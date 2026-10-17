<script lang="ts" module>
  /**
   * Empty state block - the blank Dashboards page of an analytics workspace.
   * SvEmptyState carries the icon, title, one sentence and the primary action;
   * the action opens an inline SvTextInput form that creates the first
   * dashboard, the list then shows it, and deleting the last one brings the
   * empty state back (with an Undo toast). SvButton, SvBadge, SvToaster.
   * Pure UI-kit, --sg-* themed.
   *
   * Headless: createDashboardList() below owns the list, the create form with
   * its validation and delete with undo, with no markup. The component under
   * it is one styled render of that core; import createDashboardList from
   * this file (or `npx @svgrid/ui add empty-states-simple --headless` for the
   * core alone) to draw your own.
   */
  export type Dashboard = { id: number; name: string; created: string }
  export type DashboardListOptions = {
    /** Dashboards already saved. Empty by default, so the empty state shows. */
    initial?: Dashboard[]
    /** Save the new dashboard; throw (or reject) to keep the form open. */
    onCreate?: (name: string) => Promise<void> | void
    /** Called after a delete with an undo that puts it back in place. */
    onRemove?: (dashboard: Dashboard, undo: () => void) => void
  }

  export function createDashboardList(opts: DashboardListOptions = {}) {
    const initial = opts.initial ?? []
    let dashboards = $state<Dashboard[]>([...initial])
    let creating = $state(false)
    let name = $state('')
    let error = $state<string | undefined>()
    let saving = $state(false)
    let nextId = Math.max(0, ...initial.map((d) => d.id)) + 1

    function openForm() {
      creating = true
      name = ''
      error = undefined
    }

    async function create(ev?: Event) {
      ev?.preventDefault()
      const value = name.trim()
      if (!value) { error = 'Give the dashboard a name'; return }
      if (dashboards.some((d) => d.name.toLowerCase() === value.toLowerCase())) { error = 'A dashboard with this name exists'; return }
      error = undefined
      saving = true
      try {
        await opts.onCreate?.(value)
        dashboards = [...dashboards, { id: nextId++, name: value, created: 'Created just now' }]
        creating = false
      } finally {
        saving = false
      }
    }

    function remove(d: Dashboard) {
      const index = dashboards.findIndex((x) => x.id === d.id)
      dashboards = dashboards.filter((x) => x.id !== d.id)
      const undo = () => { dashboards = [...dashboards.slice(0, index), d, ...dashboards.slice(index)] }
      opts.onRemove?.(d, undo)
    }

    return {
      get dashboards() { return dashboards },
      /** True when there is nothing to list and the form is closed. */
      get isEmpty() { return dashboards.length === 0 && !creating },
      get creating() { return creating },
      get name() { return name },
      set name(v: string) { name = v },
      get error() { return error },
      get saving() { return saving },
      openForm,
      closeForm: () => { creating = false },
      create,
      remove,
      /** Spread on your create <form>. */
      formProps: () => ({ onsubmit: create }),
    }
  }
</script>

<script lang="ts">
  import { SvEmptyState, SvTextInput, SvButton, SvBadge, SvToaster, toast } from '@svgrid/grid'

  const boards = createDashboardList({
    // Replace the timer with your create request.
    onCreate: (value) =>
      new Promise<void>((res) => setTimeout(res, 700)).then(() => {
        toast.success(`"${value}" created`)
      }),
    onRemove: (d, undo) => toast(`"${d.name}" deleted`, { action: { label: 'Undo', onClick: undo } }),
  })
</script>

