<!-- Documented in: docs/help/server/server-grouping.md -->
<script lang="ts">
  /**
   * 473. Server grouping: totals, sort and refresh rules
   * ---------------------------------------------------
   * The options around a grouped row model, each with the request log to
   * show what it costs: subtotal footers and a grand total in any of four
   * positions, levels that open on arrival, expand-all that reaches rows
   * not loaded yet, and the rules for what a sort or a filter re-requests.
   * Sort a plain column and only the leaf levels re-fetch; sort a group
   * column and only that column's level (its children's order does not
   * depend on it); sort an aggregated column and every level. A filter
   * purges everything, or only the groups it touches.
   *
   * The row model is Enterprise; the datasource contract the in-memory
   * reference source implements is free.
   */
  import { SvGrid, renderComponent, tableFeatures, rowSortingFeature, columnFilteringFeature, type GridColumns, type ServerDataSource } from '@svgrid/grid'
  import {
    setLicenseKey,
    createInMemoryDataSource,
    createServerRowModel,
    serverGroupText,
    SvGroupCell,
    type EntitySchema,
    type ServerRowModel,
    type ServerRowModelState,
    type ServerRowModelGridRow,
  } from '@svgrid/enterprise'
  import { createPrng } from '../shared/mock-api'

  setLicenseKey('SVENTERPRISE-DEV-LOCAL')

  const features = tableFeatures({ rowSortingFeature, columnFilteringFeature })

  // ---- The server ----------------------------------------------------------
  type Sale = { id: number; region: string; country: string; product: string; rep: string; qty: number; amount: number }
  const WORLD: Record<string, string[]> = { Americas: ['US', 'BR', 'CA'], EMEA: ['DE', 'UK', 'FR'], APAC: ['JP', 'AU', 'IN'] }
  const PRODUCTS = ['Desk', 'Chair', 'Lamp', 'Monitor', 'Cabinet', 'Whiteboard']
  const REPS = ['Ada', 'Grace', 'Linus', 'Margaret', 'Ken', 'Barbara', 'Dennis', 'Donald']
  const rng = createPrng(0x7a11)
  const DB: Sale[] = Array.from({ length: 30_000 }, (_, i) => {
    const region = rng.pick(Object.keys(WORLD))
    const qty = rng.int(1, 12)
    return { id: i + 1, region, country: rng.pick(WORLD[region]!), product: rng.pick(PRODUCTS), rep: rng.pick(REPS), qty, amount: qty * rng.int(90, 900) }
  })
  const schema: EntitySchema<Sale> = {
    name: 'sales',
    fields: [
      { field: 'id', type: 'number', primaryKey: true, readonly: true },
      { field: 'region', type: 'text' },
      { field: 'country', type: 'text' },
      { field: 'product', type: 'text' },
      { field: 'rep', type: 'text' },
      { field: 'qty', type: 'number' },
      { field: 'amount', type: 'number' },
    ],
  }
  const memory = createInMemoryDataSource(DB, schema)

  type LogEntry = { seq: number; kind: string; route: string; range: string; sort: string; filter: string; ms: number }
  let log = $state<LogEntry[]>([])
  let seq = 0
  const source: ServerDataSource<Sale> = {
    async getRows(req) {
      const t0 = performance.now()
      await new Promise((r) => setTimeout(r, 140))
      const result = await memory.getRows(req)
      const keys = req.groupKeys ?? []
      log = [
        {
          seq: seq++,
          kind: keys.length < (req.groupBy?.length ?? 0) ? 'group' : 'leaf',
          route: keys.length ? keys.join(' > ') : 'top',
          range: `${req.startRow}-${req.endRow}`,
          sort: req.sortModel.map((s) => `${s.id}${s.desc ? ' desc' : ''}`).join(', ') || '-',
          filter: Object.keys(req.filterModel.columns ?? {}).join(', ') || '-',
          ms: Math.round(performance.now() - t0),
        },
        ...log,
      ].slice(0, 40)
      return result
    },
  }

  // ---- The model, rebuilt when an option changes ---------------------------
  type TotalPos = 'none' | 'top' | 'bottom' | 'pinnedTop' | 'pinnedBottom'
  type SortScope = 'affected' | 'all'
  type FilterScope = 'purge' | 'touched'
  let totals = $state<TotalPos>('pinnedBottom')
  let footers = $state(true)
  let openDepth = $state(2)
  let sortScope = $state<SortScope>('affected')
  let filterScope = $state<FilterScope>('purge')
  let view = $state<ServerRowModelState<Sale>>()

  // The options are construction-time, so a change rebuilds the model; the
  // grid stays mounted (it re-subscribes to the new rowModel), the log keeps
  // its entries, and the sort, filter and open groups carry over so the
  // note's "compare the two rules" works on the same tree.
  let ctl = $state.raw<ServerRowModel<Sale>>(makeModel())
  function makeModel(previous?: ServerRowModel<Sale>, carryExpansion = true) {
    const carried = previous?.getState()
    const model = createServerRowModel<Sale>(source, {
      groupBy: ['region', 'country'],
      aggregations: [
        { col: 'amount', fn: 'sum' },
        { col: 'qty', fn: 'sum' },
      ],
      childCount: (r) => (r as { childCount?: number }).childCount,
      groupFooters: footers,
      grandTotalRow: totals === 'none' ? undefined : totals,
      isGroupOpenByDefault: (route) => route.length <= openDepth,
      sortAllLevels: sortScope === 'all',
      onlyRefreshFilteredGroups: filterScope === 'touched',
      blockSize: 50,
      skeletonRows: 4,
      filterValues: async (columnId) => [...new Set(DB.map((r) => String(r[columnId as keyof Sale])))].sort(),
      onChange: (s) => (view = s),
    })
    if (carried) {
      if (carried.sortModel.length) model.setSort(carried.sortModel)
      if (Object.keys(carried.filterModel.columns ?? {}).length || carried.filterModel.global) model.setFilter(carried.filterModel)
    }
    model.refresh()
    // Groups that were open re-open as their levels arrive (not when the
    // option being changed is what opens on load).
    if (carryExpansion) for (const key of carried?.expandedGroups ?? []) model.expandGroup(JSON.parse(key) as string[])
    return model
  }
  function rebuild(carryExpansion = true) {
    const previous = ctl
    ctl = makeModel(previous, carryExpansion)
    previous.dispose()
  }
  $effect(() => () => ctl.dispose())

  // ---- Columns --------------------------------------------------------------
  const usd = { type: 'number' as const, options: { style: 'currency' as const, currency: 'USD', maximumFractionDigits: 0 } }
  const columns: GridColumns<Row> = [
    {
      // Its id is the first group field, so sorting the header sorts the
      // region level on the server (the country level keeps its order).
      id: 'region',
      header: 'Region (group) / Country',
      width: 230,
      filterable: false,
      fieldFn: (row) => serverGroupText(row, 'rep'),
      cell: (ctx) =>
        renderComponent(SvGroupCell, {
          row: ctx.row.original,
          onToggle: () => ctl.group.onToggle(ctx.row.original),
          leafField: 'rep',
        }),
    },
    { field: 'product', header: 'Product (plain)', width: 140 },
    { field: 'qty', header: 'Qty (sum)', width: 120, align: 'right', format: { type: 'number' } },
    { field: 'amount', header: 'Amount (sum)', width: 140, align: 'right', format: usd },
  ]
  type Row = ServerRowModelGridRow<Sale>

  const levels = $derived.by(() => {
    void view
    return ctl.levelStates().length
  })
