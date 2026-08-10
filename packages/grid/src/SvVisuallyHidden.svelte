<script lang="ts">
  /**
   * SvVisuallyHidden - content available to screen readers but visually hidden
   * (the accessible "sr-only" pattern). Use for extra context on icon-only
   * controls, live-region text, and skip links (which become visible on focus
   * via `focusable`).
   *
   * <button><Icon /><SvVisuallyHidden>Delete row</SvVisuallyHidden></button>
   */
  import type { Snippet } from 'svelte'

  type Props = {
    /** Reveal the content when it (or a child) receives focus - for skip links. */
    focusable?: boolean
    /** Element/tag to render. */
    as?: string
    children?: Snippet
  }

  let { focusable = false, as = 'span', children }: Props = $props()
</script>

<svelte:element this={as} class="sv-vh" class:is-focusable={focusable}>
  {@render children?.()}
</svelte:element>

<style>
  .sv-vh {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0 0 0 0);
    white-space: nowrap;
    border: 0;
  }
  .sv-vh.is-focusable:focus,
  .sv-vh.is-focusable:focus-within {
    position: static;
    width: auto;
    height: auto;
    margin: 0;
    overflow: visible;
    clip: auto;
    white-space: normal;
  }
</style>
