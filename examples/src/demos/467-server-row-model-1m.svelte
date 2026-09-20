<!-- Documented in: docs/help/server/server-row-model.md -->
<script lang="ts">
  /**
   * 467. Server-Side Row Model: 1,000,000 rows
   * -------------------------------------------
   * One grid, one `rowModel` prop, a million rows that stay on the "server".
   * Sorting, filtering, the global search, grouping to any depth, paging or
   * infinite scroll, inline edits, adds and deletes, select-all across rows
   * the grid never loaded, and a bulk edit by rule - every one of them is a
   * request to the columnar warehouse in `shared/server-warehouse.ts`, and
   * the log on the right shows each request as it happens.
   *
   * The row model and its chrome are Enterprise; the datasource contract the
   * warehouse implements is free in @svgrid/grid.
   */
  import {
    SvGrid,
    renderComponent,
    tableFeatures,
    rowSortingFeature,
    columnFilteringFeature,
    rowSelectionFeature,
    type GridColumns,
    type SvGridApi,
  } from '@svgrid/grid'
  import {
    setLicenseKey,
    installEnterprise,
    compilePredicate,
    createServerRowModel,
    serverGroupText,
    SvGroupCell,
    SvRowGroupPanel,
    type ServerRowModel,
    type ServerRowModelState,
    type ServerRowModelGridRow,
  } from '@svgrid/enterprise'
  import { createWarehouse, type WarehouseLogEntry, type WarehouseRow } from '../shared/server-warehouse'
  import BlockMap from '../shared/BlockMap.svelte'

  setLicenseKey('SVENTERPRISE-DEV-LOCAL')

  const features = tableFeatures({ rowSortingFeature, columnFilteringFeature, rowSelectionFeature })

  // ---- The server ----------------------------------------------------------
  // Built once, on load. `compilePredicate` makes the advanced filter's
  // expression run on the "server" too, as the contract asks.
  const ROWS = 1_000_000
  let log = $state<WarehouseLogEntry[]>([])
  const warehouse = createWarehouse({
    rows: ROWS,
    latencyMs: [40, 120],
    compileExpression: (expr) =>
      compilePredicate<WarehouseRow>(expr, { getValue: (row, id) => (row as Record<string, unknown>)[id], rows: [] }),
    onRequest: (entry) => {
      log = [entry, ...log].slice(0, 30)
    },
  })

  // ---- The model ---------------------------------------------------------
  type Mode = 'infinite' | 'paged'
  type Row = ServerRowModelGridRow<WarehouseRow>
  let mode = $state<Mode>('infinite')
  let view = $state<ServerRowModelState<WarehouseRow>>()
  let groupBy = $state<string[]>(['region', 'country'])
  let loadError = $state<string | null>(null)

  function makeModel(m: Mode, groups: string[]): ServerRowModel<WarehouseRow> {
    const model = createServerRowModel<WarehouseRow>(warehouse, {
      groupBy: groups,
      // The count rides on the grand total; it is what makes "1,000,000
      // selected" a number the model can stand behind.
      aggregations: [
        { col: 'amount', fn: 'sum' },
        { col: 'qty', fn: 'sum' },
        { col: 'id', fn: 'count' },
      ],
      getRowId: (r) => String(r.id),
      childCount: (r) => (r as { childCount?: number }).childCount,
      grandTotalRow: 'pinnedBottom',
      groupFooters: false,
      blockSize: 100,
      maxBlocksInCache: 24,
      skeletonRows: 6,
      selection: { groupSelects: 'descendants' },
      pagination: m === 'paged' ? { pageSize: 100, pageSizes: [50, 100, 250] } : undefined,
      // The first region and its first country open on load, so the level
      // cascade and the leaf blocks are on screen before the first click.
      isGroupOpenByDefault: (route) => route[0] === 'Americas' && (route.length === 1 || (route.length === 2 && route[1] === 'United States')),
      // Flat, the root claims its million rows up front, so a jump to row
      // 900,000 works before the first block has even landed.
      levelParams: (level) => (level === 0 && groupBy.length === 0 ? { initialRowCount: ROWS } : {}),
      onLoadError: (route, err) => (loadError = `${route.length ? route.join(' > ') : 'top level'}: ${(err as Error).message}`),
      onChange: (s) => {
        view = s
        if (!s.error) loadError = null
      },
    })
    model.refresh()
    return model
  }
  let ctl = $state.raw(makeModel('infinite', groupBy))
  $effect(() => () => ctl.dispose())
  function setMode(next: Mode) {
    if (next === mode) return
    ctl.dispose()
    mode = next
    search = ''
    ctl = makeModel(next, groupBy)
  }
  function setGroupBy(next: string[]) {
    groupBy = next
    ctl.setGroupBy(next)
  }
  const GROUP_PRESETS: Array<{ label: string; groups: string[] }> = [
    { label: 'Flat', groups: [] },
    { label: 'Region', groups: ['region'] },
    { label: '+ Country', groups: ['region', 'country'] },
    { label: '+ Rep', groups: ['region', 'country', 'rep'] },
  ]
  const isPreset = (p: { groups: string[] }) => p.groups.length === groupBy.length && p.groups.every((g, i) => g === groupBy[i])
  const groupCols = [
    { id: 'region', label: 'Region' },
    { id: 'country', label: 'Country' },
    { id: 'rep', label: 'Rep' },
    { id: 'product', label: 'Product' },
    { id: 'category', label: 'Category' },
    { id: 'status', label: 'Status' },
    { id: 'year', label: 'Year' },
    { id: 'quarter', label: 'Quarter' },
  ]

  // ---- Chrome switches ----------------------------------------------------
  let slow = $state(false)
  let failures = $state(false)
  $effect(() => warehouse.setLatency(slow ? [600, 1200] : [40, 120]))
  $effect(() => warehouse.setFailureRate(failures ? 0.3 : 0))

  let search = $state('')
  let jumpTo = $state(900_000)
  let api = $state<SvGridApi<typeof features, Row> | null>(null)
  // Row numbers are 1-based in the box; the api takes an index.
  const jump = () => api?.scrollToRow(Math.max(0, Math.floor(jumpTo) - 1))
  function applySearch() {
    // Through the grid, so the request carries the column filters too.
    api?.setState({ globalFilter: search })
  }

  // ---- Editing --------------------------------------------------------------
  // A leaf edit is one `updateRow` on the server, applied back as a
  // transaction (no refetch); the parent group's subtotal then follows
  // through a targeted refresh of that level.
  async function onEdit(e: { row: Row; columnId: string; newValue: unknown; oldValue: unknown }) {
    const meta = e.row.__group
    if (meta.kind !== 'leaf' || Object.is(e.newValue, e.oldValue)) return
    await ctl.updateRow(String(e.row.id), { [e.columnId]: e.newValue } as Partial<WarehouseRow>)
    const route = meta.route ?? []
    if (route.length) ctl.refresh({ route: route.slice(0, -1) })
  }
  async function addRow() {
    const active = api?.getActiveCell()
    const focused = active ? (ctl.getRows()[active.rowIndex] as Row | undefined) : undefined
    const meta = focused?.__group
    const seed: Partial<WarehouseRow> = { amount: 1234, qty: 1, status: 'Open' }
    // Under the focused group, or the first region's first country.
    const route = (meta?.kind === 'leaf' ? meta.route : meta?.kind === 'group' ? meta.path : undefined) ?? []
    if (groupBy[0] === 'region' && route[0]) seed.region = route[0]
    if (groupBy[1] === 'country' && route[1]) seed.country = route[1]
    if (groupBy[2] === 'rep' && route[2]) seed.rep = route[2]
    await ctl.createRow(seed)
  }
  async function deleteSelected() {
    const state = ctl.getSelectionState()
    if (!state) return
    // A flat rule under select-all would delete a million rows; the demo
    // keeps deletes to the rows on screen that are ticked.
    const ids = (ctl.getRows() as Row[])
      .filter((r) => r.__group?.kind === 'leaf' && ctl.selection?.isSelected(String(r.id), r))
      .map((r) => String(r.id))
    for (const id of ids) await ctl.deleteRow(id)
  }

  // ---- Columns --------------------------------------------------------------
  // The aggregated columns sit next to the group column so a subtotal is
  // readable without scrolling sideways.
  const usd = { type: 'number' as const, options: { style: 'currency' as const, currency: 'USD', maximumFractionDigits: 0 } }
  const columns: GridColumns<Row> = [
    {
      id: 'group',
      header: 'Group',
      width: 260,
      sortable: false,
      filterable: false,
      // The text behind the expander: copy, export and the pinned grand total read it.
      fieldFn: (row) => serverGroupText(row, 'rep'),
      cell: (ctx) =>
        renderComponent(SvGroupCell, {
          row: ctx.row.original,
          onToggle: () => ctl.group.onToggle(ctx.row.original),
          leafField: 'rep',
        }),
    },
    // A group row carries the count aggregate under `id`; only a leaf shows it as an id.
    {
      field: 'id',
      header: 'Id',
      width: 90,
      align: 'right',
      editable: false,
      formatter: ({ value, row }) => (row?.original.__group?.kind === 'leaf' ? String(value) : ''),
    },
    { field: 'amount', header: 'Amount', width: 130, align: 'right', format: usd, editorType: 'number', cellFlash: true },
    { field: 'qty', header: 'Qty', width: 90, align: 'right', format: { type: 'number' }, editorType: 'number', cellFlash: true },
    { field: 'status', header: 'Status', width: 110, editorType: 'select', editorOptions: ['Paid', 'Open', 'Overdue', 'Refunded'] },
    { field: 'product', header: 'Product', width: 130, editorType: 'text' },
    { field: 'category', header: 'Category', width: 120, editable: false },
    { field: 'date', header: 'Date', width: 120, editable: false },
  ]

  // ---- Footer figures -----------------------------------------------------
  const cache = $derived.by(() => {
    void view
    const blocks = ctl.getCacheState()
    return {
      loaded: blocks.filter((b) => b.status === 'loaded').length,
      loading: blocks.filter((b) => b.status === 'loading').length,
      failed: blocks.filter((b) => b.status === 'failed').length,
      levels: ctl.levelStates().length,
    }
  })
  // The cache drawn per level, for the block map under the grid.
  const cacheLevels = $derived.by(() => {
    void view
    return ctl.levelStates().map((l) => ({
      label: l.route.length ? l.route.join(' > ') : 'top level',
      rowCount: l.rowCount,
      blocks: l.blocks,
    }))
  })
  // What the requests cost: the median of the last answers the log holds,
  // and how many are out right now.
  const latency = $derived.by(() => {
    const done = log.filter((e) => !e.failed).map((e) => e.ms).sort((a, b) => a - b)
    const p50 = done.length ? done[Math.floor(done.length / 2)]! : null
    return { p50, inFlight: cache.loading }
  })
  const selectedCount = $derived.by(() => {
    void view
    return ctl.selection?.selectedCount?.() ?? 0
  })
  // The warehouse is plain; its size is re-read whenever the model emits.
  const serverRows = $derived.by(() => {
    void view
    return warehouse.size()
  })
  const fmt = (n: number) => n.toLocaleString()
