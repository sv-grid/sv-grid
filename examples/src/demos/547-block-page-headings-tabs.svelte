<script lang="ts" module>
  /**
   * Page heading with tabs block - a project page header: h1, owner line and
   * "Invite" + "Run sync" SvButtons, with an SvTabs strip underneath
   * (Overview, Activity, Settings) whose labels carry live counts. The panel
   * below switches with the tab: an overview summary, an activity list that
   * "Run sync" appends to, and a settings form with SvTextInput and
   * SvSwitchButton. SvToaster confirms each action. Pure UI-kit, --sg-* themed.
   *
   * Headless: createProjectHeading() below owns the active tab, the tab
   * labels with their counts, the activity list and the sync flow with no
   * markup. The component under it is one styled render of that core; import
   * createProjectHeading from this file (or `npx @svgrid/ui add
   * page-headings-tabs --headless` for the core alone) to draw your own.
   */
  import type { TabItem } from '@svgrid/grid'

  export type ProjectActivity = { who: string; what: string; when: string }
  export type ProjectHeadingOptions = {
    name?: string
    alerts?: boolean
    activity?: ProjectActivity[]
    /** Open settings issues, shown as the Settings tab count. */
    issues?: number
    tab?: string
    /** Run the sync; resolve with the activity entry to add. Throw (or reject) to add nothing. */
    onSync?: () => Promise<ProjectActivity | void> | ProjectActivity | void
  }

  const SAMPLE_ACTIVITY: ProjectActivity[] = [
    { who: 'Priya N.', what: 'added the orders_daily model', when: '2h ago' },
    { who: 'Sync', what: 'loaded 48,210 rows from Postgres', when: '5h ago' },
    { who: 'Tom B.', what: 'changed the schedule to hourly', when: 'Yesterday' },
  ]

  export function createProjectHeading(opts: ProjectHeadingOptions = {}) {
    // Tab labels carry live counts; a finished sync opens the Activity tab.
    const issues = opts.issues ?? 2
    let tab = $state(opts.tab ?? 'overview')
    let syncing = $state(false)
    let name = $state(opts.name ?? 'Northwind warehouse')
    let alerts = $state(opts.alerts ?? true)
    let activity = $state<ProjectActivity[]>((opts.activity ?? SAMPLE_ACTIVITY).map((a) => ({ ...a })))

    const tabs = $derived<TabItem[]>([
      { id: 'overview', label: 'Overview' },
      { id: 'activity', label: `Activity (${activity.length})` },
      { id: 'settings', label: `Settings (${issues})` },
    ])
    const lastSync = $derived(activity.find((a) => a.who === 'Sync')?.when.toLowerCase())
    const nameError = $derived(name.trim() ? undefined : 'Give the project a name')

    async function runSync() {
      if (syncing) return
      syncing = true
      try {
        const entry = await opts.onSync?.()
        if (entry) activity = [entry, ...activity]
        tab = 'activity'
      } catch {
        // Nothing was synced.
      } finally {
        syncing = false
      }
    }

    return {
      issues,
      get tab() { return tab },
      set tab(v: string) { tab = v },
      get tabs() { return tabs },
      get name() { return name },
      set name(v: string) { name = v },
      get nameError() { return nameError },
      get alerts() { return alerts },
      set alerts(v: boolean) { alerts = v },
      get activity() { return activity },
      get lastSync() { return lastSync },
      get syncing() { return syncing },
      runSync,
      /** Spread on a plain <button role="tab"> when you draw your own tab strip. */
      tabProps: (id: string) => ({
        type: 'button' as const,
        role: 'tab' as const,
        'aria-selected': tab === id,
        tabindex: tab === id ? 0 : -1,
        onclick: () => { tab = id },
      }),
    }
  }
</script>

<script lang="ts">
  import { SvTabs, SvButton, SvTextInput, SvSwitchButton, SvToaster, toast } from '@svgrid/grid'

  const project = createProjectHeading({
    // Replace with your sync request; resolve with the entry to show.
    onSync: () =>
      new Promise<void>((res) => setTimeout(res, 900)).then(() => {
        toast.success('Sync finished')
        return { who: 'Sync', what: 'loaded 1,904 new rows from Postgres', when: 'Just now' }
      }),
  })
</script>

