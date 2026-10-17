<script lang="ts" module>
  /**
   * KPI cards with sparklines block - live service metrics: each SvCard holds
   * the current value, its 30-second average and peak, and a full-width
   * SvSparkline area chart of the window. An SvSwitchButton turns Live on and
   * off; while it is on, every card gets a new point each second and the
   * oldest one drops off. The interval is cleared when Live goes off and when
   * the block unmounts. An SvBadge shows the stream state. Pure UI-kit,
   * --sg-* themed.
   *
   * Headless: createLiveKpis() below owns the rolling series, the Live flag,
   * its timer and the value formatting with no markup. The component under it
   * is one styled render of that core; import createLiveKpis from this file
   * (or `npx @svgrid/ui add kpi-cards-sparkline --headless` for the core
   * alone) to draw your own.
   */
  export type LiveMetric = LiveSpec & { series: number[] }
  export type LiveSpec = { label: string; unit: string; digits: number; base: number; spread: number }
  export type LiveKpiOptions = {
    metrics?: LiveSpec[]
    /** Points kept per series; 30 by default. */
    window?: number
    /** Milliseconds between ticks while Live is on. */
    interval?: number
    live?: boolean
  }

  const SAMPLE_SPECS: LiveSpec[] = [
    { label: 'Requests / min', unit: '', digits: 0, base: 1280, spread: 60 },
    { label: 'p95 latency', unit: ' ms', digits: 0, base: 212, spread: 14 },
    { label: 'Error rate', unit: '%', digits: 2, base: 0.42, spread: 0.06 },
    { label: 'Open connections', unit: '', digits: 0, base: 3120, spread: 45 },
  ]

  const fmt = (m: LiveSpec, n: number) =>
    n.toLocaleString('en-US', { minimumFractionDigits: m.digits, maximumFractionDigits: m.digits }) + m.unit
  const avg = (m: LiveMetric) => m.series.reduce((a, b) => a + b, 0) / m.series.length

  /**
   * Call during component init: the Live timer is an `$effect` that ticks
   * while `live` is true and is cleared when it goes false or on unmount.
   */
  export function createLiveKpis(opts: LiveKpiOptions = {}) {
    const size = opts.window ?? 30

    // Small seeded generator; the first paint is the same on every load.
    let seed = 7
    function rand() {
      seed = (seed + 0x6d2b79f5) | 0
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296
    }
    /** Random walk that drifts back toward the metric's base level. */
    function walk(m: LiveSpec, prev: number) {
      const v = Math.max(0, prev + (m.base - prev) * 0.2 + (rand() - 0.5) * 2 * m.spread)
      return Number(v.toFixed(m.digits))
    }
    function make(spec: LiveSpec): LiveMetric {
      const series = [spec.base]
      while (series.length < size) series.push(walk(spec, series[series.length - 1]!))
      return { ...spec, series }
    }

    const metrics = $state<LiveMetric[]>((opts.metrics ?? SAMPLE_SPECS).map(make))
    let live = $state(opts.live ?? true)
    let updated = $state(new Date())

    /**
     * Add one point per metric and drop the oldest. Pass values from your feed
     * (polling, SSE or a websocket), in metric order; without them it walks.
     */
    function tick(values?: number[]) {
      metrics.forEach((m, i) => {
        m.series.push(values?.[i] ?? walk(m, m.series[m.series.length - 1]!))
        if (m.series.length > size) m.series.shift()
      })
      updated = new Date()
    }

    $effect(() => {
      if (!live) return
      const t = setInterval(() => tick(), opts.interval ?? 1000)
      return () => clearInterval(t)
    })

    return {
      metrics,
      window: size,
      get live() { return live },
      set live(v: boolean) { live = v },
      get updated() { return updated },
      tick,
      fmt,
      avg,
      last: (m: LiveMetric) => m.series[m.series.length - 1]!,
      peak: (m: LiveMetric) => Math.max(...m.series),
    }
  }
</script>