<section class="sv-boards" aria-labelledby="sv-boards-title">
  <header class="sv-boards-bar">
    <div>
      <h2 id="sv-boards-title">Dashboards</h2>
      <p class="sv-boards-muted">Acme Analytics workspace</p>
    </div>
    {#if boards.dashboards.length && !boards.creating}
      <SvButton size="sm" onclick={boards.openForm}>New dashboard</SvButton>
    {/if}
  </header>

  <div class="sv-boards-panel" class:sv-boards-has-items={boards.dashboards.length > 0}>
    {#if boards.creating}
      <form class="sv-boards-create" {...boards.formProps()}>
        <SvTextInput label="Dashboard name" placeholder="e.g. Weekly revenue" bind:value={boards.name} error={boards.error} invalid={!!boards.error} required autofocus block />
        <div class="sv-boards-create-actions">
          <SvButton variant="ghost" onclick={boards.closeForm}>Cancel</SvButton>
          <SvButton type="submit" loading={boards.saving}>Create dashboard</SvButton>
        </div>
      </form>
    {/if}

    {#if boards.isEmpty}
      <SvEmptyState title="No dashboards yet" description="A dashboard collects the charts and tables your team checks every week.">
        {#snippet icon()}
          <svg viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <rect x="3" y="3" width="8" height="10" rx="1.5" /><rect x="13" y="3" width="8" height="6" rx="1.5" />
            <rect x="13" y="11" width="8" height="10" rx="1.5" /><rect x="3" y="15" width="8" height="6" rx="1.5" />
          </svg>
        {/snippet}
        <SvButton onclick={boards.openForm}>New dashboard</SvButton>
      </SvEmptyState>
    {:else if boards.dashboards.length}
      <ul class="sv-boards-list">
        {#each boards.dashboards as d (d.id)}
          <li>
            <span class="sv-boards-tile" aria-hidden="true">{d.name.slice(0, 1).toUpperCase()}</span>
            <div class="sv-boards-meta">
              <strong>{d.name}</strong>
              <span class="sv-boards-muted">{d.created}</span>
            </div>
            <SvBadge size="sm">Private</SvBadge>
            <SvButton variant="ghost" size="sm" ariaLabel={`Delete ${d.name}`} onclick={() => boards.remove(d)}>Delete</SvButton>
          </li>
        {/each}
      </ul>
    {/if}
  </div>
</section>

<SvToaster position="bottom-right" />

<style>
  .sv-boards {
    min-height: 460px; padding: 28px; box-sizing: border-box;
    display: flex; flex-direction: column; gap: 18px;
    background: var(--sg-bg, #fff); color: var(--sg-fg, #0f172a);
    font-family: var(--sg-font, inherit);
  }
  .sv-boards-bar { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
  .sv-boards-bar h2 { margin: 0; font-size: 20px; font-weight: 650; letter-spacing: -.01em; }
  .sv-boards-muted { margin: 2px 0 0; font-size: 13px; color: var(--sg-muted, #64748b); }
  .sv-boards-panel {
    flex: 1; display: flex; flex-direction: column; justify-content: center;
    border: 1px solid var(--sg-border, #e2e8f0); border-radius: var(--sg-radius-lg, 12px);
    background: var(--sg-bg-subtle, #f8fafc); padding: 8px;
  }
  .sv-boards-create {
    display: flex; flex-direction: column; gap: 12px; width: 100%; max-width: 420px; margin: 24px auto;
    padding: 18px; box-sizing: border-box; border-radius: var(--sg-radius, 8px);
    background: var(--sg-bg, #fff); border: 1px solid var(--sg-border, #e2e8f0);
  }
  .sv-boards-panel.sv-boards-has-items { flex: none; justify-content: flex-start; background: var(--sg-bg, #fff); padding: 0 4px; }
  .sv-boards-create-actions { display: flex; justify-content: flex-end; gap: 8px; }
  .sv-boards-list { list-style: none; margin: 0; padding: 0; align-self: stretch; flex: 1; }
  .sv-boards-list li {
    display: flex; align-items: center; gap: 12px; padding: 12px;
    border-bottom: 1px solid var(--sg-border, #e2e8f0);
  }
  .sv-boards-list li:last-child { border-bottom: 0; }
  .sv-boards-tile {
    flex: none; display: grid; place-items: center; width: 36px; height: 36px; border-radius: 9px;
    font-weight: 700; color: var(--sg-fg, #0f172a);
    background: color-mix(in srgb, var(--sg-muted, #64748b) 18%, transparent);
  }
  .sv-boards-meta { flex: 1; min-width: 0; display: flex; flex-direction: column; }
  .sv-boards-meta strong { font-size: 14px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .sv-boards-meta .sv-boards-muted { margin: 0; font-size: 12.5px; }

  @media (max-width: 560px) {
    .sv-boards { padding: 18px 16px; }
    .sv-boards-bar { flex-wrap: wrap; }
    .sv-boards-list li :global(.sv-badge) { display: none; }
  }
</style>
