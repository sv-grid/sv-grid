<script lang="ts">
  /**
   * SvList - a themed ordered / unordered / unstyled list. Pass `items` for the
   * simple case, or a `children` snippet for full control over each `<li>`.
   *
   * <SvList items={['One', 'Two', 'Three']} />
   * <SvList type="ordered" spacing="lg" items={steps} />
   */
  import type { Snippet } from 'svelte'

  type Props = {
    /** Marker style. `none` drops markers + indentation. */
    type?: 'unordered' | 'ordered' | 'none'
    /** Simple string items (skip the snippet). */
    items?: string[]
    /** Vertical gap between items. */
    spacing?: 'sm' | 'md' | 'lg'
    /** Font size step. */
    size?: 'sm' | 'md' | 'lg'
    /** Custom list content (`<li>` elements). Overrides `items`. */
    children?: Snippet
  }

  let { type = 'unordered', items, spacing = 'md', size = 'md', children }: Props = $props()

  const gapMap = { sm: '2px', md: '6px', lg: '10px' } as const
  const sizeMap = { sm: '13px', md: '14px', lg: '16px' } as const
  const tag = $derived(type === 'ordered' ? 'ol' : 'ul')
</script>

<svelte:element
  this={tag}
  class="sv-list sv-list--{type}"
  style:--sv-list-gap={gapMap[spacing]}
  style:font-size={sizeMap[size]}
>
  {#if children}
    {@render children()}
  {:else if items}
    {#each items as item}<li>{item}</li>{/each}
  {/if}
</svelte:element>

<style>
  .sv-list {
    margin: 0;
    font-family: var(--sg-font, inherit);
    color: var(--sg-fg, #0f172a);
    line-height: 1.5;
  }
  .sv-list--unordered, .sv-list--ordered { padding-left: 1.4em; }
  .sv-list--none { padding-left: 0; list-style: none; }
  .sv-list :global(li) { margin-top: var(--sv-list-gap, 6px); }
  .sv-list :global(li:first-child) { margin-top: 0; }
</style>
