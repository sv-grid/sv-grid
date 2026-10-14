<script lang="ts">
  /** Long-text cells with rich text on: the formatted lines, one after another, clipped to the row. */
  import type { FieldCellProps } from './registry.svelte'
  import { parseRichText } from './rich-text'

  let { value }: FieldCellProps = $props()
  const lines = $derived(parseRichText(value))
</script>

<span class="sv-frx">
  {#each lines as line, i (i)}
    {#if i > 0}<span class="sv-frx-sep" aria-hidden="true"> </span>{/if}
    {#if line.bullet}<span class="sv-frx-bullet" aria-hidden="true">•</span>{/if}
    {#each line.parts as p, j (j)}
      {#if p.kind === 'b'}<strong>{p.text}</strong>
      {:else if p.kind === 'i'}<em>{p.text}</em>
      {:else if p.kind === 'code'}<code>{p.text}</code>
      {:else if p.kind === 'a'}<a href={p.href} target="_blank" rel="noopener noreferrer" onpointerdown={(e) => e.stopPropagation()}>{p.text}</a>
      {:else}{p.text}{/if}
    {/each}
  {/each}
</span>

<style>
  .sv-frx { display: block; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .sv-frx code { font-size: 0.9em; padding: 0 3px; border-radius: 3px; background: var(--sg-header-bg, #f8fafc); }
  .sv-frx a { color: inherit; text-decoration: underline; text-decoration-color: var(--sg-muted, #94a3b8); }
  .sv-frx-bullet { margin-inline-end: 4px; color: var(--sg-muted, #64748b); }
  .sv-frx-sep { margin-inline: 4px; }
</style>
