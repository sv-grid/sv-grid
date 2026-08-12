<script lang="ts">
  /**
   * SvStack - a vertical flex layout primitive: stacks children in a column with a
   * consistent `gap` and optional cross-axis `align`. The building block for form
   * rows, card bodies, and sidebars. (For a horizontal row use SvGroup.)
   *
   * ```svelte
   * <SvStack gap={12}><A /><B /><C /></SvStack>
   * ```
   */
  import type { Snippet } from 'svelte'

  type Props = {
    /** Gap between children (px, or any CSS length). Default 12. */
    gap?: number | string
    /** Cross-axis alignment. */
    align?: 'start' | 'center' | 'end' | 'stretch'
    /** Main-axis distribution. */
    justify?: 'start' | 'center' | 'end' | 'between' | 'around'
    /** Wrapping element tag. Default `div`. */
    as?: string
    children?: Snippet
  }

  let { gap = 12, align = 'stretch', justify = 'start', as = 'div', children }: Props = $props()
  const g = $derived(typeof gap === 'number' ? `${gap}px` : gap)
  const alignMap = { start: 'flex-start', center: 'center', end: 'flex-end', stretch: 'stretch' } as const
  const justifyMap = { start: 'flex-start', center: 'center', end: 'flex-end', between: 'space-between', around: 'space-around' } as const
</script>

<svelte:element this={as} class="sv-stack" style:gap={g} style:align-items={alignMap[align]} style:justify-content={justifyMap[justify]}>
  {@render children?.()}
</svelte:element>

<style>
  .sv-stack { display: flex; flex-direction: column; min-width: 0; }
</style>
