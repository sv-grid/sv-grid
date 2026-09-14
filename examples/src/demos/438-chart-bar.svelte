<!-- Documented in: docs/help/charts/gallery.md -->
<script lang="ts">
  /**
   * 438. Bar charts
   * ---------------
   * One dataset, eight quarters of revenue for three regions, drawn every way
   * a bar chart is drawn:
   *
   * - `stacked`, `stacked100` and `orientation: 'horizontal'` are spec fields,
   *   so the switches below change three words and the chart redraws.
   * - `categoryGroups` puts the year over its four quarters as a second axis
   *   tier, with the group span rather than a repeated label.
   * - `referenceLines` draws the plan as a dashed pill on the value axis.
   * - `dataLabels` writes the value on each bar; `hideOverlap` keeps the
   *   grouped chart readable when the bars get narrow.
   * - The second chart is the same data as variance to plan: negative bars
   *   hang from the zero line and take the colour of their sign through
   *   `colors`, one per category.
   *
   * Free, in @svgrid/grid.
   */
  import { SvChart, type ChartSpec } from '@svgrid/grid'
  import ChartDataGrid from '../shared/ChartDataGrid.svelte'
  import ViewSwitch from '../shared/ViewSwitch.svelte'

  const QUARTERS = ['Q1', 'Q2', 'Q3', 'Q4', 'Q1', 'Q2', 'Q3', 'Q4']
  const regions = [
    { label: 'Americas', values: [42, 47, 51, 63, 55, 58, 64, 78] },
    { label: 'EMEA', values: [31, 33, 36, 44, 39, 42, 45, 57] },
    { label: 'APAC', values: [18, 22, 26, 31, 29, 34, 38, 46] },
  ]
  const plan = [95, 100, 110, 130, 125, 132, 145, 170]

  let stacked = $state(false)
  let percent = $state(false)
  let horizontal = $state(false)
  let labels = $state(true)

  const revenue = $derived<ChartSpec>({
    type: 'bar',
    categories: QUARTERS,
    categoryGroups: [{ label: '2025', span: 4 }, { label: '2026', span: 4 }],
    series: regions.map((r) => ({ label: r.label, values: r.values })),
    stacked: stacked || percent,
    stacked100: percent,
    orientation: horizontal ? 'horizontal' : 'vertical',
    valueFormat: 'currency',
    title: 'Revenue by region',
    subtitle: percent ? 'Share of each quarter' : 'USD millions, quarterly',
    yAxis: { title: percent ? 'Share' : 'USD (millions)', gridLines: true },
    referenceLines: !percent && stacked ? [{ value: 130, label: 'Plan 2026', dashed: true, pill: true }] : undefined,
    dataLabels: labels ? { show: true, placement: stacked || percent ? 'inside' : 'top', hideOverlap: true } : { show: false },
    height: 340,
  })

  /** Actual minus plan per quarter: a bar that can hang below zero. */
  const variance = $derived<ChartSpec>({
    type: 'bar',
    categories: QUARTERS,
    categoryGroups: [{ label: '2025', span: 4 }, { label: '2026', span: 4 }],
    series: [
      {
        label: 'Actual vs plan',
        values: plan.map((p, i) => regions.reduce((sum, r) => sum + r.values[i]!, 0) - p),
        colors: plan.map((p, i) => (regions.reduce((sum, r) => sum + r.values[i]!, 0) - p >= 0 ? '#16a34a' : '#dc2626')),
      },
    ],
    valueFormat: 'currency',
    title: 'Variance to plan',
    subtitle: 'Total revenue minus the plan, per quarter',
    yAxis: { gridLines: true, title: 'USD (millions)' },
    referenceLines: [{ value: 0, label: '', color: '#94a3b8' }],
    dataLabels: { show: true, placement: 'top', formatter: (v) => (v > 0 ? `+${v}` : String(v)) },
    height: 220,
  })

  // Chart | Grid: the same spec as the chart or as the rows behind it.
  let view = $state<'chart' | 'grid'>('chart')
</script>

<section class="wrap">
  <header class="chrome">
    <ViewSwitch bind:value={view} options={[['chart', 'Chart'], ['grid', 'Grid']]} />
    <label class="chk"><input type="checkbox" bind:checked={stacked} disabled={percent} /> Stacked</label>
    <label class="chk"><input type="checkbox" bind:checked={percent} /> 100%</label>
    <label class="chk"><input type="checkbox" bind:checked={horizontal} /> Horizontal</label>
    <label class="chk"><input type="checkbox" bind:checked={labels} /> Data labels</label>
    <span class="note">
      Grouped, stacked, normalised and horizontal bars from one spec; a year tier over the quarters, a
      plan line, labels that step aside when bars get narrow, and negative bars that hang from zero.
    </span>
  </header>

  <div class="pane">
    {#if view === 'chart'}
      <SvChart spec={revenue} legend="bottom" selectable autosize />
    {:else}
      <ChartDataGrid spec={revenue} />
    {/if}
  </div>
  <div class="pane">
    {#if view === 'chart'}
      <SvChart spec={variance} legend={false} autosize />
    {:else}
      <ChartDataGrid spec={variance} />
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
  .chk {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    font-size: 12px;
    color: var(--sg-fg, #0f172a);
    white-space: nowrap;
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
