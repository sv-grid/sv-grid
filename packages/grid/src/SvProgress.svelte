<script lang="ts">
  /**
   * SvProgress - a linear progress bar (WAI-ARIA `progressbar`). Determinate
   * (value/max) or `indeterminate` (animated), with color intents, sizes, an
   * optional label and an optional secondary `buffer` track. Theme-driven via
   * `--sg-*`; respects prefers-reduced-motion. Parity: Smart progress bar.
   *
   * ```svelte
   * <SvProgress value={64} showLabel />
   * <SvProgress indeterminate color="success" />
   * ```
   */
  type Props = {
    /** Current value (0..max). Ignored when `indeterminate`. */
    value?: number
    max?: number
    /** Unknown-duration animated bar. */
    indeterminate?: boolean
    /** Buffered/secondary value (e.g. streamed-ahead), 0..max. */
    buffer?: number
    color?: 'accent' | 'success' | 'warning' | 'danger'
    size?: 'sm' | 'md' | 'lg'
    /** Show a percentage label at the end of the bar. */
    showLabel?: boolean
    /** Format the label (default: rounded percent). */
    formatLabel?: (value: number, max: number) => string
    /** Diagonal candy-stripe overlay on the fill. */
    striped?: boolean
    ariaLabel?: string
  }

  let {
    value = 0,
    max = 100,
    indeterminate = false,
    buffer,
    color = 'accent',
    size = 'md',
    showLabel = false,
    formatLabel,
    striped = false,
    ariaLabel,
  }: Props = $props()

  const pct = $derived(max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0)
  const bufPct = $derived(buffer != null && max > 0 ? Math.min(100, Math.max(0, (buffer / max) * 100)) : null)
  const label = $derived(formatLabel ? formatLabel(value, max) : `${Math.round(pct)}%`)
</script>

<div class="sv-prog sv-prog--{size} sv-prog--{color}" class:has-label={showLabel && !indeterminate}>
  <div
    class="sv-prog__track"
    role="progressbar"
    aria-label={ariaLabel}
    aria-valuemin={indeterminate ? undefined : 0}
    aria-valuemax={indeterminate ? undefined : max}
    aria-valuenow={indeterminate ? undefined : value}
    aria-valuetext={indeterminate ? undefined : label}
  >
    {#if bufPct != null && !indeterminate}<div class="sv-prog__buffer" style:width={`${bufPct}%`}></div>{/if}
    <div
      class="sv-prog__fill"
      class:is-indeterminate={indeterminate}
      class:is-striped={striped}
      style:width={indeterminate ? undefined : `${pct}%`}
    ></div>
  </div>
  {#if showLabel && !indeterminate}<span class="sv-prog__label">{label}</span>{/if}
</div>

<style>
  .sv-prog {
    --_accent: var(--sg-accent, #2563eb);
    --_c: var(--_accent);
    display: flex; align-items: center; gap: 10px; width: 100%;
  }
  .sv-prog--success { --_c: var(--sg-success, #16a34a); }
  .sv-prog--warning { --_c: var(--sg-warning, #f59e0b); }
  .sv-prog--danger { --_c: var(--sg-danger, #dc2626); }
  .sv-prog__track {
    position: relative; flex: 1; overflow: hidden;
    background: var(--sg-border, #e2e8f0); border-radius: 999px;
  }
  .sv-prog--sm .sv-prog__track { height: 5px; }
  .sv-prog--md .sv-prog__track { height: 8px; }
  .sv-prog--lg .sv-prog__track { height: 12px; }
  .sv-prog__buffer {
    position: absolute; inset-block: 0; inset-inline-start: 0;
    background: color-mix(in srgb, var(--_c) 28%, transparent); border-radius: 999px;
  }
  .sv-prog__fill {
    position: absolute; inset-block: 0; inset-inline-start: 0; min-width: 0;
    background: var(--_c); border-radius: 999px; transition: width 0.3s cubic-bezier(0.16, 1, 0.3, 1);
  }
  .sv-prog__fill.is-striped {
    background-image: linear-gradient(45deg, rgba(255,255,255,0.22) 25%, transparent 25%, transparent 50%, rgba(255,255,255,0.22) 50%, rgba(255,255,255,0.22) 75%, transparent 75%);
    background-size: 16px 16px; animation: sv-prog-stripe 0.8s linear infinite;
  }
  .sv-prog__fill.is-indeterminate {
    width: 40%; border-radius: 999px;
    animation: sv-prog-indet 1.3s cubic-bezier(0.65, 0.05, 0.36, 1) infinite;
  }
  @keyframes sv-prog-indet {
    0% { inset-inline-start: -45%; } 100% { inset-inline-start: 100%; }
  }
  @keyframes sv-prog-stripe { to { background-position: 16px 0; } }
  @media (prefers-reduced-motion: reduce) {
    .sv-prog__fill.is-indeterminate { animation-duration: 2.4s; }
    .sv-prog__fill.is-striped { animation: none; }
    .sv-prog__fill { transition: none; }
  }
  .sv-prog__label {
    flex: none; min-width: 38px; text-align: end; font-size: 12px; font-weight: 600;
    font-variant-numeric: tabular-nums; color: var(--sg-muted, #64748b);
  }
</style>
