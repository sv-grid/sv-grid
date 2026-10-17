<script lang="ts" module>
  /**
   * Order history block - an account page listing past orders in SvGrid:
   * order number, date, item count, a right-aligned total and an SvBadge status
   * cell. Headers sort, an SvSegmented filters by status, and each row's View
   * SvButton opens the order in an SvDrawer with its lines, totals and
   * shipping address. Money is integer cents. Pure UI-kit, --sg-* themed.
   *
   * Headless: createOrderHistory() below owns the orders, the status filter,
   * the selected order and its drawer state with no markup. The component
   * under it is one styled render of that core (the SvGrid columns live in the
   * render); import createOrderHistory from this file (or `npx @svgrid/ui add
   * orders-history --headless` for the core alone) to draw your own.
   */
  export type OrderStatus = 'processing' | 'shipped' | 'delivered' | 'cancelled'
  export type OrderFilter = 'all' | 'open' | 'delivered' | 'cancelled'
  export type PastOrderLine = { name: string; qty: number; priceCents: number }
  export type PastOrder = {
    id: string; number: string; placedAt: string; status: OrderStatus
    lines: PastOrderLine[]; shippingCents: number; taxCents: number; shipTo: string
    items: number; totalCents: number
  }
  export type OrderHistoryOptions = {
    orders?: PastOrder[]
    initialFilter?: OrderFilter
    onInvoice?: (order: PastOrder) => void
    /** Called with the order whose items go back in the cart; the drawer closes after. */
    onBuyAgain?: (order: PastOrder) => void
  }

  /** Badge tone and sort rank per status: Status sorts by stage, not alphabetically. */
  export const ORDER_STATUS: Record<OrderStatus, { label: string; tone: 'neutral' | 'success' | 'warning' | 'info'; rank: number }> = {
    processing: { label: 'Processing', tone: 'warning', rank: 0 },
    shipped: { label: 'Shipped', tone: 'info', rank: 1 },
    delivered: { label: 'Delivered', tone: 'success', rank: 2 },
    cancelled: { label: 'Cancelled', tone: 'neutral', rank: 3 },
  }

  export const ORDER_FILTERS: { value: OrderFilter; label: string }[] = [
    { value: 'all', label: 'All' },
    { value: 'open', label: 'Open' },
    { value: 'delivered', label: 'Delivered' },
    { value: 'cancelled', label: 'Cancelled' },
  ]

  const ADDR = 'Ada Lovelace, 18 Harbor St, Portland, OR 97209'
  const order = (number: string, placedAt: string, status: OrderStatus, lines: PastOrderLine[], shippingCents = 495): PastOrder => {
    const sub = lines.reduce((s, l) => s + l.qty * l.priceCents, 0)
    const taxCents = Math.round(sub * 0.0825)
    return {
      id: number, number, placedAt, status, lines, shippingCents, taxCents, shipTo: ADDR,
      items: lines.reduce((n, l) => n + l.qty, 0), totalCents: sub + shippingCents + taxCents,
    }
  }

  const SAMPLE_ORDERS: PastOrder[] = [
    order('NW-20417', '2026-10-13', 'processing', [{ name: 'Day pack 22 L', qty: 1, priceCents: 8900 }, { name: 'Trail bottle', qty: 2, priceCents: 2800 }], 0),
    order('NW-20388', '2026-10-08', 'shipped', [{ name: 'Merino beanie', qty: 1, priceCents: 3400 }]),
    order('NW-20301', '2026-09-27', 'shipped', [{ name: 'Rain shell', qty: 1, priceCents: 14800 }, { name: 'Stuff sack 8 L', qty: 2, priceCents: 1600 }], 1200),
    order('NW-20214', '2026-09-14', 'delivered', [{ name: 'Camp mug', qty: 4, priceCents: 1800 }]),
    order('NW-20160', '2026-09-02', 'cancelled', [{ name: 'Trekking poles', qty: 1, priceCents: 11900 }], 0),
    order('NW-20092', '2026-08-21', 'delivered', [{ name: 'Headlamp 400', qty: 1, priceCents: 4900 }, { name: 'AAA cells, 8 pack', qty: 1, priceCents: 1200 }]),
    order('NW-19975', '2026-08-03', 'delivered', [{ name: 'Wool socks, 3 pairs', qty: 2, priceCents: 3600 }]),
    order('NW-19840', '2026-07-12', 'delivered', [{ name: 'Sleeping pad', qty: 1, priceCents: 13900 }, { name: 'Pump sack', qty: 1, priceCents: 3500 }], 0),
    order('NW-19711', '2026-06-25', 'cancelled', [{ name: 'Camp chair', qty: 2, priceCents: 7400 }]),
    order('NW-19602', '2026-06-04', 'delivered', [{ name: 'Trail bottle', qty: 1, priceCents: 2800 }]),
  ]

  export function createOrderHistory(opts: OrderHistoryOptions = {}) {
    const orders = opts.orders ?? SAMPLE_ORDERS
    let filter = $state<OrderFilter>(opts.initialFilter ?? 'all')
    let selected = $state<PastOrder | null>(null)
    let open = $state(false)

    const rows = $derived(orders.filter((o) =>
      filter === 'all' ? true : filter === 'open' ? o.status === 'processing' || o.status === 'shipped' : o.status === filter))

    function view(o: PastOrder) { selected = o; open = true }
    function close() { open = false }

    return {
      orders,
      get rows() { return rows },
      get filter() { return filter },
      set filter(v: string | number | null) {
        if (ORDER_FILTERS.some((f) => f.value === v)) filter = v as OrderFilter
      },
      get selected() { return selected },
      /** Drawer visibility; bind it to your drawer or dialog. */
      get open() { return open },
      set open(v: boolean) { open = v },
      view,
      close,
      /** Call when the drawer has finished closing. */
      clearSelection: () => { selected = null },
      subtotalOf: (o: PastOrder) => o.lines.reduce((s, l) => s + l.qty * l.priceCents, 0),
      invoice: () => { if (selected) opts.onInvoice?.(selected) },
      buyAgain: () => { if (selected) opts.onBuyAgain?.(selected); open = false },
      /** Spread on a plain <button> per filter when you render your own tabs. */
      filterProps: (value: OrderFilter) => ({
        type: 'button' as const, role: 'radio' as const, 'aria-checked': filter === value,
        onclick: () => { filter = value },
      }),
      /** Spread on a plain row element to open that order on click or Enter. */
      rowProps: (o: PastOrder) => ({
        tabindex: 0, 'aria-label': `View order ${o.number}`,
        onclick: () => view(o),
        onkeydown: (e: KeyboardEvent) => { if (e.key === 'Enter') view(o) },
      }),
    }
  }
