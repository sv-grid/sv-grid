<script lang="ts" module>
  /**
   * KPI cards with icons block - dashboard metric tiles, each with a tinted
   * inline-SVG icon, today's value and the 7-day average. The cards are
   * toggle buttons (aria-pressed): clicking one selects it and the SvCard
   * panel below shows that metric's last 7 days, one labelled bar per day.
   * Pure UI-kit, --sg-* themed.
   *
   * Headless: createKpiIconCards() below owns the metrics, the selected card,
   * the week's peak and the number formatting with no markup. The component
   * under it is one styled render of that core; import createKpiIconCards
   * from this file (or `npx @svgrid/ui add kpi-cards-icon --headless` for the
   * core alone) to draw your own.
   */
  export type IconMetric = {
    key: string; label: string
    unit: 'usd' | 'count'
    /** Oldest first; the last value is today. */
    days: number[]
    /** Icon strokes on a 24 x 24 box. */
    icon: string[]
  }
  export type KpiIconOptions = {
    metrics?: IconMetric[]
    /** One label per entry in `days`; Oct 9 to Oct 15 by default. */
    dayLabels?: string[]
    selected?: string
  }

  const SAMPLE_DAYS = ['Oct 9', 'Oct 10', 'Oct 11', 'Oct 12', 'Oct 13', 'Oct 14', 'Oct 15']
  const SAMPLE_METRICS: IconMetric[] = [
    { key: 'revenue', label: 'Revenue', unit: 'usd', days: [11840, 12310, 9870, 13420, 12960, 14110, 12480],
      icon: ['M12 3v18', 'M16.5 7.5c0-1.7-2-3-4.5-3s-4.5 1.3-4.5 3 2 2.6 4.5 3 4.5 1.3 4.5 3-2 3-4.5 3-4.5-1.3-4.5-3'] },
    { key: 'signups', label: 'New signups', unit: 'count', days: [184, 201, 176, 229, 240, 198, 212],
      icon: ['M5.5 8a3.5 3.5 0 1 0 7 0a3.5 3.5 0 1 0-7 0', 'M2.5 20c.8-3.6 3.4-5.5 6.5-5.5s5.7 1.9 6.5 5.5', 'M18.5 8v6M15.5 11h6'] },
    { key: 'projects', label: 'Active projects', unit: 'count', days: [1204, 1211, 1219, 1226, 1230, 1241, 1248],
      icon: ['M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z'] },
    { key: 'tickets', label: 'Support tickets', unit: 'count', days: [38, 42, 51, 36, 33, 29, 31],
      icon: ['M4 5h16v11H9l-5 4z', 'M8 9.5h8M8 12.5h5'] },
  ]

  const fmt = (m: IconMetric, n: number) =>
    m.unit === 'usd' ? '$' + n.toLocaleString('en-US') : n.toLocaleString('en-US')
  /** Short form for the narrow day columns: $11.8k. */
  const short = (m: IconMetric, n: number) =>
    m.unit === 'usd' && n >= 1000 ? `$${(n / 1000).toFixed(1)}k` : fmt(m, n)
  const avg = (m: IconMetric) => Math.round(m.days.reduce((a, b) => a + b, 0) / m.days.length)

  export function createKpiIconCards(opts: KpiIconOptions = {}) {
    const metrics = opts.metrics ?? SAMPLE_METRICS
    const dayLabels = opts.dayLabels ?? SAMPLE_DAYS

    let selected = $state(opts.selected ?? metrics[0]?.key ?? '')
    const current = $derived(metrics.find((m) => m.key === selected) ?? metrics[0]!)
    const peak = $derived(Math.max(...current.days))

    return {
      metrics,
      dayLabels,
      get selected() { return selected },
      set selected(key: string) { selected = key },
      /** The selected metric. */
      get current() { return current },
      fmt,
      short,
      avg,
      today: (m: IconMetric) => m.days[m.days.length - 1]!,
      /** Bar height for a value, as a percentage of the selected week's peak. */
      barHeight: (v: number) => `${Math.round((v / peak) * 100)}%`,
      /** Spread on each card <button>. */
      cardProps: (key: string) => ({
        type: 'button' as const,
        'aria-pressed': selected === key,
        onclick: () => { selected = key },
      }),
    }
  }
</script>

<script lang="ts">
  import { SvCard } from '@svgrid/grid'

  const kpi = createKpiIconCards()
</script>

