<!-- Documented in: docs/help/charts/gallery.md -->
<script lang="ts">
  /**
   * 440. Area charts
   * ----------------
   * Traffic by channel over a year, as areas:
   *
   * - `stacked` piles the channels; `stackOffset: 'wiggle'` and `'silhouette'`
   *   turn the pile into a stream centred on its own baseline; `stacked100`
   *   normalises each month to a share.
   * - `stack` groups two piles on one chart: the three web channels stack on
   *   each other while the app installs stack on their own, so the two totals
   *   can be compared without adding them.
   * - `gradient` fades each fill towards the baseline.
   * - The second chart is a range area: the daily temperature band between
   *   the low (`lowValues`) and the high (`values`), with the mean as a line
   *   over it and the freezing point as a reference band.
   *
   * Free, in @svgrid/grid.
   */
  import { SvChart, type ChartSpec } from '@svgrid/grid'
  import ChartDataGrid from '../shared/ChartDataGrid.svelte'
  import ViewSwitch from '../shared/ViewSwitch.svelte'

  let seed = 11
  const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648)
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  const wave = (base: number, amp: number, phase: number, noise: number) =>
    MONTHS.map((_, i) => Math.round(base + amp * Math.sin((i / 12) * Math.PI * 2 + phase) + (rnd() - 0.5) * noise))
  const channels = [
    { label: 'Search', values: wave(420, 90, 0.4, 60), stack: 'web' },
    { label: 'Social', values: wave(260, 120, 2.1, 70), stack: 'web' },
    { label: 'Referral', values: wave(140, 40, 1.2, 30), stack: 'web' },
    { label: 'App installs', values: wave(300, 110, 3.6, 50), stack: 'app' },
  ]

  let mode = $state<'stacked' | 'groups' | 'wiggle' | 'silhouette' | 'percent'>('stacked')
  let gradient = $state(true)

  const traffic = $derived<ChartSpec>({
    type: 'area',
    categories: MONTHS,
    series: channels.map((c) => ({
      label: c.label,
      values: c.values,
      gradient,
      smooth: mode === 'wiggle' || mode === 'silhouette',
      stack: mode === 'groups' ? c.stack : undefined,
    })),
    stacked: mode !== 'groups',
    stacked100: mode === 'percent',
    stackOffset: mode === 'wiggle' ? 'wiggle' : mode === 'silhouette' ? 'silhouette' : 'zero',
    valueFormat: 'compact',
    title: 'Sessions by channel',
    subtitle:
      mode === 'groups' ? 'Web channels stacked, app installs on their own pile' :
      mode === 'percent' ? 'Share of each month' :
      mode === 'stacked' ? 'Thousands, stacked' : 'Thousands, as a stream',
    yAxis: { title: mode === 'percent' ? 'Share' : 'Sessions (k)', gridLines: mode === 'stacked' || mode === 'groups' || mode === 'percent', labels: mode !== 'wiggle' && mode !== 'silhouette' },
    height: 320,
  })

  const days: string[] = []
  for (let i = 0; i < 90; i += 1) days.push(new Date(Date.UTC(2026, 0, 1 + i)).toISOString().slice(0, 10))
  const mean = days.map((_, i) => 2 + 9 * Math.sin(((i - 20) / 90) * Math.PI) + (rnd() - 0.5) * 4)
  const band = $derived<ChartSpec>({
    type: 'range-area',
    xType: 'time',
    categories: days,
    series: [
      { label: 'Daily range', values: mean.map((m) => Math.round((m + 4 + rnd() * 3) * 10) / 10), lowValues: mean.map((m) => Math.round((m - 4 - rnd() * 3) * 10) / 10), color: '#0ea5e9', marker: 'none' },
      { label: 'Mean', type: 'line', values: mean.map((m) => Math.round(m * 10) / 10), color: '#0369a1', smooth: true, marker: 'none' },
    ],
    title: 'Temperature, first quarter',
    subtitle: 'Daily low to high with the mean',
    yAxis: { title: '°C', gridLines: true },
    referenceBands: [{ from: -10, to: 0, label: 'Freezing', color: '#60a5fa', opacity: 0.12 }],
    height: 240,
  })

  // Chart | Grid: the same spec as the chart or as the rows behind it.
  let view = $state<'chart' | 'grid'>('chart')
</script>

<section class="wrap">
  <header class="chrome">
    <ViewSwitch bind:value={view} options={[['chart', 'Chart'], ['grid', 'Grid']]} />
    <label class="ctl">
      Layout
      <select bind:value={mode}>
        <option value="stacked">Stacked</option>
        <option value="groups">Two stack groups</option>
        <option value="percent">100% stacked</option>
        <option value="wiggle">Stream (wiggle)</option>
        <option value="silhouette">Stream (silhouette)</option>
      </select>
    </label>
    <label class="chk"><input type="checkbox" bind:checked={gradient} /> Gradient fills</label>
    <span class="note">
      Stacked areas, two independent piles on one chart, a normalised share, streams on a centred
      baseline, gradient fills, and a low-to-high band with its mean.
    </span>
  </header>

  <div class="pane">
    {#if view === 'chart'}
      <SvChart spec={traffic} legend="bottom" autosize />
    {:else}
      <ChartDataGrid spec={traffic} />
    {/if}
  </div>
  <div class="pane">
    {#if view === 'chart'}
      <SvChart spec={band} legend="bottom" zoomable crosshairLabels autosize />
    {:else}
      <ChartDataGrid spec={band} />
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
