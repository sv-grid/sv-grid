<script lang="ts">
  /**
   * SvGroup - a horizontal flex layout primitive: lays children in a row with a
   * consistent `gap`, alignment, and optional wrapping. The row counterpart to
   * SvStack - toolbars, button clusters, inline label + control.
   *
   * ```svelte
   * <SvGroup gap={8} justify="between"><Title /><Actions /></SvGroup>
   * ```
   */
  import type { Snippet } from 'svelte'

  type Props = {
    /** Gap between children (px, or any CSS length). Default 8. */
    gap?: number | string
    /** Cross-axis alignment. Default `center`. */
    align?: 'start' | 'center' | 'end' | 'stretch' | 'baseline'
    /** Main-axis distribution. */
    justify?: 'start' | 'center' | 'end' | 'between' | 'around'
    /** Allow wrapping to multiple rows. */
    wrap?: boolean
    /** Give every child `flex: 1` so they share the width evenly. */
    grow?: boolean
    as?: string
    children?: Snippet
  }

  let { gap = 8, align = 'center', justify = 'start', wrap = false, grow = false, as = 'div', children }: Props = $props()
  const g = $derived(typeof gap === 'number' ? `${gap}px` : gap)
  const alignMap = { start: 'flex-start', center: 'center', end: 'flex-end', stretch: 'stretch', baseline: 'baseline' } as const
  const justifyMap = { start: 'flex-start', center: 'center', end: 'flex-end', between: 'space-between', around: 'space-around' } as const
</script>

<svelte:element this={as} class="sv-group" class:is-grow={grow} style:gap={g} style:flex-wrap={wrap ? 'wrap' : 'nowrap'} style:align-items={alignMap[align]} style:justify-content={justifyMap[justify]}>
  {@render children?.()}
</svelte:element>

<style>
  .sv-group { display: flex; flex-direction: row; min-width: 0; }
  .sv-group.is-grow > :global(*) { flex: 1 1 0; min-width: 0; }
</style>