</script>

<section class="wrap demo-kit">
  <header class="chrome">
    <div class="seg mode-seg" role="group" aria-label="Row mode">
      <button type="button" class:is-on={mode === 'infinite'} aria-pressed={mode === 'infinite'} onclick={() => setMode('infinite')}>Infinite scroll</button>
      <button type="button" class:is-on={mode === 'paged'} aria-pressed={mode === 'paged'} onclick={() => setMode('paged')}>Paged</button>
    </div>
    <div class="seg preset-seg" role="group" aria-label="Grouping">
      {#each GROUP_PRESETS as p (p.label)}
        <button type="button" class:is-on={isPreset(p)} aria-pressed={isPreset(p)} title={p.groups.length ? 'Group by ' + p.groups.join(' > ') : 'No grouping'} onclick={() => setGroupBy(p.groups)}>{p.label}</button>
      {/each}
    </div>
    <label class="chk"><input type="checkbox" bind:checked={slow} /> Slow network</label>
    <label class="chk"><input type="checkbox" bind:checked={failures} /> Simulate failures</label>
    <span class="note">
      A million rows that never leave the server: every sort, filter, search, expand, page and edit is one
      request to the warehouse, and the request log lists each one. Double-click a leaf's Amount, Qty, Status
      or Product to edit it; the subtotal above follows. Tick the header checkbox to select all million.
    </span>
  </header>

  <div class="toolbar">
    <form class="search" onsubmit={(e) => { e.preventDefault(); applySearch() }}>
      <input type="search" class="field" placeholder="Search a million rows (rep, product, country...)" bind:value={search} aria-label="Global search" />
      <button type="submit" class="btn">Search</button>
    </form>
    {#if mode === 'infinite'}
      <!-- A page holds a hundred rows; there is nothing to scroll to in paged mode. -->
      <form class="jump" onsubmit={(e) => { e.preventDefault(); jump() }}>
        <input type="number" class="field" min="1" max={ROWS} bind:value={jumpTo} aria-label="Row to jump to" />
        <button type="submit" class="btn" title="Scroll to a row, loaded or not - the block under it loads">Jump to row</button>
      </form>
    {/if}
    <div class="actions">
      <button type="button" class="btn" onclick={() => ctl.refresh({ route: [] })} title="Re-fetch the open levels in place">Refresh</button>
      <button type="button" class="btn" onclick={() => ctl.refresh({ route: [], purge: true })} title="Drop every cached block and start over">Purge</button>
      <button type="button" class="btn" disabled={cache.failed === 0} onclick={() => ctl.retryLoads()} title="Re-fetch every block that failed">Retry failed</button>
      <button type="button" class="btn" onclick={addRow} title="Insert a row under the focused group as a transaction">Add row</button>
      <button type="button" class="btn btn-danger" disabled={selectedCount === 0} onclick={deleteSelected} title="Delete the ticked rows on screen">Delete selected</button>
    </div>
  </div>

  <SvRowGroupPanel columns={groupCols} {groupBy} onChange={setGroupBy} applyMode="deferred" />

  <div class="body">
    {#key mode}
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
          showRowSelection
          selectionBar={['selectAll', 'editFields']}
          pageable={mode === 'paged'}
          rowHeight={34}
          containerHeight="100%"
          onCellValueChange={onEdit}
          onApiReady={(next) => (api = installEnterprise(next))}
        />
      </div>
    {/key}
    <aside class="log" aria-label="Request log">
      <div class="log-list">
      <div class="log-head">Requests <span class="muted">newest first</span></div>
      {#each log as e (e.seq)}
        <div class="log-row" class:is-failed={e.failed} class:is-cached={e.cached}>
          <span class="log-kind">{e.kind}</span>
          <span class="log-route" title={e.route.join(' > ')}>{e.route.length ? e.route.join(' > ') : 'root'}</span>
          <span class="log-range">{e.range}</span>
          <span class="log-ms">{e.ms} ms</span>
          <span class="log-rows">{e.failed ? 'failed' : `${e.rows} rows`}</span>
        </div>
      {/each}
      {#if !log.length}<div class="muted log-empty">No requests yet.</div>{/if}
      </div>
      <BlockMap levels={cacheLevels} />
    </aside>
  </div>

  <footer class="foot">
    <span class="stat" data-stat="server"><span class="stat-label">Server</span><strong>{fmt(serverRows)}</strong> rows</span>
    <span class="stat" data-stat="selected"><span class="stat-label">Selected</span><strong>{fmt(selectedCount)}</strong></span>
    <span class="stat" data-stat="cache"><span class="stat-label">Cache</span><strong>{cache.loaded}</strong> block{cache.loaded === 1 ? '' : 's'} across <strong>{cache.levels}</strong> level{cache.levels === 1 ? '' : 's'}{cache.loading ? `, ${cache.loading} loading` : ''}{cache.failed ? `, ${cache.failed} failed` : ''}</span>
    <span class="stat" data-stat="latency"><span class="stat-label">Latency</span>{#if latency.p50 != null}<strong>{latency.p50} ms</strong> median{:else}<strong>-</strong>{/if}{#if latency.inFlight}, <strong>{latency.inFlight}</strong> in flight{/if}</span>
    <span class="stat" data-stat="warehouse"><span class="stat-label">Warehouse</span><strong>{(warehouse.memoryBytes() / 1e6).toFixed(0)} MB</strong> in typed arrays</span>
    {#if loadError}<span class="stat err">{loadError}</span>{/if}
  </footer>
</section>

<style>
  /* Only what is particular to this demo; the chrome is the shared demo-kit. */
  /* The log column: the request list scrolls, the block map stays at the bottom. */
  .log { display: flex; flex-direction: column; overflow: hidden; }
  .log-list { flex: 1; min-height: 0; overflow: auto; }
  .search { display: inline-flex; gap: 4px; flex: 1 1 260px; min-width: 0; }
  .search .field { flex: 1; }
  .jump { display: inline-flex; gap: 4px; }
  .jump .field { width: 110px; }
  .actions { margin-left: auto; }
  .log-row { grid-template-columns: 44px 1fr 64px 48px 56px; }
  .log-row.is-cached .log-ms { color: var(--sg-muted, #64748b); }
  .log-row.is-failed { color: var(--sg-danger, #b91c1c); }
  .log-route { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .log-range, .log-ms, .log-rows { text-align: right; white-space: nowrap; }
</style>
