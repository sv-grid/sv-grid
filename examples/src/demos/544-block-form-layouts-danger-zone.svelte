<script lang="ts" module>
  /**
   * Danger zone block - the destructive actions of a project's settings,
   * kept apart in a panel bordered in --sg-danger. Transfer ownership takes a
   * new owner from an SvDropDownList and an SvCheckBox acknowledgement;
   * Archive asks once through SvPopconfirm; Delete opens an SvModal where the
   * Delete SvButton stays disabled until the project name is typed exactly
   * into an SvTextInput. Pure UI-kit, --sg-* themed.
   *
   * Headless: createDangerZone() below owns the owner, transfer, archive and
   * type-to-confirm delete flows with no markup. The component under it is
   * one styled render of that core; import createDangerZone from this file
   * (or `npx @svgrid/ui add form-layouts-danger-zone --headless` for the core
   * alone) to draw your own.
   */
  const STATUSES = ['Active', 'Archived', 'Deleted'] as const
  export type DangerZoneStatus = (typeof STATUSES)[number]
  export type DangerZoneOptions = {
    /** The project name, which is also what the user types to confirm a delete. */
    project?: string
    owner?: string
    people?: { value: string; label: string }[]
    archived?: boolean
    /** Called with the new owner; throw (or reject) to keep the current owner. */
    onTransfer?: (to: string) => Promise<void> | void
    onArchive?: (archived: boolean) => void
    /** Called once the name matches and Delete is pressed; throw (or reject) to keep the project. */
    onDelete?: (project: string) => Promise<void> | void
    /** Called after the delete went through; `undo` brings the project back. */
    onDeleted?: (undo: () => void) => void
  }

  const SAMPLE_PEOPLE = [
    { value: 'Ada Lovelace', label: 'Ada Lovelace' }, { value: 'Grace Hopper', label: 'Grace Hopper' },
    { value: 'Alan Turing', label: 'Alan Turing' }, { value: 'Mary Jackson', label: 'Mary Jackson' },
  ]

  export function createDangerZone(opts: DangerZoneOptions = {}) {
    // Every flow waits on its callback; a rejected one leaves the project as it was.
    const project = opts.project ?? 'atlas-web'
    const people = opts.people ?? SAMPLE_PEOPLE

    let owner = $state(opts.owner ?? 'Ada Lovelace')
    let newOwner = $state<string | number | null>(null)
    let understood = $state(false)
    let transferring = $state(false)
    let archived = $state(opts.archived ?? false)
    let deleteOpen = $state(false)
    let typed = $state('')
    let deleting = $state(false)
    let deleted = $state(false)

    const candidates = $derived(people.filter((p) => p.value !== owner))
    const canTransfer = $derived(newOwner != null && understood)
    const canDelete = $derived(typed === project)
    const status = $derived<DangerZoneStatus>(deleted ? 'Deleted' : archived ? 'Archived' : 'Active')

    async function transfer() {
      if (!canTransfer || transferring) return
      const to = String(newOwner)
      transferring = true
      try {
        await opts.onTransfer?.(to)
        owner = to; newOwner = null; understood = false
      } catch {
        // The current owner stays.
      } finally {
        transferring = false
      }
    }

    function toggleArchive() {
      archived = !archived
      opts.onArchive?.(archived)
    }

    function openDelete() { typed = ''; deleteOpen = true }
    const restore = () => { deleted = false }

    async function confirmDelete() {
      if (!canDelete || deleting) return
      deleting = true
      try {
        await opts.onDelete?.(project)
        deleteOpen = false
        deleted = true
        opts.onDeleted?.(restore)
      } catch {
        // The dialog stays open; nothing was deleted.
      } finally {
        deleting = false
      }
    }

    return {
      project,
      get owner() { return owner },
      get candidates() { return candidates },
      get newOwner() { return newOwner },
      set newOwner(v: string | number | null) { newOwner = v },
      get understood() { return understood },
      set understood(v: boolean) { understood = v },
      get transferring() { return transferring },
      get canTransfer() { return canTransfer },
      get archived() { return archived },
      get deleteOpen() { return deleteOpen },
      set deleteOpen(v: boolean) { deleteOpen = v },
      get typed() { return typed },
      set typed(v: string) { typed = v },
      get canDelete() { return canDelete },
      get deleting() { return deleting },
      get deleted() { return deleted },
      get status() { return status },
      transfer, toggleArchive, openDelete, confirmDelete, restore,
      /** Spread on a plain <input> for the type-to-confirm field. */
      confirmInputProps: () => ({
        value: typed,
        placeholder: project,
        autocomplete: 'off',
        oninput: (e: Event) => { typed = (e.currentTarget as HTMLInputElement).value },
      }),
    }
  }
