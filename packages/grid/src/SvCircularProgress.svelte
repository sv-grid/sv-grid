<script lang="ts">
  /**
   * SvCircularProgress - a circular / ring progress indicator (WAI-ARIA
   * `progressbar`). Determinate (value/max) or `indeterminate` (spinning), with
   * color intents, sizing/thickness, and an optional center label or `children`
   * snippet. Theme-driven; respects prefers-reduced-motion.
   *
   * ```svelte
   * <SvCircularProgress value={72} showLabel />
   * <SvCircularProgress indeterminate size={28} color="accent" />
   * ```
   */
  import type { Snippet } from 'svelte'

  type Props = {
    value?: number
    max?: number
    indeterminate?: boolean
    /** Diameter in px. */
    size?: number
    /** Ring stroke width in px. */
    thickness?: number
    color?: 'accent' | 'success' | 'warning' | 'danger'
    /** Show a percentage label in the center. */
    showLabel?: boolean
    formatLabel?: (value: number, max: number) => string
    ariaLabel?: string
    /** Custom center content (overrides showLabel). */
    children?: Snippet
  }

  let {
    value = 0,
    max = 100,
    indeterminate = false,
    size = 48,
    thickness = 5,
    color = 'accent',
    showLabel = false,
    formatLabel,
    ariaLabel,
    children,
  }: Props = $props()

  const r = $derived((size - thickness) / 2)
  const circ = $derived(2 * Math.PI * r)
  const pct = $derived(max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0)
  const offset = $derived(circ * (1 - pct / 100))
  const label = $derived(formatLabel ? formatLabel(value, max) : `${Math.round(pct)}%`)
</script>

<div
  class="sv-circ sv-circ--{color}"
  class:is-indeterminate={indeterminate}
  style:width={`${size}px`}
  style:height={`${size}px`}
  role="progressbar"
  aria-label={ariaLabel}
  aria-valuemin={indeterminate ? undefined : 0}
  aria-valuemax={indeterminate ? undefined : max}
  aria-valuenow={indeterminate ? undefined : value}
  aria-valuetext={indeterminate ? undefined : label}
>
  <svg class="sv-circ__svg" viewBox={`0 0 ${size} ${size}`} width={size} height={size}>
    <circle class="sv-circ__track" cx={size / 2} cy={size / 2} r={r} fill="none" stroke-width={thickness} />
    <circle
      class="sv-circ__arc"
      cx={size / 2}
      cy={size / 2}
      r={r}
      fill="none"
      stroke-width={thickness}
      stroke-linecap="round"
      stroke-dasharray={circ}
      stroke-dashoffset={indeterminate ? circ * 0.7 : offset}
    />
  </svg>
  {#if children}
    <div class="sv-circ__center">{@render children()}</div>
  {:else if showLabel && !indeterminate}
    <div class="sv-circ__center sv-circ__label" style:font-size={`${Math.max(9, size * 0.26)}px`}>{label}</div>
  {/if}
</div>

<style>
  .sv-circ {
    --_accent: var(--sg-accent, #2563eb);
    --_c: var(--_accent);
    position: relative; display: inline-flex; flex: none;
  }
  .sv-circ--success { --_c: var(--sg-success, #16a34a); }
  .sv-circ--warning { --_c: var(--sg-warning, #f59e0b); }
  .sv-circ--danger { --_c: var(--sg-danger, #dc2626); }
  .sv-circ__svg { display: block; transform: rotate(-90deg); }
  .sv-circ__track { stroke: var(--sg-border, #e2e8f0); }
  .sv-circ__arc { stroke: var(--_c); transition: stroke-dashoffset 0.35s cubic-bezier(0.16, 1, 0.3, 1); }
  .sv-circ.is-indeterminate .sv-circ__svg { animation: sv-circ-spin 0.9s linear infinite; }
  .sv-circ.is-indeterminate .sv-circ__arc { transition: none; }
  @keyframes sv-circ-spin { to { transform: rotate(270deg); } }
  @media (prefers-reduced-motion: reduce) {
    .sv-circ.is-indeterminate .sv-circ__svg { animation-duration: 2.4s; }
    .sv-circ__arc { transition: none; }
  }
  .sv-circ__center {
    position: absolute; inset: 0; display: grid; place-items: center;
    color: var(--sg-fg, #0f172a);
  }
  .sv-circ__label { font-weight: 700; font-variant-numeric: tabular-nums; }
</style>
