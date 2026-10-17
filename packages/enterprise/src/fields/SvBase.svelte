<script lang="ts">
  /**
   * SvBase - a table database: one table with views, or several tables as
   * tabs with links between them.
   *
   * ```svelte
   * <SvBase {data} {columns} primaryField="name" bind:views editable />
   * <SvBase bind:tables editable onTablesChange={save} />
   * ```
   *
   * With `tables`, a link field from one table to another gets a field in the
   * other table that links back, and the two stay in step: linking a record
   * on one side lists it on the other, deleting records unlinks them, pointing
   * the field at another table moves the field back, and deleting either
   * field or a table removes what links to it. `onTablesChange` hands over the
   * whole list after every change, so the app can store it.
   *
   * A table with a `source` (`baseSource`) loads its records from a database
   * or an API and writes each change back (`base-sync.ts`); the end of the
   * tab bar says when it is loading, saving, or a save failed. A change made
   * in the database by someone else (another user, a script, an AI agent)
   * shows up in the page: its cells are tinted and its row marked until the
   * record is opened, and the record's activity says who changed what, from
   * the row's "last modified by" field. `onRemoteChange` hears of each one.
   */
  import { onMount, untrack } from 'svelte'
  import { toast } from '@svgrid/grid'
  import { createBaseSync, type BaseRemoteChange, type BaseSyncStatus } from './base-sync'
  import { noteRemoteChange } from './activity.svelte'
  import BaseTableView from './BaseTableView.svelte'
  import BaseTabs from './BaseTabs.svelte'
  import { registerLinkedTable, unregisterLinkedTable } from './sources.svelte'
  import { gridOf } from './grid-access'
  import { openRecord, closeRecord } from './editor-request.svelte'
  import {
    addInverse,
    blankTable,
    checkLinks,
    colId,
    copyTable,
    fieldChanged,
    newRecordId,
    primaryOf,
    removeLinkField,
    removeTable,
    rowIdOf,
    syncAllInverses,
    syncInverse,
    type BaseTable,
  } from './base-tables'
  import type { FieldView, FieldViewType } from './view-model'
  import { baseToSql } from './base-sql'
  import { createAutomationRunner, type AutomationRun, type BaseAutomation } from './automations.svelte'

  type Row = Record<string, unknown>
  // A table without views shows one grid view; one list, so it never reads as a change.
  const GRID_ONLY: FieldView[] = [{ id: 'grid', name: 'Grid view', type: 'grid' }]

  let {
    tables = $bindable<BaseTable[] | undefined>(undefined),
    activeTable = $bindable<string>(''),
    onTablesChange,
    data,
    columns,
    views = $bindable<FieldView[]>([{ id: 'grid', name: 'Grid view', type: 'grid' }]),
    activeView = $bindable<string>(''),
    onViewsChange,
    viewTypes,
    rowHeights,
    containerHeight = 560,
    onApiReady,
    serverRuns,
    automations = true,
    onRemoteChange,
    ...grid
  }: {
    /** Several tables, shown as tabs. Without it, `data` and `columns` are the one table. */
    tables?: BaseTable[]
    activeTable?: string
    onTablesChange?: (tables: BaseTable[]) => void
    data?: any[]
    columns?: any[]
    views?: FieldView[]
    activeView?: string
    onViewsChange?: (views: FieldView[]) => void
    viewTypes?: ReadonlyArray<FieldViewType>
    /** The row heights the view bar's row height menu offers. */
    rowHeights?: ReadonlyArray<{ label: string; height: number }>
    containerHeight?: number | string
    onApiReady?: (api: any) => void
    /** The server runner's latest runs, shown with this page's under Runs (an endpoint returning `server.runs`). */
    serverRuns?: () => Promise<ReadonlyArray<AutomationRun>>
    /** The view bar's Automations; false hides it (automations already set still run). */
    automations?: boolean
    /** Changes made in the database by someone else, once they are in the page (tables with a `source` that has `realtime`). */
    onRemoteChange?: (changes: BaseRemoteChange[]) => void
    [prop: string]: any
  } = $props()

  // ---- Several tables ------------------------------------------------------

  const current = $derived(tables ? (tables.find((t) => t.id === activeTable) ?? tables[0]) : undefined)
  const currentId = $derived(current?.id ?? '')
  // Raw: the fields module finds the grid by the api object itself.
  let api = $state.raw<any>(null)
  // The rows handed to the grid. They change when another table is shown, not
  // on every edit: the grid writes edits into these rows and owns the array.
  // svelte-ignore state_referenced_locally
  let gridData = $state.raw<Row[]>(current?.data ?? [])
  // svelte-ignore state_referenced_locally
  let shownId = current?.id ?? ''
  // A record to open once the table it is in has its grid (from "Open in").
  let pendingOpen: string | null = null
  // The view each table showed last ('' is its first view).
  // svelte-ignore state_referenced_locally
  let viewOf = $state<Record<string, string>>(Object.fromEntries((tables ?? []).map((t) => [t.id, ''])))

  // Another table shown: its rows go to the grid, and it remembers its view.
  $effect.pre(() => {
    const t = current
    if (!t) return
    untrack(() => {
      if (viewOf[t.id] === undefined) viewOf[t.id] = ''
      if (t.id === shownId) return
      shownId = t.id
      gridData = t.data
      if (activeTable !== t.id) activeTable = t.id
    })
  })

  const height = $derived(typeof containerHeight === 'number' ? `${containerHeight}px` : containerHeight)

  const tableOf = (id: string) => tables?.find((t) => t.id === id)

  function commit(next: BaseTable[]) {
    const before = tables
    put(next)
    // Tables with a source: what changed goes to the database.
    sync.push(next)
    linkedChanges(before, next)
  }

  /**
   * Records of other tables a change reached through a link (a task added to
   * a project lists it on the project): they changed too, so their
   * automations hear of it. The shown table's own edits are heard from the
   * grid. A link sync gives a changed record a new object, so identity tells
   * which ones moved.
   */
  function linkedChanges(prev: BaseTable[] | undefined, next: BaseTable[]) {
    if (!prev) return
    for (const t of next) {
      if (t.id === current?.id || t.id === chainWrote || !(t.automations ?? []).length) continue
      const old = prev.find((x) => x.id === t.id)
      if (!old || old.data === t.data) continue
      const byId = new Map(old.data.map((r) => [rowIdOf(old, r), r]))
      for (const r of t.data) {
        const was = byId.get(rowIdOf(t, r))
        if (!was || was === r) continue
        const fields = t.columns.filter((d) => d.field != null && JSON.stringify(was[String(d.field)] ?? null) !== JSON.stringify(r[String(d.field)] ?? null)).map((d) => colId(d))
        if (fields.length) void runner.handle({ type: 'updated', table: t.id, record: r, before: was, fields, depth: chainDepth })
      }
    }
  }

  /** The tables in the page; the shown grid takes its table's rows when they changed outside it. */
  function put(next: BaseTable[]) {
    const before = current
    tables = next
    // The shown table's rows changed outside its grid (a link pointed
    // elsewhere and its values were cleared): the grid takes the new rows.
    const after = next.find((t) => t.id === before?.id)
    if (after && before && after.data !== before.data && after.data !== liveRows()) gridData = after.data
    onTablesChange?.(next)
  }

  // ---- Tables on a database ---------------------------------------------------

  let syncState = $state<BaseSyncStatus>({ state: 'idle' })
  let savedOnce = $state(false)
  const sync = createBaseSync({
    // The shown table as its grid holds it: an edit is in its rows already.
    getTables: () => (tables ? pulled() : undefined),
    apply: put,
    onStatus: (s) => {
      if (s.state === 'saving') savedOnce = true
      syncState = s
    },
    onError: (e) => toast.error(`Could not ${e.action === 'load' ? 'load' : 'save'} ${e.table}: ${e.message}`),
    onRemoteChange: (list) => {
      for (const c of list) noteRemote(c)
      onRemoteChange?.(list)
    },
  })

  // Fields the database or the page stamps: a change to one says nothing new.
  const STAMPS = new Set(['createdTime', 'createdBy', 'lastModifiedTime', 'lastModifiedBy', 'autoNumber'])

  /** Who made a change elsewhere: the record's "last modified by" (or, when added, "created by"). */
  function authorOf(t: BaseTable, record: Row, added: boolean): string | undefined {
    const order = added ? ['createdBy', 'lastModifiedBy'] : ['lastModifiedBy']
    for (const type of order) {
      const d = t.columns.find((x) => x.fieldType === type && x.field != null)
      const v = d ? record[String(d.field)] : undefined
      if (v != null && v !== '') return String(v)
    }
    return undefined
  }

  /** A change made elsewhere goes into the record's activity, and marks it unseen. */
  function noteRemote(c: BaseRemoteChange) {
    const t = tableOf(c.table)
    if (!t || c.type === 'delete') return
    const scope = { base: baseScope, tableId: t.id }
    const by = authorOf(t, c.record, c.type === 'insert')
    if (c.type === 'insert') return noteRemoteChange(scope, c.id, { by, added: true })
    const fields = (c.fields ?? []).flatMap((f) => {
      const d = t.columns.find((x) => x.field != null && String(x.field) === f.field)
      return d && !STAMPS.has(d.fieldType) ? [{ columnId: colId(d), from: f.from, to: f.to }] : []
    })
    noteRemoteChange(scope, c.id, { by, fields })
  }
  onMount(() => {
    void sync.load()
    return () => {
      sync.dispose()
      runner.stop()
    }
  })

  // ---- Automations --------------------------------------------------------------

  // What an automation changes goes through commit, so a table with a source
  // writes it to the database like any other change.
  // How deep in a chain of automations the change being committed was made.
  let chainDepth = 0
  // The table an automation changed itself: it reports that change.
  let chainWrote: string | undefined
  // This base's own key for its records' comments and activity (`baseScope`).
  const baseScope = {}
  const runner = createAutomationRunner({
    scope: baseScope,
    getTables: () => (tables ? pulled() : undefined),
    apply: (next, depth = 0, wrote) => {
      chainDepth = depth
      chainWrote = wrote
      try {
        commit(next)
      } finally {
        chainDepth = 0
        chainWrote = undefined
      }
    },
  })
  // Scheduled automations are armed again when any table's automations change.
  $effect(() => {
    void tables?.map((t) => t.automations)
    untrack(() => runner.schedule())
  })

  // Edits to one record in one go (a paste, a fill) are one change to it.
  const touched = new Map<string, { table: string; record: Row; before: Row; fields: Set<string> }>()
  function noteUpdate(tableId: string, record: Row | undefined, columnId: string, oldValue: unknown) {
    const t = tableOf(tableId)
    if (!t || !record) return
    const key = `${tableId}:${rowIdOf(t, record)}`
    let hit = touched.get(key)
    if (!hit) {
      hit = { table: tableId, record, before: { ...record }, fields: new Set() }
      touched.set(key, hit)
      if (touched.size === 1) queueMicrotask(flushTouched)
    }
    const field = t.columns.find((d) => colId(d) === columnId)?.field
    if (field != null && !hit.fields.has(columnId)) hit.before[String(field)] = oldValue
    hit.fields.add(columnId)
  }
  function flushTouched() {
    const list = [...touched.values()]
    touched.clear()
    for (const u of list) void runner.handle({ type: 'updated', table: u.table, record: u.record, before: u.before, fields: [...u.fields] })
  }
  /** The handler of a button field, when an automation runs on it. */
  function buttonFor(tableId: string, columnId: string): ((row: Row) => void) | null {
    const on = (tableOf(tableId)?.automations ?? []).some((a) => a.enabled && a.trigger.type === 'button' && a.trigger.field === columnId)
    return on ? (row) => void runner.handle({ type: 'button', table: tableId, record: row, field: columnId }) : null
  }
  const syncLine = $derived.by(() => {
    const s = syncState
    if (!tables?.some((t) => t.source)) return null
    if (s.state === 'loading') return { text: 'Loading records…' }
    if (s.state === 'saving') return { text: 'Saving…' }
    if (s.state === 'error') return { text: `Not saved: ${s.message}`, tone: 'error' as const, title: `${s.table}: ${s.message}` }
    if (s.state === 'limited') return { text: `${s.table}: the first ${s.limit.toLocaleString()} records` }
    return savedOnce ? { text: 'All changes saved' } : null
  })

  /** The rows the shown table's grid holds now (records added, deleted). */
  function liveRows(): Row[] | undefined {
    return api ? (gridOf(api)?.internalData as Row[] | undefined) : undefined
  }

  /** The tables with the shown one's rows as its grid holds them. */
  function pulled(change: Partial<BaseTable> = {}): BaseTable[] {
    const list = tables ?? []
    const id = current?.id
    const live = liveRows()
    return list.map((t) => (t.id === id ? { ...t, ...(live ? { data: live } : {}), ...change } : t))
  }

  function switchTo(id: string) {
    if (!tables || id === current?.id) return
    commit(pulled())
    show(id)
  }

  /** Show table `id`: a new grid with its rows. */
  function show(id: string) {
    const t = tableOf(id)
    if (!t) return
    closeRecord()
    api = null
    if (viewOf[id] === undefined) viewOf[id] = ''
    shownId = id
    gridData = t.data
    activeTable = id
  }

  // ---- What the shown table's grid reports ----------------------------------

  const linkFieldOf = (t: BaseTable | undefined, id: string) => t?.columns.find((d) => colId(d) === id && d.fieldType === 'link')

  function call(name: string, e: unknown) {
    ;(current?.props?.[name] as ((e: unknown) => void) | undefined)?.(e)
    ;(grid[name] as ((e: unknown) => void) | undefined)?.(e)
  }

  const handlers = {
    onColumnAdd: (e: { column: Record<string, any>; columns: any[]; data?: Row[] }) => {
      const id = current!.id
      let next = pulled({ columns: e.columns, ...(e.data ? { data: e.data } : {}) })
      if (e.column?.fieldType === 'link') next = addInverse(next, id, colId(e.column))
      commit(next)
      call('onColumnAdd', e)
    },
    onColumnChange: (e: { column: Record<string, any>; previous?: Record<string, any>; columns: any[]; data?: Row[] }) => {
      const id = current!.id
      let next = pulled({ columns: e.columns, ...(e.data ? { data: e.data } : {}) })
      if (e.previous?.fieldType === 'link' || e.column?.fieldType === 'link') next = fieldChanged(next, id, e.previous, colId(e.column))
      commit(next)
      call('onColumnChange', e)
    },
    onColumnRemove: (e: { columnId: string; columns: any[] }) => {
      const removed = linkFieldOf(current, e.columnId)
      commit(removeLinkField(pulled({ columns: e.columns }), current!.id, removed))
      call('onColumnRemove', e)
    },
    onCellValueChange: (e: { columnId: string; row?: Row; oldValue?: unknown }) => {
      const id = current!.id
      const next = pulled()
      commit(linkFieldOf(current, e.columnId)?.fieldProps?.inverse ? syncInverse(next, id, e.columnId) : next)
      noteUpdate(id, e.row, e.columnId, e.oldValue)
      call('onCellValueChange', e)
    },
    onRowAdd: (e: { row?: Row }) => {
      const id = current!.id
      commit(syncAllInverses(pulled(), id))
      if (e?.row) void runner.handle({ type: 'created', table: id, record: e.row })
      call('onRowAdd', e)
    },
    onRowsDelete: (e: { data: Row[] }) => {
      commit(syncAllInverses(pulled({ data: e.data }), current!.id))
      call('onRowsDelete', e)
    },
  }

  // ---- Every table is a table link fields can point at ----------------------

  /** A record named `name` in table `id` (the link picker's "+ Create"). */
  function createIn(id: string, name: string): Row {
    const t = tableOf(id)!
    const row: Row = { id: newRecordId(), [primaryOf(t)]: name }
    if (id === current?.id && api) {
      api.addRow(row, 'bottom')
      commit(pulled())
    } else {
      commit(pulled().map((x) => (x.id === id ? { ...x, data: [...x.data, row] } : x)))
    }
    return row
  }

  /** Show record `rowId` in its own table, expanded. */
  function openIn(id: string, rowId: string) {
    if (id === current?.id) {
      const ctrl = api ? gridOf(api) : null
      if (ctrl) openRecord({ ctrl, rowId })
      return
    }
    pendingOpen = rowId
    switchTo(id)
  }

  // What was registered for each table: registering again only when its name or fields change.
  const registered = new Map<string, { name: string; columns: unknown; primary: string }>()
  // This base's registrations: unregistering them leaves another base's
  // table, or the app's, with the same id alone.
  const owner = {}
  onMount(() => {
    // Loaded links that will not sync (an inverse naming no field) or that disagree: said once, in the console.
    if (tables) checkLinks(tables)
    return () => {
      for (const id of registered.keys()) unregisterLinkedTable(id, owner)
    }
  })
  $effect(() => {
    const list = tables
    if (!list) return
    for (const t of list) {
      const primary = primaryOf(t)
      const seen = registered.get(t.id)
      if (seen && seen.name === t.name && seen.columns === t.columns && seen.primary === primary) continue
      registered.set(t.id, { name: t.name, columns: t.columns, primary })
      const id = t.id
      registerLinkedTable({
        id,
        name: t.name,
        // Read each time: the shown table from its grid, the others from the list.
        rows: () => (id === current?.id ? (liveRows() ?? tableOf(id)?.data ?? []) : (tableOf(id)?.data ?? [])),
        getRowId: (r) => {
          const own = tableOf(id)
          return own ? rowIdOf(own, r) : String(r.id ?? '')
        },
        primaryField: primary,
        fields: t.columns
          .filter((d) => d.field)
          .map((d) => ({ field: String(d.field), header: String(d.header ?? d.field), fieldType: d.fieldType, fieldProps: d.fieldProps })),
        create: (name) => createIn(id, name),
        open: (rowId) => openIn(id, rowId),
      }, owner)
    }
    for (const id of [...registered.keys()]) {
      if (list.some((t) => t.id === id)) continue
      registered.delete(id)
      unregisterLinkedTable(id, owner)
    }
  })

  // ---- The tabs ---------------------------------------------------------------

  function addTable() {
    const list = pulled()
    const t = blankTable(list)
    commit([...list, t])
    switchTo(t.id)
  }
  function renameTable(id: string, name: string) {
    commit(pulled().map((t) => (t.id === id ? { ...t, name } : t)))
  }
  function duplicateTable(id: string) {
    const list = pulled()
    const source = list.find((t) => t.id === id)
    if (!source) return
    const copy = copyTable(list, source)
    let next = [...list, copy]
    for (const d of copy.columns) if (d.fieldType === 'link') next = addInverse(next, copy.id, colId(d))
    commit(next)
    switchTo(copy.id)
  }
  /** The base as Postgres SQL, downloaded: tables, links, records, views and automations. */
  function exportSql() {
    const list = pulled()
    const sql = baseToSql(list, { title: list.map((t) => t.name).join(', ') })
    const url = URL.createObjectURL(new Blob([sql], { type: 'application/sql' }))
    const a = document.createElement('a')
    a.href = url
    a.download = 'base.sql'
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }
  function deleteTable(id: string) {
    const list = pulled()
    if (list.length < 2) return
    const i = list.findIndex((t) => t.id === id)
    const next = removeTable(list, id)
    const shown = id === current?.id
    commit(next)
    if (shown) show(next[Math.max(0, i - 1)]!.id)
  }

  // One table: rows keyed by their id field, as a table of `tables` is, so
  // comments, activity and an open record stay with the record when a row
  // above it is deleted. A row without an id falls back to its index; a
  // `getRowId` prop wins.
  const singleRowId = (r: Row, i: number): string =>
    grid.getRowId ? grid.getRowId(r, i) : r?.id != null && r.id !== '' ? String(r.id) : String(i)

  // Per table, not per change: an edit gives the grid no new getRowId or rowAdder.
  const gridProps = $derived.by(() => {
    const id = currentId
    if (!id) return {}
    const t = untrack(() => tableOf(id))
    if (!t) return {}
    const own = (t.props ?? {}) as Record<string, any>
    const adder = own.rowAdder ?? grid.rowAdder ?? true
    // A new record gets an id, as every record of a base has one.
    const rowAdder =
      adder === false
        ? false
        : {
            ...(typeof adder === 'object' ? adder : {}),
            defaults: () => ({ id: newRecordId(), ...(typeof adder === 'object' && typeof adder.defaults === 'function' ? adder.defaults() : {}) }),
          }
    return {
      ...grid,
      ...own,
      ...handlers,
      rowAdder,
      primaryField: primaryOf(t),
      getRowId: (r: Row) => rowIdOf(tableOf(id) ?? t, r),
      // Comments and activity are kept by base and table id, so they outlive this grid.
      baseTableId: id,
      baseScope,
      // A button field an automation runs on.
      fieldButtons: (columnId: string) => buttonFor(id, columnId),
    }
  })
