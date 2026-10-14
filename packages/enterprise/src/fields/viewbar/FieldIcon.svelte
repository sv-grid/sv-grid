<script lang="ts">
  /** A field's type icon, as the header and the field editor show it. */
  import { getFieldType } from '../registry.svelte'

  let { column, size = 14 }: { column: { fieldType?: string }; size?: number } = $props()

  // A column without a field type: a plain "text" mark.
  const TEXT = 'M5 7h14M5 12h10M5 17h7'
  const path = $derived((column.fieldType && getFieldType(column.fieldType)?.icon) || TEXT)
</script>

<svg class="sv-fvb-field-icon" viewBox="0 0 24 24" width={size} height={size} aria-hidden="true"
  ><path d={path} fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" /></svg
>

<style>
  .sv-fvb-field-icon { flex: none; color: var(--sg-muted, #64748b); }
</style>
