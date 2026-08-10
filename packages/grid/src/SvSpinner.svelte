<script lang="ts">
  /**
   * SvSpinner - a dedicated indeterminate loading spinner (distinct from the
   * determinate SvProgress bars). Sizeable, colorable, and it respects
   * `prefers-reduced-motion`. Give it a `label` for screen readers.
   *
   * ```svelte
   * <SvSpinner size="lg" label="Loading results" />
   * ```
   */
  type Props = {
    /** Diameter in px, or a named size. Default `md` (20px). */
    size?: 'sm' | 'md' | 'lg' | number
    /** Stroke color (defaults to the accent token). */
    color?: string
    /** Accessible label; when omitted the spinner is `aria-hidden`. */
    label?: string
  }

  let { size = 'md', color, label }: Props = $props()
  const px = $derived(typeof size === 'number' ? size : size === 'sm' ? 15 : size === 'lg' ? 28 : 20)
</script>

<span
  class="sv-spinner"
  role={label ? 'status' : undefined}
  aria-label={label}
  aria-hidden={label ? undefined : 'true'}
  style:width={`${px}px`}
  style:height={`${px}px`}
  style:color={color}
></span>

<style>
  .sv-spinner {
    display: inline-block; box-sizing: border-box; flex: none; border-radius: 50%;
    border: 2px solid color-mix(in srgb, currentcolor 25%, transparent);
    border-top-color: currentcolor; color: var(--sg-accent, #2563eb);
    animation: sv-spinner-rot 0.6s linear infinite;
  }
  @keyframes sv-spinner-rot { to { transform: rotate(360deg); } }
  @media (prefers-reduced-motion: reduce) { .sv-spinner { animation-duration: 1.4s; } }
</style>
