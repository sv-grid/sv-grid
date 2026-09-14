<!-- Documented in: docs/help/charts/gallery.md -->
<script lang="ts">
  /**
   * 444. Histograms and box plots
   * -----------------------------
   * Twelve hundred request latencies from three services, as the two charts
   * that show a distribution rather than a value:
   *
   * - `rowsToHistogramSpec` bins the sample: a bin count, a bin width, or a
   *   rule (`sturges`, `fd`, `sqrt`); one series per service shares the same
   *   edges so the bars line up. `stacked` piles them, otherwise they sit side
   *   by side. A reference line marks the p95 of the whole sample.
   * - `rowsToBoxSpec` draws the five-number summary per service and per
   *   region: the box is the middle half, the whiskers reach the last point
   *   inside 1.5 IQR (`whisker`), and everything past them is an outlier dot.
   *   Flip the whisker to 3 IQR and watch the outliers get absorbed.
   * - `yScale: 'log'` on the box plot when one service is an order of
   *   magnitude slower.
   *
   * Free, in @svgrid/grid.
   */
  import { SvChart, rowsToBoxSpec, rowsToHistogramSpec, type ChartSpec } from '@svgrid/grid'
  import ChartDataGrid from '../shared/ChartDataGrid.svelte'
  import ViewSwitch from '../shared/ViewSwitch.svelte'

  type Row = { service: string; region: string; ms: number }
  let seed = 5
  const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648)
  // Log-normal latencies: most requests fast, a long right tail.
  const lognormal = (mu: number, sigma: number) => {
    const u = 1 - rnd()
    const v = rnd()
    const z = Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v)
    return Math.exp(mu + sigma * z)
  }
  const rows: Row[] = []
  const services = [
    { name: 'search', mu: 4.2, sigma: 0.35 },
    { name: 'checkout', mu: 4.9, sigma: 0.45 },
    { name: 'reports', mu: 5.8, sigma: 0.6 },
  ]
  for (const s of services) for (const region of ['us', 'eu', 'ap']) for (let i = 0; i < 130; i += 1) rows.push({ service: s.name, region, ms: Math.round(lognormal(s.mu + (region === 'ap' ? 0.2 : 0), s.sigma)) })
  const sorted = rows.map((r) => r.ms).sort((a, b) => a - b)
  const p95 = sorted[Math.floor(sorted.length * 0.95)]!

  let bins = $state(30)
  let stacked = $state(true)
  let whisker = $state(1.5)
  let logY = $state(false)

  const histogram = $derived<ChartSpec>({
    ...rowsToHistogramSpec(rows.filter((r) => r.ms < 1500), { value: 'ms', series: 'service', bins }),
    stacked,
    title: 'Latency distribution',
    subtitle: `${rows.length} requests in ${bins} bins`,
    xAxis: { title: 'Latency (ms)' },
    yAxis: { title: 'Requests', gridLines: true },
    referenceLines: [{ value: p95, axis: 'x', label: `p95 ${p95} ms`, color: '#dc2626', dashed: true }],
    height: 320,
  })

  const boxes = $derived<ChartSpec>({
    ...rowsToBoxSpec(rows, { category: 'service', value: 'ms', series: 'region', whisker }),
    title: 'Latency by service and region',
    subtitle: `Whiskers at ${whisker} IQR; dots are outliers`,
    yScale: logY ? 'log' : 'linear',
    yAxis: { title: 'Latency (ms)', gridLines: true },
    height: 320,
  })

  // Chart | Grid: the same spec as the chart or as the rows behind it.
  let view = $state<'chart' | 'grid'>('chart')
</script>

<section class="wrap">
  <header class="chrome">
    <ViewSwitch bind:value={view} options={[['chart', 'Chart'], ['grid', 'Grid']]} />
    <label class="ctl">
      Bins
      <input type="range" min="8" max="80" step="1" bind:value={bins} />
      <span class="muted">{bins}</span>
    </label>
    <label class="chk"><input type="checkbox" bind:checked={stacked} /> Stack the services</label>
    <label class="ctl">
      Whisker
      <select bind:value={whisker}>
        <option value={1.0}>1 IQR</option>
        <option value={1.5}>1.5 IQR</option>
        <option value={3}>3 IQR</option>
      </select>
    </label>
    <label class="chk"><input type="checkbox" bind:checked={logY} /> Log scale on the boxes</label>
    <span class="note">
      A histogram with shared bins across three series and a p95 marker; box plots per service and
      region with an adjustable whisker rule and outlier dots.
    </span>
  </header>

  <div class="row">
    <div class="pane">
      {#if view === 'chart'}
        <SvChart spec={histogram} legend="bottom" tooltipMode="shared" autosize />
      {:else}
        <ChartDataGrid spec={histogram} />
      {/if}
    </div>
    <div class="pane">
      {#if view === 'chart'}
        <SvChart spec={boxes} legend="bottom" autosize />
      {:else}
        <ChartDataGrid spec={boxes} />
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
  }
  .pane {
    flex: 1 1 420px;
    border: 1px solid var(--sg-border, #e2e8f0);
    border-radius: 10px;
    background: var(--sg-bg, #fff);
    padding: 8px 10px;
    min-width: 0;
  }
</style>
