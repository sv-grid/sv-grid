<script lang="ts">
  /**
   * SvScrollArea - a scroll container with the kit's themed custom scrollbars
   * (Firefox `scrollbar-color` + Chromium `::-webkit-scrollbar`) consuming the
   * `--sg-scrollbar-*` tokens, so any panel matches the grid/demos without
   * hand-rolling scrollbar CSS. The fallbacks derive from `--sg-fg` so it also
   * adapts to light/dark when no preset defines the tokens.
   *
   * ```svelte
   * <SvScrollArea maxHeight="240px">…long content…</SvScrollArea>
   * ```
   */
  import type { Snippet } from 'svelte'

  type Props = {
    maxHeight?: string
    height?: string
    /** Scroll horizontally instead of vertically. */
    horizontal?: boolean
    /** Accessible name for the scrollable region, announced by screen readers. */
    ariaLabel?: string
    children?: Snippet
  }

  let { maxHeight, height, horizontal = false, ariaLabel = 'Scrollable content', children }: Props = $props()
</script>

<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
<div
  class="sv-scroll"
  class:is-x={horizontal}
  style:max-height={maxHeight}
  style:height={height}
  tabindex="0"
  role="region"
  aria-label={ariaLabel}
>
  {@render children?.()}
</div>

<style>
  .sv-scroll {
    overflow: auto; overscroll-behavior: contain; min-height: 0;
    scrollbar-width: thin;
    scrollbar-color: var(--sg-scrollbar-thumb, color-mix(in srgb, var(--sg-fg, #0f172a) 26%, transparent)) var(--sg-scrollbar-bg, transparent);
  }
  .sv-scroll.is-x { overflow: auto hidden; }
  .sv-scroll::-webkit-scrollbar { width: 12px; height: 12px; }
  .sv-scroll::-webkit-scrollbar-track {
    background: var(--sg-scrollbar-bg, transparent);
    box-shadow: inset 1px 0 0 0 var(--sg-scrollbar-border, transparent);
  }
  .sv-scroll::-webkit-scrollbar-thumb {
    background: var(--sg-scrollbar-thumb, color-mix(in srgb, var(--sg-fg, #0f172a) 26%, transparent));
    border-radius: var(--sg-scrollbar-thumb-radius, 6px);
    border: 3px solid transparent; background-clip: padding-box;
  }
  .sv-scroll::-webkit-scrollbar-thumb:hover { background: var(--sg-scrollbar-thumb-hover, color-mix(in srgb, var(--sg-fg, #0f172a) 38%, transparent)); }
  .sv-scroll::-webkit-scrollbar-thumb:active { background: var(--sg-scrollbar-thumb-active, color-mix(in srgb, var(--sg-fg, #0f172a) 50%, transparent)); }
  .sv-scroll::-webkit-scrollbar-corner { background: var(--sg-scrollbar-bg, transparent); }
</style>
