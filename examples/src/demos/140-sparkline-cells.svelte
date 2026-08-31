<!-- Documented in: docs/help/cells/sparklines.md -->
<script lang="ts">
  /**
   * 140. Sparkline cells
   * --------------------
   * In-cell mini charts as a first-class column type - no custom snippet,
   * no chart library. Set `sparkline` on a column whose value is an array
   * of numbers (or a comma/space string) and the grid paints an inline SVG:
   *
   *   { field: 'trend', sparkline: { type: 'line' } }
   *   { field: 'flow',  sparkline: { type: 'bar', color: '#16a34a' } }
   *   { field: 'streak', sparkline: { type: 'winloss' } }
   *
   * Four types: line, area, bar, win/loss. Each takes color / negativeColor /
   * width / height and an optional fixed min/max scale.
   */
  import { SvGrid, tableFeatures, type ColumnDef } from '@svgrid/grid'

  const features = tableFeatures({})

  type Row = {
    id: number
    product: string
    revenue: number[]
    volume: number[]
    delta: number[]
    streak: number[]
  }

  // Deterministic pseudo-random series so the demo is stable across reloads.
  let seed = 0x2f6e2b1
  function rnd() {
    seed = (seed * 1664525 + 1013904223) >>> 0
    return seed / 0xffffffff
  }
  function series(n: number, base: number, swing: number): number[] {
    const out: number[] = []
    let v = base
    for (let i = 0; i < n; i += 1) {
      v += (rnd() - 0.45) * swing
      out.push(Math.round(v))
    }
    return out
  }
  function signs(n: number): number[] {
    return Array.from({ length: n }, () => (rnd() > 0.42 ? 1 : -1))
  }

  const PRODUCTS = [
    'Industrial PLC', 'Cordless driver', 'Stainless rivets', 'Aluminum stock',
    'Wire rope', 'Hardwood pallet', 'I/O module', 'Torque wrench',
    'Steel sheet', 'Drum, 55 gal', 'Bearing set', 'Hydraulic hose',
  ]
  const rows: Row[] = PRODUCTS.map((product, id) => ({
    id,
    product,
    revenue: series(16, 100, 40),
    volume: series(12, 50, 60).map((v) => Math.max(0, v)),
    delta: series(14, 0, 30),
    streak: signs(14),
  }))

  const columns: ColumnDef<typeof features, Row>[] = [
    { field: 'product', header: 'Product', width: 180 },
    {
      field: 'revenue',
      header: 'Revenue (line)',
      width: 160,
      align: 'center',
      sparkline: { type: 'line' },
    },
    {
      field: 'revenue',
      id: 'revenue-area',
      header: 'Revenue (area)',
      width: 160,
      align: 'center',
      sparkline: { type: 'area', color: '#0ea5e9' },
    },
    {
      field: 'volume',
      header: 'Volume (bar)',
      width: 160,
      align: 'center',
      sparkline: { type: 'bar', color: '#16a34a' },
    },
    {
      field: 'delta',
      header: 'Delta (bar +/-)',
      width: 160,
      align: 'center',
      sparkline: { type: 'bar', color: '#16a34a', negativeColor: '#ef4444' },
    },
    {
      field: 'streak',
      header: 'Win / loss',
      width: 150,
      align: 'center',
      sparkline: { type: 'winloss', color: '#16a34a', negativeColor: '#ef4444' },
    },
  ]
</script>

<section class="flex flex-col flex-1 min-h-0 gap-3">
  <div
    class="shrink-0 rounded-lg border px-4 py-3"
    style="border-color: var(--sg-border); background: var(--sg-header-bg);"
  >
    <p class="text-sm font-semibold" style="color: var(--sg-fg);">
      In-cell sparklines via <code>sparkline</code> on the column
    </p>
    <p class="mt-1 text-xs" style="color: var(--sg-muted);">
      The cell value is a number array; the grid renders the SVG. No chart
      library, no custom cell snippet. Line, area, bar (with +/- coloring),
      and win/loss.
    </p>
  </div>

  <div class="flex-1 min-h-0">
    <SvGrid responsive={true}
      data={rows}
      columns={columns}
      features={features}
      selectionMode="none"
      rowHeight={40}
      containerHeight="100%"
      fitColumns={true}
    />
  </div>
</section>
