<!-- Documented in: docs/help/charts/gallery.md -->
<script lang="ts">
  /**
   * 443. Combination charts
   * -----------------------
   * Revenue and cost as bars, gross margin as a line on its own axis, and a
   * target for the margin: the chart a monthly review is built on.
   *
   * - `type` per series: the spec is a bar chart, one series says `'line'`,
   *   another `'area'`. Bars keep their slots; the line takes its points from
   *   the slot centres.
   * - `axis: 'right'` moves the margin to `y2Axis`, formatted as a percent
   *   (the values are fractions, 0.29 for 29%), with its own domain so 30%
   *   does not sit on the same scale as $3M. The tooltip and the
   *   screen-reader table read the margin in that format too.
   * - `referenceLines` with `axis: 'right'` draws the margin target on that
   *   axis, not the left one.
   * - `dataLabels` on the bars only, through the series' own `dataLabels`
   *   placement in the spec and a formatter that hides them on the line.
   * - `tooltipMode="shared"` lists every series for the hovered month.
   *
   * Free, in @svgrid/grid.
   */
  import { SvChart, type ChartSpec } from '@svgrid/grid'
  import ChartDataGrid from '../shared/ChartDataGrid.svelte'
  import ViewSwitch from '../shared/ViewSwitch.svelte'

  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  const revenue = [2.1, 2.3, 2.6, 2.4, 2.9, 3.2, 3.1, 3.4, 3.6, 3.5, 3.9, 4.3]
  const cost = [1.5, 1.6, 1.8, 1.8, 2.0, 2.1, 2.2, 2.3, 2.3, 2.4, 2.5, 2.7]
  // A fraction: the right axis formats it as a percent.
  const margin = revenue.map((r, i) => Math.round(((r - cost[i]!) / r) * 1000) / 1000)

  let costAs = $state<'bar' | 'area'>('bar')
  let smooth = $state(true)
  let labels = $state(true)

  const spec = $derived<ChartSpec>({
    type: 'bar',
    categories: MONTHS,
    series: [
      { label: 'Revenue', values: revenue, color: '#2563eb' },
      { label: 'Cost', values: cost, type: costAs, color: '#94a3b8', opacity: costAs === 'area' ? 0.5 : 1, gradient: costAs === 'area' },
      { label: 'Gross margin', values: margin, type: 'line', axis: 'right', color: '#16a34a', marker: 'circle', smooth, strokeWidth: 2.5 },
    ],
    title: 'Revenue, cost and margin',
    subtitle: 'USD millions on the left, gross margin on the right',
    valueFormat: 'currency',
    yAxis: { title: 'USD (millions)', gridLines: true, min: 0 },
    y2Axis: { title: 'Gross margin', format: 'percent', min: 0, max: 0.5, gridLines: false },
    referenceLines: [{ value: 0.33, axis: 'right', label: 'Margin target 33%', color: '#16a34a', dashed: true, pill: true }],
    dataLabels: labels ? { show: true, placement: 'top', hideOverlap: true, formatter: (v, ctx) => (ctx.series === 'Revenue' ? `$${v}M` : '') } : { show: false },
    height: 400,
  })

  // Chart | Grid: the same spec as the chart or as the rows behind it.
  let view = $state<'chart' | 'grid'>('chart')
</script>

<section class="wrap">
  <header class="chrome">
    <ViewSwitch bind:value={view} options={[['chart', 'Chart'], ['grid', 'Grid']]} />
    <label class="ctl">
      Cost as
      <select bind:value={costAs}>
        <option value="bar">Bars</option>
        <option value="area">Area</option>
      </select>
    </label>
    <label class="chk"><input type="checkbox" bind:checked={smooth} /> Smooth margin line</label>
    <label class="chk"><input type="checkbox" bind:checked={labels} /> Revenue labels</label>
    <span class="note">
      Bars, a line and an area in one spec, a second value axis with its own format and domain, a
      target drawn on that axis, labels on one series only, and a shared tooltip per month.
    </span>
  </header>

  <div class="pane">
    {#if view === 'chart'}
      <SvChart {spec} legend="bottom" tooltipMode="shared" crosshairLabels autosize />
    {:else}
      <ChartDataGrid spec={spec} />
    {/if}
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
  .note {
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
  .pane {
    flex: none;
    border: 1px solid var(--sg-border, #e2e8f0);
    border-radius: 10px;
    background: var(--sg-bg, #fff);
    padding: 8px 10px;
    min-width: 0;
  }
</style>
