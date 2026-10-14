<script lang="ts">
  /**
   * URL, email and phone cells: the value as a link when it is a valid one of
   * its kind (see links.ts), plain text otherwise. A plain click on the link
   * follows it; clicking elsewhere in the cell selects it as usual.
   */
  import type { FieldCellProps } from './registry.svelte'
  import { linkHref, linkText, type LinkKind } from './links'

  let { value, column }: FieldCellProps = $props()
  const kind = $derived((column.columnDef.fieldType as LinkKind) ?? 'url')
  const href = $derived(linkHref(kind, value))
  const text = $derived(linkText(kind, value))
</script>

{#if href}
  <a
    class="sv-field-link"
    {href}
    target={kind === 'url' ? '_blank' : undefined}
    rel={kind === 'url' ? 'noopener noreferrer' : undefined}
    onpointerdown={(e) => e.stopPropagation()}
  >{text}</a>
{:else}
  <span class="sv-field-link-text">{text}</span>
{/if}

<style>
  /* Text colour with an underline, not the accent: on themes where the accent
     marks selection (Ember), a column of accent links reads as selected. */
  .sv-field-link {
    color: inherit;
    text-decoration: underline;
    text-decoration-color: var(--sg-muted, #94a3b8);
    text-underline-offset: 2px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .sv-field-link:hover { text-decoration-color: currentColor; }
  .sv-field-link-text {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
</style>
