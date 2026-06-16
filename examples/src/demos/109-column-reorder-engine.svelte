<script lang="ts">
  /**
   * 109. Column reorder - engine-level (`enableColumnReorder`)
   * ---------------------------------------------------------
   * Set `enableColumnReorder` on `<SvGrid>` and every header becomes
   * draggable. The grid paints a vertical drop indicator between
   * neighbouring headers, fires `onColumnOrderChange` on every change,
   * and exposes `api.setColumnOrder()` / `api.getColumnOrder()` for
   * imperative use (saved views, URL persistence, command palettes).
   *
   * Different from demo 104 (which wires drag-and-drop in user-land via
   * a mutation observer). This is the engine feature.
   */
  import {
    SvGrid,
    tableFeatures,
    rowSortingFeature,
    columnFilteringFeature,
    type ColumnDef,
    type SvGridApi,
  } from '@svgrid/grid'

  type Row = {
    symbol: string
    name: string
    sector: string
    price: number
    change: number
    changePct: number
    volume: number
    marketCap: number
    pe: number
    yield: number
  }

  let rows = $state<Row[]>([
    { symbol: 'AAPL', name: 'Apple',     sector: 'Tech',    price: 198.42, change:  +1.84, changePct: +0.94, volume: 48_241_900, marketCap: 3_100_000, pe: 32.4, yield: 0.52 },
    { symbol: 'MSFT', name: 'Microsoft', sector: 'Tech',    price: 412.18, change:  -2.40, changePct: -0.58, volume: 22_124_500, marketCap: 3_050_000, pe: 34.2, yield: 0.74 },
    { symbol: 'NVDA', name: 'NVIDIA',    sector: 'Tech',    price: 124.89, change:  +5.21, changePct: +4.36, volume: 295_881_100, marketCap: 2_950_000, pe: 75.1, yield: 0.01 },
    { symbol: 'GOOGL',name: 'Alphabet',  sector: 'Tech',    price: 178.92, change:  +0.84, changePct: +0.47, volume: 18_456_200, marketCap: 2_100_000, pe: 26.8, yield: 0.46 },
    { symbol: 'AMZN', name: 'Amazon',    sector: 'Retail',  price: 188.31, change:  +1.18, changePct: +0.63, volume: 36_120_400, marketCap: 1_900_000, pe: 51.9, yield: 0.00 },
    { symbol: 'META', name: 'Meta',      sector: 'Tech',    price: 502.71, change:  -3.62, changePct: -0.72, volume: 12_894_000, marketCap: 1_240_000, pe: 28.9, yield: 0.39 },
    { symbol: 'BRK',  name: 'Berkshire', sector: 'Finance', price: 432.10, change:  +0.92, changePct: +0.21, volume:  3_217_800, marketCap:   870_000, pe:  9.6, yield: 0.00 },
    { symbol: 'LLY',  name: 'Eli Lilly', sector: 'Pharma',  price: 826.42, change:  +9.18, changePct: +1.12, volume:  3_142_900, marketCap:   765_000, pe:132.8, yield: 0.61 },
    { symbol: 'TSM',  name: 'TSMC',      sector: 'Tech',    price: 174.96, change:  +2.51, changePct: +1.46, volume: 16_410_200, marketCap:   720_000, pe: 21.4, yield: 1.27 },
    { symbol: 'JPM',  name: 'JPMorgan',  sector: 'Finance', price: 209.42, change:  +0.16, changePct: +0.08, volume:  9_840_100, marketCap:   580_000, pe: 11.8, yield: 2.34 },
    { symbol: 'TSLA', name: 'Tesla',     sector: 'Auto',    price: 178.92, change:  -3.41, changePct: -1.87, volume: 102_815_000, marketCap:   560_000, pe: 65.2, yield: 0.00 },
    { symbol: 'V',    name: 'Visa',      sector: 'Finance', price: 274.18, change:  +1.05, changePct: +0.38, volume:  6_280_400, marketCap:   550_000, pe: 30.1, yield: 0.79 },
  ])

  const features = tableFeatures({ rowSortingFeature, columnFilteringFeature })
  let api = $state<SvGridApi<typeof features, Row> | null>(null)

  // ---- Persisted column order ------------------------------------------
  function loadOrder(): string[] | undefined {
    try {
      const raw = localStorage.getItem('sv-109-column-order')
      if (raw) {
        const arr = JSON.parse(raw) as string[]
        if (Array.isArray(arr)) return arr
      }
    } catch { /* ignore */ }
    return undefined
  }
  let order = $state<string[]>(loadOrder() ?? [])
  $effect(() => {
    if (order.length > 0) {
      try { localStorage.setItem('sv-109-column-order', JSON.stringify(order)) } catch { /* ignore */ }
    }
  })

  let lastChange = $state<string>('')

  function resetOrder() {
    order = []
    try { localStorage.removeItem('sv-109-column-order') } catch { /* ignore */ }
    lastChange = 'reset to natural order'
  }
  function reverseOrder() {
    const current = api?.getColumnOrder() ?? []
    api?.setColumnOrder(current.slice().reverse())
  }
  function alphabetical() {
    const current = api?.getColumnOrder() ?? []
    api?.setColumnOrder(current.slice().sort())
  }

  const columns: ColumnDef<typeof features, Row>[] = [
    { field: 'symbol',     header: 'Symbol',      width: 90,  editable: false },
    { field: 'name',       header: 'Company',     width: 150, editable: false },
    { field: 'sector',     header: 'Sector',      width: 110, editable: false },
    { field: 'price',      header: 'Price',       width: 100, align: 'right', editable: false,
      format: { type: 'number', options: { style: 'currency', currency: 'USD', maximumFractionDigits: 2 } } },
    { field: 'change',     header: 'Change $',    width: 100, align: 'right', editable: false,
      cellClass: (ctx) => `change-${(ctx.getValue() as number) >= 0 ? 'pos' : 'neg'}`,
      format: { type: 'number', options: { signDisplay: 'always', maximumFractionDigits: 2 } } },
    { field: 'changePct',  header: 'Change %',    width: 100, align: 'right', editable: false,
      cellClass: (ctx) => `change-${(ctx.getValue() as number) >= 0 ? 'pos' : 'neg'}`,
      format: { type: 'number', options: { signDisplay: 'always', maximumFractionDigits: 2, style: 'percent' } } },
    { field: 'volume',     header: 'Volume',      width: 130, align: 'right', editable: false,
      format: { type: 'number', options: { notation: 'compact', maximumFractionDigits: 1 } } },
    { field: 'marketCap',  header: 'Market cap',  width: 130, align: 'right', editable: false,
      format: { type: 'number', options: { style: 'currency', currency: 'USD', notation: 'compact', maximumFractionDigits: 1 } } },
    { field: 'pe',         header: 'P/E',         width:  80, align: 'right', editable: false },
    { field: 'yield',      header: 'Yield %',     width:  90, align: 'right', editable: false,
      format: { type: 'number', options: { maximumFractionDigits: 2 } } },
  ]
