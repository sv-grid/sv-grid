<script lang="ts">
  /** Barcode cells: a barcode mark and the code's text (`{ text, type }` or a plain string). */
  import type { FieldCellProps } from './registry.svelte'

  let { value }: FieldCellProps = $props()
  const text = $derived(value && typeof value === 'object' ? String((value as { text?: unknown }).text ?? '') : value == null ? '' : String(value))
</script>

{#if text}
  <span class="sv-fbc">
    <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><path d="M4 5v14M7 5v14M10 5v14M13 5v14M15 5v14M18 5v14M20 5v14" fill="none" stroke="currentColor" stroke-width="1.4" /></svg>
    <span class="sv-fbc-text">{text}</span>
  </span>
{/if}

<style>
  .sv-fbc { display: inline-flex; align-items: center; gap: 6px; min-width: 0; }
  .sv-fbc svg { flex: none; color: var(--sg-muted, #64748b); }
  .sv-fbc-text { font-variant-numeric: tabular-nums; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
</style>
