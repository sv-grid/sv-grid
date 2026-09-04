<script lang="ts">
  /**
   * 399. Northwood Clinic - an operations console (enterprise flagship)
   * ------------------------------------------------------------------
   * A whole clinic app on the Scheduler. A NavPane rail switches modules; the
   * Schedule module is a DOCKABLE workspace (SvDockManager) with the day scheduler
   * as the hero over a live "load by hour" chart and an Upcoming grid. Providers
   * are grouped by department (resource tree), every open slot is bookable, and
   * appointments keep a cleanup buffer. Insights is a charting dashboard; Patients
   * is a records grid. Live KPIs. All surfaces read the one `rows` array.
   */
  import {
    SvGrid,
    SvGridChart,
    SvDockManager,
    SvNavPane,
    SvStat,
    SvCalendar,
    dockGroup,
    dockTabs,
    dockPane,
    type DockManagerState,
    type ChartSpec,
    type ColumnDef,
    type SchedulerResource,
    type SchedulerEventMoveEvent,
    type SchedulerEventResizeEvent,
    type SchedulerEventCommitEvent,
  } from '@svgrid/grid'
  import { enableSchedulerView, setLicenseKey, availableSlots, type SchedulerProConfig, type SchedulerResourceGroup } from '@svgrid/enterprise'

  setLicenseKey('SVENTERPRISE-DEV-LOCAL')
  enableSchedulerView()

  // --- providers grouped by department (resource tree) ---
  type Provider = SchedulerResource & { dept: string; availability: { start: number; end: number }[] }
  const HOURS = [{ start: 8, end: 12 }, { start: 13, end: 17 }] // lunch 12-13
  const providers: Provider[] = [
    { id: 'adams', title: 'Dr. Adams', color: '#4f46e5', dept: 'general', availability: HOURS },
    { id: 'blake', title: 'Dr. Blake', color: '#0891b2', dept: 'general', availability: HOURS },
    { id: 'chen', title: 'Dr. Chen', color: '#db2777', dept: 'peds', availability: HOURS },
    { id: 'diaz', title: 'Dr. Diaz', color: '#16a34a', dept: 'imaging', availability: [{ start: 8, end: 16 }] },
    { id: 'mri', title: 'MRI room', color: '#d97706', dept: 'imaging', availability: [{ start: 8, end: 17 }] },
  ]
  const groups: SchedulerResourceGroup[] = [
    { id: 'general', title: 'General medicine' },
    { id: 'peds', title: 'Pediatrics' },
    { id: 'imaging', title: 'Imaging' },
  ]

  const SERVICES = ['Consult', 'Follow-up', 'Procedure', 'Imaging', 'Vaccination'] as const
  const SVC_COLOR: Record<string, string> = { Consult: '#4f46e5', 'Follow-up': '#0891b2', Procedure: '#db2777', Imaging: '#d97706', Vaccination: '#16a34a' }
  const STATUSES = ['Booked', 'Checked in', 'Completed', 'No-show'] as const
  const STATUS_COLOR: Record<string, string> = { Booked: '#64748b', 'Checked in': '#4f46e5', Completed: '#16a34a', 'No-show': '#dc2626' }

  type Appt = { id: string; title: string; service: string; patient: string; provider: string; status: string; start: string; end: string; color: string }
  const pad = (n: number) => String(n).padStart(2, '0')
  const iso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const at = (h: number, m = 0) => { const d = new Date(today); d.setHours(h, m, 0, 0); return d }
  const ats = (h: number, m = 0) => iso(at(h, m))
  const mk = (id: string, service: string, patient: string, provider: string, status: string, sh: number, sm: number, dur: number): Appt => {
    const s = at(sh, sm); const e = new Date(s.getTime() + dur * 60000)
    return { id, title: service, service, patient, provider, status, start: iso(s), end: iso(e), color: SVC_COLOR[service] }
  }

  let seq = 100
  let rows = $state<Appt[]>([
    mk('a1', 'Consult', 'A. Reed', 'adams', 'Checked in', 8, 30, 30),
    mk('a2', 'Follow-up', 'B. Owens', 'adams', 'Booked', 10, 0, 30),
    mk('a3', 'Procedure', 'C. Patel', 'adams', 'Booked', 13, 30, 60),
    mk('a4', 'Consult', 'D. Wright', 'blake', 'Completed', 9, 0, 30),
    mk('a5', 'Vaccination', 'E. Lee', 'blake', 'No-show', 11, 0, 15),
    mk('a6', 'Follow-up', 'F. Brooks', 'blake', 'Booked', 14, 0, 30),
    mk('a7', 'Consult', 'G. Adler (child)', 'chen', 'Checked in', 9, 30, 30),
    mk('a8', 'Vaccination', 'H. Mason (child)', 'chen', 'Completed', 10, 30, 15),
    mk('a9', 'Follow-up', 'I. Cole (child)', 'chen', 'Booked', 15, 0, 30),
    mk('a10', 'Imaging', 'J. Ng', 'diaz', 'Booked', 9, 0, 45),
    mk('a11', 'Imaging', 'K. Brooks', 'diaz', 'Completed', 11, 0, 45),
    mk('a12', 'Imaging', 'L. Stone', 'mri', 'Booked', 10, 0, 60),
    mk('a13', 'Imaging', 'M. Vale', 'mri', 'No-show', 13, 0, 60),
    mk('a14', 'Procedure', 'N. Frost', 'adams', 'Completed', 15, 30, 45),
  ])

  type Patient = { id: string; name: string; dob: string; phone: string; lastVisit: string; provider: string }
  const patients: Patient[] = [
    { id: 'p1', name: 'Amelia Reed', dob: '1988-03-12', phone: '555-0101', lastVisit: '2026-06-02', provider: 'adams' },
    { id: 'p2', name: 'Ben Owens', dob: '1975-11-30', phone: '555-0102', lastVisit: '2026-07-18', provider: 'adams' },
    { id: 'p3', name: 'Cara Patel', dob: '1992-01-08', phone: '555-0103', lastVisit: '2026-05-21', provider: 'adams' },
    { id: 'p4', name: 'Dan Wright', dob: '1968-09-14', phone: '555-0104', lastVisit: '2026-07-30', provider: 'blake' },
    { id: 'p5', name: 'Eve Lee', dob: '2019-04-02', phone: '555-0105', lastVisit: '2026-06-28', provider: 'chen' },
    { id: 'p6', name: 'Finn Brooks', dob: '1983-12-19', phone: '555-0106', lastVisit: '2026-07-11', provider: 'blake' },
    { id: 'p7', name: 'Grace Adler', dob: '2016-08-25', phone: '555-0107', lastVisit: '2026-07-05', provider: 'chen' },
    { id: 'p8', name: 'Jonah Ng', dob: '1990-02-17', phone: '555-0108', lastVisit: '2026-06-14', provider: 'diaz' },
  ]

  const providerName = (id: string) => providers.find((p) => p.id === id)?.title ?? id
  const columns: ColumnDef<any, Appt>[] = [
    { field: 'title', header: 'Service', editorType: 'list', editorOptions: SERVICES.map((s) => ({ value: s, label: s, color: SVC_COLOR[s] })), width: 130 },
    { field: 'patient', header: 'Patient', editorType: 'text', width: 150 },
    { field: 'provider', header: 'Provider', editorType: 'list', editorOptions: providers.map((p) => ({ value: p.id, label: p.title ?? p.id, color: p.color })), width: 120 },
    { field: 'status', header: 'Status', editorType: 'list', editorOptions: STATUSES.map((s) => ({ value: s, label: s, color: STATUS_COLOR[s] })), width: 120 },
    { field: 'start', header: 'Start', editorType: 'datetime', width: 150 },
    { field: 'end', header: 'End', editorType: 'datetime', width: 150 },
  ]
  const patientColumns: ColumnDef<any, Patient>[] = [
    { field: 'name', header: 'Patient', editorType: 'text', width: 170 },
    { field: 'dob', header: 'Date of birth', editorType: 'text', width: 130 },
    { field: 'phone', header: 'Phone', editorType: 'text', width: 120 },
    { id: 'prov', header: 'Primary provider', fieldFn: (r: Patient) => providerName(r.provider), width: 150 },
    { field: 'lastVisit', header: 'Last visit', editorType: 'text', width: 120 },
  ]

  // --- KPIs (live) ---
  const durMin = (r: Appt) => (new Date(r.end).getTime() - new Date(r.start).getTime()) / 60000
  const totalAppts = $derived(rows.length)
  const noShows = $derived(rows.filter((r) => r.status === 'No-show').length)
  const availableMin = $derived(providers.reduce((s, p) => s + p.availability.reduce((a, w) => a + (w.end - w.start) * 60, 0), 0))
  const bookedMin = $derived(rows.filter((r) => r.status !== 'No-show').reduce((s, r) => s + durMin(r), 0))
  const utilization = $derived(availableMin ? Math.round((bookedMin / availableMin) * 100) : 0)
  const openSlots = $derived.by(() => {
    let n = 0
    for (const p of providers) {
      const working = p.availability.map((w) => ({ start: at(w.start, 0), end: at(w.end, 0) }))
      const busy = rows.filter((r) => r.provider === p.id).map((r) => ({ start: new Date(r.start), end: new Date(r.end) }))
      n += availableSlots({ working, busy, durationMin: 30, bufferAfterMin: 10 }).length
    }
    return n
  })

  // --- charts (derived, redraw live) ---
  const byProvider = $derived<ChartSpec>({
    type: 'bar',
    categories: providers.map((p) => p.title ?? p.id),
    series: [{ label: 'Appointments', color: 'var(--sg-accent, #4f46e5)', values: providers.map((p) => rows.filter((r) => r.provider === p.id).length) }],
  })
  const byService = $derived<ChartSpec>({
    type: 'bar',
    categories: [...SERVICES],
    series: [{ label: 'Appointments', values: SERVICES.map((s) => rows.filter((r) => r.service === s).length) }],
  })
  const statusMix = $derived<ChartSpec>({
    type: 'pie',
    categories: [...STATUSES],
    series: [{ label: 'Status', values: STATUSES.map((s) => rows.filter((r) => r.status === s).length) }],
  })
  const byHour = $derived.by<ChartSpec>(() => {
    const hours = Array.from({ length: 10 }, (_, i) => 8 + i) // 8..17
    return {
      type: 'bar',
      categories: hours.map((h) => `${h}`),
      series: [{ label: 'Booked', color: 'var(--sg-accent, #4f46e5)', values: hours.map((h) => rows.filter((r) => new Date(r.start).getHours() === h).length) }],
    }
  })

  function onEventMove(e: SchedulerEventMoveEvent<Appt>) { e.row.start = iso(e.start); e.row.end = iso(e.end); if (e.toResource != null) e.row.provider = e.toResource }
  function onEventResize(e: SchedulerEventResizeEvent<Appt>) { e.row.start = iso(e.start); e.row.end = iso(e.end) }
  function onEventCommit(e: SchedulerEventCommitEvent<Appt>) { Object.assign(e.row, e.values); e.row.color = SVC_COLOR[e.row.service] ?? e.row.color }
  function onEventDelete(row: Appt) { rows = rows.filter((r) => r !== row) }
  function onSlotPick(start: Date, end: Date, resourceId?: string) {
    rows = [...rows, mk(`a${++seq}`, 'Consult', 'New patient', resourceId ?? providers[0].id, 'Booked', start.getHours(), start.getMinutes(), 30)]
  }

  let schedDate = $state<Date>(new Date())
  const miniValue = $derived([schedDate])
  let activeModule = $state('schedule')

  const schedulerCfg: SchedulerProConfig<any, Appt> = {
    startField: 'start', endField: 'end', titleField: 'title', colorField: 'color', statusField: 'status',
    resourceField: 'provider', resources: providers,
    resourceGroups: groups, resourceGroupOf: (r) => (r as Provider).dept, groupPersistKey: 'svgrid-clinic-console-groups',
    bookable: { durationMin: 30, stepMin: 30 }, bufferAfterMin: 10,
    views: ['timelineDay'], initialView: 'timelineDay',
    date: schedDate, onNavigate: (d) => (schedDate = d),
    businessHours: { start: 8, end: 17 }, dayStartHour: 8, dayEndHour: 18, timelineTickMinWidth: 92, timelineLaneHeight: 26,
    event: apptBody, tooltip: true, editable: true, drawer: true,
    onEventMove, onEventResize, onEventCommit, onEventDelete, onSlotPick,
  }

  // --- dockable workspace for the Schedule module ---
  const LAYOUT_KEY = 'svgrid-clinic-console-layout-v1'
  const defaultWorkspace = (): DockManagerState => ({
    main: dockGroup('row', [
      dockTabs([dockPane('scheduler', 'Day schedule', { minSize: 320, closable: false })]),
      dockGroup('column', [
        dockTabs([dockPane('load', 'Load by hour', { minSize: 120 })]),
        dockTabs([dockPane('upcoming', 'Upcoming', { minSize: 140 })]),
      ], [0.42, 0.58]),
    ], [0.68, 0.32]),
    floating: [],
    autoHide: [],
  })
  function loadWorkspace(): DockManagerState {
    try { const s = localStorage.getItem(LAYOUT_KEY); if (s) return JSON.parse(s) as DockManagerState } catch { /* ignore */ }
    return defaultWorkspace()
  }
  let workspace = $state<DockManagerState>(loadWorkspace())
  $effect(() => { try { localStorage.setItem(LAYOUT_KEY, JSON.stringify(workspace)) } catch { /* ignore */ } })

  let loadW = $state(0), loadH = $state(0)
  let c1w = $state(0), c1h = $state(0), c2w = $state(0), c2h = $state(0), c3w = $state(0), c3h = $state(0)
