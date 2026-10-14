<script lang="ts">
  /**
   * The card a linked record shows while the pointer rests on its chip: the
   * record's name, its table and its first few fields. One per grid; the chip
   * says where it is (showLinkPreview).
   */
  import { portalToBody } from '@svgrid/grid'
  import { showLinkPreview, type LinkPreviewRequest } from './editor-request.svelte'
  import { getLinkedTable } from './sources.svelte'
  import { linkedFields, linkedRow, linkedText, linkedValue } from './linked-fields'

  let { request }: { request: LinkPreviewRequest } = $props()

  const MAX_FIELDS = 4
  const table = $derived(getLinkedTable(request.table))
  const row = $derived(table ? linkedRow(table, request.rowId) : undefined)
  // The first four fields that have a value: an empty one does not use up a place.
  const fields = $derived.by(() => {
    if (!table || !row) return []
    const out: Array<{ id: string; header: string; text: string }> = []
    for (const f of linkedFields(table, row)) {
      if (f.id === table.primaryField) continue
      const text = linkedText(f, linkedValue(f, row), row)
      if (text) out.push({ id: f.id, header: f.header, text })
      if (out.length === MAX_FIELDS) break
    }
    return out
  })
  // Below the chip, kept inside the window.
  const left = $derived(Math.max(8, Math.min(request.x, (typeof window !== 'undefined' ? window.innerWidth : 1200) - 268)))
</script>

{#if table && row}
  <div
    class="sv-flpv"
    use:portalToBody
    style:left={`${left}px`}
    style:top={`${request.y + 6}px`}
    role="tooltip"
    onpointerleave={() => showLinkPreview(null)}
  >
    <div class="sv-flpv-title">{String(row[table.primaryField] ?? '') || 'Unnamed'}</div>
    <div class="sv-flpv-table">{table.name}</div>
    {#each fields as f (f.id)}
      <div class="sv-flpv-field"><span class="sv-flpv-label">{f.header}</span>{f.text}</div>
    {/each}
  </div>
{/if}

<style>
  .sv-flpv {
    position: fixed; z-index: 2147483645; width: 260px; box-sizing: border-box; padding: 10px 12px;
    background: var(--sg-bg, #fff); color: var(--sg-fg, #0f172a); font-size: 12px; line-height: 1.5;
    border: 1px solid var(--sg-border, #e2e8f0); border-radius: 10px; box-shadow: 0 12px 32px -12px rgba(15, 23, 42, 0.4);
  }
  .sv-flpv-title { font-size: 14px; font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .sv-flpv-table { color: var(--sg-muted, #64748b); margin-bottom: 6px; }
  .sv-flpv-field { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .sv-flpv-label { color: var(--sg-muted, #64748b); margin-inline-end: 6px; }
</style>
