<script lang="ts">
  /**
   * "Delete record?" from a row's or a card's menu, as the selection bar asks
   * before it deletes: the record goes, and its links from other records.
   */
  import { SvModal } from '@svgrid/grid'
  import { primaryIdOf } from './grid-access'
  import { deleteRecord } from './view-model'

  let { ctrl, api, row, onClose }: { ctrl: any; api: any; row: unknown; onClose: () => void } = $props()

  let open = $state(true)
  // svelte-ignore state_referenced_locally
  const primary = (ctrl.internalColumns as Array<Record<string, any>>).find((d) => String(d.id ?? d.field) === primaryIdOf(ctrl))
  // svelte-ignore state_referenced_locally
  const name = String((primary?.field ? (row as Record<string, unknown> | null)?.[primary.field] : '') ?? '').trim()

  function close() {
    open = false
    onClose()
  }
  function remove() {
    deleteRecord(ctrl, api, row)
    close()
  }
</script>

<SvModal bind:open title="Delete record?" width={420} onClose={close}>
  <p class="sv-frdel-text">
    {#if name}<strong>{name}</strong> is deleted{:else}This record is deleted{/if}, and its links from other records go with it.
  </p>
  {#snippet footer()}
    <div class="sv-frdel-foot">
      <button type="button" class="sv-frdel-btn" onclick={close}>Cancel</button>
      <button type="button" class="sv-frdel-btn is-danger" onclick={remove}>Delete record</button>
    </div>
  {/snippet}
</SvModal>

<style>
  .sv-frdel-text { margin: 0; font-size: 14px; line-height: 1.5; color: var(--sg-fg, #0f172a); }
  .sv-frdel-foot { display: flex; justify-content: flex-end; gap: 8px; width: 100%; }
  .sv-frdel-btn {
    height: 32px; padding: 0 14px; font: inherit; font-size: 13px; cursor: pointer; border-radius: var(--sg-radius, 6px);
    background: transparent; color: var(--sg-fg, #0f172a); border: 1px solid var(--sg-border, #e2e8f0);
  }
  .sv-frdel-btn.is-danger { background: var(--sg-danger, #dc2626); border-color: var(--sg-danger, #dc2626); color: #fff; }
</style>