</script>

<section class="wrap demo-kit">
  <header class="chrome">
    <div class="opt">
      <span class="opt-label">Grand total</span>
      <div class="seg total-seg" role="group" aria-label="Grand total row">
        {#each ['none', 'top', 'bottom', 'pinnedTop', 'pinnedBottom'] as p (p)}
          <button type="button" class:is-on={totals === p} aria-pressed={totals === p} onclick={() => { totals = p as TotalPos; rebuild() }}>{p === 'pinnedTop' ? 'pinned top' : p === 'pinnedBottom' ? 'pinned bottom' : p}</button>
        {/each}
      </div>
    </div>
    <div class="opt">
      <span class="opt-label">Open on load</span>
      <div class="seg depth-seg" role="group" aria-label="Levels open by default">
        {#each [0, 1, 2] as d (d)}
          <button type="button" class:is-on={openDepth === d} aria-pressed={openDepth === d} onclick={() => { openDepth = d; rebuild(false) }}>{d === 0 ? 'nothing' : d === 1 ? 'regions' : 'countries'}</button>
        {/each}
      </div>
    </div>
    <div class="opt">
      <span class="opt-label">A sort re-fetches</span>
      <div class="seg sort-seg" role="group" aria-label="Sort scope">
        <button type="button" class:is-on={sortScope === 'affected'} aria-pressed={sortScope === 'affected'} onclick={() => { sortScope = 'affected'; rebuild() }}>affected levels</button>
        <button type="button" class:is-on={sortScope === 'all'} aria-pressed={sortScope === 'all'} onclick={() => { sortScope = 'all'; rebuild() }}>every level</button>
      </div>
    </div>
    <div class="opt">
      <span class="opt-label">A filter</span>
      <div class="seg filter-seg" role="group" aria-label="Filter scope">
        <button type="button" class:is-on={filterScope === 'purge'} aria-pressed={filterScope === 'purge'} onclick={() => { filterScope = 'purge'; rebuild() }}>purges all</button>
        <button type="button" class:is-on={filterScope === 'touched'} aria-pressed={filterScope === 'touched'} onclick={() => { filterScope = 'touched'; rebuild() }}>touched groups only</button>
      </div>
    </div>
    <label class="chk"><input type="checkbox" checked={footers} onchange={(e) => { footers = e.currentTarget.checked; rebuild() }} /> Subtotal footers</label>
  </header>
  <div class="toolbar">
    <div class="actions">
      <button type="button" class="btn" onclick={() => ctl.expandAll()} title="Open every group the grid has read">Expand loaded</button>
      <button type="button" class="btn" onclick={() => ctl.expandAll({ includeUnloaded: true })} title="Groups that arrive later open too, until the next collapse">Expand everything</button>
      <button type="button" class="btn" onclick={() => ctl.collapseAll()} title="Close every group; their levels stay cached">Collapse all</button>
      <button type="button" class="btn" onclick={() => ctl.refresh({ route: [] })} title="Re-read the open levels in place: expansion and scroll survive">Refresh</button>
      <button type="button" class="btn" onclick={() => ctl.refresh({ route: [], purge: true })} title="Drop every cached level and start over">Purge</button>
    </div>
    <span class="note">
      Sort <em>Product</em>: only the leaf levels re-fetch. Sort <em>Region</em>: the region level alone, since the
      countries under a region keep their own order. Sort <em>Amount</em>: every level, because the group rows
      carry its sum. Open a filter on Product and compare the two filter rules in the log.
    </span>
  </div>
  <div class="body">
    <div class="gridpane">
      <SvGrid
        responsive={true}
        columnResize
        fitColumns
        rowModel={ctl}
        stickyGroupRows
        {columns}
        {features}
        sortable
        filterable
        filterMode="menu"
        selectionMode="none"
        rowHeight={32}
        containerHeight="100%"
      />
    </div>
    <aside class="log" aria-label="Request log">
      <div class="log-head">Requests <span class="muted">newest first · {levels} level{levels === 1 ? '' : 's'} cached</span></div>
      <div class="log-row log-cols" aria-hidden="true">
        <span>level</span><span>route</span><span>rows</span><span>sort</span><span>filter</span>
      </div>
      {#each log as e (e.seq)}
        <div class="log-row">
          <span class="log-kind">{e.kind}</span>
          <span class="log-route" title={e.route}>{e.route}</span>
          <span class="log-range">{e.range}</span>
          <span class="log-sort" class:muted={e.sort === '-'} title="the sort the request carried">{e.sort}</span>
          <span class="log-filter" class:muted={e.filter === '-'} title="the filter columns the request carried">{e.filter}</span>
        </div>
      {/each}
      {#if !log.length}<div class="muted log-empty">No requests yet.</div>{/if}
    </aside>
  </div>
</section>

<style>
  /* Only what is particular to this demo; the chrome is the shared demo-kit. */
  .log-row { grid-template-columns: 40px 1fr 44px 64px 48px; }
  .log-cols { position: sticky; top: 30px; font-size: 10px; text-transform: uppercase; letter-spacing: 0.03em; color: var(--sg-muted, #64748b); background: var(--sg-bg, #fff); }
  .log-route, .log-sort, .log-filter { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .log-sort, .log-filter { color: var(--sg-muted, #64748b); }
  .log-range { text-align: right; white-space: nowrap; }
</style>
