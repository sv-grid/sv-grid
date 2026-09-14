<!-- Documented in: docs/help/charts/gallery.md -->
<script lang="ts">
  /**
   * 442. Scatter and bubble charts
   * ------------------------------
   * Ninety products as points: marketing spend on x, revenue on y, one series
   * per segment, and the bubble radius from the unit count.
   *
   * - `points: [{ x, y, r, label }]` per series; `r` makes it a bubble chart,
   *   drop it for plain dots. The label is what the tooltip names.
   * - `overlay` fits a regression on each series: `linear`, `poly:2`, `exp`,
   *   `log` or `power`. The tooltip and the legend show the R-squared of the
   *   fit, so a curve that flatters the data is easy to catch.
   * - Two reference lines at the averages split the plot into quadrants.
   * - `xAxis.scale: 'log'` when spend spans two orders of magnitude, and a
   *   `min` / `max` on both axes to keep the frame still while you filter.
   * - Click a point to select it; the grid follows.
   *
   * Free, in @svgrid/grid.
   */
  import { SvChart, SvGrid, tableFeatures, rowSortingFeature, type ChartPointRef, type ChartSpec, type GridColumns, type SeriesOverlay } from '@svgrid/grid'
  import ChartDataGrid from '../shared/ChartDataGrid.svelte'
  import ViewSwitch from '../shared/ViewSwitch.svelte'

  const features = tableFeatures({ rowSortingFeature })
  type Row = { name: string; segment: string; spend: number; revenue: number; units: number }
  let seed = 23
  const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648)
  const SEGMENTS = [
    { name: 'Consumer', base: 8, slope: 2.4, noise: 22 },
    { name: 'SMB', base: 30, slope: 3.1, noise: 40 },
    { name: 'Enterprise', base: 90, slope: 4.2, noise: 90 },
  ]
  const rows: Row[] = []
  for (const seg of SEGMENTS) {
    for (let i = 0; i < 30; i += 1) {
      const spend = Math.round(Math.pow(10, 1 + rnd() * 2))
      const revenue = Math.round(seg.base + seg.slope * spend * (0.85 + rnd() * 0.3) + (rnd() - 0.5) * seg.noise)
      rows.push({ name: `${seg.name} ${String(i + 1).padStart(2, '0')}`, segment: seg.name, spend, revenue: Math.max(5, revenue), units: Math.round(20 + rnd() * 400) })
    }
  }
  const columns: GridColumns<Row> = [
    { field: 'name', header: 'Product', width: 130 },
    { field: 'spend', header: 'Spend', width: 70, align: 'right', cellDataType: 'number' },
    { field: 'revenue', header: 'Revenue', width: 80, align: 'right', cellDataType: 'number' },
    { field: 'units', header: 'Units', width: 64, align: 'right', cellDataType: 'number' },
  ]

  let bubbles = $state(true)
  let fit = $state<SeriesOverlay | ''>('linear')
  let logX = $state(false)
  let picked = $state<ChartPointRef[]>([])

  const avgSpend = Math.round(rows.reduce((s, r) => s + r.spend, 0) / rows.length)
  const avgRevenue = Math.round(rows.reduce((s, r) => s + r.revenue, 0) / rows.length)

  const spec = $derived<ChartSpec>({
    type: 'scatter',
    categories: [],
    series: SEGMENTS.map((seg) => ({
      label: seg.name,
      values: [],
      points: rows.filter((r) => r.segment === seg.name).map((r) => ({ x: r.spend, y: r.revenue, r: bubbles ? r.units : undefined, label: r.name })),
      overlay: fit || undefined,
    })),
    title: 'Revenue against marketing spend',
    subtitle: bubbles ? 'Bubble size is units sold' : 'One dot per product',
    xAxis: { title: 'Spend (k)', scale: logX ? 'log' : 'linear', min: logX ? 8 : 0, max: 1100, gridLines: true },
    yAxis: { title: 'Revenue (k)', min: 0, gridLines: true },
    referenceLines: [
      { value: avgRevenue, label: 'Avg revenue', dashed: true, color: '#94a3b8' },
      { value: avgSpend, axis: 'x', label: 'Avg spend', dashed: true, color: '#94a3b8' },
    ],
    height: 400,
  })

  const pickedName = $derived(picked[0]?.category ?? null)
  const shown = $derived(pickedName ? rows.filter((r) => r.name === pickedName) : rows)

  // Chart | Grid: the same spec as the chart or as the rows behind it.
  let view = $state<'chart' | 'grid'>('chart')
</script>

<section class="wrap">
  <header class="chrome">
    <ViewSwitch bind:value={view} options={[['chart', 'Chart'], ['grid', 'Grid']]} />
    <label class="chk"><input type="checkbox" bind:checked={bubbles} /> Bubble size from units</label>
    <label class="ctl">
      Fit
      <select bind:value={fit}>
        <option value="">None</option>
        <option value="linear">Linear</option>
        <option value="poly:2">Quadratic</option>
        <option value="exp">Exponential</option>
        <option value="log">Logarithmic</option>
        <option value="power">Power</option>
      </select>
    </label>
    <label class="chk"><input type="checkbox" bind:checked={logX} /> Log x</label>
    <span class="note">
      Points with a third value as the bubble size, a regression per series with its R-squared in the
      tooltip, quadrant lines at the averages, a log x axis, and selection that reaches the grid.
    </span>
  </header>

  <div class="row">
    <div class="pane pane-chart">
      {#if view === 'chart'}
        <SvChart {spec} legend="bottom" selectable bind:selected={picked} zoomable autosize />
      {:else}
        <ChartDataGrid spec={spec} />
      {/if}
    </div>
    <div class="grid-host">
      <div class="muted">{pickedName ? `${pickedName} selected` : `${rows.length} products; click a point`}</div>
      <SvGrid data={shown} {columns} {features} sortable rowHeight={26} containerHeight="100%" fitColumns responsive />
    </div>
  </div>
</section>

<style>
  .wrap {
    display: flex;
    flex-direction: column;
    flex: 1;
    min-height: 0;
    gap: 10px;
    overflow: auto;
  }
  .chrome {
    display: flex;
    align-items: center;
    gap: 12px;
    flex-wrap: wrap;
    flex: none;
  }
  .note,
  .muted {
    font-size: 12px;
    color: var(--sg-muted, #64748b);
  }
  .chk,
  .ctl {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    font-size: 12px;
    color: var(--sg-fg, #0f172a);
    white-space: nowrap;
  }
  .ctl select {
    font: inherit;
    border: 1px solid var(--sg-border, #e2e8f0);
    border-radius: 6px;
    background: var(--sg-bg, #fff);
    color: inherit;
    padding: 2px 6px;
  }
  .row {
    display: flex;
    flex: none;
    gap: 12px;
    flex-wrap: wrap;
    min-height: 0;
  }
  .pane {
    border: 1px solid var(--sg-border, #e2e8f0);
    border-radius: 10px;
    background: var(--sg-bg, #fff);
    padding: 8px 10px;
    min-width: 0;
  }
  .pane-chart {
    flex: 1 1 480px;
  }
  .grid-host {
    flex: 1 1 400px;
    min-width: 0;
    min-height: 320px;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
</style>
