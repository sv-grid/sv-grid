<!-- Documented in: docs/help/charts/gallery.md -->
<script lang="ts">
  /**
   * 446. Radar and radial charts
   * ----------------------------
   * The polar family, on one product-comparison dataset:
   *
   * - A radar (spider) chart: one axis per attribute, one polygon per
   *   product, with the axis pinned to 0..100 so a product that scores low
   *   everywhere does not stretch to the rim. Click a legend item to hide a
   *   product, double-click to isolate one; the switches below do the same
   *   through `visible` on the series.
   * - A radial column chart: the same monthly series as bars around a
   *   circle, stacked; a nightingale (polar area) chart, where the radius,
   *   not the angle, carries the value; and a radial bar chart, one ring
   *   per category read against the scale.
   *
   * Every one takes the same `categories` and `series` a bar chart takes;
   * `type` is the only difference.
   *
   * Free, in @svgrid/grid.
   */
  import { SvChart, type ChartSpec, type ChartType } from '@svgrid/grid'
  import ChartDataGrid from '../shared/ChartDataGrid.svelte'
  import ViewSwitch from '../shared/ViewSwitch.svelte'

  const attributes = ['Speed', 'Battery', 'Camera', 'Display', 'Build', 'Value']
  const products = [
    { label: 'Aster 12', values: [88, 72, 91, 85, 80, 62] },
    { label: 'Birch S', values: [74, 90, 70, 78, 86, 84] },
    { label: 'Cedar One', values: [65, 68, 74, 92, 70, 95] },
  ]
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  const sales = [
    { label: 'Online', values: [42, 38, 51, 47, 55, 63, 71, 68, 60, 57, 74, 92] },
    { label: 'Retail', values: [30, 28, 33, 35, 38, 41, 46, 44, 39, 42, 55, 70] },
  ]

  let shown = $state<Record<string, boolean>>({ 'Aster 12': true, 'Birch S': true, 'Cedar One': true })
  let radialType = $state<Extract<ChartType, 'radial-column' | 'nightingale' | 'radial-bar'>>('radial-column')

  const radar = $derived<ChartSpec>({
    type: 'radar',
    categories: attributes,
    series: products.map((p) => ({ ...p, visible: shown[p.label] !== false })),
    title: 'Three phones, six attributes',
    subtitle: 'Scores out of 100',
    yAxis: { min: 0, max: 100 },
    height: 360,
  })
  const radial = $derived<ChartSpec>({
    type: radialType,
    categories: radialType === 'radial-bar' ? MONTHS.slice(0, 6) : MONTHS,
    series: radialType === 'radial-bar' ? [{ label: 'Online', values: sales[0]!.values.slice(0, 6) }] : sales,
    stacked: radialType === 'radial-column',
    title: radialType === 'radial-column' ? 'Sales around the year' : radialType === 'nightingale' ? 'Sales as a nightingale' : 'First half, one ring per month',
    subtitle: radialType === 'radial-column' ? 'Stacked columns on a circle' : radialType === 'nightingale' ? 'The radius carries the value, every slice the same angle' : 'Radial bars read against the shared scale',
    valueFormat: 'compact',
    height: 360,
  })

  // Chart | Grid: the same spec as the chart or as the rows behind it.
  let view = $state<'chart' | 'grid'>('chart')
</script>

<section class="wrap">
  <header class="chrome">
    <ViewSwitch bind:value={view} options={[['chart', 'Chart'], ['grid', 'Grid']]} />
    {#each products as p (p.label)}
      <label class="chk"><input type="checkbox" bind:checked={shown[p.label]} /> {p.label}</label>
    {/each}
    <label class="ctl">
      Radial
      <select bind:value={radialType}>
        <option value="radial-column">Radial column</option>
        <option value="nightingale">Nightingale</option>
        <option value="radial-bar">Radial bar</option>
      </select>
    </label>
    <span class="note">
      A radar with one axis per attribute and a polygon per product, and the same monthly series as
      radial columns, a nightingale and radial bars; only the type changes.
    </span>
  </header>

  <div class="row">
    <div class="pane">
      {#if view === 'chart'}
        <SvChart spec={radar} legend="bottom" autosize />
      {:else}
        <ChartDataGrid spec={radar} />
      {/if}
    </div>
    <div class="pane">
      {#if view === 'chart'}
        <SvChart spec={radial} legend="bottom" autosize />
      {:else}
        <ChartDataGrid spec={radial} />
      {/if}
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
  .row {
    display: flex;
    flex: none;
    gap: 12px;
    flex-wrap: wrap;
  }
  .pane {
    flex: 1 1 380px;
    border: 1px solid var(--sg-border, #e2e8f0);
    border-radius: 10px;
    background: var(--sg-bg, #fff);
    padding: 8px 10px;
    min-width: 0;
  }
</style>
