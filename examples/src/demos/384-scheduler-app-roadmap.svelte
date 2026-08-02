<script lang="ts">
  /**
   * 384. Portfolio roadmap - product portfolio planning (real app)
   * -------------------------------------------------------------
   * A working roadmap tool, not a feature demo:
   *  - a live sidebar: search, a squad roster (avatar + lead + active initiative
   *    count) you can show/hide to filter the roadmap, a "delivery on-track"
   *    gauge, and a status legend,
   *  - a KPI strip (initiatives / in progress / at risk / shipped),
   *  - the scheduler as a timeline grouped by squad - initiatives as multi-week
   *    bars, milestones as amber flags. Zoom Month / Year; drag a bar to
   *    reschedule or hand it to another squad; drop an idea from the backlog,
   *  - a progress-aware initiative card + a companion "all initiatives" table -
   *    the same rows as a grid.
   */
  import {
    SvGrid,
    SvAvatar,
    SvBadge,
    SvButton,
    SvStat,
    SvGauge,
    SvProgress,
    SvTextInput,
    SvCheckBox,
    type ColumnDef,
    type SchedulerResource,
    type SchedulerEventMoveEvent,
    type SchedulerEventResizeEvent,
    type SchedulerEventCommitEvent,
  } from '@svgrid/grid'
  import { enableSchedulerView, setLicenseKey } from '@svgrid/enterprise'

  setLicenseKey('SVENTERPRISE-DEV-LOCAL')
  enableSchedulerView()

  type Status = 'Planned' | 'In progress' | 'At risk' | 'Shipped'
  type Init = {
    id: number; title: string; squad: string; owner: string; status: Status
    effort: number; progress: number; start: string; end: string; allDay: boolean; color: string
  }
  type Idea = { id: string; title: string; durationMin?: number; color?: string }

  const MILESTONE = '#f59e0b'
  const STATUS: Record<Status, { color: string; variant: 'neutral' | 'info' | 'success' | 'warning' | 'danger' }> = {
    Planned: { color: '#6366f1', variant: 'info' },
    'In progress': { color: '#0891b2', variant: 'info' },
    'At risk': { color: '#dc2626', variant: 'danger' },
    Shipped: { color: '#16a34a', variant: 'success' },
  }

  type Squad = SchedulerResource & { lead: string; initials: string }
  const squads: Squad[] = [
    { id: 'core', title: 'Core Platform', color: '#4f46e5', lead: 'Priya Shah', initials: 'PS' },
    { id: 'growth', title: 'Growth', color: '#0891b2', lead: 'Dana Cole', initials: 'DC' },
    { id: 'mobile', title: 'Mobile', color: '#16a34a', lead: 'Sven Ohm', initials: 'SO' },
    { id: 'data', title: 'Data & AI', color: '#db2777', lead: 'Lena Ross', initials: 'LR' },
  ]

  const pad = (n: number) => String(n).padStart(2, '0')
  const isoDay = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
  const first = new Date()
  first.setDate(1)
  first.setHours(0, 0, 0, 0)
  const dm = (dayOffset: number) => { const d = new Date(first); d.setDate(first.getDate() + dayOffset); return isoDay(d) }

  const DAY = 24 * 60
  const mk = (i: Omit<Init, 'color'>): Init => ({ ...i, color: i.owner === '-' ? MILESTONE : STATUS[i.status].color })

  let seq = 100
  let rows = $state<Init[]>([
    // Core Platform
    mk({ id: 1, title: 'Realtime sync engine', squad: 'core', owner: 'Priya', status: 'In progress', effort: 21, progress: 60, start: dm(1), end: dm(18), allDay: true }),
    mk({ id: 2, title: 'Billing v2', squad: 'core', owner: 'Marco', status: 'Planned', effort: 34, progress: 5, start: dm(20), end: dm(45), allDay: true }),
    mk({ id: 3, title: 'API rate limiting', squad: 'core', owner: 'Priya', status: 'Shipped', effort: 8, progress: 100, start: dm(0), end: dm(9), allDay: true }),
    // Growth
    mk({ id: 4, title: 'Referral program', squad: 'growth', owner: 'Dana', status: 'At risk', effort: 13, progress: 35, start: dm(3), end: dm(24), allDay: true }),
    mk({ id: 5, title: 'Pricing page rework', squad: 'growth', owner: 'Dana', status: 'In progress', effort: 8, progress: 55, start: dm(10), end: dm(22), allDay: true }),
    mk({ id: 6, title: 'Lifecycle emails', squad: 'growth', owner: 'Omar', status: 'Planned', effort: 5, progress: 0, start: dm(24), end: dm(38), allDay: true }),
    // Mobile
    mk({ id: 7, title: 'Onboarding revamp', squad: 'mobile', owner: 'Sven', status: 'In progress', effort: 13, progress: 45, start: dm(6), end: dm(15), allDay: true }),
    mk({ id: 8, title: 'Offline mode', squad: 'mobile', owner: 'Sven', status: 'Planned', effort: 21, progress: 10, start: dm(18), end: dm(40), allDay: true }),
    mk({ id: 9, title: 'Push notifications', squad: 'mobile', owner: 'Mia', status: 'At risk', effort: 8, progress: 25, start: dm(12), end: dm(28), allDay: true }),
    // Data & AI
    mk({ id: 10, title: 'Model eval harness', squad: 'data', owner: 'Lena', status: 'Shipped', effort: 8, progress: 100, start: dm(2), end: dm(12), allDay: true }),
    mk({ id: 11, title: 'Semantic search', squad: 'data', owner: 'Lena', status: 'In progress', effort: 34, progress: 40, start: dm(14), end: dm(38), allDay: true }),
    mk({ id: 12, title: 'Warehouse migration', squad: 'data', owner: 'Kai', status: 'Planned', effort: 21, progress: 0, start: dm(26), end: dm(46), allDay: true }),
    // milestones (single-day amber flags)
    mk({ id: 13, title: '🚩 Public beta', squad: 'core', owner: '-', status: 'Planned', effort: 0, progress: 0, start: dm(24), end: dm(25), allDay: true }),
    mk({ id: 14, title: '🚩 Investor demo', squad: 'growth', owner: '-', status: 'Planned', effort: 0, progress: 0, start: dm(30), end: dm(31), allDay: true }),
    mk({ id: 15, title: '🚩 v3.0 launch', squad: 'data', owner: '-', status: 'Planned', effort: 0, progress: 0, start: dm(40), end: dm(41), allDay: true }),
  ])
  let backlog = $state<Idea[]>([
    { id: 'i1', title: 'SSO for enterprise', durationMin: 14 * DAY, color: STATUS.Planned.color },
    { id: 'i2', title: 'Usage-based pricing', durationMin: 21 * DAY, color: STATUS.Planned.color },
    { id: 'i3', title: 'Push-to-web parity', durationMin: 10 * DAY, color: STATUS.Planned.color },
  ])

  const isMilestone = (r: Init) => r.owner === '-'

  // --- Interactive filters ---------------------------------------------------
  let query = $state('')
  let hidden = $state<Record<string, boolean>>({})
  const shownSquads = $derived(squads.filter((s) => !hidden[s.id]))
  const q = $derived(query.trim().toLowerCase())
  const filtered = $derived(
    rows.filter((r) => !hidden[r.squad] && (q === '' || r.title.toLowerCase().includes(q) || r.owner.toLowerCase().includes(q))),
  )
  const activeCount = (id: string) => rows.filter((r) => r.squad === id && !isMilestone(r)).length

  // --- KPIs -------------------------------------------------------------------
  const initiatives = $derived(rows.filter((r) => !isMilestone(r)))
  const inProgress = $derived(initiatives.filter((r) => r.status === 'In progress').length)
  const atRisk = $derived(initiatives.filter((r) => r.status === 'At risk').length)
  const shipped = $derived(initiatives.filter((r) => r.status === 'Shipped').length)
  // delivery on-track = share of initiatives not flagged at risk (higher is better)
  const onTrack = $derived(initiatives.length ? Math.round(((initiatives.length - atRisk) / initiatives.length) * 100) : 0)

  const columns: ColumnDef<any, Init>[] = [
    { field: 'title', header: 'Initiative', editorType: 'text', width: 190 },
    { field: 'squad', header: 'Squad', editorType: 'list', editorOptions: squads.map((s) => ({ value: s.id, label: s.title ?? s.id, color: s.color })), width: 140 },
    { field: 'owner', header: 'Owner', editorType: 'text', width: 100 },
    { field: 'status', header: 'Status', editorType: 'list', editorOptions: (Object.keys(STATUS) as Status[]).map((s) => ({ value: s, label: s, color: STATUS[s].color })), width: 130 },
    { field: 'effort', header: 'Effort', editorType: 'number', width: 90 },
    { field: 'progress', header: 'Progress', editorType: 'number', width: 100 },
    { field: 'start', header: 'Start', editorType: 'date', width: 130 },
    { field: 'end', header: 'End', editorType: 'date', width: 130 },
  ]

  function onSchedule(item: Idea, start: Date, resourceId?: string) {
    const squad = resourceId ?? shownSquads[0]?.id ?? squads[0].id
    const end = new Date(start.getTime() + (item.durationMin ?? 14 * DAY) * 60000)
    rows = [...rows, mk({ id: ++seq, title: item.title, squad, owner: 'TBD', status: 'Planned', effort: 8, progress: 0, start: isoDay(start), end: isoDay(end), allDay: true })]
    backlog = backlog.filter((i) => i.id !== item.id)
  }
  function newInitiative() {
    const squad = shownSquads[0]?.id ?? squads[0].id
    rows = [...rows, mk({ id: ++seq, title: 'New initiative', squad, owner: 'TBD', status: 'Planned', effort: 8, progress: 0, start: dm(1), end: dm(14), allDay: true })]
  }
  function onEventMove(e: SchedulerEventMoveEvent<Init>) { e.row.start = isoDay(e.start); e.row.end = isoDay(e.end); if (e.toResource != null) e.row.squad = e.toResource }
  function onEventResize(e: SchedulerEventResizeEvent<Init>) { e.row.start = isoDay(e.start); e.row.end = isoDay(e.end) }
  function onEventCommit(e: SchedulerEventCommitEvent<Init>) { Object.assign(e.row, e.values); e.row.color = isMilestone(e.row) ? MILESTONE : STATUS[e.row.status]?.color ?? e.row.color }
  function onEventDelete(row: Init) { rows = rows.filter((r) => r !== row) }
