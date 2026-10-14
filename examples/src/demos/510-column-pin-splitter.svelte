<script lang="ts">
  /**
   * 510. Drag to pin columns
   * ------------------------
   * `pinSplitter` draws a divider at the right edge of the left-pinned
   * columns (the row numbers when none are pinned). Drag it right and the
   * columns it passes are pinned; drag it left and they scroll again. It
   * snaps to column edges, shows how many columns it will pin, keeps 120px
   * for the columns that scroll, and never pins them all. A column that
   * changes sides stays where it is on screen. Escape drops a drag; with the
   * keyboard, Tab to the divider and use the arrow keys (Home unpins all).
   *
   * Free in @svgrid/grid, and loaded only when the prop is on. Its words
   * come from `localization.text` like the rest of the grid's UI.
   */
  import { SvGrid, type GridColumns, type SvGridApi } from '@svgrid/grid'

  type Order = {
    id: number
    order: string
    customer: string
    region: string
    rep: string
    product: string
    qty: number
    unitPrice: number
    discount: number
    total: number
    status: string
    ordered: string
    shipped: string
    carrier: string
  }

  const CUSTOMERS = ['Northwind Traders', 'Contoso Ltd', 'Fabrikam Inc', 'Adventure Works', 'Tailspin Toys', 'Wide World Importers', 'Litware', 'Proseware']
  const REGIONS = ['North America', 'Europe', 'Asia Pacific', 'Latin America']
  const REPS = ['Ana Ruiz', 'Ben Okafor', 'Cleo Park', 'Dev Shah', 'Elena Novak']
  const PRODUCTS = ['Standing desk', 'Ergonomic chair', 'Monitor arm', 'Desk lamp', 'Cable tray', 'Footrest']
  const STATUS = ['Processing', 'Shipped', 'Delivered', 'On hold']
  const CARRIERS = ['DHL', 'UPS', 'FedEx', 'Maersk']
  const day = (n: number) => new Date(Date.UTC(2026, 8, 1 + n)).toISOString().slice(0, 10)
  const rows: Order[] = Array.from({ length: 60 }, (_, i) => {
    const qty = 1 + ((i * 7) % 24)
    const unitPrice = [649, 389, 129, 89, 45, 59][i % 6]!
    const discount = [0, 0.05, 0.1, 0, 0.15][i % 5]!
    const status = STATUS[(i * 3) % 4]!
    return {
      id: i + 1,
      order: `SO-${String(24100 + i)}`,
      customer: CUSTOMERS[i % CUSTOMERS.length]!,
      region: REGIONS[(i * 5) % REGIONS.length]!,
      rep: REPS[i % REPS.length]!,
      product: PRODUCTS[i % PRODUCTS.length]!,
      qty,
      unitPrice,
      discount,
      total: Math.round(qty * unitPrice * (1 - discount) * 100) / 100,
      status,
      ordered: day(i % 28),
      shipped: status === 'Processing' || status === 'On hold' ? '' : day((i % 28) + 2),
      carrier: CARRIERS[i % CARRIERS.length]!,
    }
  })

  const columns: GridColumns<Order> = [
    { field: 'order', header: 'Order', width: 110 },
    { field: 'customer', header: 'Customer', width: 190 },
    { field: 'region', header: 'Region', width: 140 },
    { field: 'rep', header: 'Sales rep', width: 130 },
    { field: 'product', header: 'Product', width: 160 },
    { field: 'qty', header: 'Qty', width: 80, editorType: 'number' },
    { field: 'unitPrice', header: 'Unit price', width: 110, editorType: 'number', format: { type: 'currency', currency: 'USD' } },
    { field: 'discount', header: 'Discount', width: 100, editorType: 'number', format: { type: 'percent' } },
    { field: 'total', header: 'Total', width: 120, editorType: 'number', format: { type: 'currency', currency: 'USD' } },
    { field: 'status', header: 'Status', width: 120 },
    { field: 'ordered', header: 'Ordered', width: 120, cellDataType: 'dateString' },
    { field: 'shipped', header: 'Shipped', width: 120, cellDataType: 'dateString' },
    { field: 'carrier', header: 'Carrier', width: 110 },
  ]

  let api = $state.raw<SvGridApi<any, Order> | null>(null)
  // What is pinned, as the grid has it now (the splitter, the column menu or Reset).
  const pinned = $derived(api ? api.getColumnPinning().left : [])
  const headerOf = (id: string) => columns.find((c) => c.field === id)?.header ?? id
</script>

<section class="flex flex-col gap-3 h-full min-h-0">
  <div class="flex flex-wrap items-center gap-3 shrink-0">
    <p class="ps-note text-sm m-0 flex-1 min-w-[260px]">
      Drag the line at the edge of the pinned columns to pin more or fewer. It snaps to column edges; Escape cancels; Tab to it and use the arrow keys.
    </p>
    <span class="ps-pinned text-sm" aria-live="polite">
      {pinned.length ? `Pinned: ${pinned.map(headerOf).join(', ')}` : 'Nothing pinned'}
    </span>
    <button type="button" class="ps-btn text-sm" onclick={() => api?.setColumnPinning({ left: ['order'], right: [] })}>Reset</button>
  </div>
  <div class="flex-1 min-h-0">
    <SvGrid
      data={rows}
      {columns}
      getRowId={(r) => String(r.id)}
      showRowNumbers
      showRowSelection={false}
      pinSplitter
      columnResize
      sortable
      initialColumnPinning={{ left: ['order'], right: [] }}
      containerHeight="100%"
      onApiReady={(a) => (api = a)}
    />
  </div>
</section>

<style>
  .ps-note { color: var(--sg-muted, #64748b); }
  .ps-pinned {
    padding: 3px 10px; border-radius: 999px; color: var(--sg-fg, #0f172a);
    background: color-mix(in srgb, var(--sg-fg, #0f172a) 6%, transparent);
  }
  .ps-btn {
    height: 30px; padding: 0 12px; border-radius: 8px; font: inherit; cursor: pointer;
    border: 1px solid var(--sg-border, #cbd5e1); background: var(--sg-bg, #fff); color: var(--sg-fg, #0f172a);
  }
</style>
