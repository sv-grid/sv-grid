<script lang="ts">
  /**
   * SvSimpleGrid - a responsive grid primitive: lays children into `cols` equal
   * columns that auto-fit down to a `minChildWidth` before wrapping, with a
   * consistent `gap`. Use it for card galleries, stat tiles, and dashboards.
   *
   * ```svelte
   * <SvSimpleGrid minChildWidth={220} gap={12}>{#each tiles as t}<Card {t} />{/each}</SvSimpleGrid>
   * ```
   */
  import type { Snippet } from 'svelte'

  type Props = {
    /**
     * Fixed column count. When omitted, columns auto-fit based on
     * `minChildWidth` (responsive by default).
     */
    cols?: number
    /** Minimum child width (px) before wrapping, for the auto-fit layout. Default 200. */
    minChildWidth?: number
    /** Gap between cells (px, or any CSS length). Default 12. */
    gap?: number | string
    children?: Snippet
  }

  let { cols, minChildWidth = 200, gap = 12, children }: Props = $props()
  const g = $derived(typeof gap === 'number' ? `${gap}px` : gap)
  const template = $derived(
    cols != null
      ? `repeat(${cols}, minmax(0, 1fr))`
      : `repeat(auto-fit, minmax(min(${minChildWidth}px, 100%), 1fr))`,
  )
</script>

<div class="sv-simplegrid" style:gap={g} style:grid-template-columns={template}>
  {@render children?.()}
</div>

<style>
  .sv-simplegrid { display: grid; min-width: 0; }
</style>