</script>

<script lang="ts">
  import {
    SvGrid, SvSegmented, SvBadge, SvButton, SvDrawer, SvDivider, SvToaster, toast, renderSnippet,
    type GridColumns,
  } from '@svgrid/grid'

  const history = createOrderHistory({
    onInvoice: (o) => toast(`Invoice for ${o.number} downloaded`),
    onBuyAgain: (o) => toast.success(`${o.items} items added to your cart`),
  })

  const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' })
  const fmt = (cents: number) => money.format(cents / 100)
  const day = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  const fmtDate = (iso: string) => day.format(new Date(iso + 'T12:00:00'))

  const ROW_H = 46
  // Rows + header, plus room for the horizontal scrollbar once the grid pans (below 640 px).
  let wrapWidth = $state(0)
  const gridHeight = $derived(Math.max(history.rows.length, 3) * ROW_H + 52 + (wrapWidth && wrapWidth < 640 ? 14 : 0))

  const columns: GridColumns<PastOrder> = [
    { field: 'number', header: 'Order', width: 120 },
    { field: 'placedAt', header: 'Date', width: 130, formatter: ({ value }) => fmtDate(String(value)) },
    { field: 'items', header: 'Items', width: 80, align: 'right', hideBelow: 520 },
    { field: 'totalCents', header: 'Total', width: 110, align: 'right', formatter: ({ value }) => fmt(Number(value)) },
    {
      field: 'status', header: 'Status', width: 130,
      sortValue: (v) => ORDER_STATUS[v as OrderStatus]?.rank ?? null,
      cell: (ctx) => renderSnippet(StatusCell, { status: ctx.row.original.status }),
    },
    { id: 'view', header: '', width: 90, align: 'right', cell: (ctx) => renderSnippet(ViewCell, { row: ctx.row.original }) },
  ]
</script>