<section class="sv-kc-icon" aria-labelledby="kpi-icon-title">
  <header class="sv-kc-icon-head">
    <h2 id="kpi-icon-title">Today</h2>
    <p class="sv-kc-icon-sub">Fieldline, October 15. Pick a metric to see its week.</p>
  </header>

  <div class="sv-kc-icon-cards">
    {#each kpi.metrics as m (m.key)}
      <button class="sv-kc-icon-metric" {...kpi.cardProps(m.key)}>
        <span class="sv-kc-icon-tile" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
            {#each m.icon as d (d)}<path {d} />{/each}
          </svg>
        </span>
        <span class="sv-kc-icon-label">{m.label}</span>
        <span class="sv-kc-icon-value">{fmt(m, kpi.today(m))}</span>
        <span class="sv-kc-icon-caption">7-day avg {fmt(m, avg(m))}</span>
      </button>
    {/each}
  </div>

  <div class="sv-kc-icon-panel" aria-live="polite">
    <SvCard title={`${kpi.current.label}, last 7 days`} subtitle="October 9 to 15">
      <ol class="sv-kc-icon-days">
        {#each kpi.current.days as v, i (kpi.dayLabels[i])}
          <li>
            <span class="sv-kc-icon-bar" class:sv-kc-icon-is-today={i === kpi.current.days.length - 1}
              style:height={kpi.barHeight(v)} aria-hidden="true"></span>
            <span class="sv-kc-icon-day">{kpi.dayLabels[i]}</span>
            <span class="sv-kc-icon-num" title={fmt(kpi.current, v)}>{short(kpi.current, v)}</span>
          </li>
        {/each}
      </ol>
    </SvCard>
  </div>
</section>

<style>
  .sv-kc-icon {
    width: 100%; box-sizing: border-box; min-height: 480px; padding: 28px 32px;
    background: var(--sg-bg, #fff); color: var(--sg-fg, #0f172a);
    border: 1px solid var(--sg-border, #e2e8f0); border-radius: var(--sg-radius-lg, 12px);
    font-family: var(--sg-font, inherit);
  }
  .sv-kc-icon-head { margin-bottom: 18px; }
  h2 { margin: 0; font-size: 20px; font-weight: 700; letter-spacing: -.01em; }
  .sv-kc-icon-sub { margin: 4px 0 0; font-size: 13.5px; color: var(--sg-muted, #64748b); }

  .sv-kc-icon-cards { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; }
  .sv-kc-icon-metric {
    display: flex; flex-direction: column; align-items: flex-start; gap: 4px; min-width: 0;
    padding: 16px; text-align: left; font: inherit; color: inherit; cursor: pointer;
    background: var(--sg-bg, #fff); border: 1px solid var(--sg-border, #e2e8f0);
    border-radius: var(--sg-radius-lg, 12px); transition: border-color .15s, box-shadow .15s;
  }
  .sv-kc-icon-metric:hover { border-color: color-mix(in srgb, var(--sg-fg, #0f172a) 25%, var(--sg-border, #e2e8f0)); }
  .sv-kc-icon-metric:focus-visible { outline: 2px solid var(--sg-focus-ring, var(--sg-accent, #2563eb)); outline-offset: 2px; }
  .sv-kc-icon-metric[aria-pressed='true'] {
    border-color: var(--sg-accent, #2563eb);
    box-shadow: 0 0 0 1px var(--sg-accent, #2563eb);
  }
  .sv-kc-icon-tile {
    display: inline-flex; align-items: center; justify-content: center;
    width: 36px; height: 36px; margin-bottom: 8px; border-radius: var(--sg-radius, 8px);
    color: var(--sg-muted, #64748b);
    background: color-mix(in srgb, var(--sg-fg, #0f172a) 7%, var(--sg-bg, #fff));
  }
  .sv-kc-icon-tile svg { display: block; }
  .sv-kc-icon-metric[aria-pressed='true'] .sv-kc-icon-tile {
    color: var(--sg-accent, #2563eb);
    background: color-mix(in srgb, var(--sg-accent, #2563eb) 14%, transparent);
  }
  .sv-kc-icon-label { font-size: 12.5px; font-weight: 600; color: var(--sg-muted, #64748b); }
  .sv-kc-icon-value { font-size: 24px; font-weight: 700; line-height: 1.15; letter-spacing: -.02em; font-variant-numeric: tabular-nums; }
  .sv-kc-icon-caption { font-size: 12px; color: var(--sg-muted, #64748b); font-variant-numeric: tabular-nums; }

  .sv-kc-icon-panel { margin-top: 16px; }
  .sv-kc-icon-days {
    list-style: none; margin: 0; padding: 0;
    display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); gap: 10px;
  }
  /* Fixed-height bar row on top, so every day's label lines up. */
  .sv-kc-icon-days li { display: grid; grid-template-rows: 88px auto auto; gap: 2px; min-width: 0; }
  .sv-kc-icon-bar {
    align-self: end; width: 100%; max-width: 44px;
    border-radius: 4px 4px 0 0; transition: height .2s ease;
    background: color-mix(in srgb, var(--sg-fg, #0f172a) 22%, transparent);
  }
  .sv-kc-icon-bar.sv-kc-icon-is-today { background: color-mix(in srgb, var(--sg-fg, #0f172a) 55%, transparent); }
  .sv-kc-icon-day { margin-top: 8px; font-size: 11.5px; color: var(--sg-muted, #64748b); }
  .sv-kc-icon-num { font-size: 13px; font-weight: 600; font-variant-numeric: tabular-nums; overflow-wrap: anywhere; }

  @media (max-width: 900px) {
    .sv-kc-icon-cards { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  }
  @media (max-width: 560px) {
    .sv-kc-icon { padding: 20px 16px; }
    .sv-kc-icon-cards { gap: 10px; }
    .sv-kc-icon-metric { padding: 14px 12px; }
    .sv-kc-icon-value { font-size: 20px; }
    .sv-kc-icon-days { gap: 4px; }
    .sv-kc-icon-days li { grid-template-rows: 64px auto auto; }
    .sv-kc-icon-day, .sv-kc-icon-num { font-size: 11px; }
  }
</style>
