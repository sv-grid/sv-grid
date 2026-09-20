<!-- Documented in: docs/help/server/server-editing.md -->
<script lang="ts">
  /**
   * 482. Server row model: CRUD
   * ---------------------------
   * The four writes over a grouped server row model, against a backend that
   * says no. A new order goes in through the form under the focused region
   * and lands as a transaction; an inline edit is one `updateRow` carrying
   * the row's version, so an edit that lost a race is refused with a
   * conflict; a delete of a shipped order is refused; a delete that went
   * through can be undone. `saving` shows while a write is out. Optimistic
   * mode shows the edit before the server answers and puts the row back
   * when it refuses; the slow-server switch makes the difference visible.
   * The log is what the server received and what it said.
   *
   * The row model is Enterprise; the datasource contract the reference
   * in-memory source implements is free.
   */
  import { SvGrid, renderComponent, tableFeatures, rowSortingFeature, columnFilteringFeature, type GridColumns } from '@svgrid/grid'
  import {
    setLicenseKey,
    installEnterprise,
    createInMemoryDataSource,
    createServerRowModel,
    serverGroupText,
    SvGroupCell,
    SvGridEditPanel,
    type EntitySchema,
    type ServerRowModel,
    type ServerRowModelState,
    type ServerRowModelGridRow,
  } from '@svgrid/enterprise'
  import { createPrng } from '../shared/mock-api'

  setLicenseKey('SVENTERPRISE-DEV-LOCAL')

  const features = tableFeatures({ rowSortingFeature, columnFilteringFeature })

  // ---- The server ----------------------------------------------------------
  type Status = 'draft' | 'confirmed' | 'shipped' | 'cancelled'
  type Order = {
    id: number
    region: string
    customer: string
    product: string
    qty: number
    unitPrice: number
    amount: number
    status: Status
    updatedAt: string
    version: number
  }
  const REGIONS = ['EMEA', 'AMER', 'APAC']
  const CUSTOMERS = ['Acme', 'Globex', 'Initech', 'Umbrella', 'Hooli', 'Vandelay', 'Stark', 'Wayne', 'Tyrell', 'Wonka']
  const PRODUCTS = ['Bolt M8', 'Bracket L', 'Hinge 40', 'Panel 2x1', 'Rail 900', 'Clamp S']
  const STATUSES: Status[] = ['draft', 'confirmed', 'confirmed', 'shipped', 'cancelled']
  const rng = createPrng(0xc47d)
  const DAY = 86_400_000
  const stamp = (daysAgo: number) => new Date(Date.now() - daysAgo * DAY).toISOString().slice(0, 16).replace('T', ' ')
  let nextId = 1
  const DB: Order[] = Array.from({ length: 3_000 }, () => {
    const qty = rng.int(1, 40)
    const unitPrice = rng.int(4, 120)
    return {
      id: nextId++,
      region: rng.pick(REGIONS),
      customer: rng.pick(CUSTOMERS),
      product: rng.pick(PRODUCTS),
      qty,
      unitPrice,
      amount: qty * unitPrice,
      status: rng.pick(STATUSES),
      updatedAt: stamp(rng.int(1, 120)),
      version: 1,
    }
  })
  const schema: EntitySchema<Order> = {
    name: 'order',
    label: 'order',
    fields: [
      { field: 'id', type: 'number', primaryKey: true, readonly: true, hidden: { form: true } },
      { field: 'region', type: 'enum', label: 'Region', required: true, options: REGIONS.map((r) => ({ value: r, label: r })) },
      { field: 'customer', type: 'text', label: 'Customer', required: true, minLength: 2 },
      { field: 'product', type: 'enum', label: 'Product', required: true, options: PRODUCTS.map((p) => ({ value: p, label: p })) },
      { field: 'qty', type: 'number', label: 'Quantity', required: true, min: 1 },
      { field: 'unitPrice', type: 'number', label: 'Unit price', required: true, min: 0 },
      { field: 'status', type: 'enum', label: 'Status', options: (['draft', 'confirmed', 'shipped', 'cancelled'] as Status[]).map((s) => ({ value: s, label: s })) },
      { field: 'amount', type: 'number', readonly: true, hidden: { form: true } },
      { field: 'updatedAt', type: 'text', readonly: true, hidden: { form: true } },
      { field: 'version', type: 'number', readonly: true, hidden: { form: true } },
    ],
  }

  // The reference backend, with the rules a real one has: input checked
  // again on the server, a version on every row so a lost race is refused,
  // and a business rule (shipped orders are not deleted).
  const memory = createInMemoryDataSource(DB, schema)
  let requests = $state(0)
  let slow = $state(false)
  const latency = () => new Promise((r) => setTimeout(r, slow ? 900 : 150))
  function check(input: Partial<Order>) {
    if (input.customer !== undefined && String(input.customer).trim().length < 2) throw new Error('customer: at least two characters')
    if (input.qty !== undefined && (!Number.isInteger(Number(input.qty)) || Number(input.qty) < 1)) throw new Error('qty: a whole number of at least 1')
    if (input.unitPrice !== undefined && Number(input.unitPrice) < 0) throw new Error('unitPrice: cannot be negative')
    if (input.region !== undefined && !REGIONS.includes(String(input.region))) throw new Error(`region: one of ${REGIONS.join(', ')}`)
  }
  const source: typeof memory = {
    ...memory,
    async getRows(req) {
      requests += 1
      await latency()
      return memory.getRows(req)
    },
    async createRow(input) {
      await latency()
      check(input)
      const qty = Number(input.qty)
      const unitPrice = Number(input.unitPrice)
      return memory.createRow({
        ...input,
        // An undo brings a row back under its own id.
        id: input.id ?? nextId++,
        qty,
        unitPrice,
        amount: qty * unitPrice,
        status: (input.status as Status) || 'draft',
        updatedAt: stamp(0),
        version: 1,
      })
    },
    async updateRow(id, patch) {
      await latency()
      const current = memory.rows().find((r) => String(r.id) === id)
      if (!current) throw new Error(`order ${id} no longer exists`)
      const { version, ...changes } = patch
      if (version !== undefined && version !== current.version) {
        throw new Error(`order ${id} was changed by someone else (now version ${current.version}); reload the group and try again`)
      }
      const changed = (Object.keys(changes) as Array<keyof typeof changes>).filter((k) => changes[k] !== current[k])
      if (current.status === 'cancelled' && changed.some((k) => k !== 'status')) {
        throw new Error(`order ${id} is cancelled and read-only`)
      }
      check(changes)
      const qty = Number(changes.qty ?? current.qty)
      const unitPrice = Number(changes.unitPrice ?? current.unitPrice)
      return memory.updateRow(id, { ...changes, qty, unitPrice, amount: qty * unitPrice, updatedAt: stamp(0), version: current.version + 1 })
    },
    async deleteRow(id) {
      await latency()
      const current = memory.rows().find((r) => String(r.id) === id)
      if (current?.status === 'shipped') throw new Error(`order ${id} has shipped and cannot be deleted; cancel it instead`)
      return memory.deleteRow(id)
    },
  }
  // Another user saves the row: its version moves on, so the next edit
  // carrying the old version is refused.
  async function someoneElseEdits(id: string) {
    const current = memory.rows().find((r) => String(r.id) === id)
    if (!current) return
    await memory.updateRow(id, { qty: current.qty + 1, amount: (current.qty + 1) * current.unitPrice, updatedAt: stamp(0), version: current.version + 1 })
  }

  // ---- The model ---------------------------------------------------------
  type Row = ServerRowModelGridRow<Order>
  let optimistic = $state(false)
  let view = $state<ServerRowModelState<Order>>()
  let ctl = $state.raw<ServerRowModel<Order>>(makeModel())
  function makeModel(previous?: ServerRowModel<Order>) {
    const carried = previous?.getState()
    const model = createServerRowModel<Order>(source, {
      groupBy: ['region'],
      aggregations: [
        { col: 'amount', fn: 'sum' },
        { col: 'id', fn: 'count' },
      ],
      childCount: (r) => (r as { childCount?: number }).childCount,
      grandTotalRow: 'pinnedBottom',
      isGroupOpenByDefault: () => true,
      getRowId: (r) => String(r.id),
      optimistic,
      blockSize: 100,
      skeletonRows: 4,
      filterValues: async (columnId) => [...new Set(memory.rows().map((r) => String(r[columnId as keyof Order])))].sort(),
      onChange: (s) => (view = s),
    })
    if (carried) {
      if (carried.sortModel.length) model.setSort(carried.sortModel)
      if (Object.keys(carried.filterModel.columns ?? {}).length || carried.filterModel.global) model.setFilter(carried.filterModel)
    }
    model.refresh()
    for (const key of carried?.expandedGroups ?? []) model.expandGroup(JSON.parse(key) as string[])
    return model
  }
  // The grid stays mounted; it re-subscribes when the model changes.
  function setOptimistic(next: boolean) {
    if (next === optimistic) return
    optimistic = next
    const previous = ctl
    ctl = makeModel(previous)
    previous.dispose()
  }
  $effect(() => () => ctl.dispose())

  // ---- The log --------------------------------------------------------------
  type Entry = { seq: number; kind: string; id: string; ok: boolean; detail: string; ms: number }
  let log = $state<Entry[]>([])
  let logSeq = 0
  let lastError = $state('')
  function note(kind: string, id: string, ok: boolean, detail: string, started: number) {
    log = [{ seq: logSeq++, kind, id, ok, detail, ms: Math.round(performance.now() - started) }, ...log].slice(0, 40)
    lastError = ok ? '' : detail
  }
  const message = (err: unknown) => (err instanceof Error ? err.message : String(err))

  // ---- The focused row --------------------------------------------------------
  let focused = $state<Row | null>(null)
  const focusRow = (rowIndex: number) => {
    const row = ctl.getRows()[rowIndex] as Row | undefined
    focused = row && row.__group && row.__group.kind !== 'placeholder' ? row : null
  }
  const focusedOrder = $derived(focused?.__group.kind === 'leaf' ? (focused as unknown as Order) : null)
  const focusedRegion = $derived.by(() => {
    const m = focused?.__group
    if (m?.kind === 'group') return m.key
    if (m?.kind === 'leaf') return m.route?.[0] ?? null
    return null
  })
  // The live row for the focused id: the focused snapshot goes stale after a write.
  const liveFocused = $derived.by(() => {
    void view
    if (!focusedOrder) return null
    return (ctl.getRows() as Row[]).find((r) => r.__group?.kind === 'leaf' && String(r.id) === String(focusedOrder.id)) as unknown as Order | null
  })

  // ---- The writes ---------------------------------------------------------------
  const busy = $derived(view?.saving ?? false)
  async function onEdit(e: { row: Row; columnId: string; newValue: unknown; oldValue: unknown }) {
    const meta = e.row.__group
    if (meta.kind !== 'leaf' || Object.is(e.newValue, e.oldValue)) return
    const id = String(e.row.id)
    const started = performance.now()
    try {
      // The version the row was read at rides along, so a lost race is refused.
      await ctl.updateRow(id, { [e.columnId]: e.newValue, version: (e.row as unknown as Order).version } as Partial<Order>)
      note('update', id, true, `${e.columnId}: ${String(e.oldValue)} -> ${String(e.newValue)}`, started)
      if (e.columnId === 'qty' || e.columnId === 'unitPrice') ctl.refresh({ route: [] })
    } catch (err) {
      note('update', id, false, message(err), started)
    }
  }
  let editing = $state<Order | null | undefined>(undefined)
  // Create mode seeds the region from the focused group.
  const formSchema = $derived<EntitySchema<Order>>({
    ...schema,
    fields: schema.fields.map((f) => (f.field === 'region' ? { ...f, defaultValue: focusedRegion ?? 'EMEA' } : f)),
  })
  async function save({ mode, id, values }: { mode: 'create' | 'edit'; id: string | null; values: Partial<Order> }) {
    const started = performance.now()
    if (mode === 'create') {
      try {
        // At the top of its region, where it can be seen; the default is the end.
        const row = await ctl.createRow(values, [String(values.region)], 0)
        note('create', String(row.id), true, `${row.customer}, ${row.qty} x ${row.product} under ${row.region}`, started)
        ctl.refresh({ route: [] })
      } catch (err) {
        note('create', '-', false, message(err), started)
        throw err // the form shows it
      }
    } else if (id) {
      try {
        await ctl.updateRow(id, { ...values, version: liveFocused?.version ?? editing?.version })
        note('update', id, true, 'from the form', started)
        ctl.refresh({ route: [] })
      } catch (err) {
        note('update', id, false, message(err), started)
        throw err
      }
    }
    editing = undefined
  }
  let undo = $state<{ row: Order; route: string[]; index: number } | null>(null)
  // Where a row sits in its level: its distance from the group row above it
  // in the flattened list, so an undo can put it back in the same place.
  function indexInLevel(id: string, route: string[]): number {
    const rows = ctl.getRows() as Row[]
    const at = rows.findIndex((r) => r.__group?.kind === 'leaf' && String(r.id) === id)
    if (at < 0) return 0
    let head = at - 1
    while (head >= 0 && !(rows[head]!.__group?.kind === 'group' && JSON.stringify((rows[head]!.__group as { path?: string[] }).path) === JSON.stringify(route))) head -= 1
    return head < 0 ? 0 : at - head - 1
  }
  async function remove() {
    const row = liveFocused
    if (!row) return
    const id = String(row.id)
    const index = indexInLevel(id, [row.region])
    const started = performance.now()
    try {
      await ctl.deleteRow(id)
      note('delete', id, true, `${row.customer}, ${row.qty} x ${row.product}`, started)
      undo = { row, route: [row.region], index }
      focused = null
      ctl.refresh({ route: [] })
    } catch (err) {
      note('delete', id, false, message(err), started)
    }
  }
  async function undoDelete() {
    const u = undo
    if (!u) return
    undo = null
    const started = performance.now()
    try {
      // The same row, same id, back under its region where it was.
      await ctl.createRow(u.row, u.route, u.index)
      note('undo', String(u.row.id), true, 'row restored', started)
      ctl.refresh({ route: [] })
    } catch (err) {
      note('undo', String(u.row.id), false, message(err), started)
    }
  }
  async function conflict() {
    const row = liveFocused
    if (!row) return
    await someoneElseEdits(String(row.id))
    note('other user', String(row.id), true, `saved version ${row.version + 1} behind your back; edit the row now`, performance.now())
  }
  function reloadGroup() {
    const route = focusedRegion ? [focusedRegion] : []
    ctl.refresh({ route })
    note('reload', focusedRegion ?? 'top level', true, 're-read in place', performance.now())
  }

  // ---- Columns --------------------------------------------------------------
  const usd = { type: 'number' as const, options: { style: 'currency' as const, currency: 'USD', maximumFractionDigits: 0 } }
  const isLeaf = (row: { original: Row } | null | undefined) => row?.original.__group?.kind === 'leaf'
  const leafOnly = (ctx: { row: { original: Row } }) => isLeaf(ctx.row)
  const columns: GridColumns<Row> = [
    {
      id: 'region',
      header: 'Region / Order',
      width: 190,
      sortable: false,
      filterable: false,
      fieldFn: (row) => serverGroupText(row, 'id'),
      cell: (ctx) =>
        renderComponent(SvGroupCell, {
          row: ctx.row.original,
          onToggle: () => ctl.group.onToggle(ctx.row.original),
          leafField: 'id',
        }),
    },
    { field: 'customer', header: 'Customer', width: 120, editable: leafOnly },
    { field: 'product', header: 'Product', width: 110, editable: leafOnly, editorType: 'select', editorOptions: PRODUCTS },
    { field: 'qty', header: 'Qty', width: 70, align: 'right', editable: leafOnly, editorType: 'number' },
    { field: 'unitPrice', header: 'Unit price', width: 100, align: 'right', format: usd, editable: leafOnly, editorType: 'number' },
    { field: 'amount', header: 'Amount', width: 110, align: 'right', format: usd, editable: false },
    { field: 'status', header: 'Status', width: 100, editable: leafOnly, editorType: 'select', editorOptions: ['draft', 'confirmed', 'shipped', 'cancelled'] },
    { field: 'version', header: 'v', width: 50, align: 'right', editable: false, formatter: ({ value, row }) => (row && isLeaf(row) ? String(value) : '') },
    { field: 'updatedAt', header: 'Updated', width: 130, editable: false, formatter: ({ value, row }) => (row && isLeaf(row) ? String(value) : '') },
  ]
  const orders = $derived(Number(view?.grandTotal?.id ?? 0))
