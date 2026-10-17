<script lang="ts">
  /**
   * One table of a base: the view bar over a `<SvGrid>`, and the form view
   * beside it. Grid, Kanban, calendar, Gantt and gallery views are the grid
   * itself in another mode (`board`, `scheduler`, `gantt`, `gallery`); a form
   * view asks for the same fields. Every prop it does not name goes to the
   * grid. `<SvBase>` draws one, under its table tabs when it has several.
   *
   * With a `runner`, the view bar has the table's Automations; an
   * automation's "Color the record" action paints the grid while a record
   * matches its condition.
   *
   * A record someone else changed (read from the database, `base-sync.ts`)
   * has the cells that moved tinted, and a record added elsewhere the whole
   * row, until the record is opened.
   */
  import { SvGrid, hasGanttView } from '@svgrid/grid'
  import SvBaseViewBar from './SvBaseViewBar.svelte'
  import SvBaseForm from './SvBaseForm.svelte'
  import BaseChartView from './BaseChartView.svelte'
  import BaseAutomations from './BaseAutomations.svelte'
  import { gridOf } from './grid-access'
  import { markAllSeen, unseenIn } from './activity.svelte'
  import { findFieldUser } from './sources.svelte'
  import { fieldCopyText } from './copy-text'
  import { recordMenu } from './record-menu'
  import { matches, type AutomationRun, type AutomationRunner, type BaseAutomation } from './automations.svelte'
  import type { BaseTable } from './base-tables'
  import type { FieldView, FieldViewType } from './view-model'

  let {
    data,
    columns,
    views = $bindable<FieldView[]>([{ id: 'grid', name: 'Grid view', type: 'grid' }]),
    activeView = $bindable<string>(''),
    onViewsChange,
    viewTypes,
    rowHeights,
    containerHeight = 560,
    onApiReady,
    bare = false,
    table,
    tables,
    runner,
    serverRuns,
    onAutomationsChange,
    onFormSubmit,
    newRecord,
    ...grid
  }: {
    /** The grid's rows and columns. */
    data: any[]
    columns: any[]
    views?: FieldView[]
    activeView?: string
    onViewsChange?: (views: FieldView[]) => void
    viewTypes?: ReadonlyArray<FieldViewType>
    /** The row heights the view bar's row height menu offers. */
    rowHeights?: ReadonlyArray<{ label: string; height: number }>
    containerHeight?: number | string
    onApiReady?: (api: any) => void
    /** No border of its own: it sits under the table tabs, inside their frame. */
    bare?: boolean
    /** The table shown, with its automations (from `<SvBase tables>`). */
    table?: BaseTable
    /** Every table of the base, for the automations that create records. */
    tables?: () => BaseTable[]
    /** Runs the base's automations; without it there is no Automations button. */
    runner?: AutomationRunner
    serverRuns?: () => Promise<ReadonlyArray<AutomationRun>>
    onAutomationsChange?: (automations: BaseAutomation[]) => void
    /** A form view sent a record. A Promise keeps the form busy until it settles; a rejection shows its message. */
    onFormSubmit?: (row: Record<string, unknown>, viewId: string) => void | Promise<unknown>
    /** Values a record from a form view starts with (`<SvBase tables>` gives an id). */
    newRecord?: () => Record<string, unknown>
    [prop: string]: any
  } = $props()

  // Raw: a proxied api is another object, and the view bar finds the grid by the api itself.
  let api = $state.raw<any>(null)
  // Right-click on a record: expand, insert, duplicate, copy, paste, delete. The app's own `contextMenu` wins.
  const menu = recordMenu(() => api, () => (api ? gridOf(api) : undefined))
  const view = $derived(views.find((v) => v.id === activeView) ?? views[0])
  const type = $derived(view?.type ?? 'grid')
  // A form or a chart draws over the grid, which stays mounted: it holds the
  // records, the filter and the api they read.
  const besideGrid = $derived(type === 'form' || type === 'chart')
  // Gantt only once the app has turned it on.
  const types = $derived(viewTypes ?? (['grid', 'kanban', 'calendar', ...(hasGanttView() ? ['gantt'] : []), 'gallery', 'chart', 'form'] as FieldViewType[]))
  const height = $derived(typeof containerHeight === 'number' ? `${containerHeight}px` : containerHeight)

  // ---- Automations ----------------------------------------------------------
  let automationsOpen = $state(false)
  const automationList = $derived(table?.automations ?? [])
  // "Color the record": a format per action, drawn while the record matches.
  const highlightFormats = $derived.by(() => {
    const t = table
    if (!t) return []
    const out: any[] = []
    for (const a of automationList) {
      if (!a.enabled || !a.condition) continue
      for (const action of a.actions) {
        if (action.type !== 'highlight') continue
        out.push({
          type: 'rule',
          ...(action.fields?.length ? { columns: action.fields } : {}),
          when: ({ row }: { row: Record<string, unknown> }) => matches(t, a.condition, row),
          background: action.background,
          ...(action.color ? { color: action.color } : {}),
        })
      }
    }
    return out
  })
  // ---- Changes made elsewhere ------------------------------------------------
  const UNSEEN = 'color-mix(in srgb, var(--sg-accent, #2563eb) 20%, transparent)'
  // A format per changed column, drawn on the records that changed it and are not seen yet.
  const unseenFormats = $derived.by(() => {
    const tableId = grid.baseTableId
    const getRowId = grid.getRowId
    if (typeof tableId !== 'string' || !tableId || typeof getRowId !== 'function') return []
    const marks = unseenIn({ base: grid.baseScope, tableId })
    if (!marks.size) return []
    const idOf = (row: Record<string, unknown>) => String(getRowId(row, 0))
    const columns = new Set<string>()
    let added = false
    for (const m of marks.values()) {
      if (m.added) added = true
      for (const c of m.columns) columns.add(c)
    }
    const out: any[] = []
    if (added) out.push({ type: 'rule', when: ({ row }: { row: Record<string, unknown> }) => !!marks.get(idOf(row))?.added, background: UNSEEN })
    for (const c of columns) out.push({ type: 'rule', columns: [c], when: ({ row }: { row: Record<string, unknown> }) => !!marks.get(idOf(row))?.columns.has(c), background: UNSEEN })
    return out
  })
  // The view bar's "3 changed by Ana" chip: one name when one person made them all.
  const changed = $derived.by(() => {
    const tableId = grid.baseTableId
    if (typeof tableId !== 'string' || !tableId) return null
    const scope = { base: grid.baseScope, tableId }
    const marks = unseenIn(scope)
    if (!marks.size) return null
    const authors = new Set([...marks.values()].map((m) => m.by ?? ''))
    const only = authors.size === 1 ? [...authors][0] : ''
    const who = only ? (findFieldUser(only)?.name ?? 'someone else') : authors.size === 1 ? 'someone else' : 'others'
    return { label: `${marks.size} changed by ${who}`, onSeen: () => markAllSeen(scope) }
  })
  const conditionalFormats = $derived(
    highlightFormats.length || unseenFormats.length ? [...((grid.conditionalFormats as any[]) ?? []), ...highlightFormats, ...unseenFormats] : grid.conditionalFormats,
  )
