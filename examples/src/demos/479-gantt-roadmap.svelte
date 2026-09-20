<script lang="ts">
  /**
   * 479. Product roadmap - a year in quarters (Enterprise Gantt)
   * -----------------------------------------------------------
   * The Gantt as a roadmap rather than a schedule: three teams, their
   * initiatives across four quarters, and the releases that cut across them
   * as milestones.
   *
   *   - **Custom bar bodies.** The `task` snippet draws each initiative with
   *     the owner's initials and a status chip inside the bar, in place of
   *     the plain label. Colour is by status, not by team, because on a
   *     roadmap the question is "what is at risk", not "who owns it".
   *   - **A quarter axis.** `zoom: 'quarter'` with a `zoomLevels` ladder of
   *     month / quarter / year, so the whole year fits and a scroll of the
   *     wheel drills into a month.
   *   - **A status filter.** The chips in the header hand the grid a
   *     filtered array, and the Gantt draws what it is handed - the team
   *     rows stay put so an empty team still reads as a team.
   *   - **A custom tooltip.** The `tooltip` snippet adds effort and a
   *     one-line summary the bar has no room for.
   */
  import { SvGrid, SvAvatar, type ColumnDef, type GanttConfig, type GanttDependency } from '@svgrid/grid'
  import { enableGanttView, setLicenseKey } from '@svgrid/enterprise'

  setLicenseKey('SVENTERPRISE-DEV-LOCAL')
  enableGanttView()

  type Status = 'On track' | 'At risk' | 'Late' | 'Done'
  type Item = {
    id: string
    name: string
    team: string
    owner: string
    status: Status
    summary: string
    /** Effort in engineer-weeks. */
    effort: number
    start: string
    end?: string
    progress: number
    parentId: string | null
    milestone?: boolean
    color: string
  }

  const STATUS: Record<Status, string> = {
    'On track': '#2563eb',
    'At risk': '#d97706',
    Late: '#dc2626',
    Done: '#16a34a',
  }
  const statuses = Object.keys(STATUS) as Status[]
  const TEAM = { platform: 'Platform', growth: 'Growth', mobile: 'Mobile' } as const
  const RELEASE = '#7c3aed'

  // The roadmap year runs from the first of this month's quarter, so the
  // today line always sits inside the first quarter shown.
  const pad = (n: number) => String(n).padStart(2, '0')
  const iso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
  const now = new Date()
  const q0 = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1)
  /** A date `months` months and `days` days from the quarter start. */
  const at = (months: number, days = 0) => iso(new Date(q0.getFullYear(), q0.getMonth() + months, 1 + days))

  type Seed = {
    id: string; name: string; team: keyof typeof TEAM; owner: string; status: Status
    summary: string; effort: number; from: [number, number]; to: [number, number]; progress: number
  }
  const item = (s: Seed): Item => ({
    id: s.id,
    name: s.name,
    team: TEAM[s.team],
    owner: s.owner,
    status: s.status,
    summary: s.summary,
    effort: s.effort,
    start: at(...s.from),
    end: at(...s.to),
    progress: s.progress,
    parentId: s.team,
    color: STATUS[s.status],
  })
  const team = (id: keyof typeof TEAM, owner: string): Item => ({
    id, name: TEAM[id], team: TEAM[id], owner, status: 'On track', summary: '', effort: 0,
    start: at(0), progress: 0, parentId: null, color: '#64748b',
  })
  const release = (id: string, name: string, months: number, days: number, summary: string): Item => ({
    id, name, team: 'Releases', owner: 'Release', status: 'On track', summary, effort: 0,
    start: at(months, days), progress: 0, parentId: null, milestone: true, color: RELEASE,
  })

  const all: Item[] = [
    team('platform', 'Sven'),
    item({ id: 'p1', name: 'Multi-region storage', team: 'platform', owner: 'Sven', status: 'Done', summary: 'Tenant data pinned to a home region, with failover.', effort: 14, from: [0, 0], to: [2, 14], progress: 100 }),
    item({ id: 'p2', name: 'Event streaming backbone', team: 'platform', owner: 'Kai', status: 'At risk', summary: 'Replace the nightly batch with a change feed every service can subscribe to.', effort: 20, from: [1, 14], to: [5, 0], progress: 45 }),
    item({ id: 'p3', name: 'Zero-downtime migrations', team: 'platform', owner: 'Lena', status: 'On track', summary: 'Expand-contract schema changes, run by the deploy pipeline.', effort: 8, from: [5, 1], to: [7, 0], progress: 0 }),
    item({ id: 'p4', name: 'Audit log v2', team: 'platform', owner: 'Sven', status: 'On track', summary: 'Immutable, exportable, with retention per plan.', effort: 10, from: [7, 0], to: [9, 14], progress: 0 }),
    item({ id: 'p5', name: 'Rate limiting per tenant', team: 'platform', owner: 'Kai', status: 'On track', summary: 'Fair-share limits at the edge, with a self-serve view of your own quota.', effort: 6, from: [9, 15], to: [11, 0], progress: 0 }),

    team('growth', 'Priya'),
    item({ id: 'g1', name: 'Self-serve onboarding', team: 'growth', owner: 'Priya', status: 'Done', summary: 'Sign up to a working workspace in under three minutes.', effort: 12, from: [0, 0], to: [1, 20], progress: 100 }),
    item({ id: 'g2', name: 'Usage-based pricing', team: 'growth', owner: 'Marco', status: 'Late', summary: 'Metered plans with a live usage meter in the app.', effort: 16, from: [1, 0], to: [4, 14], progress: 60 }),
    item({ id: 'g3', name: 'Referral programme', team: 'growth', owner: 'Priya', status: 'On track', summary: 'Invite a team, both sides get a month free.', effort: 6, from: [4, 15], to: [6, 0], progress: 0 }),
    item({ id: 'g4', name: 'In-app trials of paid tiers', team: 'growth', owner: 'Mia', status: 'At risk', summary: 'Try any paid feature for 14 days without talking to sales.', effort: 9, from: [5, 14], to: [8, 14], progress: 5 }),
    item({ id: 'g5', name: 'Annual plan push', team: 'growth', owner: 'Marco', status: 'On track', summary: 'Discounted annual billing, surfaced at renewal.', effort: 4, from: [9, 14], to: [11, 14], progress: 0 }),

    team('mobile', 'Dana'),
    item({ id: 'm1', name: 'Offline mode', team: 'mobile', owner: 'Dana', status: 'Done', summary: 'Read everything, queue writes, sync on reconnect.', effort: 18, from: [0, 0], to: [2, 28], progress: 100 }),
    item({ id: 'm2', name: 'Push notifications', team: 'mobile', owner: 'Omar', status: 'On track', summary: 'Mentions, assignments and due dates, with per-category opt-outs.', effort: 7, from: [3, 0], to: [4, 20], progress: 30 }),
    item({ id: 'm3', name: 'Tablet layouts', team: 'mobile', owner: 'Dana', status: 'At risk', summary: 'Two-pane navigation on anything wider than 700 px.', effort: 11, from: [4, 14], to: [7, 14], progress: 0 }),
    item({ id: 'm4', name: 'Widgets and shortcuts', team: 'mobile', owner: 'Omar', status: 'On track', summary: 'Home-screen widgets and Siri / Assistant shortcuts.', effort: 5, from: [8, 0], to: [9, 14], progress: 0 }),
    item({ id: 'm5', name: 'Accessibility audit fixes', team: 'mobile', owner: 'Dana', status: 'On track', summary: 'Close every WCAG AA finding from the spring audit.', effort: 6, from: [10, 0], to: [11, 14], progress: 0 }),

    release('r1', 'v4.0', 3, 1, 'Storage, onboarding, offline.'),
    release('r2', 'v4.5', 6, 14, 'Streaming, pricing, notifications.'),
    release('r3', 'v5.0', 11, 20, 'Everything above the line ships in v5.'),
  ]

  const dependencies: GanttDependency[] = [
    { id: 'd1', from: 'p1', to: 'r1' },
    { id: 'd2', from: 'g1', to: 'r1' },
    { id: 'd3', from: 'm1', to: 'r1' },
    { id: 'd4', from: 'p2', to: 'p3' },
    { id: 'd5', from: 'p2', to: 'r2' },
    { id: 'd6', from: 'g2', to: 'g3' },
    { id: 'd7', from: 'g2', to: 'r2' },
    { id: 'd8', from: 'm2', to: 'r2' },
    { id: 'd9', from: 'p4', to: 'p5' },
    { id: 'd10', from: 'p5', to: 'r3' },
    { id: 'd11', from: 'g5', to: 'r3' },
    { id: 'd12', from: 'm5', to: 'r3' },
  ]

  // --- the status filter -----------------------------------------------------
  let shown = $state<Set<Status>>(new Set(statuses))
  function toggle(s: Status) {
    const next = new Set(shown)
    if (next.has(s)) next.delete(s)
    else next.add(s)
    // Emptying the filter would draw three bare team rows; treat it as "all".
    shown = next.size ? next : new Set(statuses)
  }
  const rows = $derived(all.filter((r) => r.parentId == null || shown.has(r.status)))
  const initiatives = all.filter((r) => r.parentId != null)
  const count = (s: Status) => initiatives.filter((r) => r.status === s).length
  const weeksLeft = $derived(
    initiatives.filter((r) => r.status !== 'Done').reduce((sum, r) => sum + Math.round(r.effort * (1 - r.progress / 100)), 0),
  )

  const columns: ColumnDef<any, Item>[] = [
    { field: 'name', header: 'Initiative', width: 220 },
    { field: 'owner', header: 'Owner', width: 90 },
    { field: 'status', header: 'Status', width: 90 },
    { field: 'effort', header: 'Weeks', width: 70 },
  ]

  const fmt = (d: string | undefined) => (d ? new Date(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : '')

  const cfg: GanttConfig<any, Item> = {
    startField: 'start',
    endField: 'end',
    titleField: 'name',
    progressField: 'progress',
    parentField: 'parentId',
    milestoneField: 'milestone',
    colorField: 'color',
    dependencies,
    tableColumns: ['name', 'owner', 'status', '__progress'],
    tableWidth: 440,
    rowHeight: 38,
    zoom: 'quarter',
    zoomLevels: ['month', 'quarter', 'year'],
    weekStartsOn: 1,
    rangePaddingDays: 10,
    task: bar,
    tooltip: tip,
  }

  // The same rows as a plain table: the Gantt is one view of the grid.
  let view = $state<'gantt' | 'table'>('gantt')
</script>

{#snippet bar(row: Item)}
  <span class="rm-bar">
    <SvAvatar name={row.owner} size={18} />
    <span class="rm-bar-name">{row.name}</span>
    <span class="rm-bar-chip">{row.status}</span>
  </span>
{/snippet}

{#snippet tip(row: Item)}
  <div class="rm-tip">
    <div class="rm-tip-head">
      <span class="rm-dot" style:background={row.color}></span>
      <strong>{row.name}</strong>
    </div>
    {#if row.milestone}
      <div class="rm-tip-meta">Release on {fmt(row.start)}</div>
    {:else if row.parentId}
      <div class="rm-tip-meta">{row.owner} - {row.status} - {fmt(row.start)} to {fmt(row.end)}</div>
      <div class="rm-tip-meta">{row.effort} engineer-weeks, {row.progress}% done</div>
    {:else}
      <div class="rm-tip-meta">Team lead: {row.owner}</div>
    {/if}
    {#if row.summary}<p class="rm-tip-sum">{row.summary}</p>{/if}
  </div>
{/snippet}

<section class="rm">
  <header class="rm-head">
    <div class="rm-title">
      <strong>Roadmap, Q{Math.floor(q0.getMonth() / 3) + 1} {q0.getFullYear()} onward</strong>
      <span class="rm-sub">
        {initiatives.length} initiatives across three teams, {weeksLeft} engineer-weeks still to go. Click a status to filter; Ctrl+wheel zooms.
      </span>
    </div>
    <div class="rm-filters" role="group" aria-label="Filter by status">
      {#each statuses as s (s)}
        <button
          class="rm-chip"
          class:rm-chip-off={!shown.has(s)}
          style:--chip={STATUS[s]}
          aria-pressed={shown.has(s)}
          onclick={() => toggle(s)}
        >
          <span class="rm-dot" style:background={STATUS[s]}></span>
          {s}
          <b>{count(s)}</b>
        </button>
      {/each}
      <span class="rm-chip rm-chip-static">
        <span class="rm-diamond"></span>
        Release
      </span>
    </div>
    <div class="rm-seg" role="tablist" aria-label="View">
      <button class="rm-seg-btn" role="tab" aria-selected={view === 'gantt'} class:rm-on={view === 'gantt'} onclick={() => (view = 'gantt')}>Gantt</button>
      <button class="rm-seg-btn" role="tab" aria-selected={view === 'table'} class:rm-on={view === 'table'} onclick={() => (view = 'table')}>Table</button>
    </div>
  </header>

  <div class="rm-body">
    {#if view === 'gantt'}
      <SvGrid
        columnResize
        data={rows}
        columns={columns}
        getRowId={(r) => r.id}
        containerHeight="100%"
        gantt={cfg}
      />
    {:else}
      <SvGrid columnResize data={rows} columns={columns} getRowId={(r) => r.id} containerHeight="100%" sortable fitColumns />
    {/if}
  </div>
</section>

<style>
  .rm {
    display: flex;
    flex: 1 1 auto;
    flex-direction: column;
    min-height: 0;
    border: 1px solid var(--sg-border, #e5e7eb);
    border-radius: 12px;
    overflow: hidden;
    background: var(--sg-bg, #fff);
  }
  .rm-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    padding: 10px 14px;
    border-bottom: 1px solid var(--sg-border, #e5e7eb);
  }
  .rm-title { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
  .rm-seg { display: inline-flex; flex: none; border: 1px solid var(--sg-border, #e5e7eb); border-radius: 8px; overflow: hidden; }
  .rm-seg-btn { padding: 5px 12px; border: 0; background: transparent; color: inherit; font: inherit; font-size: 0.8rem; cursor: pointer; }
  .rm-seg-btn:hover { background: color-mix(in srgb, var(--sg-fg, #1f2937) 6%, transparent); }
  .rm-on { background: var(--sg-accent, #4f46e5); color: #fff; }
  .rm-on:hover { background: var(--sg-accent, #4f46e5); }

  .rm-sub { font-size: 0.78rem; color: var(--sg-muted, #6b7280); }
  .rm-filters { display: flex; flex: none; flex-wrap: wrap; gap: 6px; }
  .rm-chip {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 4px 10px;
    border: 1px solid var(--sg-border, #e5e7eb);
    border-radius: 999px;
    background: transparent;
    color: var(--sg-fg, #1f2937);
    font: inherit;
    font-size: 0.76rem;
    cursor: pointer;
    transition: opacity 0.15s;
  }
  .rm-chip b { font-weight: 600; color: var(--sg-muted, #6b7280); }
  .rm-chip:hover { border-color: var(--chip); }
  .rm-chip-off { opacity: 0.45; }
  .rm-chip-static { cursor: default; }
  .rm-dot { width: 8px; height: 8px; border-radius: 50%; flex: none; }
  .rm-diamond { width: 8px; height: 8px; background: #7c3aed; transform: rotate(45deg); border-radius: 1px; flex: none; }
  .rm-body { flex: 1 1 auto; min-height: 0; padding: 8px; }

  /* The bar body: the snippet fills the bar, so it clips its own overflow. */
  .rm-bar {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    width: 100%;
    min-width: 0;
    padding: 0 6px;
    color: #fff;
    font-size: 0.76rem;
  }
  .rm-bar-name { flex: 1 1 auto; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-weight: 600; }
  .rm-bar-chip {
    flex: none;
    padding: 1px 6px;
    border-radius: 999px;
    background: rgba(255, 255, 255, 0.22);
    font-size: 0.66rem;
    font-weight: 600;
    letter-spacing: 0.01em;
  }
  .rm-bar :global(.sv-avatar) { flex: none; }

  .rm-tip { display: flex; flex-direction: column; gap: 3px; }
  .rm-tip-head { display: flex; align-items: center; gap: 7px; }
  .rm-tip-meta { font-size: 0.74rem; opacity: 0.85; }
  .rm-tip-sum { margin: 4px 0 0; font-size: 0.76rem; line-height: 1.35; opacity: 0.9; }

  @media (max-width: 767px) {
    .rm { min-width: 860px; flex-shrink: 0; }
  }
</style>
