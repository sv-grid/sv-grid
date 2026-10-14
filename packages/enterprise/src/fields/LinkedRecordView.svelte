<script lang="ts">
  /**
   * A record of a linked table, opened from a link chip: its fields with
   * their names and values, drawn as their cells draw them. The table belongs
   * to the app, so the record is read here, not edited; a table that can show
   * its records (another tab of a base, `open`) offers "Open in {table}".
   */
  import { SvModal } from '@svgrid/grid'
  import FieldCell from './FieldCell.svelte'
  import { getLinkedTable } from './sources.svelte'
  import { closeAllLinkedRecords } from './editor-request.svelte'
  import { linkedFields, linkedRow, linkedText, linkedValue } from './linked-fields'
  import { getFieldType, typeDrawsCell } from './registry.svelte'

  let { ctrl, table: tableId, rowId, onClose }: { ctrl: any; table: string; rowId: string; onClose: () => void } = $props()

  let open = $state(true)
  const table = $derived(getLinkedTable(tableId))
  const row = $derived(table ? linkedRow(table, rowId) : undefined)
  const fields = $derived(table ? linkedFields(table, row) : [])
  const title = $derived(table && row ? String(row[table.primaryField] ?? '') || 'Unnamed' : 'Record')
  const draws = (def: Record<string, any>) => !!def.fieldType && def.cell == null && typeDrawsCell(def)
  /** Show the record in its own table, and close every linked record over this grid. */
  function openWhere() {
    const go = table?.open
    open = false
    closeAllLinkedRecords()
    go?.(rowId)
  }
</script>

<SvModal bind:open {title} width={520} {onClose}>
  {#if !table || !row}
    <p class="sv-flrv-gone">This record is not in its table any more.</p>
  {:else}
    <p class="sv-flrv-table">{table.name}</p>
    <div class="sv-flrv-fields">
      {#each fields as f (f.id)}
        {@const v = linkedValue(f, row)}
        <div class="sv-flrv-field">
          <div class="sv-flrv-label">
            {#if f.def.fieldType && getFieldType(f.def.fieldType)?.icon}
              <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><path d={getFieldType(f.def.fieldType)?.icon} fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" /></svg>
            {/if}
            {f.header}
          </div>
          <div class="sv-flrv-value">
            {#if draws(f.def)}
              <FieldCell {ctrl} row={{ id: rowId, original: row }} column={{ id: f.id, columnDef: f.def }} value={v} />
            {:else}
              {linkedText(f, v, row) || ' '}
            {/if}
          </div>
        </div>
      {/each}
    </div>
  {/if}
  {#snippet footer()}
    <div class="sv-flrv-footer">
      {#if table?.open && row}
        <button
          type="button"
          class="sv-flrv-btn sv-flrv-btn-quiet"
          onclick={openWhere}>Open in {table.name}</button
        >
      {/if}
      <button
        type="button"
        class="sv-flrv-btn"
        onclick={() => {
          open = false
          onClose()
        }}>Close</button
      >
    </div>
  {/snippet}
</SvModal>

<style>
  .sv-flrv-table { margin: -6px 0 12px; font-size: 12px; color: var(--sg-muted, #64748b); }
  .sv-flrv-fields { display: flex; flex-direction: column; gap: 12px; }
  .sv-flrv-label { display: flex; align-items: center; gap: 6px; font-size: 12px; font-weight: 600; color: var(--sg-muted, #64748b); margin-bottom: 4px; }
  .sv-flrv-value {
    display: flex; align-items: center; min-height: 34px; padding: 0 10px; box-sizing: border-box; font-size: 14px;
    border: 1px solid var(--sg-border, #e2e8f0); border-radius: var(--sg-radius, 6px); background: var(--sg-header-bg, #f8fafc);
  }
  .sv-flrv-gone { color: var(--sg-muted, #64748b); }
  .sv-flrv-footer { display: flex; justify-content: flex-end; gap: 8px; width: 100%; }
  .sv-flrv-btn {
    height: 32px; padding: 0 14px; font: inherit; font-size: 13px; cursor: pointer; border-radius: var(--sg-radius, 6px);
    background: var(--sg-fg, #0f172a); color: var(--sg-bg, #fff); border: 1px solid var(--sg-fg, #0f172a);
  }
  .sv-flrv-btn-quiet { background: transparent; color: var(--sg-fg, #0f172a); border-color: var(--sg-border, #e2e8f0); }
</style>
