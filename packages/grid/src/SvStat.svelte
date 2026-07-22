<script lang="ts">
  /**
   * SvStat - a KPI / metric card: a label, a big value, and an optional delta with
   * an up/down trend (auto-coloured; green up / red down, or inverted for
   * "lower is better" metrics), plus slots for an icon and an inline chart
   * (e.g. a sparkline). Theme-driven. The dashboard building block.
   *
   * ```svelte
   * <SvStat label="Revenue" value="$48.2k" delta={12.4} hint="vs last month" />
   * ```
   */
  import type { Snippet } from 'svelte'

  type Trend = 'up' | 'down' | 'flat'

  type Props = {
    label: string
    value: string | number
    /** A number (auto-signs + infers trend) or a preformatted string. */
    delta?: string | number
    /** Override the inferred trend. */
    trend?: Trend
    /** Text after the delta (e.g. "vs last month"). */
    hint?: string
    /** Treat a downward delta as good (green) - e.g. error rate, latency. */
    invert?: boolean
    icon?: Snippet
    /** Inline chart / sparkline slot. */
    chart?: Snippet
  }

  let { label, value, delta, trend, hint, invert = false, icon, chart }: Props = $props()

  const resolvedTrend = $derived<Trend | undefined>(
    trend ?? (typeof delta === 'number' ? (delta > 0 ? 'up' : delta < 0 ? 'down' : 'flat') : undefined),
  )
  const deltaText = $derived(
    delta == null ? null : typeof delta === 'number' ? `${delta > 0 ? '+' : ''}${delta}%` : delta,
  )
  const arrow = $derived(resolvedTrend === 'up' ? '▲' : resolvedTrend === 'down' ? '▼' : '→')
  // Which trend is "positive" (green): up, unless inverted.
  const tone = $derived(
    resolvedTrend === 'flat' || !resolvedTrend
      ? 'flat'
      : (resolvedTrend === 'up') !== invert
        ? 'good'
        : 'bad',
  )
</script>

<div class="sv-stat">
  <div class="sv-stat__head">
    <span class="sv-stat__label">{label}</span>
    {#if icon}<span class="sv-stat__icon" aria-hidden="true">{@render icon()}</span>{/if}
  </div>
  <div class="sv-stat__value">{value}</div>
  {#if (deltaText != null) || hint || chart}
    <div class="sv-stat__foot">
      {#if deltaText != null && resolvedTrend}
        <span class="sv-stat__delta is-{tone}"><span class="sv-stat__arrow" aria-hidden="true">{arrow}</span>{deltaText}</span>
      {/if}
      {#if hint}<span class="sv-stat__hint">{hint}</span>{/if}
      {#if chart}<span class="sv-stat__chart">{@render chart()}</span>{/if}
    </div>
  {/if}
</div>

<style>
  .sv-stat {
    display: flex; flex-direction: column; gap: 5px;
    padding: 14px 16px; border: 1px solid var(--sg-border, #e2e8f0); border-radius: var(--sg-radius-lg, 12px);
    background: var(--sg-bg, #fff); color: var(--sg-fg, #0f172a); min-width: 0;
  }
  .sv-stat__head { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
  .sv-stat__label { font-size: 12.5px; font-weight: 600; color: var(--sg-muted, #64748b); }
  .sv-stat__icon { color: var(--sg-muted, #94a3b8); display: inline-flex; }
  .sv-stat__value { font-size: 26px; font-weight: 700; line-height: 1.1; font-variant-numeric: tabular-nums; }
  .sv-stat__foot { display: flex; align-items: center; gap: 8px; font-size: 12px; }
  .sv-stat__delta { display: inline-flex; align-items: center; gap: 3px; font-weight: 650; font-variant-numeric: tabular-nums; }
  .sv-stat__arrow { font-size: 9px; }
  .sv-stat__delta.is-good { color: var(--sg-success, #16a34a); }
  .sv-stat__delta.is-bad { color: var(--sg-danger, #dc2626); }
  .sv-stat__delta.is-flat { color: var(--sg-muted, #64748b); }
  .sv-stat__hint { color: var(--sg-muted, #94a3b8); }
  .sv-stat__chart { margin-inline-start: auto; }
</style>