</script>

{#if tables && current}
  <div class="sv-fbase-tables" style:height>
    <BaseTabs
      {tables}
      activeId={current.id}
      onSwitch={switchTo}
      onAdd={addTable}
      onRename={renameTable}
      onDuplicate={duplicateTable}
      onDelete={deleteTable}
      onExportSql={exportSql}
      status={syncLine}
    />
    <div class="sv-fbase-slot">
      {#key current.id}
        <BaseTableView
          {...gridProps}
          bare
          data={gridData}
          columns={current.columns}
          views={current.views ?? GRID_ONLY}
          bind:activeView={viewOf[current.id]}
          onViewsChange={(v: FieldView[]) => commit(pulled({ views: v }))}
          table={current}
          tables={() => pulled()}
          runner={automations ? runner : undefined}
          {serverRuns}
          onAutomationsChange={(list: BaseAutomation[]) => commit(pulled({ automations: list }))}
          onFormSubmit={(row: Row, viewId: string) => void runner.handle({ type: 'form', table: current!.id, record: row, view: viewId })}
          newRecord={() => ({ id: newRecordId() })}
          {viewTypes}
          {rowHeights}
          containerHeight="100%"
          onApiReady={(a: any) => {
            api = a
            onApiReady?.(a)
            const rowId = pendingOpen
            pendingOpen = null
            if (rowId) queueMicrotask(() => {
              const ctrl = gridOf(a)
              if (ctrl) openRecord({ ctrl, rowId })
            })
          }}
        />
      {/key}
    </div>
  </div>
{:else}
  <BaseTableView {...grid} getRowId={singleRowId} data={data ?? []} columns={columns ?? []} bind:views bind:activeView {onViewsChange} {viewTypes} {rowHeights} {containerHeight} {onApiReady} />
{/if}

<style>
  .sv-fbase-tables {
    display: flex; flex-direction: column; min-height: 0; box-sizing: border-box; overflow: hidden;
    border: 1px solid var(--sg-border, #e2e8f0); border-radius: var(--sg-radius-lg, 10px); background: var(--sg-bg, #fff);
  }
  .sv-fbase-slot { flex: 1 1 auto; min-height: 0; }
</style>