</script>

<section class="flex flex-col flex-1 min-h-0 gap-3">
  <div class="info shrink-0">
    <p>
      <strong>Drag any column header</strong> to reorder. A vertical drop indicator paints between neighbouring headers; on release, the grid reorders and emits <code>onColumnOrderChange</code>. The order persists across reloads (localStorage). Use the toolbar to drive the order via <code>api.setColumnOrder()</code>.
    </p>
    <div class="actions">
      <button class="btn" onclick={reverseOrder}>Reverse</button>
      <button class="btn" onclick={alphabetical}>Alphabetical</button>
      <button class="btn alt" onclick={resetOrder}>Reset to natural</button>
    </div>
    <code class="order-readout">{order.length ? order.join(' › ') : '(natural order)'}</code>
    {#if lastChange}<div class="last-change">Last change: {lastChange}</div>{/if}
  </div>

  <div class="flex-1 min-h-0">
    <SvGrid
      data={rows}
      columns={columns}
      features={features}
      enableColumnReorder={true}
      columnOrder={order}
      onColumnOrderChange={(next) => {
        order = [...next]
        lastChange = next.join(', ')
      }}
      filterMode="menu"
      selectionMode="cell"
      showPagination={false}
      enableInlineEditing={false}
      enableCellSelection={true}
      enableRowSummaries={false}
      rowHeight={34}
      containerHeight="100%"
      fitColumns={false}
      onApiReady={(next) => (api = next)}
    />
  </div>
</section>

<style>
  .info {
    display: flex; flex-direction: column; gap: 6px;
    border: 1px solid var(--sg-border, #e2e8f0);
    background: linear-gradient(135deg, rgba(99,102,241,0.04), rgba(168,85,247,0.03));
    border-radius: 8px; padding: 10px 14px;
    font-size: 13px; color: var(--sg-fg, #0f172a);
  }
  .info p { margin: 0; }
  .info code {
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    background: rgba(99,102,241,0.12); color: #4338ca;
    padding: 1px 5px; border-radius: 3px; font-size: 12px;
  }
  .order-readout {
    background: var(--sg-bg, #fff) !important;
    border: 1px dashed color-mix(in oklab, #6366f1 30%, transparent);
    font-size: 11px !important; padding: 4px 8px !important;
    overflow-x: auto; white-space: nowrap;
  }
  .last-change { font-size: 11px; color: var(--sg-muted, #64748b); }
  .actions { display: flex; gap: 6px; }
  .btn {
    background: linear-gradient(135deg, #6366f1, #8b5cf6); color: #fff;
    border: 0; border-radius: 6px; padding: 5px 12px;
    font-size: 12px; font-weight: 700; cursor: pointer;
  }
  .btn.alt {
    background: var(--sg-bg, #fff); color: var(--sg-fg, #0f172a);
    border: 1px solid var(--sg-border, #cbd5e1);
  }
  .btn:hover { filter: brightness(1.08); }

  :global(td.change-pos) { color: #16a34a; font-weight: 700; font-variant-numeric: tabular-nums; }
  :global(td.change-neg) { color: #dc2626; font-weight: 700; font-variant-numeric: tabular-nums; }
</style>
