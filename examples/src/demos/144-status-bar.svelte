<!-- Documented in: docs/help/status-bar.md -->
<script lang="ts">
  /**
   * 144. Status bar
   * ---------------
   * The Excel-style bar under the grid that shows live aggregates of the
   * SELECTED cell range - count, sum, average, min, max. Turn it on with
   * `statusBar` (and `enableCellSelection`), then drag a rectangle across
   * the numeric cells.
   *
   *   <SvGrid enableCellSelection statusBar />
   *   <SvGrid enableCellSelection statusBar={{ aggregates: ['sum', 'avg'] }} />
   */
  import { SvGrid, tableFeatures, type ColumnDef } from 'sv-grid-core'

  const features = tableFeatures({})

  type Row = {
    id: number
    product: string
    q1: number
    q2: number
    q3: number
    q4: number
  }

  let seed = 0xbee5
  const rnd = () => ((seed = (seed * 1103515245 + 12345) >>> 0) / 0xffffffff)
  const PRODUCTS = ['Industrial PLC', 'Cordless driver', 'Stainless rivets', 'Aluminum stock', 'Wire rope', 'Hardwood pallet', 'I/O module', 'Torque wrench', 'Steel sheet', 'Drum, 55 gal', 'Bearing set', 'Hydraulic hose']
  const rows: Row[] = PRODUCTS.map((product, id) => ({
    id,
    product,
    q1: Math.round(5_000 + rnd() * 95_000),
    q2: Math.round(5_000 + rnd() * 95_000),
    q3: Math.round(5_000 + rnd() * 95_000),
    q4: Math.round(5_000 + rnd() * 95_000),
  }))

  const money: ColumnDef<typeof features, Row>['format'] = {
    type: 'currency',
    currency: 'USD',
    options: { maximumFractionDigits: 0 },
  }
  const columns: ColumnDef<typeof features, Row>[] = [
    { field: 'product', header: 'Product', width: 200 },
    { field: 'q1', header: 'Q1', width: 130, align: 'right', format: money },
    { field: 'q2', header: 'Q2', width: 130, align: 'right', format: money },
    { field: 'q3', header: 'Q3', width: 130, align: 'right', format: money },
    { field: 'q4', header: 'Q4', width: 130, align: 'right', format: money },
  ]
</script>

<section class="flex flex-col flex-1 min-h-0 gap-3">
  <div
    class="shrink-0 rounded-lg border px-4 py-3"
    style="border-color: var(--sg-border); background: var(--sg-header-bg);"
  >
    <p class="text-sm font-semibold" style="color: var(--sg-fg);">
      Live range aggregates via <code>statusBar</code>
    </p>
    <p class="mt-1 text-xs" style="color: var(--sg-muted);">
      Drag a rectangle across the quarter columns. The bar under the grid
      updates with Count / Sum / Avg / Min / Max of the selection - just like
      Excel. Numeric stats appear only when the selection holds numbers.
    </p>
  </div>

  <div class="flex-1 min-h-0">
    <SvGrid
      data={rows}
      columns={columns}
      features={features}
      enableCellSelection
      statusBar
      selectionMode="cell"
      enableRowSummaries={false}
      rowHeight={36}
      containerHeight="100%"
      fitColumns={true}
    />
  </div>
</section>
