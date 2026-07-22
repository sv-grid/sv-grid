<script lang="ts">
  /**
   * SvSkeleton - a shimmering loading placeholder. Use it while data is in
   * flight; it respects `prefers-reduced-motion` (falls back to a static tint).
   * Parity: Smart skeleton / loading indicators.
   *
   * ```svelte
   * <SvSkeleton variant="text" lines={3} />
   * <SvSkeleton variant="circle" width="40px" height="40px" />
   * ```
   */
  type Props = {
    variant?: 'text' | 'rect' | 'circle'
    /** Any CSS length. Defaults suit the variant. */
    width?: string
    height?: string
    /** Corner radius (rect/text). */
    radius?: string
    /** Number of text lines (variant="text" only). The last line is shorter. */
    lines?: number
    /** Turn the shimmer off (static tint only). */
    animated?: boolean
  }

  let { variant = 'text', width, height, radius, lines = 1, animated = true }: Props = $props()

  const isText = $derived(variant === 'text')
  const rowCount = $derived(isText ? Math.max(1, lines) : 1)
</script>

<div class="sv-skel" role="status" aria-busy="true" aria-live="polite">
  <span class="sv-skel__sr">Loading</span>
  {#each Array(rowCount) as _, i (i)}
    <span
      class="sv-skel__box sv-skel__box--{variant}"
      class:is-animated={animated}
      class:is-last={isText && i === rowCount - 1 && rowCount > 1}
      style:width={width}
      style:height={height}
      style:border-radius={variant === 'circle' ? '50%' : radius}
      aria-hidden="true"
    ></span>
  {/each}
</div>

<style>
  .sv-skel { display: flex; flex-direction: column; gap: 8px; }
  .sv-skel__sr {
    position: absolute; width: 1px; height: 1px; margin: -1px; padding: 0;
    overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; border: 0;
  }
  .sv-skel__box {
    display: block;
    background: var(--sg-skeleton-bg, var(--sg-row-hover-bg, #e2e8f0));
    border-radius: var(--sg-radius, 8px);
  }
  .sv-skel__box--text { width: 100%; height: 0.85em; }
  .sv-skel__box--rect { width: 100%; height: 120px; }
  .sv-skel__box--circle { width: 40px; height: 40px; border-radius: 50%; }
  .sv-skel__box.is-last { width: 60%; }

  .sv-skel__box.is-animated {
    background: linear-gradient(
      90deg,
      var(--sg-skeleton-bg, var(--sg-row-hover-bg, #e2e8f0)) 25%,
      color-mix(in srgb, var(--sg-skeleton-bg, var(--sg-row-hover-bg, #e2e8f0)) 55%, var(--sg-bg, #fff)) 37%,
      var(--sg-skeleton-bg, var(--sg-row-hover-bg, #e2e8f0)) 63%
    );
    background-size: 400% 100%;
    animation: sv-skel-shimmer 1.4s ease-in-out infinite;
  }
  @keyframes sv-skel-shimmer { 0% { background-position: 100% 0 } 100% { background-position: 0 0 } }
  @media (prefers-reduced-motion: reduce) {
    .sv-skel__box.is-animated { animation: none; background: var(--sg-skeleton-bg, var(--sg-row-hover-bg, #e2e8f0)); }
  }
</style>