{#snippet StatusCell(p: { status: OrderStatus })}
  <SvBadge variant={ORDER_STATUS[p.status].tone} size="sm" dot>{ORDER_STATUS[p.status].label}</SvBadge>
{/snippet}

{#snippet ViewCell(p: { row: PastOrder })}
  <SvButton size="sm" variant="ghost" ariaLabel={`View order ${p.row.number}`} onclick={() => history.view(p.row)}>View</SvButton>
{/snippet}

<main class="sv-ord-hist">
  <header class="sv-ord-hist-head">
    <div>
      <h1>Order history</h1>
      <p class="sv-ord-hist-muted">{history.orders.length} orders since June 2026. Sort by any column.</p>
    </div>
    <SvSegmented ariaLabel="Filter by status" options={ORDER_FILTERS} bind:value={history.filter} size="sm" />
  </header>

  <div class="sv-ord-hist-grid" bind:clientWidth={wrapWidth}>
    <SvGrid
      data={history.rows}
      {columns}
      getRowId={(r) => r.id}
      sortable
      selectionMode="none"
      initialSorting={[{ id: 'placedAt', desc: true }]}
      rowHeight={ROW_H}
      containerHeight={gridHeight}
      fitColumns
      responsive
      emptyMessage="No orders with this status."
      onRowClick={({ row }) => history.view(row)}
    />
  </div>
</main>

<SvDrawer bind:open={history.open} title={history.selected ? `Order ${history.selected.number}` : 'Order'} size="400px" onClosed={history.clearSelection}>
  {#if history.selected}
    {@const o = history.selected}
    <div class="sv-ord-hist-detail">
      <div class="sv-ord-hist-meta">
        <SvBadge variant={ORDER_STATUS[o.status].tone} dot>{ORDER_STATUS[o.status].label}</SvBadge>
        <span class="sv-ord-hist-muted">Placed {fmtDate(o.placedAt)}</span>
      </div>
      <ul class="sv-ord-hist-lines">
        {#each o.lines as l (l.name)}
          <li><span>{l.name} <span class="sv-ord-hist-muted">x {l.qty}</span></span><span class="sv-ord-hist-num">{fmt(l.qty * l.priceCents)}</span></li>
        {/each}
      </ul>
      <SvDivider />
      <dl class="sv-ord-hist-sum">
        <div><dt>Subtotal</dt><dd>{fmt(history.subtotalOf(o))}</dd></div>
        <div><dt>Shipping</dt><dd>{o.shippingCents ? fmt(o.shippingCents) : 'Free'}</dd></div>
        <div><dt>Tax</dt><dd>{fmt(o.taxCents)}</dd></div>
        <div class="sv-ord-hist-grand"><dt>Total</dt><dd>{fmt(o.totalCents)}</dd></div>
      </dl>
      <section>
        <h3>Ship to</h3>
        <p class="sv-ord-hist-muted">{o.shipTo}</p>
      </section>
    </div>
  {/if}
  {#snippet footer()}
    <div class="sv-ord-hist-actions">
      <SvButton variant="outline" onclick={history.invoice}>Invoice</SvButton>
      <SvButton variant="primary" onclick={history.buyAgain}>Buy again</SvButton>
    </div>
  {/snippet}
</SvDrawer>

<SvToaster position="bottom-right" />

<style>
  .sv-ord-hist {
    display: flex; flex-direction: column; gap: 18px;
    width: 100%; box-sizing: border-box; min-height: 560px; padding: 28px;
    background: var(--sg-bg, #fff); color: var(--sg-fg, #0f172a); font-family: var(--sg-font, inherit);
  }
  .sv-ord-hist-head { display: flex; align-items: flex-end; justify-content: space-between; gap: 16px; flex-wrap: wrap; }
  h1 { margin: 0 0 4px; font-size: 22px; font-weight: 650; letter-spacing: -.01em; }
  h3 { margin: 0 0 4px; font-size: 13px; font-weight: 600; }
  .sv-ord-hist-muted { margin: 0; color: var(--sg-muted, #64748b); font-size: 13px; }
  .sv-ord-hist-grid { width: 100%; min-width: 0; }
  .sv-ord-hist-detail { display: flex; flex-direction: column; gap: 18px; }
  .sv-ord-hist-meta { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
  .sv-ord-hist-lines { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 10px; font-size: 14px; }
  .sv-ord-hist-lines li, .sv-ord-hist-sum div { display: flex; justify-content: space-between; gap: 12px; }
  .sv-ord-hist-num, .sv-ord-hist-sum dd { font-variant-numeric: tabular-nums; }
  .sv-ord-hist-sum { display: flex; flex-direction: column; gap: 6px; margin: 0; font-size: 14px; }
  .sv-ord-hist-sum dt { color: var(--sg-muted, #64748b); }
  .sv-ord-hist-sum dd { margin: 0; }
  .sv-ord-hist-grand { padding-top: 8px; border-top: 1px solid var(--sg-border, #e2e8f0); font-weight: 650; }
  .sv-ord-hist-grand dt { color: var(--sg-fg, #0f172a); }
  .sv-ord-hist-actions { display: flex; justify-content: flex-end; gap: 8px; }

  @media (max-width: 600px) {
    .sv-ord-hist { padding: 20px 16px; }
    .sv-ord-hist-head { align-items: stretch; flex-direction: column; }
  }
</style>
