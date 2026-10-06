<!-- Documented in: docs/help/server/worker-data-source.md -->
<script lang="ts">
  /**
   * 500. Worker data source: sort and group off the main thread
   * -------------------------------------------------------------
   * The same orders table in two grids. "Free grid" hands the rows to
   * `<SvGrid data>` and lets the grid sort, filter and group them itself,
   * on the page, as the free package does. "Enterprise: Web Worker" builds
   * the rows inside a worker, where a columnar engine answers each request
   * (`serveWorkerDataSource`), and the server row model asks it for one block
   * of 100 rows at a time (`createWorkerDataSource`). Sort a column, group,
   * or search, and watch the meters: the slowest request, and the longest
   * gap between frames. The moving dot is driven from JavaScript, so it
   * stops whenever the page does.
   *
   * The worker data source and the row model are Enterprise; the free grid
   * on the other side is the full free package, nothing turned off.
   */
  import {
    SvGrid,
    renderComponent,
    tableFeatures,
    rowSortingFeature,
    columnFilteringFeature,
    columnGroupingFeature,
    rowExpandingFeature,
    type GridColumns,
    type ServerDataSource,
    type SvGridApi,
  } from '@svgrid/grid'
  import {
    setLicenseKey,
    installEnterprise,
    createServerRowModel,
    createWorkerDataSource,
    serverGroupText,
    SvGroupCell,
    SvRowGroupPanel,
    type ServerRowModel,
    type ServerRowModelState,
    type ServerRowModelGridRow,
  } from '@svgrid/enterprise'
  import { makeOrders, type Order } from '../shared/orders-dataset'

  setLicenseKey('SVENTERPRISE-DEV-LOCAL')

  type Mode = 'worker' | 'free'
  const canUseWorker = typeof Worker !== 'undefined'
  const SIZES = [100_000, 250_000, 500_000, 1_000_000]

  const INITIAL_MODE: Mode = canUseWorker ? 'worker' : 'free'
  const INITIAL_SIZE = 250_000

  let mode = $state<Mode>(INITIAL_MODE)
  let size = $state(INITIAL_SIZE)
  let groupBy = $state<string[]>([])
  let view = $state.raw<ServerRowModelState<Order>>()

  // ---- Meters --------------------------------------------------------------
  // Both read over a rolling window, so a slow sort stays on screen long
  // enough to read after it finishes.
  const WINDOW_MS = 4000
  type Sample = { at: number; ms: number }
  let requestSamples: Sample[] = []
  let frameSamples: Sample[] = []
  let slowestRequest = $state(0)
  let longestFrame = $state(0)
  let loadMs = $state<number | null>(null)
  let tick = $state(0)

  function windowMax(samples: Sample[], now: number): number {
    let max = 0
    for (const s of samples) if (now - s.at <= WINDOW_MS && s.ms > max) max = s.ms
    return max
  }

  // Wrap the source to time every block request, round trip included.
  function timed(source: ServerDataSource<Order>): ServerDataSource<Order> {
    return {
      ...source,
      async getRows(req) {
        const t0 = performance.now()
        try {
          return await source.getRows(req)
        } finally {
          requestSamples.push({ at: performance.now(), ms: performance.now() - t0 })
        }
      },
    }
  }

  $effect(() => {
    let prev = performance.now()
    let raf = 0
    const loop = (now: number) => {
      // A hidden tab stops painting; that pause is not the grid's.
      if (document.visibilityState === 'visible') frameSamples.push({ at: now, ms: now - prev })
      prev = now
      requestSamples = requestSamples.filter((s) => now - s.at <= WINDOW_MS)
      frameSamples = frameSamples.filter((s) => now - s.at <= WINDOW_MS)
      slowestRequest = windowMax(requestSamples, now)
      longestFrame = windowMax(frameSamples, now)
      tick = (now % 2000) / 2000
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  })

  // ---- Enterprise: the worker and the row model -----------------------------
  function makeModel(rows: number, by: string[]): ServerRowModel<Order> {
    const t0 = performance.now()
    loadMs = null
    const worker = new Worker(new URL('../shared/orders.worker.ts', import.meta.url), { type: 'module' })
    // The rows are built in the worker; only their count crosses.
    worker.postMessage({ type: 'orders:init', rows })
    const source = createWorkerDataSource<Order>(worker)
    source.ready.then(() => (loadMs = performance.now() - t0), () => {})
    const model = createServerRowModel<Order>(timed(source), {
      groupBy: by,
      aggregations: [
        { col: 'amount', fn: 'sum' },
        { col: 'qty', fn: 'sum' },
      ],
      childCount: (r) => (r as { childCount?: number }).childCount,
      grandTotalRow: 'pinnedBottom',
      getRowId: (r) => String(r.id),
      blockSize: 100,
      // The worker usually answers within a frame or two: keep the rows on
      // screen until it does, rather than flashing skeletons in between.
      keepRowsWhileLoading: 500,
      onChange: (s) => (view = s),
    })
    model.refresh()
    return model
  }

  const features = tableFeatures({ rowSortingFeature, columnFilteringFeature })

  // ---- Free: the rows on the page, the grid's own row pipeline -------------
  let freeRows = $state.raw<Order[]>([])
  let freeApi: SvGridApi<typeof freeFeatures, Order> | null = null
  const freeFeatures = tableFeatures({ rowSortingFeature, columnFilteringFeature, columnGroupingFeature, rowExpandingFeature })

  function makeFree(rows: number): void {
    const t0 = performance.now()
    freeRows = makeOrders(rows)
    loadMs = performance.now() - t0
  }

  let ctl = $state.raw<ServerRowModel<Order> | null>(INITIAL_MODE === 'worker' ? makeModel(INITIAL_SIZE, []) : null)
  if (INITIAL_MODE === 'free') makeFree(INITIAL_SIZE)
  $effect(() => () => ctl?.dispose())

  function rebuild(nextMode: Mode, nextSize: number) {
    ctl?.dispose() // terminates the worker, if there is one
    ctl = null
    view = undefined
    freeRows = []
    freeApi = null
    mode = nextMode
    size = nextSize
    if (nextMode === 'worker') ctl = makeModel(nextSize, groupBy)
    else makeFree(nextSize)
  }

  function setGroupBy(next: string[]) {
    groupBy = next
    if (mode === 'worker') ctl?.setGroupBy(next)
    else freeApi?.setGroupBy(next)
  }

  const groupCols = [
    { id: 'region', label: 'Region' },
    { id: 'country', label: 'Country' },
    { id: 'category', label: 'Category' },
    { id: 'status', label: 'Status' },
  ]

  // ---- Columns -------------------------------------------------------------
  type Row = ServerRowModelGridRow<Order>
  const usd = { type: 'number' as const, options: { style: 'currency' as const, currency: 'USD', maximumFractionDigits: 0 } }
  // The free grid totals its own groups; the worker's groups arrive totalled.
  const dataColumns = (totals: boolean) => [
    { field: 'customer', header: 'Customer', width: 110, editable: false },
    // The free grid groups by column id, so every groupable field needs a column.
    { field: 'region', header: 'Region', width: 80, editable: false },
    { field: 'country', header: 'Country', width: 70, editable: false },
    { field: 'product', header: 'Product', width: 105, editable: false },
    { field: 'category', header: 'Category', width: 85, editable: false },
    { field: 'rep', header: 'Rep', width: 75, editable: false },
    { field: 'status', header: 'Status', width: 80, editable: false },
    { field: 'placed', header: 'Placed', width: 90, editable: false },
    // Wide enough for the grand total: a million orders hold over 12 million units.
    { field: 'qty', header: 'Qty', width: 90, align: 'right', format: { type: 'number' }, editable: false, ...(totals ? { aggregate: 'sum' } : {}) },
    { field: 'amount', header: 'Amount', width: 115, align: 'right', format: usd, editable: false, ...(totals ? { aggregate: 'sum' } : {}) },
  ]
  const columns: GridColumns<Row> = [
    {
      id: 'group',
      header: 'Group / Order',
      width: 140,
      sortable: false,
      filterable: false,
      fieldFn: (row) => serverGroupText(row, 'id'),
      cell: (ctx) =>
        renderComponent(SvGroupCell, {
          row: ctx.row.original,
          onToggle: () => ctl?.group.onToggle(ctx.row.original),
          leafField: 'id',
        }),
    },
    ...(dataColumns(false) as GridColumns<Row>),
  ]
  const freeColumns: GridColumns<Order> = [
    { field: 'id', header: 'Order', width: 140, editable: false },
    ...(dataColumns(true) as GridColumns<Order>),
  ]

  const level = (ms: number) => (ms < 50 ? 'ok' : ms < 200 ? 'warn' : 'bad')
  const fmtMs = (ms: number) => `${Math.round(ms).toLocaleString()} ms`
</script>

<section class="wrap demo-kit">
  <header class="chrome">
    <div class="seg" role="group" aria-label="Which grid runs the queries">
      <button type="button" class:is-on={mode === 'worker'} aria-pressed={mode === 'worker'} disabled={!canUseWorker} onclick={() => mode !== 'worker' && rebuild('worker', size)}>Enterprise: Web Worker</button>
      <button type="button" class:is-on={mode === 'free'} aria-pressed={mode === 'free'} onclick={() => mode !== 'free' && rebuild('free', size)}>Free grid</button>
    </div>
    <label class="sel">
      Rows
      <select value={size} onchange={(e) => rebuild(mode, Number(e.currentTarget.value))}>
        {#each SIZES as n (n)}<option value={n}>{n.toLocaleString()}</option>{/each}
      </select>
    </label>
    <span class="ticker" aria-hidden="true" title="Moves on every frame the page paints"><span class="dot" style:transform={`translateX(${tick * 100}%)`}></span></span>
    <span class="note">
      Sort a column, group by dragging a chip, or search. The <strong>Free grid</strong> sorts and groups
      every row on the page, and the page waits for it. <strong>Enterprise</strong> does the same work in
      a worker and brings back only the visible block of 100 rows.
      {#if !canUseWorker}This browser has no Web Workers, so only the free grid runs.{/if}
    </span>
  </header>
  <SvRowGroupPanel columns={groupCols} {groupBy} onChange={setGroupBy} />
  {#if mode === 'worker' && ctl}
    {#key ctl}
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
          showGlobalFilter
          selectionMode="none"
          rowHeight={30}
          containerHeight="100%"
          onApiReady={(next) => installEnterprise(next)}
        />
      </div>
    {/key}
  {:else if mode === 'free'}
    {#key freeRows}
      <div class="gridpane">
        <SvGrid
          responsive={true}
          columnResize
          fitColumns
          data={freeRows}
          columns={freeColumns}
          features={freeFeatures}
          sortable
          filterable
          filterMode="menu"
          showGlobalFilter
          showGroupingControls={false}
          selectionMode="none"
          rowHeight={30}
          containerHeight="100%"
          onApiReady={(next) => {
            freeApi = next
            next.setGroupBy(groupBy)
          }}
        />
      </div>
    {/key}
  {/if}
  <footer class="foot">
    <span class="stat"><span class="stat-label">Running on</span><strong>{mode === 'worker' ? 'Web Worker' : 'The page'}</strong></span>
    <span class="stat"><span class="stat-label">Rows</span><strong>{size.toLocaleString()}</strong></span>
    <span class="stat"><span class="stat-label">Data ready</span><strong>{loadMs == null ? 'building...' : fmtMs(loadMs)}</strong></span>
    <span class="stat meter" data-level={mode === 'worker' ? level(slowestRequest) : undefined} data-stat="request">
      <span class="stat-label">Slowest request (4 s)</span><strong>{mode === 'worker' ? fmtMs(slowestRequest) : 'none, all on the page'}</strong>
    </span>
    <span class="stat meter" data-level={level(longestFrame)} data-stat="frame"><span class="stat-label">Longest frame (4 s)</span><strong>{fmtMs(longestFrame)}</strong></span>
    {#if view?.error}<span class="stat err">{String((view.error as Error).message ?? view.error)}</span>{/if}
  </footer>
</section>

<style>
  /* Only what is particular to this demo; the chrome is the shared demo-kit. */
  .sel { display: inline-flex; align-items: center; gap: 6px; font-size: 12px; color: var(--sg-muted, #64748b); }
  .sel select {
    font: inherit; color: var(--sg-fg, #0f172a); background: var(--sg-bg, #fff);
    border: 1px solid var(--sg-border, #e2e8f0); border-radius: 6px; padding: 3px 6px;
  }
  .ticker {
    position: relative; display: inline-block; width: 72px; height: 8px; flex: none;
    border-radius: 999px; background: color-mix(in oklab, var(--sg-border, #e2e8f0) 70%, transparent);
  }
  .ticker .dot {
    position: absolute; inset: 0 auto 0 0; width: calc(100% - 8px);
  }
  .ticker .dot::after {
    content: ''; position: absolute; left: 0; top: 0; width: 8px; height: 8px; border-radius: 50%;
    background: var(--sg-fg, #0f172a);
  }
  /* Semantic colours: fine under a frame, a visible hitch, a frozen page. */
  .meter[data-level='ok'] strong { color: var(--sg-success, #16a34a); }
  .meter[data-level='warn'] strong { color: var(--sg-warning, #f59e0b); }
  .meter[data-level='bad'] strong { color: var(--sg-danger, #dc2626); }
</style>