</script>

<div class="sv-fbase" class:is-bare={bare} style:height>
  {#if api}
    <SvBaseViewBar
      {api}
      bind:views
      bind:activeView
      {onViewsChange}
      viewTypes={types}
      {rowHeights}
      automations={runner && table ? { count: automationList.length, onManage: () => (automationsOpen = true) } : null}
      {changed}
    />
  {/if}
  <div class="sv-fbase-body">
    <!-- The grid stays mounted under a form: it holds the api the form adds rows through. -->
    <div class="sv-fbase-grid" class:is-hidden={besideGrid}>
      <SvGrid
        {...grid}
        {data}
        {columns}
        {conditionalFormats}
        contextMenu={grid.contextMenu ?? menu}
        processCellForClipboard={grid.processCellForClipboard ?? fieldCopyText}
        containerHeight="100%"
        onApiReady={(a: any) => {
          api = a
          onApiReady?.(a)
        }}
      />
    </div>
    {#if api && type === 'chart'}
      <BaseChartView {api} setting={view?.chart} />
    {/if}
    {#if api && type === 'form'}
      <!-- One form per view: another form view starts with its own empty fields. -->
      {#key view?.id}
        <SvBaseForm
          {api}
          fields={view?.formFields}
          required={view?.formRequired}
          title={view?.formTitle ?? view?.name}
          description={view?.formDescription}
          submitLabel={view?.formSubmitLabel}
          defaults={newRecord}
          onSubmit={(row) => (view ? onFormSubmit?.(row, view.id) : undefined)}
        />
      {/key}
    {/if}
  </div>
  {#if runner && table && api && automationsOpen}
    <BaseAutomations
      bind:open={automationsOpen}
      {table}
      tables={tables?.() ?? [table]}
      ctrl={gridOf(api)}
      {views}
      {runner}
      {serverRuns}
      onChange={(list) => onAutomationsChange?.(list)}
    />
  {/if}
</div>

<style>
  .sv-fbase {
    display: flex; flex-direction: column; min-height: 0; box-sizing: border-box;
    border: 1px solid var(--sg-border, #e2e8f0); border-radius: var(--sg-radius-lg, 10px); overflow: hidden;
    background: var(--sg-bg, #fff);
  }
  .sv-fbase.is-bare { border: 0; border-radius: 0; }
  .sv-fbase-body { position: relative; flex: 1 1 auto; min-height: 0; }
  .sv-fbase-grid { height: 100%; }
  .sv-fbase-grid.is-hidden { visibility: hidden; position: absolute; inset: 0; pointer-events: none; }
  .sv-fbase-body > :global(.sv-fform-wrap) { position: absolute; inset: 0; }
</style>
