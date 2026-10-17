<script lang="ts" module>
  /**
   * KPI cards with trend block - four SvStat cards that compare each metric
   * with the period before it: a signed delta with an up or down arrow, green
   * when the move is good and red when it is bad. Churn rate and time to
   * convert use `invert`, so a drop reads green. An SvSegmented switch
   * (7d / 30d / 90d) swaps every value, delta and previous-period figure.
   * Pure UI-kit, --sg-* themed.
   *
   * Headless: createKpiTrendCards() below owns the period, the metrics and
   * the delta and formatting rules with no markup, and hands back one ready
   * row per card. The component under it is one styled render of that core;
   * import createKpiTrendCards from this file (or `npx @svgrid/ui add
   * kpi-cards-trend --headless` for the core alone) to draw your own.
   */
  type TrendPeriod = '7d' | '30d' | '90d'
  type TrendUnit = 'usd' | 'count' | 'pct' | 'days'
  export type TrendMetric = {
    label: string; unit: TrendUnit; invert?: boolean
    now: Record<TrendPeriod, number>; prev: Record<TrendPeriod, number>
  }
  export type TrendCard = {
    label: string; value: string; delta: string; trend: 'up' | 'down' | 'flat'; invert?: boolean; hint: string
  }
  export type KpiTrendOptions = { metrics?: TrendMetric[]; period?: TrendPeriod }

  // Current and previous-period values per metric; swap for your own query.
  const SAMPLE_METRICS: TrendMetric[] = [
    { label: 'Revenue', unit: 'usd',
      now: { '7d': 19640, '30d': 84210, '90d': 246300 }, prev: { '7d': 18210, '30d': 79870, '90d': 251900 } },
    { label: 'New trials', unit: 'count',
      now: { '7d': 312, '30d': 1286, '90d': 3904 }, prev: { '7d': 287, '30d': 1340, '90d': 3420 } },
    { label: 'Churn rate', unit: 'pct', invert: true,
      now: { '7d': 1.9, '30d': 2.2, '90d': 2.1 }, prev: { '7d': 2.3, '30d': 2.0, '90d': 2.6 } },
    { label: 'Time to convert', unit: 'days', invert: true,
      now: { '7d': 9.4, '30d': 10.2, '90d': 9.9 }, prev: { '7d': 10.1, '30d': 9.8, '90d': 11.3 } },
  ]
  const PERIODS: TrendPeriod[] = ['7d', '30d', '90d']
  const SINCE: Record<TrendPeriod, string> = { '7d': 'previous 7 days', '30d': 'previous 30 days', '90d': 'previous 90 days' }

  function fmt(unit: TrendUnit, n: number): string {
    if (unit === 'usd') return n >= 100000 ? `$${(n / 1000).toFixed(1)}k` : '$' + n.toLocaleString('en-US')
    if (unit === 'pct') return `${n.toFixed(1)}%`
    if (unit === 'days') return `${n.toFixed(1)} days`
    return n.toLocaleString('en-US')
  }

  /** Percent change, or percentage points for a metric that is already a rate. */
  function delta(m: TrendMetric, p: TrendPeriod): { text: string; trend: 'up' | 'down' | 'flat' } {
    const a = m.now[p], b = m.prev[p]
    const trend = a > b ? 'up' : a < b ? 'down' : 'flat'
    const sign = a > b ? '+' : ''
    if (m.unit === 'pct') return { text: `${sign}${(a - b).toFixed(1)} pp`, trend }
    return { text: `${sign}${(((a - b) / b) * 100).toFixed(1)}%`, trend }
  }

  export function createKpiTrendCards(opts: KpiTrendOptions = {}) {
    // period stays string | number so SvSegmented can bind to it; p narrows it.
    const metrics = opts.metrics ?? SAMPLE_METRICS
    let period = $state<string | number>(opts.period ?? '30d')
    const p = $derived<TrendPeriod>(period === '7d' || period === '90d' ? period : '30d')
    const cards = $derived<TrendCard[]>(metrics.map((m) => {
      const d = delta(m, p)
      return { label: m.label, value: fmt(m.unit, m.now[p]), delta: d.text, trend: d.trend, invert: m.invert, hint: `from ${fmt(m.unit, m.prev[p])}` }
    }))

    return {
      metrics,
      /** Value/label pairs for a period switch. */
      periods: PERIODS.map((v) => ({ value: v, label: v })),
      /** Bindable; anything other than 7d or 90d reads as 30d. */
      get period() { return period },
      set period(v: string | number) { period = v },
      get since() { return SINCE[p] },
      get cards() { return cards },
    }
  }
</script>

<script lang="ts">
  import { SvSegmented, SvStat } from '@svgrid/grid'

  const kpi = createKpiTrendCards()
</script>

<section class="sv-kc-trend" aria-labelledby="kpi-trend-title">
  <header class="sv-kc-trend-head">
    <div>
      <h2 id="kpi-trend-title">Subscriptions</h2>
      <p class="sv-kc-trend-sub">Acme Analytics billing, compared with the {kpi.since}</p>
    </div>
    <SvSegmented bind:value={kpi.period} ariaLabel="Period" options={kpi.periods} />
  </header>

  <div class="sv-kc-trend-cards">
    {#each kpi.cards as c (c.label)}
      <SvStat label={c.label} value={c.value} delta={c.delta} trend={c.trend} invert={c.invert} hint={c.hint} />
    {/each}
  </div>

  <p class="sv-kc-trend-note">Churn rate and time to convert are better when they fall, so a drop shows green.</p>
</section>

<style>
  .sv-kc-trend {
    width: 100%; box-sizing: border-box; min-height: 260px; padding: 28px 32px;
    background: var(--sg-bg, #fff); color: var(--sg-fg, #0f172a);
    border: 1px solid var(--sg-border, #e2e8f0); border-radius: var(--sg-radius-lg, 12px);
    font-family: var(--sg-font, inherit);
  }
  .sv-kc-trend-head { display: flex; align-items: flex-end; justify-content: space-between; gap: 14px 24px; flex-wrap: wrap; margin-bottom: 18px; }
  h2 { margin: 0; font-size: 20px; font-weight: 700; letter-spacing: -.01em; }
  .sv-kc-trend-sub { margin: 4px 0 0; font-size: 13.5px; color: var(--sg-muted, #64748b); }

  .sv-kc-trend-cards { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; }
  /* Room for the value and the delta line to breathe inside each card. */
  .sv-kc-trend-cards :global(.sv-stat) { padding: 16px 18px; gap: 8px; }

  .sv-kc-trend-note { margin: 14px 0 0; font-size: 12.5px; color: var(--sg-muted, #64748b); }

  @media (max-width: 900px) {
    .sv-kc-trend-cards { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  }
  @media (max-width: 520px) {
    .sv-kc-trend { padding: 20px 16px; }
    .sv-kc-trend-cards { grid-template-columns: 1fr; gap: 10px; }
  }
</style>