</script>

{#snippet initBody(row: Init)}
  {#if row.owner === '-'}
    <span class="rm-ev"><span class="rm-ev-top"><span class="rm-ev-title">{row.title}</span></span></span>
  {:else}
    <span class="rm-ev">
      <span class="rm-ev-top">
        <span class="rm-ev-title">{row.title}</span>
        <span class="rm-ev-owner">{row.owner}</span>
      </span>
      <span class="rm-ev-prog"><SvProgress value={row.progress} max={100} size="sm" /></span>
    </span>
  {/if}
{/snippet}

<section class="rm">
  <aside class="rm-nav">
    <header class="rm-brand"><span class="rm-brand-mark">🗺</span><span><span class="rm-brand-name">Roadmap</span><span class="rm-brand-sub">Portfolio planning</span></span></header>

    <div class="rm-search">
      <SvTextInput bind:value={query} placeholder="Search initiatives / owners" clearable />
    </div>

    <div class="rm-roster">
      <div class="rm-sec-head">Squads <span class="rm-sec-count">{shownSquads.length}/{squads.length}</span></div>
      {#each squads as s (s.id)}
        <label class="rm-squad" class:rm-squad-off={hidden[s.id]}>
          <SvCheckBox checked={!hidden[s.id]} onChange={(v) => (hidden = { ...hidden, [s.id]: !v })} ariaLabel={`Show ${s.title}`} />
          <SvAvatar name={s.lead} color={s.color} size="sm" />
          <span class="rm-squad-txt"><span class="rm-squad-name">{s.title}</span><span class="rm-squad-lead">{s.lead}</span></span>
          <SvBadge variant="neutral" size="sm">{activeCount(s.id)}</SvBadge>
        </label>
      {/each}
    </div>

    <div class="rm-gaugewrap">
      <SvGauge value={onTrack} min={0} max={100} unit="%" label="Delivery on-track" size={130} thickness={12}
        bands={[{ from: 0, to: 40, color: '#dc2626' }, { from: 40, to: 70, color: '#d97706' }, { from: 70, to: 100, color: '#16a34a' }]} />
    </div>

    <div class="rm-legend">
      <div class="rm-sec-head">Status</div>
      {#each Object.entries(STATUS) as [s, v] (s)}
        <div class="rm-legend-row"><span class="rm-dot" style:background={v.color}></span>{s}</div>
      {/each}
      <div class="rm-legend-row"><span class="rm-dot" style:background={MILESTONE}></span>Milestone</div>
    </div>
  </aside>

  <div class="rm-main">
    <div class="rm-kpis">
      <SvStat label="Initiatives" value={initiatives.length} hint="on the roadmap" />
      <SvStat label="In progress" value={inProgress} hint="active now" />
      <SvStat label="At risk" value={atRisk} hint="need attention" invert trend={atRisk > 0 ? 'up' : 'flat'} />
      <SvStat label="Shipped" value={shipped} hint="delivered" trend={shipped > 0 ? 'up' : 'flat'} />
    </div>

    <div class="rm-toolbar">
      <div class="rm-toolbar-l"><span class="rm-title">Portfolio roadmap</span><span class="rm-sub">Drag a bar to reschedule or reassign; drop an idea from the backlog; zoom Month / Year</span></div>
      <SvButton variant="primary" size="sm" onclick={newInitiative}>+ New initiative</SvButton>
    </div>

    <div class="rm-cal">
      <SvGrid
        data={filtered}
        columns={columns}
        getRowId={(r) => String(r.id)}
        containerHeight="100%"
        scheduler={{
          startField: 'start', endField: 'end', titleField: 'title', colorField: 'color',
          allDayField: 'allDay',
          resourceField: 'squad', resources: shownSquads,
          views: ['timelineMonth', 'timelineYear'], initialView: 'timelineMonth', weekStartsOn: 1,
          unscheduled: backlog, backlogTitle: 'Idea backlog',
          event: initBody, tooltip: true, editable: true, drawer: true,
          onSchedule, onEventMove, onEventResize, onEventCommit, onEventDelete,
        }}
      />
    </div>

    <details class="rm-table">
      <summary>All initiatives ({rows.length})</summary>
      <div class="rm-table-grid">
        <SvGrid data={rows} columns={columns} getRowId={(r) => String(r.id)} containerHeight="260px" />
      </div>
    </details>
  </div>
</section>

<style>
  .rm { display: flex; flex: 1 1 auto; min-height: 0; border: 1px solid var(--sg-border, #e5e7eb); border-radius: 12px; overflow: hidden; background: var(--sg-bg, #fff); }
  .rm-nav { flex: 0 0 250px; display: flex; flex-direction: column; min-height: 0; border-right: 1px solid var(--sg-border, #e5e7eb); background: color-mix(in srgb, var(--sg-fg, #1f2937) 3%, transparent); }
  .rm-brand { display: flex; align-items: center; gap: 10px; padding: 14px; border-bottom: 1px solid var(--sg-border, #e5e7eb); }
  .rm-brand-mark { font-size: 20px; width: 34px; height: 34px; display: grid; place-items: center; border-radius: 9px; background: color-mix(in srgb, var(--sg-accent, #4f46e5) 16%, transparent); }
  .rm-brand-name { display: block; font-weight: 700; }
  .rm-brand-sub { display: block; font-size: 0.72rem; color: var(--sg-muted, #6b7280); }
  .rm-search { padding: 10px 12px 4px; }
  .rm-sec-head { display: flex; align-items: center; justify-content: space-between; font-size: 0.68rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; color: var(--sg-muted, #9ca3af); padding: 8px 4px 6px; }
  .rm-sec-count { font-weight: 600; }
  .rm-roster { padding: 4px 12px; overflow-y: auto; flex: 1 1 auto; min-height: 60px; }
  .rm-squad { display: flex; align-items: center; gap: 9px; padding: 6px 6px; border-radius: 8px; cursor: pointer; }
  .rm-squad:hover { background: color-mix(in srgb, var(--sg-fg, #1f2937) 6%, transparent); }
  .rm-squad-off { opacity: 0.5; }
  .rm-squad-txt { display: flex; flex-direction: column; min-width: 0; flex: 1 1 auto; }
  .rm-squad-name { font-size: 0.85rem; font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .rm-squad-lead { font-size: 0.7rem; color: var(--sg-muted, #6b7280); }
  .rm-gaugewrap { display: grid; place-items: center; padding: 6px 12px 12px; border-top: 1px solid var(--sg-border, #e5e7eb); }
  .rm-legend { padding: 4px 14px 14px; display: flex; flex-direction: column; gap: 6px; border-top: 1px solid var(--sg-border, #e5e7eb); }
  .rm-legend-row { display: flex; align-items: center; gap: 8px; font-size: 0.8rem; }
  .rm-dot { width: 10px; height: 10px; border-radius: 3px; flex: none; }
  .rm-main { flex: 1 1 auto; display: flex; flex-direction: column; min-width: 0; min-height: 0; }
  .rm-kpis { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; padding: 12px 14px 4px; }
  .rm-toolbar { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 8px 14px; }
  .rm-toolbar-l { display: flex; flex-direction: column; }
  .rm-title { font-weight: 600; }
  .rm-sub { font-size: 0.76rem; color: var(--sg-muted, #6b7280); }
  .rm-cal { flex: 1 1 auto; min-height: 0; padding: 0 8px; }
  .rm-table { padding: 8px 14px 14px; }
  .rm-table summary { cursor: pointer; font-size: 0.82rem; font-weight: 600; color: var(--sg-muted, #4b5563); padding: 4px 0; }
  .rm-table-grid { margin-top: 8px; }
  .rm-ev { display: flex; flex-direction: column; min-width: 0; line-height: 1.25; gap: 2px; }
  .rm-ev-top { display: flex; align-items: baseline; gap: 6px; min-width: 0; }
  .rm-ev-title { font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .rm-ev-owner { font-size: 0.74em; opacity: 0.85; flex: none; }
  .rm-ev-prog { display: block; width: 70px; }
</style>
