<script lang="ts">
  /**
   * 383. Dispatch - a field-service operations board (real app)
   * ----------------------------------------------------------
   * A dispatcher's console, not a feature demo:
   *  - a live sidebar: search, a technician roster (avatar + region + today's
   *    load) you can show/hide to filter the board, and a crew-utilization gauge,
   *  - a KPI strip (jobs today / in progress / unassigned / urgent),
   *  - the scheduler as a timeline grouped by technician - drag a bar to re-time
   *    it or onto another tech to reassign, drag an unassigned job from the
   *    backlog onto the timeline to dispatch it, no double-booking a tech,
   *  - a status-coded job card + a companion "all jobs this week" table - the
   *    same rows as a grid.
   */
  import {
    SvGrid,
    SvAvatar,
    SvBadge,
    SvButton,
    SvStat,
    SvGauge,
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

  type Status = 'Scheduled' | 'En route' | 'On site' | 'Done'
  type Priority = 'Normal' | 'Urgent'
  type Job = {
    id: number; title: string; customer: string; address: string; tech: string
    status: Status; priority: Priority; start: string; end: string; color: string
  }
  type Unassigned = { id: string; title: string; durationMin?: number; color?: string }

  const STATUS: Record<Status, { color: string; variant: 'neutral' | 'info' | 'success' | 'warning' | 'danger' }> = {
    Scheduled: { color: '#6366f1', variant: 'info' },
    'En route': { color: '#d97706', variant: 'warning' },
    'On site': { color: '#16a34a', variant: 'success' },
    Done: { color: '#64748b', variant: 'neutral' },
  }

  type Tech = SchedulerResource & { region: string; initials: string }
  const techs: Tech[] = [
    { id: 'T1', title: 'Ava Miller', color: '#4f46e5', region: 'North', initials: 'AM' },
    { id: 'T2', title: 'Ben Ortiz', color: '#0891b2', region: 'North', initials: 'BO' },
    { id: 'T3', title: 'Cara Diaz', color: '#16a34a', region: 'South', initials: 'CD' },
    { id: 'T4', title: 'Dan Webb', color: '#db2777', region: 'South', initials: 'DW' },
  ]

  const pad = (n: number) => String(n).padStart(2, '0')
  const iso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
  const monday = new Date()
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7))
  monday.setHours(0, 0, 0, 0)
  const at = (day: number, h: number, m = 0) => { const d = new Date(monday); d.setDate(monday.getDate() + day); d.setHours(h, m, 0, 0); return iso(d) }
  // day index of the real "today" within this Mon-first week, so the board opens loaded
  const TD = (new Date().getDay() + 6) % 7
  const today = new Date(monday); today.setDate(monday.getDate() + TD)
  const isToday = (s: string) => s.slice(0, 10) === iso(today).slice(0, 10)

  const mk = (j: Omit<Job, 'color'>): Job => ({ ...j, color: STATUS[j.status].color })

  let seq = 100
  let rows = $state<Job[]>([
    // Today - a full board across all four techs
    mk({ id: 1, title: 'AC install', customer: 'Nguyen', address: '412 Birch Ave', tech: 'T1', status: 'On site', priority: 'Normal', start: at(TD, 8, 0), end: at(TD, 11, 0) }),
    mk({ id: 2, title: 'Boiler service', customer: 'Patel', address: '90 Elm St', tech: 'T1', status: 'Scheduled', priority: 'Normal', start: at(TD, 13, 0), end: at(TD, 15, 0) }),
    mk({ id: 3, title: 'No heat - emergency', customer: 'Fox', address: '7 Harbor Rd', tech: 'T2', status: 'En route', priority: 'Urgent', start: at(TD, 8, 30), end: at(TD, 10, 0) }),
    mk({ id: 4, title: 'Thermostat swap', customer: 'Cole', address: '221 Maple Dr', tech: 'T2', status: 'Scheduled', priority: 'Normal', start: at(TD, 11, 0), end: at(TD, 12, 0) }),
    mk({ id: 5, title: 'Duct cleaning', customer: 'Osei', address: '58 Cedar Ct', tech: 'T2', status: 'Scheduled', priority: 'Normal', start: at(TD, 14, 0), end: at(TD, 16, 0) }),
    mk({ id: 6, title: 'Water heater swap', customer: 'Rivera', address: '133 Oak Ln', tech: 'T3', status: 'On site', priority: 'Urgent', start: at(TD, 9, 0), end: at(TD, 12, 0) }),
    mk({ id: 7, title: 'Drain unclog', customer: 'Bauer', address: '5 Sunset Blvd', tech: 'T3', status: 'Scheduled', priority: 'Normal', start: at(TD, 13, 30), end: at(TD, 14, 30) }),
    mk({ id: 8, title: 'Panel upgrade', customer: 'Reyes', address: '844 Pine St', tech: 'T4', status: 'Scheduled', priority: 'Normal', start: at(TD, 9, 30), end: at(TD, 13, 0) }),
    mk({ id: 9, title: 'Outlet repair', customer: 'Haas', address: '19 Grove Way', tech: 'T4', status: 'Done', priority: 'Normal', start: at(TD, 7, 30), end: at(TD, 8, 30) }),
    // Rest of the week
    mk({ id: 10, title: 'Leak repair', customer: 'Olsen', address: '76 River Rd', tech: 'T1', status: 'Scheduled', priority: 'Normal', start: at(nextDay(1), 8, 30), end: at(nextDay(1), 10, 30) }),
    mk({ id: 11, title: 'Furnace tune-up', customer: 'Kruger', address: '30 Aspen Ct', tech: 'T2', status: 'Scheduled', priority: 'Normal', start: at(nextDay(1), 11, 0), end: at(nextDay(1), 12, 30) }),
    mk({ id: 12, title: 'Inspection', customer: 'Kim', address: '210 Vine St', tech: 'T3', status: 'Scheduled', priority: 'Normal', start: at(nextDay(1), 10, 0), end: at(nextDay(1), 11, 30) }),
    mk({ id: 13, title: 'Compressor swap', customer: 'Lund', address: '61 Willow Dr', tech: 'T4', status: 'Scheduled', priority: 'Urgent', start: at(nextDay(2), 9, 0), end: at(nextDay(2), 12, 0) }),
    mk({ id: 14, title: 'Filter replace', customer: 'Mensah', address: '14 Poplar Ave', tech: 'T1', status: 'Scheduled', priority: 'Normal', start: at(nextDay(2), 13, 0), end: at(nextDay(2), 14, 0) }),
    mk({ id: 15, title: 'Gas line check', customer: 'Sato', address: '88 Beech St', tech: 'T3', status: 'Scheduled', priority: 'Normal', start: at(nextDay(3), 9, 30), end: at(nextDay(3), 11, 0) }),
    mk({ id: 16, title: 'AC recharge', customer: 'Duarte', address: '303 Palm Rd', tech: 'T2', status: 'Scheduled', priority: 'Normal', start: at(nextDay(3), 14, 0), end: at(nextDay(3), 15, 30) }),
    mk({ id: 17, title: 'Sump pump install', customer: 'Weber', address: '42 Alder Way', tech: 'T4', status: 'Scheduled', priority: 'Normal', start: at(nextDay(4), 10, 0), end: at(nextDay(4), 12, 0) }),
  ])
  let backlog = $state<Unassigned[]>([
    { id: 'u1', title: 'Furnace repair - Diaz', durationMin: 120, color: STATUS.Scheduled.color },
    { id: 'u2', title: 'Thermostat swap - Cole', durationMin: 60, color: STATUS.Scheduled.color },
    { id: 'u3', title: 'Emergency: no cooling - Vance', durationMin: 90, color: '#ef4444' },
    { id: 'u4', title: 'Vent cleaning - Park', durationMin: 45, color: STATUS.Scheduled.color },
  ])

  // keep seeded jobs inside the visible Mon-Sun week even when today is late in it
  function nextDay(offset: number) { return (TD + offset) % 7 }

  // --- Interactive filters ---------------------------------------------------
  let query = $state('')
  let hidden = $state<Record<string, boolean>>({})
  const shownTechs = $derived(techs.filter((t) => !hidden[t.id]))
  const q = $derived(query.trim().toLowerCase())
  const boardRows = $derived(
    rows.filter((r) => !hidden[r.tech] && (q === '' || r.customer.toLowerCase().includes(q) || r.title.toLowerCase().includes(q))),
  )

  // --- KPIs -------------------------------------------------------------------
  const todayJobs = $derived(rows.filter((r) => isToday(r.start)))
  const inProgress = $derived(rows.filter((r) => r.status === 'En route' || r.status === 'On site').length)
  const urgentToday = $derived(todayJobs.filter((r) => r.priority === 'Urgent').length)
  const todayCount = (id: string) => rows.filter((r) => isToday(r.start) && r.tech === id).length

  // crew utilization = booked minutes today / (shown techs * an 8h shift)
  const SHIFT_MIN = 8 * 60
  const bookedMin = $derived(
    todayJobs.filter((r) => !hidden[r.tech]).reduce((sum, r) => sum + (new Date(r.end).getTime() - new Date(r.start).getTime()) / 60000, 0),
  )
  const capacityMin = $derived(shownTechs.length * SHIFT_MIN)
  const utilization = $derived(capacityMin ? Math.min(100, Math.round((bookedMin / capacityMin) * 100)) : 0)

  const columns: ColumnDef<any, Job>[] = [
    { field: 'title', header: 'Job', editorType: 'text', width: 150 },
    { field: 'customer', header: 'Customer', editorType: 'text', width: 120 },
    { field: 'address', header: 'Address', editorType: 'text', width: 150 },
    { field: 'tech', header: 'Tech', editorType: 'list', editorOptions: techs.map((t) => ({ value: t.id, label: t.title ?? t.id, color: t.color })), width: 130 },
    { field: 'status', header: 'Status', editorType: 'list', editorOptions: (Object.keys(STATUS) as Status[]).map((s) => ({ value: s, label: s, color: STATUS[s].color })), width: 120 },
    { field: 'priority', header: 'Priority', editorType: 'list', editorOptions: [{ value: 'Normal', label: 'Normal', color: '#94a3b8' }, { value: 'Urgent', label: 'Urgent', color: '#dc2626' }], width: 110 },
    { field: 'start', header: 'Start', editorType: 'datetime', width: 150 },
    { field: 'end', header: 'End', editorType: 'datetime', width: 150 },
  ]

  function onSchedule(item: Unassigned, start: Date, resourceId?: string) {
    const tech = resourceId ?? shownTechs[0]?.id ?? techs[0].id
    const end = new Date(start.getTime() + (item.durationMin ?? 60) * 60000)
    const [rawTitle, customer] = item.title.split(' - ')
    const urgent = /^Emergency:/i.test(rawTitle)
    rows = [...rows, mk({ id: ++seq, title: rawTitle.replace(/^Emergency:\s*/i, ''), customer: customer ?? '', address: '', tech, status: 'Scheduled', priority: urgent ? 'Urgent' : 'Normal', start: iso(start), end: iso(end) })]
    backlog = backlog.filter((u) => u.id !== item.id)
  }
  function newJob() {
    const tech = shownTechs[0]?.id ?? techs[0].id
    rows = [...rows, mk({ id: ++seq, title: 'New job', customer: 'New customer', address: '', tech, status: 'Scheduled', priority: 'Normal', start: at(TD, 16, 0), end: at(TD, 17, 0) })]
  }
  function onEventMove(e: SchedulerEventMoveEvent<Job>) { e.row.start = iso(e.start); e.row.end = iso(e.end); if (e.toResource != null) e.row.tech = e.toResource }
  function onEventResize(e: SchedulerEventResizeEvent<Job>) { e.row.start = iso(e.start); e.row.end = iso(e.end) }
  function onEventCommit(e: SchedulerEventCommitEvent<Job>) { Object.assign(e.row, e.values); e.row.color = STATUS[e.row.status]?.color ?? e.row.color }
  function onEventDelete(row: Job) { rows = rows.filter((r) => r !== row) }