</script>

{#snippet iCal()}<span class="cx-ic">📅</span>{/snippet}
{#snippet iPatients()}<span class="cx-ic">👥</span>{/snippet}
{#snippet iInsights()}<span class="cx-ic">📊</span>{/snippet}

{#snippet apptBody(row: Appt)}
  <span class="cx-ev"><span class="cx-ev-t">{row.title}</span>{#if row.patient}<span class="cx-ev-p">{row.patient}</span>{/if}</span>
{/snippet}

{#snippet chartPane(spec: ChartSpec)}
  {#if loadW > 20 && loadH > 20}<SvGridChart spec={spec} width={loadW - 12} height={loadH - 12} />{/if}
{/snippet}

<section class="cx">
  <aside class="cx-nav">
    <div class="cx-brand">🏥 Northwood Clinic</div>
    <div class="cx-mini"><SvCalendar value={miniValue} onChange={(d) => { if (d[0]) schedDate = d[0] }} footer={false} months={1} weekNumbers={false} /></div>
    <div class="cx-legend">
      <div class="cx-legend-h">Services</div>
      {#each SERVICES as s (s)}<span class="cx-legend-i"><span class="cx-dot" style:background={SVC_COLOR[s]}></span>{s}</span>{/each}
    </div>
    <div class="cx-navpane">
      <SvNavPane
        sections={[]}
        moduleValue={activeModule}
        onModuleSelect={(id) => (activeModule = id)}
        modules={[
          { id: 'schedule', label: 'Schedule', icon: iCal },
          { id: 'patients', label: 'Patients', badge: patients.length, icon: iPatients },
          { id: 'insights', label: 'Insights', icon: iInsights },
        ]}
      />
    </div>
  </aside>

  <div class="cx-main">
    <div class="cx-kpis">
      <SvStat label="Appointments" value={totalAppts} hint="today" />
      <SvStat label="Utilization" value={`${utilization}%`} hint="of provider hours" />
      <SvStat label="Open slots" value={openSlots} hint="30-min, bookable" />
      <SvStat label="No-shows" value={noShows} hint="today" />
    </div>

    {#if activeModule === 'schedule'}
      <div class="cx-toolbar">
        <div class="cx-title">Day schedule <span class="cx-title-sub">providers by department - click an open slot to book</span></div>
        <button class="cx-btn" onclick={() => (workspace = defaultWorkspace())}>Reset layout</button>
      </div>
      <div class="cx-stage">
        <SvDockManager bind:workspace minSize={120}>
          {#snippet pane(p)}
            {#if p.id === 'scheduler'}
              <div class="cx-pane"><SvGrid
      columnResize data={rows} columns={columns} getRowId={(r) => r.id} containerHeight="100%" scheduler={schedulerCfg} /></div>
            {:else if p.id === 'load'}
              <div class="cx-pane cx-chartwrap" bind:clientWidth={loadW} bind:clientHeight={loadH}>{@render chartPane(byHour)}</div>
            {:else if p.id === 'upcoming'}
              <div class="cx-pane"><SvGrid
      columnResize data={rows} columns={columns} getRowId={(r) => r.id} sortable enableInlineEditing rowHeight={30} containerHeight="100%" fitColumns /></div>
            {/if}
          {/snippet}
        </SvDockManager>
      </div>
    {:else if activeModule === 'patients'}
      <div class="cx-toolbar"><div class="cx-title">Patients <span class="cx-title-sub">{patients.length} records</span></div></div>
      <div class="cx-plain"><SvGrid
      columnResize data={patients} columns={patientColumns} getRowId={(r) => r.id} sortable filterable containerHeight="100%" fitColumns /></div>
    {:else if activeModule === 'insights'}
      <div class="cx-toolbar"><div class="cx-title">Insights <span class="cx-title-sub">today at a glance</span></div></div>
      <div class="cx-insights">
        <div class="cx-card"><div class="cx-card-h">By provider</div><div class="cx-card-body" bind:clientWidth={c1w} bind:clientHeight={c1h}>{#if c1w > 20 && c1h > 20}<SvGridChart spec={byProvider} width={c1w - 12} height={c1h - 12} />{/if}</div></div>
        <div class="cx-card"><div class="cx-card-h">By service</div><div class="cx-card-body" bind:clientWidth={c2w} bind:clientHeight={c2h}>{#if c2w > 20 && c2h > 20}<SvGridChart spec={byService} width={c2w - 12} height={c2h - 12} />{/if}</div></div>
        <div class="cx-card"><div class="cx-card-h">Status mix</div><div class="cx-card-body" bind:clientWidth={c3w} bind:clientHeight={c3h}>{#if c3w > 20 && c3h > 20}<SvGridChart spec={statusMix} width={c3w - 12} height={c3h - 12} />{/if}</div></div>
      </div>
    {/if}
  </div>
</section>

<style>
  .cx { display: flex; flex: 1 1 auto; min-height: 0; border: 1px solid var(--sg-border, #e5e7eb); border-radius: 10px; overflow: hidden; }
  .cx-nav { flex: 0 0 240px; display: flex; flex-direction: column; min-height: 0; border-right: 1px solid var(--sg-border, #e5e7eb); background: color-mix(in srgb, var(--sg-fg, #1f2937) 3%, transparent); overflow: hidden; }
  .cx-nav > * { flex: 0 0 auto; }
  .cx-ic { display: inline-flex; width: 16px; justify-content: center; }
  .cx-brand { font-weight: 700; padding: 10px 14px 8px; }
  .cx-mini { padding: 0 8px 6px; }
  .cx-mini :global(.sv-cal) { width: 100%; font-size: 0.78rem; }
  .cx-legend { padding: 6px 14px 8px; display: flex; flex-direction: column; gap: 5px; }
  .cx-legend-h { font-size: 0.68rem; font-weight: 600; text-transform: uppercase; color: var(--sg-muted, #9ca3af); }
  .cx-legend-i { display: flex; align-items: center; gap: 7px; font-size: 0.82rem; }
  .cx-dot { width: 10px; height: 10px; border-radius: 3px; }
  .cx-navpane { margin-top: auto; min-height: 0; }
  .cx-main { flex: 1 1 auto; display: flex; flex-direction: column; min-width: 0; min-height: 0; }
  .cx-kpis { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; padding: 8px 14px 4px; }
  .cx-kpis :global(.sv-stat) { padding: 7px 12px !important; gap: 2px !important; border-radius: 9px !important; }
  .cx-kpis :global(.sv-stat__value) { font-size: 18px !important; }
  .cx-kpis :global(.sv-stat__label) { font-size: 11px !important; }
  .cx-kpis :global(.sv-stat__foot) { font-size: 11px !important; }
  .cx-toolbar { display: flex; align-items: center; justify-content: space-between; padding: 8px 14px; border-bottom: 1px solid var(--sg-border, #e5e7eb); }
  .cx-title { font-weight: 600; display: flex; align-items: baseline; gap: 8px; }
  .cx-title-sub { font-size: 0.75rem; font-weight: 400; color: var(--sg-muted, #6b7280); }
  .cx-btn { padding: 4px 10px; font-size: 0.8rem; border: 1px solid var(--sg-border, #e5e7eb); border-radius: 6px; background: transparent; color: inherit; cursor: pointer; }
  .cx-btn:hover { border-color: var(--sg-accent, #4f46e5); color: var(--sg-accent, #4f46e5); }
  .cx-stage { flex: 1 1 auto; min-height: 320px; padding: 8px; }
  .cx-plain { flex: 1 1 auto; min-height: 0; padding: 8px; }
  .cx-pane { height: 100%; min-height: 0; }
  .cx-chartwrap { display: grid; place-items: center; padding: 6px; box-sizing: border-box; }
  .cx-insights { flex: 1 1 auto; min-height: 0; display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; padding: 10px 14px; }
  .cx-card { border: 1px solid var(--sg-border, #e5e7eb); border-radius: 10px; display: flex; flex-direction: column; min-height: 0; background: var(--sg-bg, #fff); }
  .cx-card-h { font-size: 0.8rem; font-weight: 600; padding: 8px 12px; border-bottom: 1px solid var(--sg-border, #e5e7eb); }
  .cx-card-body { flex: 1 1 auto; min-height: 0; display: grid; place-items: center; padding: 6px; }
  .cx-ev { display: flex; flex-direction: column; min-width: 0; line-height: 1.2; }
  .cx-ev-t { font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .cx-ev-p { font-size: 0.72em; opacity: 0.85; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  /* Phone: nav pane above the workspace instead of beside it (240px of 360 was the nav),
     the console at its content height, and the docking workspace panning in its stage. */
  @media (max-width: 639px) {
    .cx { flex-direction: column; flex-shrink: 0; }
    .cx-nav { flex: none; border-right: 0; border-bottom: 1px solid var(--sg-border, #e5e7eb); }
    .cx-stage { overflow-x: auto; }
  }
</style>
