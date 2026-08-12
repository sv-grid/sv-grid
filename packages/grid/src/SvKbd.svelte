<script lang="ts">
  /**
   * SvKbd - a keyboard-key hint. Pass `keys` for a combo (joined with the OS
   * separator), or a single `children` label.
   *
   * <SvKbd keys={['Ctrl', 'K']} /> · <SvKbd>Esc</SvKbd>
   */
  import type { Snippet } from 'svelte'

  type Props = {
    /** Key sequence, rendered as separate caps. */
    keys?: string[]
    /** Separator between keys. */
    separator?: string
    size?: 'sm' | 'md'
    children?: Snippet
  }

  let { keys, separator = '+', size = 'md', children }: Props = $props()
</script>

{#if keys}
  <span class="sv-kbd-group sv-kbd--{size}">
    {#each keys as k, i}
      {#if i > 0}<span class="sv-kbd__sep" aria-hidden="true">{separator}</span>{/if}
      <kbd class="sv-kbd">{k}</kbd>
    {/each}
  </span>
{:else}
  <kbd class="sv-kbd sv-kbd--{size}">{@render children?.()}</kbd>
{/if}

<style>
  .sv-kbd-group { display: inline-flex; align-items: center; gap: 3px; }
  .sv-kbd {
    display: inline-block;
    min-width: 1.4em;
    padding: 1px 6px;
    font-family: var(--sg-font-mono, ui-monospace, SFMono-Regular, Menlo, monospace);
    font-size: 12px;
    line-height: 1.5;
    text-align: center;
    color: var(--sg-fg, #0f172a);
    background: var(--sg-muted-bg, color-mix(in srgb, var(--sg-fg, #0f172a) 7%, var(--sg-bg, #fff)));
    border: 1px solid var(--sg-border, #e2e8f0);
    border-bottom-width: 2px;
    border-radius: 5px;
  }
  .sv-kbd--sm { font-size: 11px; padding: 0 4px; }
  .sv-kbd__sep { color: var(--sg-muted, #64748b); font-size: 11px; }
</style>
