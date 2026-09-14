<!-- Documented in: docs/help/charts/gallery.md -->
<script lang="ts">
  /**
   * 439. Line charts
   * ----------------
   * Twenty-four months of sign-ups for three plans, plus a six-month forecast,
   * and the switches a line chart usually needs:
   *
   * - `xType: 'time'` spaces the points by date and labels the axis with real
   *   months, not category strings.
   * - `smooth`, `step` and `marker` are per series; the switches set them on
   *   all three.
   * - The forecast is its own series: it repeats the last actual value so the
   *   two lines meet, then runs dashed (`dash`) past the reference line that
   *   marks today. Everything before that point is NaN in the forecast and
   *   after it in the actuals, and the chart draws a gap there rather than a
   *   dive to zero (`nullAs: 'gap'`).
   * - Two readings are missing on purpose (an outage); `connectNulls` on the
   *   Team series bridges them, the others show the hole.
   * - `seriesLabels` names each line at its end so the legend is optional, and
   *   `crosshairLabels` reads the hovered month and value off the axes.
   * - `yScale: 'log'` when the plans are an order of magnitude apart.
   *
   * Free, in @svgrid/grid.
   */
  import { SvChart, type ChartSpec } from '@svgrid/grid'
  import ChartDataGrid from '../shared/ChartDataGrid.svelte'
  import ViewSwitch from '../shared/ViewSwitch.svelte'

  let seed = 7
  const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648)

  const months: string[] = []
  for (let i = 0; i < 30; i += 1) months.push(new Date(Date.UTC(2024, 3 + i, 1)).toISOString().slice(0, 10))
  const ACTUAL = 24
  // NaN is a gap: the chart draws nothing there (`nullAs: 'gap'`).
  const grow = (start: number, rate: number, noise: number) =>
    months.map((_, i) => (i < ACTUAL ? Math.round(start * Math.pow(1 + rate, i) * (1 + (rnd() - 0.5) * noise)) : Number.NaN))
  const free = grow(1800, 0.045, 0.14)
  const team = grow(420, 0.07, 0.18)
  const enterprise = grow(38, 0.09, 0.22)
  // The outage: two months nobody could sign up for Team or Enterprise.
  team[13] = Number.NaN
  team[14] = Number.NaN
  enterprise[13] = Number.NaN
  enterprise[14] = Number.NaN
  const forecast = (actual: number[], rate: number) => {
    const last = actual[ACTUAL - 1]!
    return months.map((_, i) => (i < ACTUAL - 1 ? Number.NaN : Math.round(last * Math.pow(1 + rate, i - (ACTUAL - 1)))))
  }

  let smooth = $state(true)
  let step = $state(false)
  let markers = $state(false)
  let log = $state(false)
  let bridge = $state(true)

  const spec = $derived<ChartSpec>({
    type: 'line',
    xType: 'time',
    categories: months,
    series: [
      { label: 'Free', values: free, smooth, step: step ? 'after' : undefined, marker: markers ? 'circle' : 'none', color: '#2563eb' },
      { label: 'Team', values: team, smooth, step: step ? 'after' : undefined, marker: markers ? 'diamond' : 'none', color: '#16a34a', connectNulls: bridge },
      { label: 'Enterprise', values: enterprise, smooth, step: step ? 'after' : undefined, marker: markers ? 'square' : 'none', color: '#f59e0b' },
      { label: 'Free forecast', values: forecast(free, 0.04), smooth, dash: '6 4', marker: 'none', color: '#2563eb', opacity: 0.7 },
      { label: 'Team forecast', values: forecast(team, 0.06), smooth, dash: '6 4', marker: 'none', color: '#16a34a', opacity: 0.7 },
    ],
    nullAs: 'gap',
    yScale: log ? 'log' : 'linear',
    title: 'Sign-ups by plan',
    subtitle: 'Monthly, with a six-month forecast',
    yAxis: { title: 'Sign-ups', gridLines: true, format: 'compact' },
    referenceLines: [{ value: months[ACTUAL - 1]!, axis: 'x', label: 'Today', dashed: true }],
    referenceBands: [{ from: months[13]!, to: months[14]!, axis: 'x', label: 'Outage', color: '#dc2626', opacity: 0.12 }],
    seriesLabels: { formatter: (s) => (s.endsWith('forecast') ? '' : s) },
    height: 380,
  })

  // Chart | Grid: the same spec as the chart or as the rows behind it.
  let view = $state<'chart' | 'grid'>('chart')
</script>

<section class="wrap">
  <header class="chrome">
    <ViewSwitch bind:value={view} options={[['chart', 'Chart'], ['grid', 'Grid']]} />
    <label class="chk"><input type="checkbox" bind:checked={smooth} /> Smooth</label>
    <label class="chk"><input type="checkbox" bind:checked={step} /> Step</label>
    <label class="chk"><input type="checkbox" bind:checked={markers} /> Markers</label>
    <label class="chk"><input type="checkbox" bind:checked={bridge} /> Bridge the outage on Team</label>
    <label class="chk"><input type="checkbox" bind:checked={log} /> Log scale</label>
    <span class="note">
      A time axis, smooth or stepped lines, markers per series, a gap where the data is missing (or a
      bridge across it), a dashed forecast past a reference line, labels at the line ends and a log scale.
    </span>
  </header>

  <div class="pane">
    {#if view === 'chart'}
      <SvChart {spec} legend={false} zoomable brush crosshairLabels autosize />
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
