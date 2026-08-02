<script lang="ts">
  /**
   * 382. Meridian Clinic - a real appointment-scheduling front desk
   * -------------------------------------------------------------
   * A working clinic console, not a feature demo:
   *  - a live sidebar: search, a provider roster (avatar + specialty + today's
   *    load) you can show/hide to filter the board, and a utilization gauge,
   *  - a KPI strip (booked today / utilization / waitlist / no-shows),
   *  - the scheduler grouped by provider with each doctor's own working hours,
   *    no double-booking and no booking outside hours, a drag-in patient waitlist,
   *  - a status-coded appointment card + a companion "all appointments" table -
   *    the same rows as a grid.
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

  type Status = 'Confirmed' | 'Checked in' | 'Completed' | 'No show' | 'Cancelled'
  type Appt = {
    id: number; patient: string; provider: string; type: string; status: Status
    reason: string; phone: string; start: string; end: string; color: string
  }
  type Waiting = { id: string; title: string; durationMin?: number; color?: string }

  const TYPE_COLOR: Record<string, string> = { Consult: '#4f46e5', 'Follow-up': '#0891b2', Procedure: '#db2777', Check: '#16a34a' }
  const STATUS: Record<Status, { color: string; variant: 'neutral' | 'info' | 'success' | 'warning' | 'danger' }> = {
    Confirmed: { color: '#6366f1', variant: 'info' },
    'Checked in': { color: '#0891b2', variant: 'info' },
    Completed: { color: '#16a34a', variant: 'success' },
    'No show': { color: '#dc2626', variant: 'danger' },
    Cancelled: { color: '#94a3b8', variant: 'neutral' },
  }

  type Provider = SchedulerResource & { specialty: string; initials: string }
  const providers: Provider[] = [
    { id: 'Smith', title: 'Dr. Smith', color: '#4f46e5', specialty: 'Family medicine', initials: 'RS', availability: [{ days: [1, 2, 3, 4, 5], start: 9, end: 13 }] },
    { id: 'Jones', title: 'Dr. Jones', color: '#0891b2', specialty: 'Dermatology', initials: 'MJ', availability: [{ days: [1, 2, 3, 4, 5], start: 8, end: 12 }, { days: [1, 2, 3, 4, 5], start: 13, end: 16 }] },
    { id: 'Lee', title: 'Dr. Lee', color: '#16a34a', specialty: 'Cardiology', initials: 'AL', availability: [{ days: [1, 3, 5], start: 10, end: 18 }] },
  ]

  const pad = (n: number) => String(n).padStart(2, '0')
  const iso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
  const monday = new Date()
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7))
  monday.setHours(0, 0, 0, 0)
  const at = (day: number, h: number, m = 0) => { const d = new Date(monday); d.setDate(monday.getDate() + day); d.setHours(h, m, 0, 0); return iso(d) }
  const mkColor = (a: Omit<Appt, 'color'>): Appt => ({ ...a, color: TYPE_COLOR[a.type] })

  let seq = 100
  let rows = $state<Appt[]>([
    // Monday - a busy day across all three providers
    mkColor({ id: 1, patient: 'Amara Rivera', provider: 'Smith', type: 'Consult', status: 'Checked in', reason: 'Persistent cough', phone: '555-0142', start: at(0, 9, 0), end: at(0, 9, 30) }),
    mkColor({ id: 2, patient: 'Owen Bradley', provider: 'Smith', type: 'Follow-up', status: 'Confirmed', reason: 'BP review', phone: '555-0188', start: at(0, 9, 30), end: at(0, 10, 0) }),
    mkColor({ id: 3, patient: 'Priya Nair', provider: 'Smith', type: 'Check', status: 'Confirmed', reason: 'Annual physical', phone: '555-0119', start: at(0, 10, 30), end: at(0, 11, 15) }),
    mkColor({ id: 4, patient: 'Diego Santos', provider: 'Smith', type: 'Consult', status: 'No show', reason: 'Rash', phone: '555-0173', start: at(0, 12, 0), end: at(0, 12, 30) }),
    mkColor({ id: 5, patient: 'Bianca Chen', provider: 'Jones', type: 'Check', status: 'Completed', reason: 'Mole screening', phone: '555-0155', start: at(0, 8, 30), end: at(0, 9, 0) }),
    mkColor({ id: 6, patient: 'Ella Nakamura', provider: 'Jones', type: 'Procedure', status: 'Confirmed', reason: 'Biopsy', phone: '555-0126', start: at(0, 9, 30), end: at(0, 10, 30) }),
    mkColor({ id: 7, patient: 'Tomas Vidal', provider: 'Jones', type: 'Follow-up', status: 'Confirmed', reason: 'Eczema check', phone: '555-0198', start: at(0, 13, 30), end: at(0, 14, 0) }),
    mkColor({ id: 8, patient: 'Grace Abara', provider: 'Lee', type: 'Consult', status: 'Checked in', reason: 'Palpitations', phone: '555-0134', start: at(0, 10, 30), end: at(0, 11, 30) }),
    mkColor({ id: 9, patient: 'Henry Weber', provider: 'Lee', type: 'Follow-up', status: 'Confirmed', reason: 'Post-op review', phone: '555-0167', start: at(0, 13, 0), end: at(0, 13, 45) }),
    mkColor({ id: 10, patient: 'Sofia Marino', provider: 'Lee', type: 'Check', status: 'Confirmed', reason: 'ECG', phone: '555-0111', start: at(0, 15, 0), end: at(0, 16, 0) }),
    // Rest of the week
    mkColor({ id: 11, patient: 'Ivan Petrov', provider: 'Smith', type: 'Consult', status: 'Confirmed', reason: 'Headaches', phone: '555-0102', start: at(1, 9, 0), end: at(1, 9, 30) }),
    mkColor({ id: 12, patient: 'Lena Fischer', provider: 'Jones', type: 'Procedure', status: 'Confirmed', reason: 'Cyst removal', phone: '555-0144', start: at(1, 10, 0), end: at(1, 11, 0) }),
    mkColor({ id: 13, patient: 'Noah Kim', provider: 'Jones', type: 'Follow-up', status: 'Confirmed', reason: 'Acne review', phone: '555-0177', start: at(1, 13, 30), end: at(1, 14, 0) }),
    mkColor({ id: 14, patient: 'Carla Okafor', provider: 'Lee', type: 'Procedure', status: 'Confirmed', reason: 'Stress test', phone: '555-0159', start: at(2, 10, 30), end: at(2, 11, 30) }),
    mkColor({ id: 15, patient: 'Ruben Diaz', provider: 'Smith', type: 'Check', status: 'Confirmed', reason: 'Diabetes review', phone: '555-0121', start: at(2, 9, 30), end: at(2, 10, 15) }),
    mkColor({ id: 16, patient: 'Maya Rossi', provider: 'Jones', type: 'Consult', status: 'Confirmed', reason: 'Psoriasis', phone: '555-0183', start: at(4, 8, 30), end: at(4, 9, 15) }),
    mkColor({ id: 17, patient: 'Felix Wong', provider: 'Lee', type: 'Follow-up', status: 'Confirmed', reason: 'Med adjust', phone: '555-0190', start: at(4, 11, 0), end: at(4, 11, 30) }),
  ])
  let waitlist = $state<Waiting[]>([
    { id: 'w1', title: 'Elena Silva - new patient', durationMin: 45, color: '#4f46e5' },
    { id: 'w2', title: 'Frank Novak - review', durationMin: 30, color: '#0891b2' },
    { id: 'w3', title: 'Gita Bose - procedure', durationMin: 60, color: '#db2777' },
    { id: 'w4', title: 'Hugo Meyer - check-up', durationMin: 20, color: '#16a34a' },
    { id: 'w5', title: 'Iris Lang - consult', durationMin: 30, color: '#4f46e5' },
  ])

  // --- Interactive filters ---------------------------------------------------
  let query = $state('')
  let hidden = $state<Record<string, boolean>>({})
  const shownProviders = $derived(providers.filter((p) => !hidden[p.id]))
  const q = $derived(query.trim().toLowerCase())
  const boardRows = $derived(
    rows.filter((r) => !hidden[r.provider] && (q === '' || r.patient.toLowerCase().includes(q) || r.reason.toLowerCase().includes(q))),
  )

  // --- KPIs (for Monday, the day the board opens on) -------------------------
  const isMon = (s: string) => s.slice(0, 10) === iso(monday).slice(0, 10)
  const mondayAppts = $derived(rows.filter((r) => isMon(r.start) && r.status !== 'Cancelled'))
  const bookedMin = $derived(
    mondayAppts.reduce((sum, r) => sum + (new Date(r.end).getTime() - new Date(r.start).getTime()) / 60000, 0),
  )
  const capacityMin = $derived(
    providers.reduce((sum, p) => sum + (p.availability ?? []).filter((w) => (w.days ?? [1]).includes(1)).reduce((s, w) => s + (w.end - w.start) * 60, 0), 0),
  )
  const utilization = $derived(capacityMin ? Math.round((bookedMin / capacityMin) * 100) : 0)
  const noShows = $derived(mondayAppts.filter((r) => r.status === 'No show').length)
  const todayCount = (id: string) => rows.filter((r) => isMon(r.start) && r.provider === id && r.status !== 'Cancelled').length

  const columns: ColumnDef<any, Appt>[] = [
    { field: 'patient', header: 'Patient', editorType: 'text', width: 150 },
    { field: 'reason', header: 'Reason', editorType: 'text', width: 160 },
    { field: 'phone', header: 'Phone', editorType: 'text', width: 110 },
    { field: 'provider', header: 'Provider', editorType: 'list', editorOptions: providers.map((p) => ({ value: p.id, label: p.title ?? p.id, color: p.color })), width: 120 },
    { field: 'type', header: 'Type', editorType: 'list', editorOptions: Object.keys(TYPE_COLOR).map((t) => ({ value: t, label: t, color: TYPE_COLOR[t] })), width: 120 },
    { field: 'status', header: 'Status', editorType: 'list', editorOptions: (Object.keys(STATUS) as Status[]).map((s) => ({ value: s, label: s, color: STATUS[s].color })), width: 130 },
    { field: 'start', header: 'Start', editorType: 'datetime', width: 150 },
    { field: 'end', header: 'End', editorType: 'datetime', width: 150 },
  ]

  function onSchedule(item: Waiting, start: Date, resourceId?: string) {
    const provider = resourceId ?? shownProviders[0]?.id ?? providers[0].id
    const end = new Date(start.getTime() + (item.durationMin ?? 30) * 60000)
    rows = [...rows, mkColor({ id: ++seq, patient: item.title.split(' - ')[0], provider, type: 'Consult', status: 'Confirmed', reason: item.title.split(' - ')[1] ?? '', phone: '', start: iso(start), end: iso(end) })]
    waitlist = waitlist.filter((w) => w.id !== item.id)
  }
  function newAppointment() {
    const provider = shownProviders[0]?.id ?? providers[0].id
    rows = [...rows, mkColor({ id: ++seq, patient: 'New patient', provider, type: 'Consult', status: 'Confirmed', reason: '', phone: '', start: at(0, 16, 0), end: at(0, 16, 30) })]
  }
  function onEventMove(e: SchedulerEventMoveEvent<Appt>) { e.row.start = iso(e.start); e.row.end = iso(e.end); if (e.toResource != null) e.row.provider = e.toResource }
  function onEventResize(e: SchedulerEventResizeEvent<Appt>) { e.row.start = iso(e.start); e.row.end = iso(e.end) }
  function onEventCommit(e: SchedulerEventCommitEvent<Appt>) { Object.assign(e.row, e.values); e.row.color = TYPE_COLOR[e.row.type] ?? e.row.color }
  function onEventDelete(row: Appt) { rows = rows.filter((r) => r !== row) }
</script>

{#snippet apptBody(row: Appt)}
  <span class="cl-ev">
    <span class="cl-ev-top"><span class="cl-ev-name">{row.patient}</span><span class="cl-ev-status" style:background={STATUS[row.status].color}></span></span>
    <span class="cl-ev-sub">{row.type} · {row.reason}</span>
  </span>
{/snippet}

<section class="cl">
  <aside class="cl-nav">
    <header class="cl-brand"><span class="cl-brand-mark">✚</span><span><span class="cl-brand-name">Meridian Clinic</span><span class="cl-brand-sub">Front desk</span></span></header>

    <div class="cl-search">
      <SvTextInput bind:value={query} placeholder="Search patients / reasons" clearable />
    </div>

    <div class="cl-roster">
      <div class="cl-sec-head">Providers <span class="cl-sec-count">{shownProviders.length}/{providers.length}</span></div>
      {#each providers as p (p.id)}
        <label class="cl-prov" class:cl-prov-off={hidden[p.id]}>
          <SvCheckBox checked={!hidden[p.id]} onChange={(v) => (hidden = { ...hidden, [p.id]: !v })} ariaLabel={`Show ${p.title}`} />
          <SvAvatar name={p.title} color={p.color} size="sm" />
          <span class="cl-prov-txt"><span class="cl-prov-name">{p.title}</span><span class="cl-prov-spec">{p.specialty}</span></span>
          <SvBadge variant="neutral" size="sm">{todayCount(p.id)}</SvBadge>
        </label>
      {/each}
    </div>

    <div class="cl-gaugewrap">
      <SvGauge value={utilization} min={0} max={100} unit="%" label="Utilization today" size={130} thickness={12}
        bands={[{ from: 0, to: 60, color: '#16a34a' }, { from: 60, to: 85, color: '#d97706' }, { from: 85, to: 100, color: '#dc2626' }]} />
    </div>

    <div class="cl-legend">
      <div class="cl-sec-head">Status</div>
      {#each Object.entries(STATUS) as [s, v] (s)}
        <div class="cl-legend-row"><span class="cl-dot" style:background={v.color}></span>{s}</div>
      {/each}
    </div>
  </aside>

  <div class="cl-main">
    <div class="cl-kpis">
      <SvStat label="Booked today" value={mondayAppts.length} hint="appointments" />
      <SvStat label="Utilization" value={`${utilization}%`} hint={utilization >= 85 ? 'near capacity' : utilization >= 60 ? 'healthy' : 'open slots'} />
      <SvStat label="Waitlist" value={waitlist.length} hint="patients waiting" />
      <SvStat label="No-shows" value={noShows} hint="today" />
    </div>

    <div class="cl-toolbar">
      <div class="cl-toolbar-l"><span class="cl-title">Appointments</span><span class="cl-sub">Drag a waitlist patient onto a free slot in a provider's hours</span></div>
      <SvButton variant="primary" size="sm" onclick={newAppointment}>+ New appointment</SvButton>
    </div>

    <div class="cl-cal">
      <SvGrid
        data={boardRows}
        columns={columns}
        getRowId={(r) => String(r.id)}
        containerHeight="100%"
        scheduler={{
          startField: 'start', endField: 'end', titleField: 'patient', colorField: 'color',
          resourceField: 'provider', resources: shownProviders,
          views: ['week', 'day'], initialView: 'day', initialDate: monday, weekStartsOn: 1,
          dayStartHour: 7, dayEndHour: 19,
          restrictToBusinessHours: true, disableConflicts: true,
          unscheduled: waitlist, backlogTitle: 'Waitlist',
          event: apptBody, tooltip: true, editable: true, drawer: true,
          onSchedule, onEventMove, onEventResize, onEventCommit, onEventDelete,
        }}
      />
    </div>

    <details class="cl-table">
      <summary>All appointments this week ({rows.length})</summary>
      <div class="cl-table-grid">
        <SvGrid data={rows} columns={columns} getRowId={(r) => String(r.id)} containerHeight="260px" />
      </div>
    </details>
  </div>
</section>

<style>
  .cl { display: flex; flex: 1 1 auto; min-height: 0; border: 1px solid var(--sg-border, #e5e7eb); border-radius: 12px; overflow: hidden; background: var(--sg-bg, #fff); }
  .cl-nav { flex: 0 0 250px; display: flex; flex-direction: column; min-height: 0; border-right: 1px solid var(--sg-border, #e5e7eb); background: color-mix(in srgb, var(--sg-fg, #1f2937) 3%, transparent); }
  .cl-brand { display: flex; align-items: center; gap: 10px; padding: 14px; border-bottom: 1px solid var(--sg-border, #e5e7eb); }
  .cl-brand-mark { font-size: 20px; width: 34px; height: 34px; display: grid; place-items: center; border-radius: 9px; background: color-mix(in srgb, var(--sg-accent, #4f46e5) 16%, transparent); color: var(--sg-accent, #4f46e5); }
  .cl-brand-name { display: block; font-weight: 700; }
  .cl-brand-sub { display: block; font-size: 0.72rem; color: var(--sg-muted, #6b7280); }
  .cl-search { padding: 10px 12px 4px; }
  .cl-sec-head { display: flex; align-items: center; justify-content: space-between; font-size: 0.68rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; color: var(--sg-muted, #9ca3af); padding: 8px 4px 6px; }
  .cl-sec-count { font-weight: 600; }
  .cl-roster { padding: 4px 12px; overflow-y: auto; flex: 1 1 auto; min-height: 60px; }
  .cl-prov { display: flex; align-items: center; gap: 9px; padding: 6px 6px; border-radius: 8px; cursor: pointer; }
  .cl-prov:hover { background: color-mix(in srgb, var(--sg-fg, #1f2937) 6%, transparent); }
  .cl-prov-off { opacity: 0.5; }
  .cl-prov-txt { display: flex; flex-direction: column; min-width: 0; flex: 1 1 auto; }
  .cl-prov-name { font-size: 0.85rem; font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .cl-prov-spec { font-size: 0.7rem; color: var(--sg-muted, #6b7280); }
  .cl-gaugewrap { display: grid; place-items: center; padding: 6px 12px 12px; border-top: 1px solid var(--sg-border, #e5e7eb); }
  .cl-legend { padding: 4px 14px 14px; display: flex; flex-direction: column; gap: 6px; border-top: 1px solid var(--sg-border, #e5e7eb); }
  .cl-legend-row { display: flex; align-items: center; gap: 8px; font-size: 0.8rem; }
  .cl-dot { width: 10px; height: 10px; border-radius: 3px; flex: none; }
  .cl-main { flex: 1 1 auto; display: flex; flex-direction: column; min-width: 0; min-height: 0; }
  .cl-kpis { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; padding: 12px 14px 4px; }
  .cl-toolbar { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 8px 14px; }
  .cl-toolbar-l { display: flex; flex-direction: column; }
  .cl-title { font-weight: 600; }
  .cl-sub { font-size: 0.76rem; color: var(--sg-muted, #6b7280); }
  .cl-cal { flex: 1 1 auto; min-height: 0; padding: 0 8px; }
  .cl-table { padding: 8px 14px 14px; }
  .cl-table summary { cursor: pointer; font-size: 0.82rem; font-weight: 600; color: var(--sg-muted, #4b5563); padding: 4px 0; }
  .cl-table-grid { margin-top: 8px; }
  .cl-ev { display: flex; flex-direction: column; min-width: 0; line-height: 1.25; }
  .cl-ev-top { display: flex; align-items: center; gap: 5px; }
  .cl-ev-name { font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .cl-ev-status { width: 7px; height: 7px; border-radius: 50%; flex: none; margin-left: auto; }
  .cl-ev-sub { font-size: 0.72em; opacity: 0.85; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
</style>
