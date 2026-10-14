<script lang="ts">
  /**
   * "Delete field?" for a link field with a field that links back from the
   * other table, or with lookups, rollups and counts that read it: they are
   * all deleted with it, so it says so before it does. Any field that
   * formulas read asks too: they stay, and show #ERROR.
   */
  import { SvModal } from '@svgrid/grid'
  import { linkReaders } from './base-tables'
  import { defId, removeField } from './field-ops'
  import { formulaReaders } from './formula'
  import { getLinkedTable } from './sources.svelte'

  let { ctrl, columnId, onClose }: { ctrl: any; columnId: string; onClose: () => void } = $props()

  let open = $state(true)
  // svelte-ignore state_referenced_locally
  const def = (ctrl.internalColumns as Array<Record<string, any>>).find((d) => defId(d) === columnId)
  // svelte-ignore state_referenced_locally
  const name = String(def?.header ?? columnId)
  const table = getLinkedTable(def?.fieldProps?.table)
  const back = table?.fields?.find((f) => f.field === def?.fieldProps?.inverse)?.header
  // Lookups, rollups and counts that read either field: they go with it. The
  // ones here are removed from this grid; a base removes the ones in the
  // other table with the field back.
  // svelte-ignore state_referenced_locally
  const own = def ? linkReaders({ columns: ctrl.internalColumns as Array<Record<string, any>> }, def) : []
  const theirs = def?.fieldProps?.inverse ? (table?.fields ?? []).filter((f) => f.fieldProps?.linkField === def.fieldProps.inverse && ['lookup', 'rollup', 'count'].includes(String(f.fieldType))) : []
  const readers = [...own.map((d) => String(d.header ?? d.field)), ...theirs.map((f) => `${f.header} (${table!.name})`)]
  const isLink = def?.fieldType === 'link'
  // Formulas that read it, or a lookup deleted with it: they stay and show #ERROR.
  // svelte-ignore state_referenced_locally
  const columns = ctrl.internalColumns as Array<Record<string, any>>
  const formulas = def ? [...new Set([def, ...own].flatMap((d) => formulaReaders(columns, d)))].map((d) => String(d.header ?? d.field)) : []

  function close() {
    open = false
    onClose()
  }
  function remove() {
    for (const d of own) removeField(ctrl, defId(d))
    removeField(ctrl, columnId)
    close()
  }
</script>

<SvModal bind:open title={`Delete ${name}?`} width={440} onClose={close}>
  {#if isLink}
    <p class="sv-fdel-text">
      {name} links to {table?.name ?? 'another table'}.
      {#if back}The field there that links back, <strong>{back}</strong>, is deleted with it.{/if}
      The links between the records go too.
    </p>
    {#if readers.length}
      <p class="sv-fdel-text sv-fdel-note">These fields read it and are deleted too: {readers.join(', ')}.</p>
    {/if}
  {:else}
    <p class="sv-fdel-text">{name} and its values are deleted.</p>
  {/if}
  {#if formulas.length}
    <p class="sv-fdel-text sv-fdel-note sv-fdel-formulas">These formulas read it and will show #ERROR: {formulas.join(', ')}.</p>
  {/if}
  {#snippet footer()}
    <div class="sv-fdel-foot">
      <button type="button" class="sv-fdel-btn" onclick={close}>Cancel</button>
      <button type="button" class="sv-fdel-btn is-danger" onclick={remove}>Delete field</button>
    </div>
  {/snippet}
</SvModal>

<style>
  .sv-fdel-text { margin: 0; font-size: 14px; line-height: 1.5; color: var(--sg-fg, #0f172a); }
  .sv-fdel-note { margin-top: 10px; font-size: 13px; color: var(--sg-muted, #64748b); }
  .sv-fdel-foot { display: flex; justify-content: flex-end; gap: 8px; width: 100%; }
  .sv-fdel-btn {
    height: 32px; padding: 0 14px; font: inherit; font-size: 13px; cursor: pointer; border-radius: var(--sg-radius, 6px);
    background: transparent; color: var(--sg-fg, #0f172a); border: 1px solid var(--sg-border, #e2e8f0);
  }
  .sv-fdel-btn.is-danger { background: var(--sg-danger, #dc2626); border-color: var(--sg-danger, #dc2626); color: #fff; }
</style>
