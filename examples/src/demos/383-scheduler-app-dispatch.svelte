<script lang="ts">
  /**
   * 383. Dispatch - a field-service OPERATIONS CONSOLE (real app)
   * ------------------------------------------------------------
   * Not a sidebar+calendar clone: this is a map-first dispatcher's console.
   *  - LEFT rail: a technician roster grouped by region, each crew showing a
   *    LIVE status dot (Available / En route / On site / Break), region and
   *    today's job count; toggle a crew to filter the map + timeline. A status
   *    legend sits below.
   *  - CENTER, split top/bottom:
   *      TOP  = a live OPS MAP - a street-grid canvas with a colored pin per
   *             technician (by live status, initials) and small job markers
   *             (by status), plus a "Live ops" chip.
   *      BOTTOM = a scheduler TIMELINE grouped by tech (timelineWeek / day),
   *             an "Unassigned" backlog you drag onto the timeline to dispatch,
   *             no double-booking, drawer + tooltip, and an SLA countdown on
   *             every open job card ("SLA 2h" / "OVERDUE").
   *  - A KPI strip above the map: SLA at-risk / In progress / Unassigned /
   *    Avg response. Urgent work is red, everywhere.
   */
  import {
    SvGrid,
    SvAvatar,
    SvBadge,
    SvButton,
    SvStat,
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

  // Job status (what a job is doing) vs tech status (where a crew is) are
  // deliberately different vocabularies.
  type Status = 'Scheduled' | 'En route' | 'On site' | 'Done'
  type Priority = 'Normal' | 'Urgent'
  type Job = {
    id: number; title: string; customer: string; address: string; tech: string
    status: Status; priority: Priority; slaMins: number
    start: string; end: string; color: string
  }
  type Unassigned = { id: string; title: string; durationMin?: number; slaMins?: number; color?: string }

  const STATUS: Record<Status, { color: string; variant: 'neutral' | 'info' | 'success' | 'warning' | 'danger' }> = {
    Scheduled: { color: '#6366f1', variant: 'info' },
    'En route': { color: '#d97706', variant: 'warning' },
    'On site': { color: '#16a34a', variant: 'success' },
    Done: { color: '#64748b', variant: 'neutral' },
  }

  type TechStatus = 'Available' | 'En route' | 'On site' | 'Break'
  const TECH_STATUS: Record<TechStatus, { color: string }> = {
    Available: { color: '#16a34a' },
    'En route': { color: '#d97706' },
    'On site': { color: '#2563eb' },
    Break: { color: '#94a3b8' },
  }

  // Each tech carries a live status and a fixed map position (percent of the map).
  type Tech = SchedulerResource & { region: string; initials: string; live: TechStatus; mx: number; my: number }
  const techs: Tech[] = [
    { id: 'T1', title: 'Ava Miller', color: '#4f46e5', region: 'North', initials: 'AM', live: 'En route', mx: 26, my: 32 },
    { id: 'T2', title: 'Ben Ortiz', color: '#0891b2', region: 'North', initials: 'BO', live: 'On site', mx: 58, my: 22 },
    { id: 'T3', title: 'Cara Diaz', color: '#16a34a', region: 'South', initials: 'CD', live: 'Available', mx: 38, my: 66 },
    { id: 'T4', title: 'Dan Webb', color: '#db2777', region: 'South', initials: 'DW', live: 'Break', mx: 74, my: 60 },
  ]
  const regions = ['North', 'South']

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
  // keep seeded jobs inside the visible Mon-Sun week even when today is late in it
  function nextDay(offset: number) { return (TD + offset) % 7 }

  // A FIXED "now" anchored to today at 12:30 so SLA states are deterministic
  // regardless of the wall clock the demo happens to load at.
  const NOW = new Date(today); NOW.setHours(12, 30, 0, 0)

  const mk = (j: Omit<Job, 'color'>): Job => ({ ...j, color: STATUS[j.status].color })

  let seq = 100
  let rows = $state<Job[]>([
    // Today - a full board across all four techs
    mk({ id: 1, title: 'AC install', customer: 'Nguyen', address: '412 Birch Ave', tech: 'T1', status: 'On site', priority: 'Normal', slaMins: 300, start: at(TD, 8, 0), end: at(TD, 11, 0) }),
    mk({ id: 2, title: 'Boiler service', customer: 'Patel', address: '90 Elm St', tech: 'T1', status: 'Scheduled', priority: 'Normal', slaMins: 300, start: at(TD, 13, 0), end: at(TD, 15, 0) }),
    mk({ id: 3, title: 'No heat - emergency', customer: 'Fox', address: '7 Harbor Rd', tech: 'T2', status: 'En route', priority: 'Urgent', slaMins: 120, start: at(TD, 8, 30), end: at(TD, 10, 0) }),
    mk({ id: 4, title: 'Thermostat swap', customer: 'Cole', address: '221 Maple Dr', tech: 'T2', status: 'Scheduled', priority: 'Normal', slaMins: 240, start: at(TD, 11, 0), end: at(TD, 12, 0) }),
    mk({ id: 5, title: 'Duct cleaning', customer: 'Osei', address: '58 Cedar Ct', tech: 'T2', status: 'Scheduled', priority: 'Normal', slaMins: 300, start: at(TD, 14, 0), end: at(TD, 16, 0) }),
    mk({ id: 6, title: 'Water heater swap', customer: 'Rivera', address: '133 Oak Ln', tech: 'T3', status: 'On site', priority: 'Urgent', slaMins: 180, start: at(TD, 9, 0), end: at(TD, 12, 0) }),
    mk({ id: 7, title: 'Drain unclog', customer: 'Bauer', address: '5 Sunset Blvd', tech: 'T3', status: 'Scheduled', priority: 'Normal', slaMins: 180, start: at(TD, 13, 30), end: at(TD, 14, 30) }),
    mk({ id: 8, title: 'Panel upgrade', customer: 'Reyes', address: '844 Pine St', tech: 'T4', status: 'Scheduled', priority: 'Urgent', slaMins: 150, start: at(TD, 12, 30), end: at(TD, 15, 0) }),
    mk({ id: 9, title: 'Outlet repair', customer: 'Haas', address: '19 Grove Way', tech: 'T4', status: 'Done', priority: 'Normal', slaMins: 240, start: at(TD, 7, 30), end: at(TD, 8, 30) }),
    // Rest of the week
    mk({ id: 10, title: 'Leak repair', customer: 'Olsen', address: '76 River Rd', tech: 'T1', status: 'Scheduled', priority: 'Normal', slaMins: 300, start: at(nextDay(1), 8, 30), end: at(nextDay(1), 10, 30) }),
    mk({ id: 11, title: 'Furnace tune-up', customer: 'Kruger', address: '30 Aspen Ct', tech: 'T2', status: 'Scheduled', priority: 'Normal', slaMins: 300, start: at(nextDay(1), 11, 0), end: at(nextDay(1), 12, 30) }),
    mk({ id: 12, title: 'Inspection', customer: 'Kim', address: '210 Vine St', tech: 'T3', status: 'Scheduled', priority: 'Normal', slaMins: 300, start: at(nextDay(1), 10, 0), end: at(nextDay(1), 11, 30) }),
    mk({ id: 13, title: 'Compressor swap', customer: 'Lund', address: '61 Willow Dr', tech: 'T4', status: 'Scheduled', priority: 'Urgent', slaMins: 180, start: at(nextDay(2), 9, 0), end: at(nextDay(2), 12, 0) }),
    mk({ id: 14, title: 'Filter replace', customer: 'Mensah', address: '14 Poplar Ave', tech: 'T1', status: 'Scheduled', priority: 'Normal', slaMins: 300, start: at(nextDay(2), 13, 0), end: at(nextDay(2), 14, 0) }),
    mk({ id: 15, title: 'Gas line check', customer: 'Sato', address: '88 Beech St', tech: 'T3', status: 'Scheduled', priority: 'Normal', slaMins: 240, start: at(nextDay(3), 9, 30), end: at(nextDay(3), 11, 0) }),
    mk({ id: 16, title: 'AC recharge', customer: 'Duarte', address: '303 Palm Rd', tech: 'T2', status: 'Scheduled', priority: 'Normal', slaMins: 300, start: at(nextDay(3), 14, 0), end: at(nextDay(3), 15, 30) }),
    mk({ id: 17, title: 'Sump pump install', customer: 'Weber', address: '42 Alder Way', tech: 'T4', status: 'Scheduled', priority: 'Normal', slaMins: 300, start: at(nextDay(4), 10, 0), end: at(nextDay(4), 12, 0) }),
  ])
  let backlog = $state<Unassigned[]>([
    { id: 'u1', title: 'Furnace repair - Diaz', durationMin: 120, slaMins: 240, color: STATUS.Scheduled.color },
    { id: 'u2', title: 'Thermostat swap - Cole', durationMin: 60, slaMins: 300, color: STATUS.Scheduled.color },
    { id: 'u3', title: 'Emergency: no cooling - Vance', durationMin: 90, slaMins: 90, color: '#ef4444' },
    { id: 'u4', title: 'Vent cleaning - Park', durationMin: 45, slaMins: 300, color: STATUS.Scheduled.color },
  ])

  // --- Interactive filters ---------------------------------------------------
  let query = $state('')
  let hidden = $state<Record<string, boolean>>({})
  const shownTechs = $derived(techs.filter((t) => !hidden[t.id]))
  const q = $derived(query.trim().toLowerCase())
  const boardRows = $derived(
    rows.filter((r) => !hidden[r.tech] && (q === '' || r.customer.toLowerCase().includes(q) || r.title.toLowerCase().includes(q))),
  )

  // --- SLA ---------------------------------------------------------------------
  // deadline = start + slaMins; remaining measured against the fixed NOW.
  type Sla = { remMin: number; overdue: boolean; atRisk: boolean; label: string }
  function slaInfo(j: { start: string; slaMins: number }): Sla {
    const deadline = new Date(j.start).getTime() + j.slaMins * 60000
    const remMin = Math.round((deadline - NOW.getTime()) / 60000)
    const overdue = remMin < 0
    const atRisk = remMin <= 60 // includes overdue
    let label: string
    if (overdue) label = 'OVERDUE'
    else if (remMin >= 60) { const h = Math.floor(remMin / 60); const m = remMin % 60; label = `SLA ${h}h${m ? ` ${m}m` : ''}` }
    else label = `SLA ${remMin}m`
    return { remMin, overdue, atRisk, label }
  }

  // --- Map jobs (today, visible techs) ----------------------------------------
  // deterministic scatter so markers spread without hand-placing 17 of them
  const jobPos = (id: number) => ({ x: 12 + ((id * 37) % 74), y: 16 + ((id * 47) % 66) })
  const mapJobs = $derived(rows.filter((r) => isToday(r.start) && !hidden[r.tech]))

  // --- KPIs -------------------------------------------------------------------
  const todayJobs = $derived(rows.filter((r) => isToday(r.start)))
  const inProgress = $derived(rows.filter((r) => r.status === 'En route' || r.status === 'On site').length)
  const slaAtRisk = $derived(
    todayJobs.filter((r) => r.status !== 'Done' && slaInfo(r).atRisk).length,
  )
  const avgResponse = $derived.by(() => {
    // response minutes so far: active jobs measured from start->now, done from start->end
    const active = todayJobs.filter((r) => r.status === 'En route' || r.status === 'On site' || r.status === 'Done')
    if (active.length === 0) return 0
    const total = active.reduce((sum, r) => {
      const startMs = new Date(r.start).getTime()
      const endMs = r.status === 'Done' ? new Date(r.end).getTime() : NOW.getTime()
      return sum + Math.max(0, (endMs - startMs) / 60000)
    }, 0)
    return Math.round(total / active.length)
  })
  const todayCount = (id: string) => rows.filter((r) => isToday(r.start) && r.tech === id).length

  const columns: ColumnDef<any, Job>[] = [
    { field: 'title', header: 'Job', editorType: 'text', width: 150 },
    { field: 'customer', header: 'Customer', editorType: 'text', width: 120 },
    { field: 'address', header: 'Address', editorType: 'text', width: 150 },
    { field: 'tech', header: 'Tech', editorType: 'list', editorOptions: techs.map((t) => ({ value: t.id, label: t.title ?? t.id, color: t.color })), width: 130 },
    { field: 'status', header: 'Status', editorType: 'list', editorOptions: (Object.keys(STATUS) as Status[]).map((s) => ({ value: s, label: s, color: STATUS[s].color })), width: 120 },
    { field: 'priority', header: 'Priority', editorType: 'list', editorOptions: [{ value: 'Normal', label: 'Normal', color: '#94a3b8' }, { value: 'Urgent', label: 'Urgent', color: '#dc2626' }], width: 110 },
    { field: 'slaMins', header: 'SLA (min)', editorType: 'number', width: 100 },
    { field: 'start', header: 'Start', editorType: 'datetime', width: 150 },
    { field: 'end', header: 'End', editorType: 'datetime', width: 150 },
  ]

  function onSchedule(item: Unassigned, start: Date, resourceId?: string) {
    const tech = resourceId ?? shownTechs[0]?.id ?? techs[0].id
    const end = new Date(start.getTime() + (item.durationMin ?? 60) * 60000)
    const [rawTitle, customer] = item.title.split(' - ')
    const urgent = /^Emergency:/i.test(rawTitle)
    rows = [...rows, mk({ id: ++seq, title: rawTitle.replace(/^Emergency:\s*/i, ''), customer: customer ?? '', address: '', tech, status: 'Scheduled', priority: urgent ? 'Urgent' : 'Normal', slaMins: item.slaMins ?? (urgent ? 120 : 300), start: iso(start), end: iso(end) })]
    backlog = backlog.filter((u) => u.id !== item.id)
  }
  function newJob() {
    const tech = shownTechs[0]?.id ?? techs[0].id
    rows = [...rows, mk({ id: ++seq, title: 'New job', customer: 'New customer', address: '', tech, status: 'Scheduled', priority: 'Normal', slaMins: 300, start: at(TD, 16, 0), end: at(TD, 17, 0) })]
  }
  function onEventMove(e: SchedulerEventMoveEvent<Job>) { e.row.start = iso(e.start); e.row.end = iso(e.end); if (e.toResource != null) e.row.tech = e.toResource }
  function onEventResize(e: SchedulerEventResizeEvent<Job>) { e.row.start = iso(e.start); e.row.end = iso(e.end) }
  function onEventCommit(e: SchedulerEventCommitEvent<Job>) { Object.assign(e.row, e.values); e.row.color = STATUS[e.row.status]?.color ?? e.row.color }
  function onEventDelete(row: Job) { rows = rows.filter((r) => r !== row) }
</script>

{#snippet jobBody(row: Job)}
  {@const s = slaInfo(row)}
  <span class="dp-ev">
    <span class="dp-ev-top">
      <span class="dp-ev-title">{row.title}</span>
      {#if row.priority === 'Urgent'}<span class="dp-ev-flag" title="Urgent">!</span>{/if}
      <span class="dp-ev-status" style:background={STATUS[row.status].color}></span>
    </span>
    <span class="dp-ev-bot">
      <span class="dp-ev-cust">{row.customer}</span>
      {#if row.status !== 'Done'}
        <span class="dp-ev-sla" class:dp-ev-sla-bad={s.overdue} class:dp-ev-sla-warn={s.atRisk && !s.overdue}>{s.label}</span>
      {/if}
    </span>
  </span>
{/snippet}

<section class="dp" data-mobile-pan>
  <aside class="dp-nav">
    <header class="dp-brand"><span class="dp-brand-mark">📡</span><span><span class="dp-brand-name">Dispatch</span><span class="dp-brand-sub">Field ops console</span></span></header>

    <div class="dp-search">
      <SvTextInput bind:value={query} placeholder="Search jobs / customers" clearable />
    </div>

    <div class="dp-roster">
      <div class="dp-sec-head">Crews <span class="dp-sec-count">{shownTechs.length}/{techs.length}</span></div>
      {#each regions as region (region)}
        <div class="dp-region">{region} region</div>
        {#each techs.filter((t) => t.region === region) as t (t.id)}
          <label class="dp-tech" class:dp-tech-off={hidden[t.id]}>
            <SvCheckBox checked={!hidden[t.id]} onChange={(v) => (hidden = { ...hidden, [t.id]: !v })} ariaLabel={`Show ${t.title}`} />
            <span class="dp-tech-av">
              <SvAvatar name={t.title} color={t.color} size="sm" />
              <span class="dp-tech-live" style:background={TECH_STATUS[t.live].color} title={t.live}></span>
            </span>
            <span class="dp-tech-txt">
              <span class="dp-tech-name">{t.title}</span>
              <span class="dp-tech-meta">{t.live}</span>
            </span>
            <SvBadge variant="neutral" size="sm">{todayCount(t.id)}</SvBadge>
          </label>
        {/each}
      {/each}
    </div>

    <div class="dp-legend">
      <div class="dp-sec-head">Crew status</div>
      {#each Object.entries(TECH_STATUS) as [s, v] (s)}
        <div class="dp-legend-row"><span class="dp-dot" style:background={v.color}></span>{s}</div>
      {/each}
    </div>
  </aside>

  <div class="dp-main">
    <div class="dp-kpis">
      <SvStat label="SLA at-risk" value={slaAtRisk} hint="jobs today" trend={slaAtRisk > 0 ? 'up' : 'flat'} invert />
      <SvStat label="In progress" value={inProgress} hint="en route + on site" />
      <SvStat label="Unassigned" value={backlog.length} hint="in the backlog" />
      <SvStat label="Avg response" value={`${avgResponse}m`} hint="today" />
    </div>

    <div class="dp-map">
      <div class="dp-map-grid"></div>
      <div class="dp-map-roads"></div>
      <div class="dp-map-chip"><span class="dp-map-pulse"></span>Live ops - {mapJobs.length} active</div>
      <div class="dp-map-key">
        {#each Object.entries(STATUS) as [s, v] (s)}
          <span class="dp-map-key-item"><span class="dp-map-key-dot" style:background={v.color}></span>{s}</span>
        {/each}
      </div>
      {#each mapJobs as j (j.id)}
        {@const p = jobPos(j.id)}
        <span class="dp-job-marker" class:dp-job-urgent={j.priority === 'Urgent'} style:left={`${p.x}%`} style:top={`${p.y}%`} style:background={STATUS[j.status].color} title={`${j.title} - ${j.customer}`}></span>
      {/each}
      {#each shownTechs as t (t.id)}
        <div class="dp-pin" class:dp-pin-moving={t.live === 'En route'} style:left={`${t.mx}%`} style:top={`${t.my}%`} style:--pin={TECH_STATUS[t.live].color} title={`${t.title} - ${t.live}`}>
          <span class="dp-pin-ini">{t.initials}</span>
        </div>
      {/each}
    </div>

    <div class="dp-toolbar">
      <div class="dp-toolbar-l"><span class="dp-title">Dispatch timeline</span><span class="dp-sub">Drag a job to re-time or reassign; drag an unassigned job onto a crew to dispatch</span></div>
      <SvButton variant="primary" size="sm" onclick={newJob}>+ New job</SvButton>
    </div>

    <div class="dp-cal">
      <SvGrid
      columnResize
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
        <SvGrid
      columnResize data={rows} columns={columns} getRowId={(r) => String(r.id)} containerHeight="260px" />
      </div>
    </details>
  </div>
</section>

<style>
  .dp { display: flex; flex: 1 1 auto; min-height: 0; border: 1px solid var(--sg-border, #e5e7eb); border-radius: 12px; overflow: hidden; background: var(--sg-bg, #fff); }

  /* Left rail --------------------------------------------------------------- */
  .dp-nav { flex: 0 0 232px; display: flex; flex-direction: column; min-height: 0; border-right: 1px solid var(--sg-border, #e5e7eb); background: color-mix(in srgb, var(--sg-fg, #1f2937) 3%, transparent); }
  .dp-brand { display: flex; align-items: center; gap: 10px; padding: 14px; border-bottom: 1px solid var(--sg-border, #e5e7eb); }
  .dp-brand-mark { font-size: 18px; width: 34px; height: 34px; display: grid; place-items: center; border-radius: 9px; background: color-mix(in srgb, var(--sg-accent, #4f46e5) 16%, transparent); }
  .dp-brand-name { display: block; font-weight: 700; }
  .dp-brand-sub { display: block; font-size: 0.72rem; color: var(--sg-muted, #6b7280); }
  .dp-search { padding: 10px 12px 4px; }
  .dp-sec-head { display: flex; align-items: center; justify-content: space-between; font-size: 0.68rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; color: var(--sg-muted, #9ca3af); padding: 8px 4px 6px; }
  .dp-sec-count { font-weight: 600; }
  .dp-roster { padding: 4px 12px; overflow-y: auto; flex: 1 1 auto; min-height: 60px; }
  .dp-region { font-size: 0.66rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: color-mix(in srgb, var(--sg-accent, #4f46e5) 70%, var(--sg-muted, #6b7280)); padding: 10px 4px 3px; }
  .dp-tech { display: flex; align-items: center; gap: 9px; padding: 6px 6px; border-radius: 8px; cursor: pointer; }
  .dp-tech:hover { background: color-mix(in srgb, var(--sg-fg, #1f2937) 6%, transparent); }
  .dp-tech-off { opacity: 0.5; }
  .dp-tech-av { position: relative; flex: none; display: inline-flex; }
  .dp-tech-live { position: absolute; right: -2px; bottom: -2px; width: 10px; height: 10px; border-radius: 50%; border: 2px solid var(--sg-bg, #fff); }
  .dp-tech-txt { display: flex; flex-direction: column; min-width: 0; flex: 1 1 auto; }
  .dp-tech-name { font-size: 0.85rem; font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .dp-tech-meta { font-size: 0.7rem; color: var(--sg-muted, #6b7280); }
  .dp-legend { padding: 4px 14px 14px; display: flex; flex-direction: column; gap: 6px; border-top: 1px solid var(--sg-border, #e5e7eb); }
  .dp-legend-row { display: flex; align-items: center; gap: 8px; font-size: 0.8rem; }
  .dp-dot { width: 10px; height: 10px; border-radius: 50%; flex: none; }

  /* Main column ------------------------------------------------------------- */
  .dp-main { flex: 1 1 auto; display: flex; flex-direction: column; min-width: 0; min-height: 0; }
  .dp-kpis { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; padding: 8px 14px 6px; }
  .dp-kpis :global(.sv-stat) { padding: 7px 12px !important; gap: 2px !important; border-radius: 9px !important; }
  .dp-kpis :global(.sv-stat__value) { font-size: 18px !important; }
  .dp-kpis :global(.sv-stat__label) { font-size: 11px !important; }
  .dp-kpis :global(.sv-stat__foot) { font-size: 11px !important; }

  /* Ops map (signature) ----------------------------------------------------- */
  .dp-map { position: relative; flex: 0 0 200px; height: 200px; min-height: 200px; margin: 0 14px; border-radius: 12px; overflow: hidden; border: 1px solid var(--sg-border, #e5e7eb); background:
      radial-gradient(120% 120% at 20% 10%, color-mix(in srgb, var(--sg-accent, #4f46e5) 7%, transparent), transparent 60%),
      color-mix(in srgb, var(--sg-fg, #1f2937) 4%, var(--sg-bg, #fff)); }
  /* fine street grid */
  .dp-map-grid { position: absolute; inset: 0; background-image:
      repeating-linear-gradient(0deg, color-mix(in srgb, var(--sg-fg, #1f2937) 8%, transparent) 0 1px, transparent 1px 28px),
      repeating-linear-gradient(90deg, color-mix(in srgb, var(--sg-fg, #1f2937) 8%, transparent) 0 1px, transparent 1px 34px); }
  /* two thicker "main roads" crossing the city */
  .dp-map-roads { position: absolute; inset: 0; pointer-events: none; background-image:
      linear-gradient(90deg, transparent 0 46%, color-mix(in srgb, var(--sg-accent, #4f46e5) 14%, transparent) 46% 48%, transparent 48%),
      linear-gradient(0deg, transparent 0 62%, color-mix(in srgb, var(--sg-accent, #4f46e5) 12%, transparent) 62% 63.4%, transparent 63.4%); }
  .dp-map-chip { position: absolute; top: 10px; left: 10px; display: inline-flex; align-items: center; gap: 6px; padding: 4px 9px; border-radius: 999px; font-size: 0.72rem; font-weight: 600; color: var(--sg-fg, #1f2937); background: color-mix(in srgb, var(--sg-bg, #fff) 82%, transparent); border: 1px solid var(--sg-border, #e5e7eb); backdrop-filter: blur(2px); }
  .dp-map-pulse { width: 8px; height: 8px; border-radius: 50%; background: #16a34a; box-shadow: 0 0 0 0 color-mix(in srgb, #16a34a 70%, transparent); animation: dp-pulse 1.8s infinite; }
  .dp-map-key { position: absolute; bottom: 10px; left: 10px; display: flex; flex-wrap: wrap; gap: 4px 10px; padding: 5px 9px; border-radius: 8px; font-size: 0.68rem; color: var(--sg-fg, #1f2937); background: color-mix(in srgb, var(--sg-bg, #fff) 82%, transparent); border: 1px solid var(--sg-border, #e5e7eb); backdrop-filter: blur(2px); }
  .dp-map-key-item { display: inline-flex; align-items: center; gap: 5px; }
  .dp-map-key-dot { width: 8px; height: 8px; border-radius: 50%; }

  /* job markers */
  .dp-job-marker { position: absolute; width: 9px; height: 9px; border-radius: 50%; transform: translate(-50%, -50%); border: 1.5px solid var(--sg-bg, #fff); box-shadow: 0 1px 3px rgba(0, 0, 0, 0.28); }
  .dp-job-urgent { width: 11px; height: 11px; box-shadow: 0 0 0 3px color-mix(in srgb, #dc2626 40%, transparent); }

  /* technician pins - colored by live status via --pin */
  .dp-pin { position: absolute; transform: translate(-50%, -100%); display: grid; place-items: center; width: 30px; height: 30px; border-radius: 50% 50% 50% 0; rotate: -45deg; background: var(--pin, #4f46e5); border: 2px solid var(--sg-bg, #fff); box-shadow: 0 3px 8px rgba(0, 0, 0, 0.3); z-index: 2; }
  .dp-pin-ini { rotate: 45deg; font-size: 0.62rem; font-weight: 800; color: #fff; letter-spacing: 0.02em; }
  .dp-pin-moving { animation: dp-bob 1.6s ease-in-out infinite; }

  @keyframes dp-pulse { 0% { box-shadow: 0 0 0 0 color-mix(in srgb, #16a34a 65%, transparent); } 70% { box-shadow: 0 0 0 7px transparent; } 100% { box-shadow: 0 0 0 0 transparent; } }
  @keyframes dp-bob { 0%, 100% { transform: translate(-50%, -100%); } 50% { transform: translate(-50%, -115%); } }

  /* Timeline ---------------------------------------------------------------- */
  .dp-toolbar { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 10px 14px 6px; }
  .dp-toolbar-l { display: flex; flex-direction: column; }
  .dp-title { font-weight: 600; }
  .dp-sub { font-size: 0.76rem; color: var(--sg-muted, #6b7280); }
  .dp-cal { flex: 1 1 auto; min-height: 220px; padding: 0 8px; }
  .dp-table { padding: 8px 14px 14px; }
  .dp-table summary { cursor: pointer; font-size: 0.82rem; font-weight: 600; color: var(--sg-muted, #4b5563); padding: 4px 0; }
  .dp-table-grid { margin-top: 8px; }

  /* Event card -------------------------------------------------------------- */
  .dp-ev { display: flex; flex-direction: column; min-width: 0; line-height: 1.25; }
  .dp-ev-top { display: flex; align-items: center; gap: 5px; }
  .dp-ev-title { font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .dp-ev-flag { flex: none; width: 14px; height: 14px; display: grid; place-items: center; border-radius: 50%; background: #dc2626; color: #fff; font-size: 0.66em; font-weight: 800; }
  .dp-ev-status { width: 7px; height: 7px; border-radius: 50%; flex: none; margin-left: auto; }
  .dp-ev-bot { display: flex; align-items: center; gap: 6px; }
  .dp-ev-cust { font-size: 0.72em; opacity: 0.85; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; flex: 1 1 auto; }
  .dp-ev-sla { flex: none; font-size: 0.64em; font-weight: 700; padding: 1px 5px; border-radius: 999px; background: color-mix(in srgb, #fff 82%, transparent); color: #334155; border: 1px solid color-mix(in srgb, #000 12%, transparent); }
  .dp-ev-sla-warn { background: #fef3c7; color: #92400e; border-color: transparent; }
  .dp-ev-sla-bad { background: #dc2626; color: #fff; border-color: transparent; }

  /* Mobile: this is an app-shell console - a fixed 230px nav rail beside the
     scheduler - and the root hides its overflow, so on a phone the right-hand
     side was silently cut off. Floor it and let the whole console pan inside
     the demo stage (see .demo-stage.is-wide in examples/src/mobile.css), which
     keeps the rail and the timeline aligned. */
  @media (max-width: 767px) {
    .dp {
      min-width: 900px;
    }
  }
  /* Phone: the shell hides overflow for its rounded corners, which makes its automatic
     minimum height 0 - so as a flex item of the demo stage it shrank to the (short)
     phone stage and clipped its lower panes. Keep the content height; the stage
     scrolls vertically and pans sideways. */
  @media (max-width: 767px) {
    .dp { flex-shrink: 0; }
  }
</style>