<script lang="ts">
  import { SvCard, SvSparkline, SvSwitchButton, SvBadge } from '@svgrid/grid'

  const kpi = createLiveKpis()
  let widths = $state<number[]>([])
</script>

<section class="sv-kc-spark" aria-labelledby="kpi-spark-title">
  <header class="sv-kc-spark-head">
    <div>
      <h2 id="kpi-spark-title">API traffic</h2>
      <p class="sv-kc-spark-sub">Lumen production, us-east-1, last {kpi.window} seconds. Updated {kpi.updated.toLocaleTimeString('en-US')}</p>
    </div>
    <div class="sv-kc-spark-controls">
      <SvBadge variant={kpi.live ? 'success' : 'neutral'} dot>{kpi.live ? 'Streaming' : 'Paused'}</SvBadge>
      <label class="sv-kc-spark-live-label" for="kpi-spark-live">Live</label>
      <SvSwitchButton id="kpi-spark-live" checked={kpi.live} onChange={(v) => (kpi.live = v)} />
    </div>
  </header>

  <div class="sv-kc-spark-cards">
    {#each kpi.metrics as m, i (m.label)}
      <SvCard>
        <p class="sv-kc-spark-label">{m.label}</p>
        <p class="sv-kc-spark-value">{fmt(m, kpi.last(m))}</p>
        <p class="sv-kc-spark-caption">avg {fmt(m, avg(m))}, peak {fmt(m, kpi.peak(m))}</p>
        <div class="sv-kc-spark-chart" bind:clientWidth={widths[i]}>
          <SvSparkline data={m.series} type="area" width={Math.max(100, widths[i] ?? 0)} height={44}
            ariaLabel={`${m.label}, last ${kpi.window} seconds`} />
        </div>
      </SvCard>
    {/each}
  </div>
</section>

<style>
  .sv-kc-spark {
    width: 100%; box-sizing: border-box; min-height: 320px; padding: 28px 32px;
    background: var(--sg-bg, #fff); color: var(--sg-fg, #0f172a);
    border: 1px solid var(--sg-border, #e2e8f0); border-radius: var(--sg-radius-lg, 12px);
    font-family: var(--sg-font, inherit);
  }
  .sv-kc-spark-head { display: flex; align-items: flex-end; justify-content: space-between; gap: 14px 24px; flex-wrap: wrap; margin-bottom: 18px; }
  h2 { margin: 0; font-size: 20px; font-weight: 700; letter-spacing: -.01em; }
  .sv-kc-spark-sub { margin: 4px 0 0; font-size: 13.5px; color: var(--sg-muted, #64748b); font-variant-numeric: tabular-nums; }
  .sv-kc-spark-controls { display: flex; align-items: center; gap: 10px; }
  .sv-kc-spark-live-label { font-size: 13.5px; font-weight: 600; margin-left: 6px; cursor: pointer; }

  .sv-kc-spark-cards { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; }
  /* min-width 0 lets a card shrink below its chart's last measured width on resize. */
  .sv-kc-spark-cards > :global(.sv-card) { min-width: 0; }
  .sv-kc-spark-label { margin: 0; font-size: 12.5px; font-weight: 600; color: var(--sg-muted, #64748b); }
  .sv-kc-spark-value { margin: 6px 0 4px; font-size: 26px; font-weight: 700; line-height: 1.1; letter-spacing: -.02em; font-variant-numeric: tabular-nums; }
  .sv-kc-spark-caption { margin: 0; font-size: 12px; color: var(--sg-muted, #64748b); font-variant-numeric: tabular-nums; }
  .sv-kc-spark-chart { margin-top: 14px; min-width: 0; }
  .sv-kc-spark-chart :global(svg) { display: block; }

  @media (max-width: 900px) {
    .sv-kc-spark-cards { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  }
  @media (max-width: 520px) {
    .sv-kc-spark { padding: 20px 16px; }
    .sv-kc-spark-cards { grid-template-columns: 1fr; gap: 10px; }
    .sv-kc-spark-value { font-size: 22px; }
  }
</style>