<div class="sv-ph-tabs">
  <header class="sv-ph-tabs-head">
    <div class="sv-ph-tabs-titles">
      <h1>{project.name || 'Untitled project'}</h1>
      <p class="sv-ph-tabs-sub">Owned by Data Platform. Last sync {project.lastSync}.</p>
    </div>
    <div class="sv-ph-tabs-actions">
      <SvButton variant="secondary" onclick={() => toast('Invite link copied')}>Invite</SvButton>
      <SvButton variant="primary" loading={project.syncing} onclick={project.runSync}>Run sync</SvButton>
    </div>
  </header>

  <SvTabs tabs={project.tabs} bind:value={project.tab} ariaLabel="Project sections">
    {#snippet panel(id)}
      {#if id === 'overview'}
        <div class="sv-ph-tabs-overview">
          <div class="sv-ph-tabs-fact"><span>Tables</span><strong>36</strong></div>
          <div class="sv-ph-tabs-fact"><span>Rows</span><strong>12.4M</strong></div>
          <div class="sv-ph-tabs-fact"><span>Schedule</span><strong>Hourly</strong></div>
        </div>
        <div class="sv-ph-tabs-skel" aria-hidden="true"><span></span><span></span><span class="sv-ph-tabs-short"></span></div>
      {:else if id === 'activity'}
        <ul class="sv-ph-tabs-feed">
          {#each project.activity as a, i (i)}
            <li><strong>{a.who}</strong> {a.what}<span class="sv-ph-tabs-when">{a.when}</span></li>
          {/each}
        </ul>
      {:else}
        <div class="sv-ph-tabs-settings">
          <SvTextInput label="Project name" bind:value={project.name} block error={project.nameError} />
          <SvSwitchButton checked={project.alerts} onChange={(v) => (project.alerts = v)} label="Email me when a sync fails" />
          <p class="sv-ph-tabs-warn">{project.issues} tables have no primary key. Incremental sync skips them.</p>
        </div>
      {/if}
    {/snippet}
  </SvTabs>
</div>

<SvToaster position="bottom-right" />

<style>
  .sv-ph-tabs {
    min-height: 380px; padding: 28px 32px 24px; box-sizing: border-box;
    background: var(--sg-bg, #fff); color: var(--sg-fg, #0f172a);
    border: 1px solid var(--sg-border, #e2e8f0); border-radius: var(--sg-radius-lg, 14px);
  }
  .sv-ph-tabs-head { display: flex; align-items: flex-end; justify-content: space-between; gap: 16px 24px; flex-wrap: wrap; margin-bottom: 16px; }
  .sv-ph-tabs-titles { min-width: 0; }
  h1 { margin: 0; font-weight: 700; font-size: 26px; line-height: 1.2; letter-spacing: -.02em; overflow-wrap: anywhere; }
  .sv-ph-tabs-sub { margin: 6px 0 0; font-size: 14px; color: var(--sg-muted, #64748b); }
  .sv-ph-tabs-actions { display: flex; gap: 8px; }

  .sv-ph-tabs-overview { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; margin: 4px 0 18px; }
  .sv-ph-tabs-fact {
    display: flex; flex-direction: column; gap: 4px; padding: 12px 14px;
    border: 1px solid var(--sg-border, #e2e8f0); border-radius: var(--sg-radius, 8px); background: var(--sg-bg-subtle, #f8fafc);
  }
  .sv-ph-tabs-fact span { font-size: 12.5px; color: var(--sg-muted, #64748b); }
  .sv-ph-tabs-fact strong { font-size: 20px; font-variant-numeric: tabular-nums; }
  .sv-ph-tabs-skel { display: flex; flex-direction: column; gap: 8px; max-width: 560px; }
  .sv-ph-tabs-skel span { height: 10px; border-radius: 5px; background: color-mix(in srgb, var(--sg-fg, #0f172a) 9%, transparent); }
  .sv-ph-tabs-skel .sv-ph-tabs-short { width: 50%; }

  .sv-ph-tabs-feed { list-style: none; margin: 4px 0 0; padding: 0; font-size: 14px; }
  .sv-ph-tabs-feed li { display: flex; gap: 6px; flex-wrap: wrap; padding: 10px 0; border-bottom: 1px solid var(--sg-border, #e2e8f0); }
  .sv-ph-tabs-when { margin-left: auto; color: var(--sg-muted, #64748b); font-size: 12.5px; }

  .sv-ph-tabs-settings { display: flex; flex-direction: column; gap: 14px; max-width: 420px; margin-top: 4px; }
  .sv-ph-tabs-warn {
    margin: 0; padding: 10px 12px; font-size: 13px; border-radius: var(--sg-radius, 8px);
    background: color-mix(in srgb, var(--sg-warning, #d97706) 12%, transparent);
    border: 1px solid color-mix(in srgb, var(--sg-warning, #d97706) 35%, transparent);
  }

  @media (max-width: 640px) {
    .sv-ph-tabs { padding: 20px 16px; }
    h1 { font-size: 22px; }
    .sv-ph-tabs-actions { width: 100%; flex-wrap: wrap; }
    .sv-ph-tabs-actions > :global(*) { flex: 1; }
    .sv-ph-tabs-overview { gap: 8px; }
    .sv-ph-tabs-fact { padding: 10px; }
    .sv-ph-tabs-fact strong { font-size: 17px; }
    .sv-ph-tabs-when { margin-left: 0; width: 100%; }
  }
</style>
