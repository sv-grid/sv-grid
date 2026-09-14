<!-- Documented in: docs/help/charts/gallery.md -->
<script lang="ts">
  /**
   * 449. Waterfall, funnel and pareto
   * ---------------------------------
   * Three charts that explain how a total came to be:
   *
   * - The waterfall bridges revenue to net income: each bar starts where the
   *   last one ended, `waterfallTotals` marks the bars that are subtotals
   *   (they restart from zero), and `waterfallColors` names the colours for
   *   up, down and total. Connectors join the steps.
   * - The funnel is a sign-up flow. Each segment carries its count, the
   *   tooltip its conversion from the top and its drop-off from the step
   *   before; `funnelShape` draws it as a trapezoid, a pyramid or a cone.
   * - The pareto sorts the causes of returns by count and runs a cumulative
   *   percentage line over them, with the 80% line marked, so the few
   *   causes behind most of the returns stand out.
   *
   * Free, in @svgrid/grid.
   */
  import { SvChart, paretoSpec, type ChartSpec } from '@svgrid/grid'
  import ChartDataGrid from '../shared/ChartDataGrid.svelte'
  import ViewSwitch from '../shared/ViewSwitch.svelte'

  let shape = $state<'trapezoid' | 'pyramid' | 'cone'>('trapezoid')

  const waterfall: ChartSpec = {
    type: 'waterfall',
    categories: ['Revenue', 'Cost of sales', 'Gross profit', 'R&D', 'Sales & marketing', 'G&A', 'Operating income', 'Tax', 'Net income'],
    series: [{ label: 'FY26', values: [4300, -1840, 0, -620, -780, -310, 0, -180, 0] }],
    waterfallTotals: [true, false, true, false, false, false, true, false, true],
    waterfallColors: { positive: '#16a34a', negative: '#dc2626', total: '#2563eb' },
    valueFormat: 'currency',
    title: 'From revenue to net income',
    subtitle: 'USD thousands, FY26',
    yAxis: { gridLines: true },
    dataLabels: { show: true, placement: 'top' },
    height: 340,
  }

  const funnel = $derived<ChartSpec>({
    type: 'funnel',
    categories: ['Visited', 'Signed up', 'Activated', 'Upgraded', 'Renewed'],
    series: [{ label: 'Users', values: [48200, 12600, 7900, 2150, 1680] }],
    funnelShape: shape,
    title: 'Sign-up funnel',
    subtitle: 'Last quarter; hover a step for the conversion',
    valueFormat: 'compact',
    height: 340,
  })

  const pareto: ChartSpec = {
    ...paretoSpec({
      type: 'bar',
      categories: ['Wrong size', 'Damaged', 'Changed mind', 'Late delivery', 'Not as described', 'Defective', 'Other'],
      series: [{ label: 'Returns', values: [412, 268, 190, 96, 71, 44, 38] }],
    }),
    title: 'Why orders come back',
    subtitle: 'Returns by cause, with the cumulative share',
    yAxis: { title: 'Returns', gridLines: true },
    height: 340,
  }

  // Chart | Grid: the same spec as the chart or as the rows behind it.
  let view = $state<'chart' | 'grid'>('chart')
</script>

<section class="wrap">
  <header class="chrome">
    <ViewSwitch bind:value={view} options={[['chart', 'Chart'], ['grid', 'Grid']]} />
    <label class="ctl">
      Funnel shape
      <select bind:value={shape}>
        <option value="trapezoid">Trapezoid</option>
        <option value="pyramid">Pyramid</option>
        <option value="cone">Cone</option>
      </select>
    </label>
    <span class="note">
      A waterfall with subtotals and connectors, a funnel with conversion and drop-off in the tooltip,
      and a pareto with its cumulative line and the 80% mark.
    </span>
  </header>

  <div class="row">
    <div class="pane pane-wide">
      {#if view === 'chart'}
        <SvChart spec={waterfall} legend={false} autosize />
      {:else}
        <ChartDataGrid spec={waterfall} />
      {/if}
    </div>
    <div class="pane">
      {#if view === 'chart'}
        <SvChart spec={funnel} legend={false} autosize />
      {:else}
        <ChartDataGrid spec={funnel} />
      {/if}
    </div>
    <div class="pane">
      {#if view === 'chart'}
        <SvChart spec={pareto} legend={false} autosize />
      {:else}
        <ChartDataGrid spec={pareto} />
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
    flex: 1 1 360px;
    border: 1px solid var(--sg-border, #e2e8f0);
    border-radius: 10px;
    background: var(--sg-bg, #fff);
    padding: 8px 10px;
    min-width: 0;
  }
  .pane-wide {
    flex: 1 1 100%;
  }
</style>