</script>

<section class="wrap demo-kit">
  <header class="chrome">
    <div class="opt">
      <span class="opt-label">Writes</span>
      <div class="seg writes-seg" role="group" aria-label="Write mode">
        <button type="button" class:is-on={!optimistic} aria-pressed={!optimistic} onclick={() => setOptimistic(false)} title="The cell changes once the server has answered">wait for the server</button>
        <button type="button" class:is-on={optimistic} aria-pressed={optimistic} onclick={() => setOptimistic(true)} title="The cell changes at once; a refusal puts it back">optimistic</button>
      </div>
    </div>
    <label class="chk"><input type="checkbox" bind:checked={slow} /> Slow server (900 ms)</label>
    <div class="actions">
      <button type="button" class="btn" disabled={busy} onclick={() => (editing = null)} title="A form; the order goes under the focused region">New order</button>
      <button type="button" class="btn" disabled={!liveFocused || busy} onclick={() => (editing = liveFocused)} title="The focused order in the form">Edit</button>
      <button type="button" class="btn btn-danger" disabled={!liveFocused || busy} onclick={remove} title="deleteRow; a shipped order is refused">Delete</button>
      <button type="button" class="btn" disabled={!liveFocused || busy} onclick={conflict} title="Another user saves the focused row on the server, so your next edit of it is refused">Someone else edits</button>
      <button type="button" class="btn" onclick={reloadGroup} title="Re-read the focused region in place (refresh by route)">Reload group</button>
    </div>
    <span class="note">
      Click a row, then edit a cell, or use the buttons. The server refuses a quantity under 1, an edit
      of a cancelled order, a delete of a shipped one, and an edit that lost a race (press "Someone else
      edits", then change a cell of that row). Switch to optimistic and slow to see the row change and
      snap back.
    </span>
  </header>
  <div class="body">
    <div class="gridpane">
      <SvGrid
        responsive={true}
        columnResize
        rowModel={ctl}
        stickyGroupRows
        {columns}
        {features}
        sortable
        filterable
        filterMode="menu"
        editable
        selectionMode="none"
        rowHeight={32}
        containerHeight="100%"
        onCellValueChange={onEdit}
        onActiveCellChange={(cell) => focusRow(cell.rowIndex)}
        onApiReady={(next) => installEnterprise(next)}
      />
    </div>
    <aside class="log" aria-label="Write log">
      <div class="log-head">Writes <span class="muted">newest first</span></div>
      {#each log as e (e.seq)}
        <div class="log-row" class:is-bad={!e.ok}>
          <span class="log-kind">{e.kind}</span>
          <span class="log-id">#{e.id}</span>
          <span class="log-status">{e.ok ? 'ok' : 'refused'}</span>
          <span class="log-detail" title={`${e.ms} ms: ${e.detail}`}>{e.detail}</span>
        </div>
      {/each}
      {#if !log.length}<div class="muted log-empty">No writes yet. Edit a cell or add an order.</div>{/if}
    </aside>
  </div>
  <footer class="foot">
    <span class="stat"><span class="stat-label">Orders</span><strong>{orders.toLocaleString()}</strong></span>
    <span class="stat"><span class="stat-label">Loaded</span><strong>{(view?.gridRows.filter((r) => r.__group?.kind === 'leaf').length ?? 0).toLocaleString()}</strong></span>
    <span class="stat"><span class="stat-label">Requests</span><strong>{requests}</strong></span>
    <span class="stat" data-stat="saving"><span class="stat-label">Saving</span><strong>{busy ? 'yes' : 'no'}</strong></span>
    {#if lastError}<span class="stat err" role="alert">{lastError}</span>{/if}
    {#if undo}<span class="stat last">Order #{undo.row.id} deleted. <button type="button" class="link" onclick={undoDelete}>Undo</button></span>{/if}
    {#if view?.error}<span class="stat err">{message(view.error)}</span>{/if}
  </footer>
</section>

{#if editing !== undefined}
  <SvGridEditPanel schema={formSchema} row={editing} presentation="modal" formSize="sm" onSubmit={save} onCancel={() => (editing = undefined)} />
{/if}

<style>
  /* Only what is particular to this demo; the chrome is the shared demo-kit. */
  .log-row { grid-template-columns: 62px 48px 50px 1fr; }
  .log-row.is-bad .log-status { color: var(--sg-danger, #b91c1c); font-weight: 600; }
  .log-id { color: var(--sg-muted, #64748b); }
  .log-status { font-size: 11px; }
  .log-detail { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--sg-muted, #64748b); }
  .link {
    border: 0;
    background: none;
    padding: 0;
    font: inherit;
    color: var(--sg-accent, #2563eb);
    text-decoration: underline;
    cursor: pointer;
  }
</style>
