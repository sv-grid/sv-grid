<script lang="ts">
  /**
   * SvTitle - a heading primitive. `order` sets the semantic level (h1-h6) and,
   * by default, the visual size; pass `size` to decouple the two (e.g. an h2 that
   * looks like an h4). Themes from the shared `--sg-*` tokens.
   *
   * <SvTitle order={1}>Dashboard</SvTitle>
   * <SvTitle order={3} size={5}>Small but semantic h3</SvTitle>
   */
  import type { Snippet } from 'svelte'

  type Level = 1 | 2 | 3 | 4 | 5 | 6

  type Props = {
    /** Semantic heading level (h1-h6). */
    order?: Level
    /** Visual size step, defaults to `order`. */
    size?: Level
    /** Text alignment. */
    align?: 'start' | 'center' | 'end'
    /** Truncate to a single line with an ellipsis. */
    truncate?: boolean
    children?: Snippet
  }

  let { order = 2, size, align, truncate = false, children }: Props = $props()

  // px + weight per visual step - a compact, balanced type scale.
  const sizeMap = { 1: '30px', 2: '24px', 3: '20px', 4: '17px', 5: '15px', 6: '13px' } as const
  const weightMap = { 1: 700, 2: 700, 3: 600, 4: 600, 5: 600, 6: 600 } as const
  const alignMap = { start: 'left', center: 'center', end: 'right' } as const

  const step = $derived(size ?? order)
  const tag = $derived(`h${order}`)
</script>

<svelte:element
  this={tag}
  class="sv-title"
  class:is-truncate={truncate}
  style:font-size={sizeMap[step]}
  style:font-weight={weightMap[step]}
  style:text-align={align ? alignMap[align] : undefined}
>
  {@render children?.()}
</svelte:element>

<style>
  .sv-title {
    margin: 0;
    font-family: var(--sg-font, inherit);
    color: var(--sg-fg, #0f172a);
    line-height: 1.25;
    letter-spacing: -0.01em;
  }
  .sv-title.is-truncate { overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
</style>