</script>

{#snippet jobBody(row: Job)}
  <span class="dp-ev">
    <span class="dp-ev-top">
      <span class="dp-ev-title">{row.title}</span>
      {#if row.priority === 'Urgent'}<span class="dp-ev-flag" title="Urgent">!</span>{/if}
      <span class="dp-ev-status" style:background={STATUS[row.status].color}></span>
    </span>
    <span class="dp-ev-cust">{row.customer}</span>
  </span>
{/snippet}

<section class="dp">
  <aside class="dp-nav">
    <header class="dp-brand"><span class="dp-brand-mark">🛠</span><span><span class="dp-brand-name">Dispatch</span><span class="dp-brand-sub">Field ops board</span></span></header>

    <div class="dp-search">
      <SvTextInput bind:value={query} placeholder="Search jobs / customers" clearable />
    </div>

    <div class="dp-roster">
      <div class="dp-sec-head">Technicians <span class="dp-sec-count">{shownTechs.length}/{techs.length}</span></div>
      {#each techs as t (t.id)}
        <label class="dp-tech" class:dp-tech-off={hidden[t.id]}>
          <SvCheckBox checked={!hidden[t.id]} onChange={(v) => (hidden = { ...hidden, [t.id]: !v })} ariaLabel={`Show ${t.title}`} />
          <SvAvatar name={t.title} color={t.color} size="sm" />
          <span class="dp-tech-txt"><span class="dp-tech-name">{t.title}</span><span class="dp-tech-region">{t.region}</span></span>
          <SvBadge variant="neutral" size="sm">{todayCount(t.id)}</SvBadge>
        </label>
      {/each}
    </div>

    <div class="dp-gaugewrap">
      <SvGauge value={utilization} min={0} max={100} unit="%" label="Crew utilization" size={130} thickness={12}
        bands={[{ from: 0, to: 60, color: '#16a34a' }, { from: 60, to: 85, color: '#d97706' }, { from: 85, to: 100, color: '#dc2626' }]} />
    </div>

    <div class="dp-legend">
      <div class="dp-sec-head">Status</div>
      {#each Object.entries(STATUS) as [s, v] (s)}
        <div class="dp-legend-row"><span class="dp-dot" style:background={v.color}></span>{s}</div>
      {/each}
    </div>
  </aside>

  <div class="dp-main">
    <div class="dp-kpis">
      <SvStat label="Jobs today" value={todayJobs.length} hint="on the board" />
      <SvStat label="In progress" value={inProgress} hint="en route + on site" />
      <SvStat label="Unassigned" value={backlog.length} hint="in the backlog" />
      <SvStat label="Urgent" value={urgentToday} hint="today" trend={urgentToday > 0 ? 'up' : 'flat'} />
    </div>

    <div class="dp-toolbar">
      <div class="dp-toolbar-l"><span class="dp-title">Operations board</span><span class="dp-sub">Drag a job to re-time or reassign; drag from the backlog to dispatch</span></div>
      <SvButton variant="primary" size="sm" onclick={newJob}>+ New job</SvButton>
    </div>

    <div class="dp-cal">
      <SvGrid
        data={boardRows}
        columns={columns}
        getRowId={(r) => String(r.id)}
        containerHeight="100%"
        scheduler={{
          startField: 'start', endField: 'end', titleField: 'title', colorField: 'color',
          resourceField: 'tech', resources: shownTechs,
          views: ['timelineWeek', 'timelineDay'], initialView: 'timelineWeek', initialDate: today, weekStartsOn: 1,
          dayStartHour: 7, dayEndHour: 19,
          disableConflicts: true,
          unscheduled: backlog, backlogTitle: 'Unassigned',
          event: jobBody, tooltip: true, editable: true, drawer: true,
          onSchedule, onEventMove, onEventResize, onEventCommit, onEventDelete,
        }}
      />
    </div>

    <details class="dp-table">
      <summary>All jobs this week ({rows.length})</summary>
      <div class="dp-table-grid">
        <SvGrid data={rows} columns={columns} getRowId={(r) => String(r.id)} containerHeight="260px" />
      </div>
    </details>
  </div>
</section>

<style>
  .dp { display: flex; flex: 1 1 auto; min-height: 0; border: 1px solid var(--sg-border, #e5e7eb); border-radius: 12px; overflow: hidden; background: var(--sg-bg, #fff); }
  .dp-nav { flex: 0 0 250px; display: flex; flex-direction: column; min-height: 0; border-right: 1px solid var(--sg-border, #e5e7eb); background: color-mix(in srgb, var(--sg-fg, #1f2937) 3%, transparent); }
  .dp-brand { display: flex; align-items: center; gap: 10px; padding: 14px; border-bottom: 1px solid var(--sg-border, #e5e7eb); }
  .dp-brand-mark { font-size: 20px; width: 34px; height: 34px; display: grid; place-items: center; border-radius: 9px; background: color-mix(in srgb, var(--sg-accent, #4f46e5) 16%, transparent); }
  .dp-brand-name { display: block; font-weight: 700; }
  .dp-brand-sub { display: block; font-size: 0.72rem; color: var(--sg-muted, #6b7280); }
  .dp-search { padding: 10px 12px 4px; }
  .dp-sec-head { display: flex; align-items: center; justify-content: space-between; font-size: 0.68rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; color: var(--sg-muted, #9ca3af); padding: 8px 4px 6px; }
  .dp-sec-count { font-weight: 600; }
  .dp-roster { padding: 4px 12px; overflow-y: auto; flex: 1 1 auto; min-height: 60px; }
  .dp-tech { display: flex; align-items: center; gap: 9px; padding: 6px 6px; border-radius: 8px; cursor: pointer; }
  .dp-tech:hover { background: color-mix(in srgb, var(--sg-fg, #1f2937) 6%, transparent); }
  .dp-tech-off { opacity: 0.5; }
  .dp-tech-txt { display: flex; flex-direction: column; min-width: 0; flex: 1 1 auto; }
  .dp-tech-name { font-size: 0.85rem; font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .dp-tech-region { font-size: 0.7rem; color: var(--sg-muted, #6b7280); }
  .dp-gaugewrap { display: grid; place-items: center; padding: 6px 12px 12px; border-top: 1px solid var(--sg-border, #e5e7eb); }
  .dp-legend { padding: 4px 14px 14px; display: flex; flex-direction: column; gap: 6px; border-top: 1px solid var(--sg-border, #e5e7eb); }
  .dp-legend-row { display: flex; align-items: center; gap: 8px; font-size: 0.8rem; }
  .dp-dot { width: 10px; height: 10px; border-radius: 3px; flex: none; }
  .dp-main { flex: 1 1 auto; display: flex; flex-direction: column; min-width: 0; min-height: 0; }
  .dp-kpis { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; padding: 12px 14px 4px; }
  .dp-toolbar { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 8px 14px; }
  .dp-toolbar-l { display: flex; flex-direction: column; }
  .dp-title { font-weight: 600; }
  .dp-sub { font-size: 0.76rem; color: var(--sg-muted, #6b7280); }
  .dp-cal { flex: 1 1 auto; min-height: 0; padding: 0 8px; }
  .dp-table { padding: 8px 14px 14px; }
  .dp-table summary { cursor: pointer; font-size: 0.82rem; font-weight: 600; color: var(--sg-muted, #4b5563); padding: 4px 0; }
  .dp-table-grid { margin-top: 8px; }
  .dp-ev { display: flex; flex-direction: column; min-width: 0; line-height: 1.25; }
  .dp-ev-top { display: flex; align-items: center; gap: 5px; }
  .dp-ev-title { font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .dp-ev-flag { flex: none; width: 14px; height: 14px; display: grid; place-items: center; border-radius: 50%; background: #dc2626; color: #fff; font-size: 0.66em; font-weight: 800; }
  .dp-ev-status { width: 7px; height: 7px; border-radius: 50%; flex: none; margin-left: auto; }
  .dp-ev-cust { font-size: 0.72em; opacity: 0.85; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
</style>
