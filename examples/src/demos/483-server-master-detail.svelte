<!-- Documented in: docs/help/server/server-grouping.md -->
<script lang="ts">
  /**
   * 483. Server row model: master-detail
   * ------------------------------------
   * A detail panel under a leaf of a grouped server row model. The grid's own
   * toggle column (`showDetailToggle`) draws the chevron; the one
   * on an order asks the model to open its detail (`toggleDetail`); the
   * model puts a `detail` display row under the leaf, the grid draws it
   * through `renderDetailRow` at `detailRowHeight`, and the panel fetches
   * the order's line items from their own endpoint the moment it appears -
   * with the grid virtualized over the whole tree, and the region row held
   * under the header while the details scroll past.
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
    type EntitySchema,
    type ServerRowModel,
    type ServerRowModelState,
    type ServerRowModelGridRow,
  } from '@svgrid/enterprise'
  import { createPrng } from '../shared/mock-api'

  setLicenseKey('SVENTERPRISE-DEV-LOCAL')

  const features = tableFeatures({ rowSortingFeature, columnFilteringFeature })

  // ---- The server ----------------------------------------------------------
  type Order = { id: number; region: string; customer: string; status: string; lines: number; amount: number; placed: string }
  type Line = { sku: string; product: string; qty: number; unitPrice: number; total: number }
  const REGIONS = ['EMEA', 'AMER', 'APAC']
  const CUSTOMERS = ['Acme', 'Globex', 'Initech', 'Umbrella', 'Hooli', 'Vandelay', 'Stark', 'Wayne', 'Tyrell', 'Wonka']
  const PRODUCTS = ['Bolt M8', 'Bracket L', 'Hinge 40', 'Panel 2x1', 'Rail 900', 'Clamp S', 'Washer 10', 'Pin 4', 'Strut 300']
  const STATUS = ['open', 'confirmed', 'shipped', 'shipped', 'invoiced']
  const rng = createPrng(0xd37a11)
  const DAY = 86_400_000
  const DB: Order[] = Array.from({ length: 4_000 }, (_, i) => {
    const lines = rng.int(1, 6)
    return {
      id: i + 1,
      region: rng.pick(REGIONS),
      customer: rng.pick(CUSTOMERS),
      status: rng.pick(STATUS),
      lines,
      amount: lines * rng.int(40, 900),
      placed: new Date(Date.now() - rng.int(1, 180) * DAY).toISOString().slice(0, 10),
    }
  })
  const schema: EntitySchema<Order> = {
    name: 'orders',
    fields: [
      { field: 'id', type: 'number', primaryKey: true },
      { field: 'region', type: 'text' },
      { field: 'customer', type: 'text' },
      { field: 'status', type: 'text' },
      { field: 'lines', type: 'number' },
      { field: 'amount', type: 'number' },
      { field: 'placed', type: 'date' },
    ],
  }
  const memory = createInMemoryDataSource(DB, schema)
  let requests = $state(0)
  let slow = $state(false)
  const source: typeof memory = {
    ...memory,
    async getRows(req) {
      requests += 1
      await new Promise((r) => setTimeout(r, 150))
      return memory.getRows(req)
    },
  }
  // The second endpoint: an order's line items, generated from the order id
  // on first request, so the same order always answers the same lines.
  let lineRequests = $state(0)
  const lineCache = new Map<number, Line[]>()
  async function fetchLines(orderId: number): Promise<Line[]> {
    await new Promise((r) => setTimeout(r, slow ? 900 : 250))
    // Counted once the call is on its way: the panel starts the fetch
    // from its markup, where state must not change mid-render.
    lineRequests += 1
    let lines = lineCache.get(orderId)
    if (!lines) {
      const order = DB.find((o) => o.id === orderId)
      const p = createPrng(orderId * 7919)
      const n = order?.lines ?? p.int(1, 6)
      lines = Array.from({ length: n }, (_, i) => {
        const qty = p.int(1, 40)
        const unitPrice = p.int(4, 120)
        return { sku: `SKU-${String(orderId).padStart(5, '0')}-${i + 1}`, product: p.pick(PRODUCTS), qty, unitPrice, total: qty * unitPrice }
      })
      lineCache.set(orderId, lines)
    }
    return lines
  }

  // One request per order, however often its panel re-renders: the promise
  // is kept, so a panel closed and opened again shows its lines at once.
  const linePromises = new Map<number, Promise<Line[]>>()
  function linesOf(orderId: number): Promise<Line[]> {
    let p = linePromises.get(orderId)
    if (!p) {
      p = fetchLines(orderId)
      linePromises.set(orderId, p)
    }
    return p
  }

  // ---- The model ---------------------------------------------------------
  type Row = ServerRowModelGridRow<Order>
  let view = $state<ServerRowModelState<Order>>()
  const ctl: ServerRowModel<Order> = createServerRowModel<Order>(source, {
    groupBy: ['region'],
    aggregations: [
      { col: 'amount', fn: 'sum' },
      { col: 'id', fn: 'count' },
    ],
    childCount: (r) => (r as { childCount?: number }).childCount,
    grandTotalRow: 'pinnedBottom',
    isGroupOpenByDefault: () => true,
    getRowId: (r) => String(r.id),
    blockSize: 100,
    skeletonRows: 4,
    filterValues: async (columnId) => [...new Set(DB.map((r) => String(r[columnId as keyof Order])))].sort(),
    onChange: (s) => (view = s),
  })
  ctl.refresh()
  $effect(() => () => ctl.dispose())

  // The details open: the set the model keeps, read from its state.
  const openCount = $derived(view?.openDetails.length ?? 0)
  function openFirstOnScreen(n: number) {
    // The first n loaded orders in the flattened list.
    const rows = ctl.getRows() as Row[]
    let opened = 0
    for (const r of rows) {
      if (r.__group?.kind !== 'leaf') continue
      if (!ctl.isDetailOpen(String(r.id))) ctl.toggleDetail(String(r.id), true)
      opened += 1
      if (opened >= n) break
    }
  }

  // ---- Columns --------------------------------------------------------------
  const usd = { type: 'number' as const, options: { style: 'currency' as const, currency: 'USD', maximumFractionDigits: 0 } }
  const isLeaf = (row: Row) => row.__group?.kind === 'leaf'
  // The chevron that opens a detail is the grid's own row-header column
  // (`showDetailToggle`); the model tells it which rows are leaves and open.
  const columns: GridColumns<Row> = [
    {
      id: 'region',
      header: 'Region / Order',
      width: 170,
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
    { field: 'customer', header: 'Customer', width: 130, editable: false },
    { field: 'status', header: 'Status', width: 100, editable: false },
    { field: 'lines', header: 'Lines', width: 70, align: 'right', editable: false, formatter: ({ value, row }) => (row && isLeaf(row.original) ? String(value) : '') },
    { field: 'amount', header: 'Amount', width: 110, align: 'right', format: usd, editable: false },
    { field: 'placed', header: 'Placed', width: 110, editable: false },
  ]
  const lineFeatures = tableFeatures({ rowSortingFeature })
  const lineColumns: GridColumns<Line> = [
    { field: 'sku', header: 'SKU', width: 140 },
    { field: 'product', header: 'Product', width: 120 },
    { field: 'qty', header: 'Qty', width: 60, align: 'right' },
    { field: 'unitPrice', header: 'Unit price', width: 100, align: 'right', format: usd },
    { field: 'total', header: 'Total', width: 100, align: 'right', format: usd },
  ]
  const orders = $derived(Number(view?.grandTotal?.id ?? 0))
</script>


<!-- The panel: the order's lines, fetched from their own endpoint when the
     row appears. The model hands the leaf over as `master`. -->
{#snippet Detail(props: { row: Row; rowIndex: number })}
  {@const master = (props.row.__group as { master?: Order }).master ?? (props.row as unknown as Order)}
  <div class="md-detail">
    <div class="md-detail-title">
      Order <strong>#{master.id}</strong> for <strong>{master.customer}</strong>
      <span class="md-detail-count">{master.lines} line{master.lines === 1 ? '' : 's'}</span>
      <span class="muted">{master.status}, placed {master.placed}</span>
    </div>
    {#await linesOf(master.id)}
      <div class="md-detail-loading" aria-busy="true">Loading lines from /orders/{master.id}/lines ...</div>
    {:then lines}
      <div class="md-detail-grid">
        <SvGrid responsive={true} data={lines} columns={lineColumns} features={lineFeatures} selectionMode="none" rowHeight={28} containerHeight="100%" fitColumns={true} virtualization={false} />
      </div>
    {/await}
  </div>
{/snippet}

<section class="wrap demo-kit">
  <header class="chrome">
    <div class="actions">
      <button type="button" class="btn" onclick={() => openFirstOnScreen(3)} title="Open the details of the first three loaded orders">Open 3</button>
      <button type="button" class="btn" disabled={!openCount} onclick={() => ctl.closeAllDetails()}>Close all details</button>
    </div>
    <label class="chk"><input type="checkbox" bind:checked={slow} /> Slow lines endpoint (900 ms)</label>
    <span class="note">
      Click the chevron on an order, or press Ctrl+Enter on its row: the model puts a detail row under
      it and the panel fetches that order's lines from a second endpoint. The tree stays virtualized,
      each panel has a fixed height the virtualizer knows, and the region row holds under the header
      while you scroll through.
    </span>
  </header>
  <div class="body">
    <div class="gridpane">
      <SvGrid
        responsive={true}
        columnResize
        fitColumns
        rowModel={ctl}
        stickyGroupRows
        showDetailToggle
        {columns}
        {features}
        sortable
        filterable
        filterMode="menu"
        selectionMode="none"
        rowHeight={32}
        detailRowHeight={200}
        isDetailRow={(row) => row.__group?.kind === 'detail'}
        renderDetailRow={Detail}
        containerHeight="100%"
        onApiReady={(next) => installEnterprise(next)}
      />
    </div>
  </div>
  <footer class="foot">
    <span class="stat"><span class="stat-label">Orders</span><strong>{orders.toLocaleString()}</strong></span>
    <span class="stat" data-stat="open"><span class="stat-label">Open details</span><strong>{openCount}</strong></span>
    <span class="stat" data-stat="lines"><span class="stat-label">Line requests</span><strong>{lineRequests}</strong></span>
    <span class="stat"><span class="stat-label">Requests</span><strong>{requests}</strong></span>
    {#if view?.error}<span class="stat err">{String((view.error as Error).message ?? view.error)}</span>{/if}
  </footer>
</section>

<style>
  /* Only what is particular to this demo; the chrome is the shared demo-kit. */
  .md-detail {
    border-left: 3px solid var(--sg-accent, #6366f1);
    background: color-mix(in oklab, var(--sg-accent, #6366f1) 4%, var(--sg-bg, #fff));
    padding: 10px 14px; width: 100%; box-sizing: border-box; height: 100%;
    display: flex; flex-direction: column; gap: 8px;
  }
  .md-detail-title {
    font-size: 12px; color: var(--sg-muted, #64748b);
    display: flex; align-items: center; gap: 10px; flex-wrap: wrap;
  }
  .md-detail-title strong { color: var(--sg-fg, #0f172a); }
  .md-detail-count {
    font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em;
    background: color-mix(in oklab, var(--sg-accent, #6366f1) 14%, transparent); color: var(--sg-accent, #6366f1);
    padding: 1px 7px; border-radius: 999px;
  }
  .md-detail-loading { font-size: 12px; color: var(--sg-muted, #64748b); font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; }
  .md-detail-grid {
    flex: 1; min-height: 0;
    border: 1px solid var(--sg-border, #e2e8f0); border-radius: 6px; overflow: hidden;
    background: var(--sg-bg, #fff);
  }
</style>
