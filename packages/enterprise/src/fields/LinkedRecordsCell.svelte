<script lang="ts">
  /**
   * Link-to-records cells: one chip per linked row, showing its primary
   * field. A click on a chip opens that record; resting the pointer on one
   * previews it.
   */
  import type { FieldCellProps } from './registry.svelte'
  import { getLinkedTable, idOf, linkedRows } from './sources.svelte'
  import { openLinkedRecord, showLinkPreview } from './editor-request.svelte'

  let { ctrl, value, props }: FieldCellProps<{ table?: string }> = $props()
  const table = $derived(getLinkedTable(props.table))
  const chips = $derived(
    linkedRows(table, value).map((r) => ({ id: table ? idOf(table, r) : '', name: String(r[table?.primaryField ?? 'name'] ?? '') })),
  )

  let timer: ReturnType<typeof setTimeout> | undefined
  function enter(e: PointerEvent, id: string) {
    if (!table || e.pointerType === 'touch') return
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    clearTimeout(timer)
    timer = setTimeout(() => showLinkPreview({ ctrl, table: table.id, rowId: id, x: rect.left, y: rect.bottom }), 350)
  }
  function leave(e: PointerEvent) {
    clearTimeout(timer)
    // Onto the card itself: it closes when the pointer leaves it.
    const to = e.relatedTarget as Element | null
    if (!to?.closest?.('.sv-flpv')) showLinkPreview(null)
  }
</script>

<span class="sv-flr">
  {#each chips as chip, i (i)}
    <button
      type="button"
      class="sv-flr-chip"
      tabindex="-1"
      onpointerdown={(e) => e.stopPropagation()}
      onpointerenter={(e) => enter(e, chip.id)}
      onpointerleave={leave}
      onclick={(e) => {
        e.stopPropagation()
        clearTimeout(timer)
        if (table) openLinkedRecord({ ctrl, table: table.id, rowId: chip.id })
      }}>{chip.name || 'Unnamed'}</button
    >
  {/each}
</span>

<style>
  .sv-flr { display: inline-flex; gap: 4px; min-width: 0; overflow: hidden; }
  .sv-flr-chip {
    flex: none; max-width: 160px; padding: 1px 8px; border-radius: 4px; font: inherit; font-size: 12px; color: inherit; cursor: pointer;
    background: color-mix(in srgb, #2d7ff9 12%, transparent);
    border: 1px solid color-mix(in srgb, #2d7ff9 30%, transparent);
    overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  }
  .sv-flr-chip:hover { background: color-mix(in srgb, #2d7ff9 22%, transparent); }
</style>