</script>

<script lang="ts">
  import {
    SvDropDownList, SvCheckBox, SvPopconfirm, SvModal, SvTextInput, SvButton, SvBadge,
    SvToaster, toast,
  } from '@svgrid/grid'

  const tone = { Active: 'success', Archived: 'warning', Deleted: 'danger' } as const

  const dz = createDangerZone({
    // Replace with your requests; a thrown error leaves things as they were.
    onTransfer: (to) =>
      toast.promise(new Promise<void>((res) => setTimeout(res, 900)), {
        loading: `Transferring ${dz.project} to ${to}...`,
        success: `${to} now owns ${dz.project}`,
        error: 'Transfer failed',
      }),
    onArchive: (archived) => toast(archived ? `${dz.project} archived. It is read-only now.` : `${dz.project} restored`),
    onDelete: () => new Promise<void>((res) => setTimeout(res, 900)),
    onDeleted: (undo) => toast.error(`${dz.project} deleted`, { action: { label: 'Undo', onClick: undo } }),
  })
</script>

<main class="sv-danger">
  <header>
    <h2>{dz.project} <SvBadge size="sm" variant={tone[dz.status]}>{dz.status}</SvBadge></h2>
    <p class="sv-danger-muted">Owned by {dz.owner}. These actions affect everyone with access to the project.</p>
  </header>

  {#if dz.deleted}
    <div class="sv-danger-gone">
      <p>{dz.project} and its 1,284 tasks were deleted.</p>
      <SvButton variant="secondary" onclick={dz.restore}>Undo delete</SvButton>
    </div>
  {:else}
    <section class="sv-danger-zone" aria-labelledby="dz-title">
      <h3 id="dz-title">Danger zone</h3>

      <div class="sv-danger-item">
        <div class="sv-danger-what">
          <strong>Transfer ownership</strong>
          <p>The new owner gets billing and admin rights. You stay on the project as an editor.</p>
        </div>
        <div class="sv-danger-how sv-danger-transfer">
          <SvDropDownList label="New owner" placeholder="Choose a member" options={dz.candidates} value={dz.newOwner} block
            onChange={(v) => (dz.newOwner = v)} />
          <SvCheckBox checked={dz.understood} onChange={(v) => (dz.understood = v)}>I understand I lose admin rights</SvCheckBox>
          <SvButton variant="secondary" loading={dz.transferring} disabled={!dz.canTransfer} onclick={dz.transfer}>
            Transfer
          </SvButton>
        </div>
      </div>

      <div class="sv-danger-item">
        <div class="sv-danger-what">
          <strong>{dz.archived ? 'Unarchive project' : 'Archive project'}</strong>
          <p>Archived projects are read-only and hidden from search. Nothing is deleted.</p>
        </div>
        <div class="sv-danger-how">
          <SvPopconfirm
            title={dz.archived ? `Restore ${dz.project}?` : `Archive ${dz.project}?`}
            description={dz.archived ? 'Members can edit it again.' : 'Members keep read access.'}
            confirmLabel={dz.archived ? 'Unarchive' : 'Archive'} confirmVariant={dz.archived ? 'primary' : 'danger'}
            onConfirm={dz.toggleArchive}
          >
            {#snippet anchor()}<SvButton variant="secondary">{dz.archived ? 'Unarchive' : 'Archive'}</SvButton>{/snippet}
          </SvPopconfirm>
        </div>
      </div>

      <div class="sv-danger-item">
        <div class="sv-danger-what">
          <strong>Delete project</strong>
          <p>Removes the project, its tasks, files and history for good.</p>
        </div>
        <div class="sv-danger-how"><SvButton variant="danger" onclick={dz.openDelete}>Delete project</SvButton></div>
      </div>
    </section>
  {/if}
</main>

<SvModal bind:open={dz.deleteOpen} title="Delete {dz.project}" width={440}>
  <p class="sv-danger-warn">This deletes 1,284 tasks and 3 dashboards. It cannot be undone after 30 days.</p>
  <SvTextInput label="Type {dz.project} to confirm" placeholder={dz.project} bind:value={dz.typed} block autocomplete="off" />
  {#snippet footer()}
    <SvButton variant="ghost" onclick={() => (dz.deleteOpen = false)} disabled={dz.deleting}>Cancel</SvButton>
    <SvButton variant="danger" disabled={!dz.canDelete} loading={dz.deleting} onclick={dz.confirmDelete}>Delete project</SvButton>
  {/snippet}
</SvModal>

<SvToaster position="bottom-right" />

<style>
  .sv-danger {
    flex: none; width: 100%;
    display: flex; flex-direction: column; gap: 20px;
    min-height: 520px; max-width: 820px; margin: 0 auto; padding: 32px 24px; box-sizing: border-box;
    background: var(--sg-bg, #fff); color: var(--sg-fg, #0f172a);
  }
  h2 { display: flex; align-items: center; gap: 10px; font-weight: 700; margin: 0 0 4px; font-size: 22px; letter-spacing: -.01em; }
  .sv-danger-muted { margin: 0; font-size: 13px; color: var(--sg-muted, #64748b); }
  .sv-danger-zone {
    border: 1px solid var(--sg-danger, #dc2626); border-radius: var(--sg-radius-lg, 12px);
    background: color-mix(in srgb, var(--sg-danger, #dc2626) 4%, var(--sg-bg, #fff));
  }
  h3 {
    font-weight: 600;
    margin: 0; padding: 12px 20px; font-size: 14px; color: var(--sg-danger, #dc2626);
    border-bottom: 1px solid color-mix(in srgb, var(--sg-danger, #dc2626) 35%, transparent);
  }
  .sv-danger-item {
    display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 300px); gap: 24px; align-items: center;
    padding: 18px 20px; border-bottom: 1px solid color-mix(in srgb, var(--sg-danger, #dc2626) 20%, transparent);
  }
  .sv-danger-item:last-child { border-bottom: 0; }
  .sv-danger-what strong { font-size: 14px; }
  .sv-danger-what p { margin: 4px 0 0; font-size: 13px; line-height: 1.5; color: var(--sg-muted, #64748b); }
  .sv-danger-how { display: flex; justify-content: flex-end; }
  .sv-danger-transfer { flex-direction: column; align-items: stretch; gap: 10px; }
  .sv-danger-transfer :global(.sv-btn) { align-self: flex-end; }
  .sv-danger-gone {
    display: flex; flex-direction: column; align-items: flex-start; gap: 12px; padding: 24px;
    border: 1px dashed var(--sg-border, #e2e8f0); border-radius: var(--sg-radius-lg, 12px);
  }
  .sv-danger-gone p { margin: 0; font-size: 14px; }
  .sv-danger-warn { margin: 0 0 14px; font-size: 13.5px; line-height: 1.5; }

  @media (max-width: 640px) {
    .sv-danger { padding: 20px 12px; }
    .sv-danger-item { grid-template-columns: minmax(0, 1fr); gap: 12px; padding: 16px; }
    .sv-danger-how { justify-content: flex-start; }
    h3 { padding: 12px 16px; }
  }
</style>
