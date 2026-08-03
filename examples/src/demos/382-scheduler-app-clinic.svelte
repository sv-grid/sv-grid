<script lang="ts">
  /**
   * 382. Meridian Clinic - a front-desk appointment console (real app)
   * -----------------------------------------------------------------
   * A working front desk, structurally its own thing (not the sibling
   * sidebar + KPI + scheduler + table template):
   *  - LEFT rail: brand, a provider roster you toggle to filter the board,
   *    a utilization gauge, and a status legend.
   *  - CENTER: a KPI strip, a slim toolbar, and the day scheduler grouped by
   *    provider - each doctor's own hours, no double-booking, no booking out of
   *    hours, a drag-in patient waitlist, a drawer and status-coded cards.
   *  - RIGHT panel (the differentiator): a live PATIENT-FLOW pipeline - four
   *    stages (Waiting / Checked in / In room / Completed) whose cards are
   *    $derived from each appointment's status and update as statuses change,
   *    plus a compact waitlist summary.
   */
  import {
    SvGrid,
    SvAvatar,
    SvBadge,
    SvButton,
    SvStat,
    SvGauge,
    SvCheckBox,
    SvEmptyState,
    type ColumnDef,
    type SchedulerResource,
    type SchedulerEventMoveEvent,
    type SchedulerEventResizeEvent,
    type SchedulerEventCommitEvent,
  } from '@svgrid/grid'
  import { enableSchedulerView, setLicenseKey } from '@svgrid/enterprise'

  setLicenseKey('SVENTERPRISE-DEV-LOCAL')
  enableSchedulerView()

  type Status = 'Waiting' | 'Checked in' | 'In room' | 'Completed' | 'No show' | 'Cancelled'
  type Appt = {
    id: number; patient: string; provider: string; type: string; status: Status
    reason: string; phone: string; insurance: string; start: string; end: string; color: string
  }
  type Waiting = { id: string; title: string; durationMin?: number; color?: string }

  const TYPE_COLOR: Record<string, string> = { Consult: '#4f46e5', 'Follow-up': '#0891b2', Procedure: '#db2777', Check: '#16a34a' }
  const STATUS: Record<Status, { color: string; variant: 'neutral' | 'info' | 'success' | 'warning' | 'danger' }> = {
    Waiting: { color: '#d97706', variant: 'warning' },
    'Checked in': { color: '#0891b2', variant: 'info' },
    'In room': { color: '#7c3aed', variant: 'info' },
    Completed: { color: '#16a34a', variant: 'success' },
    'No show': { color: '#dc2626', variant: 'danger' },
    Cancelled: { color: '#94a3b8', variant: 'neutral' },
  }

  // The pipeline stages, in flow order, with their accent colour + badge variant.
  const STAGES: { key: Status; label: string; color: string; variant: 'warning' | 'info' | 'success' }[] = [
    { key: 'Waiting', label: 'Waiting', color: '#d97706', variant: 'warning' },
    { key: 'Checked in', label: 'Checked in', color: '#0891b2', variant: 'info' },
    { key: 'In room', label: 'In room', color: '#7c3aed', variant: 'info' },
    { key: 'Completed', label: 'Completed', color: '#16a34a', variant: 'success' },
  ]

  type Provider = SchedulerResource & { specialty: string }
  const providers: Provider[] = [
    { id: 'Smith', title: 'Dr. Smith', color: '#4f46e5', specialty: 'Family medicine', availability: [{ days: [1, 2, 3, 4, 5], start: 9, end: 13 }] },
    { id: 'Jones', title: 'Dr. Jones', color: '#0891b2', specialty: 'Dermatology', availability: [{ days: [1, 2, 3, 4, 5], start: 8, end: 12 }, { days: [1, 2, 3, 4, 5], start: 13, end: 16 }] },
    { id: 'Lee', title: 'Dr. Lee', color: '#16a34a', specialty: 'Cardiology', availability: [{ days: [1, 3, 5], start: 10, end: 18 }] },
  ]
  const providerTitle = (id: string) => providers.find((p) => p.id === id)?.title ?? id

  const pad = (n: number) => String(n).padStart(2, '0')
  const iso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
  const monday = new Date()
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7))
  monday.setHours(0, 0, 0, 0)
  const at = (day: number, h: number, m = 0) => { const d = new Date(monday); d.setDate(monday.getDate() + day); d.setHours(h, m, 0, 0); return iso(d) }
  const mkColor = (a: Omit<Appt, 'color'>): Appt => ({ ...a, color: TYPE_COLOR[a.type] })

  let seq = 100
  let rows = $state<Appt[]>([
    // Monday - a full front desk: every pipeline stage populated.
    mkColor({ id: 1, patient: 'Amara Rivera', provider: 'Smith', type: 'Consult', status: 'Waiting', reason: 'Persistent cough', phone: '555-0142', insurance: 'Aetna', start: at(0, 9, 0), end: at(0, 9, 30) }),
    mkColor({ id: 2, patient: 'Owen Bradley', provider: 'Smith', type: 'Follow-up', status: 'Checked in', reason: 'BP review', phone: '555-0188', insurance: 'Blue Cross', start: at(0, 9, 30), end: at(0, 10, 0) }),
    mkColor({ id: 3, patient: 'Priya Nair', provider: 'Smith', type: 'Check', status: 'In room', reason: 'Annual physical', phone: '555-0119', insurance: 'UnitedHealth', start: at(0, 10, 30), end: at(0, 11, 15) }),
    mkColor({ id: 4, patient: 'Diego Santos', provider: 'Smith', type: 'Consult', status: 'No show', reason: 'Rash', phone: '555-0173', insurance: 'Cigna', start: at(0, 12, 0), end: at(0, 12, 30) }),
    mkColor({ id: 5, patient: 'Bianca Chen', provider: 'Jones', type: 'Check', status: 'Completed', reason: 'Mole screening', phone: '555-0155', insurance: 'Medicare', start: at(0, 8, 30), end: at(0, 9, 0) }),
    mkColor({ id: 6, patient: 'Ella Nakamura', provider: 'Jones', type: 'Procedure', status: 'Checked in', reason: 'Biopsy', phone: '555-0126', insurance: 'Humana', start: at(0, 9, 30), end: at(0, 10, 30) }),
    mkColor({ id: 7, patient: 'Maya Rossi', provider: 'Jones', type: 'Consult', status: 'In room', reason: 'Psoriasis', phone: '555-0183', insurance: 'Kaiser', start: at(0, 11, 0), end: at(0, 11, 45) }),
    mkColor({ id: 8, patient: 'Tomas Vidal', provider: 'Jones', type: 'Follow-up', status: 'Waiting', reason: 'Eczema check', phone: '555-0198', insurance: 'Self-pay', start: at(0, 13, 30), end: at(0, 14, 0) }),
    mkColor({ id: 9, patient: 'Grace Abara', provider: 'Lee', type: 'Consult', status: 'Checked in', reason: 'Palpitations', phone: '555-0134', insurance: 'Aetna', start: at(0, 10, 30), end: at(0, 11, 30) }),
    mkColor({ id: 10, patient: 'Henry Weber', provider: 'Lee', type: 'Follow-up', status: 'Completed', reason: 'Post-op review', phone: '555-0167', insurance: 'Blue Cross', start: at(0, 13, 0), end: at(0, 13, 45) }),
    mkColor({ id: 11, patient: 'Sofia Marino', provider: 'Lee', type: 'Check', status: 'Waiting', reason: 'ECG', phone: '555-0111', insurance: 'Medicare', start: at(0, 15, 0), end: at(0, 16, 0) }),
    // Rest of the week (visible in Week view) - all upcoming.
    mkColor({ id: 12, patient: 'Ivan Petrov', provider: 'Smith', type: 'Consult', status: 'Waiting', reason: 'Headaches', phone: '555-0102', insurance: 'Cigna', start: at(1, 9, 0), end: at(1, 9, 30) }),
    mkColor({ id: 13, patient: 'Lena Fischer', provider: 'Jones', type: 'Procedure', status: 'Waiting', reason: 'Cyst removal', phone: '555-0144', insurance: 'UnitedHealth', start: at(1, 10, 0), end: at(1, 11, 0) }),
    mkColor({ id: 14, patient: 'Noah Kim', provider: 'Jones', type: 'Follow-up', status: 'Waiting', reason: 'Acne review', phone: '555-0177', insurance: 'Humana', start: at(1, 13, 30), end: at(1, 14, 0) }),
    mkColor({ id: 15, patient: 'Ruben Diaz', provider: 'Smith', type: 'Check', status: 'Waiting', reason: 'Diabetes review', phone: '555-0121', insurance: 'Kaiser', start: at(2, 9, 30), end: at(2, 10, 15) }),
    mkColor({ id: 16, patient: 'Carla Okafor', provider: 'Lee', type: 'Procedure', status: 'Waiting', reason: 'Stress test', phone: '555-0159', insurance: 'Aetna', start: at(2, 10, 30), end: at(2, 11, 30) }),
    mkColor({ id: 17, patient: 'Nadia Haddad', provider: 'Jones', type: 'Consult', status: 'Waiting', reason: 'Rosacea', phone: '555-0165', insurance: 'Blue Cross', start: at(4, 8, 30), end: at(4, 9, 15) }),
    mkColor({ id: 18, patient: 'Felix Wong', provider: 'Lee', type: 'Follow-up', status: 'Waiting', reason: 'Med adjust', phone: '555-0190', insurance: 'Self-pay', start: at(4, 11, 0), end: at(4, 11, 30) }),
  ])
  let waitlist = $state<Waiting[]>([
    { id: 'w1', title: 'Elena Silva - new patient', durationMin: 45, color: '#4f46e5' },
    { id: 'w2', title: 'Frank Novak - lab review', durationMin: 30, color: '#0891b2' },
    { id: 'w3', title: 'Gita Bose - procedure', durationMin: 60, color: '#db2777' },
    { id: 'w4', title: 'Hugo Meyer - check-up', durationMin: 20, color: '#16a34a' },
    { id: 'w5', title: 'Iris Lang - consult', durationMin: 30, color: '#4f46e5' },
  ])

  // --- Interactive filters ---------------------------------------------------
  // Text search is handled by the scheduler's own search box; here we only filter
  // by which providers are toggled on in the left rail.
  let hidden = $state<Record<string, boolean>>({})
  const shownProviders = $derived(providers.filter((p) => !hidden[p.id]))
  const boardRows = $derived(rows.filter((r) => !hidden[r.provider]))

  // --- Today (Monday, the day the board opens on) ----------------------------
  const isMon = (s: string) => s.slice(0, 10) === iso(monday).slice(0, 10)
  const active = (r: Appt) => r.status !== 'Cancelled'
  const mondayAppts = $derived(rows.filter((r) => isMon(r.start) && active(r)))
  const todayCount = (id: string) => rows.filter((r) => isMon(r.start) && r.provider === id && active(r)).length

  // --- KPIs ------------------------------------------------------------------
  const bookedMin = $derived(mondayAppts.reduce((sum, r) => sum + (new Date(r.end).getTime() - new Date(r.start).getTime()) / 60000, 0))
  const capacityMin = $derived(
    providers.reduce((sum, p) => sum + (p.availability ?? []).filter((w) => (w.days ?? [1]).includes(1)).reduce((s, w) => s + (w.end - w.start) * 60, 0), 0),
  )
  const utilization = $derived(capacityMin ? Math.round((bookedMin / capacityMin) * 100) : 0)
  const noShows = $derived(mondayAppts.filter((r) => r.status === 'No show').length)
  const noShowRate = $derived(mondayAppts.length ? Math.round((noShows / mondayAppts.length) * 100) : 0)

  // --- Patient-flow pipeline (derived, respects provider visibility) ---------
  const flowRows = $derived(mondayAppts.filter((r) => !hidden[r.provider]))
  const stageItems = (key: Status) => flowRows.filter((r) => r.status === key)
  const waitingNow = $derived(stageItems('Waiting'))
  // A live average wait: the longer the queue, the longer the wait (in minutes).
  const avgWait = $derived(waitingNow.length ? Math.round(waitingNow.reduce((s, _r, i) => s + 6 + i * 4, 0) / waitingNow.length) : 0)

  const columns: ColumnDef<any, Appt>[] = [
    { field: 'patient', header: 'Patient', editorType: 'text', width: 150 },
    { field: 'reason', header: 'Reason', editorType: 'text', width: 160 },
    { field: 'phone', header: 'Phone', editorType: 'text', width: 110 },
    { field: 'insurance', header: 'Insurance', editorType: 'text', width: 120 },
    { field: 'provider', header: 'Provider', editorType: 'list', editorOptions: providers.map((p) => ({ value: p.id, label: p.title ?? p.id, color: p.color })), width: 120 },
    { field: 'type', header: 'Type', editorType: 'list', editorOptions: Object.keys(TYPE_COLOR).map((t) => ({ value: t, label: t, color: TYPE_COLOR[t] })), width: 120 },
    { field: 'status', header: 'Status', editorType: 'list', editorOptions: (Object.keys(STATUS) as Status[]).map((s) => ({ value: s, label: s, color: STATUS[s].color })), width: 130 },
    { field: 'start', header: 'Start', editorType: 'datetime', width: 150 },
    { field: 'end', header: 'End', editorType: 'datetime', width: 150 },
  ]

  function onSchedule(item: Waiting, start: Date, resourceId?: string) {
    const provider = resourceId ?? shownProviders[0]?.id ?? providers[0].id
    const end = new Date(start.getTime() + (item.durationMin ?? 30) * 60000)
    rows = [...rows, mkColor({ id: ++seq, patient: item.title.split(' - ')[0], provider, type: 'Consult', status: 'Waiting', reason: item.title.split(' - ')[1] ?? '', phone: '', insurance: 'Self-pay', start: iso(start), end: iso(end) })]
    waitlist = waitlist.filter((w) => w.id !== item.id)
  }
  function newAppointment() {
    const provider = shownProviders[0]?.id ?? providers[0].id
    rows = [...rows, mkColor({ id: ++seq, patient: 'New patient', provider, type: 'Consult', status: 'Waiting', reason: '', phone: '', insurance: '', start: at(0, 11, 0), end: at(0, 11, 30) })]
  }
  function onEventMove(e: SchedulerEventMoveEvent<Appt>) { e.row.start = iso(e.start); e.row.end = iso(e.end); if (e.toResource != null) e.row.provider = e.toResource }
  function onEventResize(e: SchedulerEventResizeEvent<Appt>) { e.row.start = iso(e.start); e.row.end = iso(e.end) }
  function onEventCommit(e: SchedulerEventCommitEvent<Appt>) { Object.assign(e.row, e.values); e.row.color = TYPE_COLOR[e.row.type] ?? e.row.color }
  function onEventDelete(row: Appt) { rows = rows.filter((r) => r !== row) }
</script>

{#snippet apptBody(row: Appt)}
  <span class="mc-ev">
    <span class="mc-ev-top"><span class="mc-ev-name">{row.patient}</span><span class="mc-ev-status" style:background={STATUS[row.status].color}></span></span>
    <span class="mc-ev-sub">{row.type} · {row.reason}</span>
  </span>
{/snippet}

<section class="mc">
  <!-- LEFT rail -->
  <aside class="mc-rail">
    <header class="mc-brand"><span class="mc-brand-mark">✚</span><span><span class="mc-brand-name">Meridian Clinic</span><span class="mc-brand-sub">Front desk console</span></span></header>

    <div class="mc-rail-body">
      <div class="mc-roster">
        <div class="mc-sec-head">Providers <span class="mc-sec-count">{shownProviders.length}/{providers.length}</span></div>
        {#each providers as p (p.id)}
          <label class="mc-prov" class:mc-prov-off={hidden[p.id]}>
            <SvCheckBox checked={!hidden[p.id]} onChange={(v) => (hidden = { ...hidden, [p.id]: !v })} ariaLabel={`Show ${p.title}`} />
            <SvAvatar name={p.title} color={p.color} size="sm" />
            <span class="mc-prov-txt"><span class="mc-prov-name">{p.title}</span><span class="mc-prov-spec">{p.specialty}</span></span>
            <SvBadge variant="neutral" size="sm">{todayCount(p.id)}</SvBadge>
          </label>
        {/each}
      </div>

      <div class="mc-gaugewrap">
        <SvGauge value={utilization} min={0} max={100} unit="%" size={110} thickness={11}
          bands={[{ from: 0, to: 60, color: '#16a34a' }, { from: 60, to: 85, color: '#d97706' }, { from: 85, to: 100, color: '#dc2626' }]} />
        <div class="mc-gauge-cap">Chair utilization today</div>
      </div>

      <div class="mc-legend">
        <div class="mc-sec-head">Status legend</div>
        {#each Object.entries(STATUS) as [s, v] (s)}
          <div class="mc-legend-row"><span class="mc-dot" style:background={v.color}></span>{s}</div>
        {/each}
      </div>
    </div>
  </aside>

  <!-- CENTER -->
  <div class="mc-main">
    <div class="mc-kpis">
      <SvStat label="Booked today" value={mondayAppts.length} hint="appointments" />
      <SvStat label="Utilization" value={`${utilization}%`} hint={utilization >= 85 ? 'near capacity' : utilization >= 60 ? 'healthy' : 'open slots'} />
      <SvStat label="Avg wait" value={`${avgWait} min`} hint="in queue" invert />
      <SvStat label="No-show rate" value={`${noShowRate}%`} hint={`${noShows} today`} invert />
    </div>

    <div class="mc-toolbar">
      <div class="mc-toolbar-l">
        <span class="mc-title">Today's schedule</span>
        <span class="mc-sub">Grouped by provider - drag a waitlist patient onto a free slot</span>
      </div>
      <SvButton variant="primary" size="sm" onclick={newAppointment}>+ New appointment</SvButton>
    </div>

    <div class="mc-cal">
      <SvGrid
        data={boardRows}
        columns={columns}
        getRowId={(r) => String(r.id)}
        containerHeight="100%"
        scheduler={{
          startField: 'start', endField: 'end', titleField: 'patient', colorField: 'color',
          resourceField: 'provider', resources: shownProviders,
          views: ['day', 'week'], initialView: 'day', initialDate: monday, weekStartsOn: 1,
          dayStartHour: 7, dayEndHour: 19,
          restrictToBusinessHours: true, disableConflicts: true,
          unscheduled: waitlist, backlogTitle: 'Waitlist',
          event: apptBody, tooltip: true, editable: true, drawer: true,
          onSchedule, onEventMove, onEventResize, onEventCommit, onEventDelete,
        }}
      />
    </div>
  </div>

  <!-- RIGHT panel: the live patient-flow pipeline -->
  <aside class="mc-flow">
    <div class="mc-flow-head">
      <span class="mc-flow-title">Patient flow</span>
      <span class="mc-flow-sub">Live, {flowRows.length} in clinic today</span>
    </div>

    <div class="mc-flow-body">
      {#each STAGES as stage (stage.key)}
        {@const items = stageItems(stage.key)}
        <div class="mc-stage" style:--mc-stage-color={stage.color}>
          <div class="mc-stage-head">
            <span class="mc-stage-name">{stage.label}</span>
            <SvBadge variant={stage.variant} size="sm">{items.length}</SvBadge>
          </div>
          {#if items.length === 0}
            <div class="mc-stage-empty">No patients {stage.label.toLowerCase()}</div>
          {:else}
            <div class="mc-stage-list">
              {#each items as r (r.id)}
                <div class="mc-pt">
                  <span class="mc-pt-dot" style:background={r.color}></span>
                  <span class="mc-pt-txt">
                    <span class="mc-pt-name">{r.patient}</span>
                    <span class="mc-pt-meta">{providerTitle(r.provider)} · {r.reason}</span>
                  </span>
                </div>
              {/each}
            </div>
          {/if}
        </div>
      {/each}
    </div>

    <div class="mc-wl">
      <div class="mc-wl-head">
        <span class="mc-wl-title">Waitlist</span>
        <SvBadge variant="warning" size="sm">{waitlist.length}</SvBadge>
      </div>
      {#if waitlist.length === 0}
        <SvEmptyState compact title="Waitlist clear" description="Every patient has a slot." />
      {:else}
        <div class="mc-wl-list">
          {#each waitlist as w (w.id)}
            <div class="mc-wl-item">
              <span class="mc-wl-dot" style:background={w.color}></span>
              <span class="mc-wl-name">{w.title}</span>
              <span class="mc-wl-dur">{w.durationMin}m</span>
            </div>
          {/each}
        </div>
        <div class="mc-wl-hint">Drag a name onto the board to book it.</div>
      {/if}
    </div>
  </aside>
</section>

<style>
  .mc { display: flex; flex: 1 1 auto; min-height: 0; border: 1px solid var(--sg-border, #e5e7eb); border-radius: 12px; overflow: hidden; background: var(--sg-bg, #fff); color: var(--sg-fg, #1f2937); }

  /* LEFT rail */
  .mc-rail { flex: 0 0 220px; display: flex; flex-direction: column; min-height: 0; border-right: 1px solid var(--sg-border, #e5e7eb); background: color-mix(in srgb, var(--sg-fg, #1f2937) 3%, transparent); }
  .mc-brand { display: flex; align-items: center; gap: 10px; padding: 14px; border-bottom: 1px solid var(--sg-border, #e5e7eb); }
  .mc-brand-mark { font-size: 18px; width: 32px; height: 32px; display: grid; place-items: center; border-radius: 9px; background: color-mix(in srgb, var(--sg-accent, #4f46e5) 16%, transparent); color: var(--sg-accent, #4f46e5); }
  .mc-brand-name { display: block; font-weight: 700; font-size: 0.92rem; }
  .mc-brand-sub { display: block; font-size: 0.7rem; color: var(--sg-muted, #6b7280); }
  .mc-rail-body { display: flex; flex-direction: column; min-height: 0; flex: 1 1 auto; overflow-y: auto; }
  .mc-sec-head { display: flex; align-items: center; justify-content: space-between; font-size: 0.66rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: var(--sg-muted, #9ca3af); padding: 10px 4px 6px; }
  .mc-sec-count { font-weight: 600; }
  .mc-roster { padding: 4px 12px; }
  .mc-prov { display: flex; align-items: center; gap: 9px; padding: 6px; border-radius: 8px; cursor: pointer; transition: background 0.12s; }
  .mc-prov:hover { background: color-mix(in srgb, var(--sg-fg, #1f2937) 6%, transparent); }
  .mc-prov-off { opacity: 0.5; }
  .mc-prov-txt { display: flex; flex-direction: column; min-width: 0; flex: 1 1 auto; }
  .mc-prov-name { font-size: 0.82rem; font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .mc-prov-spec { font-size: 0.68rem; color: var(--sg-muted, #6b7280); }
  .mc-gaugewrap { display: grid; place-items: center; padding: 10px 12px 14px; margin-top: 4px; border-top: 1px solid var(--sg-border, #e5e7eb); }
  .mc-gauge-cap { margin-top: 4px; font-size: 0.72rem; font-weight: 600; color: var(--sg-muted, #6b7280); text-align: center; }
  .mc-legend { padding: 4px 14px 14px; display: flex; flex-direction: column; gap: 6px; border-top: 1px solid var(--sg-border, #e5e7eb); }
  .mc-legend-row { display: flex; align-items: center; gap: 8px; font-size: 0.78rem; }
  .mc-dot { width: 10px; height: 10px; border-radius: 3px; flex: none; }

  /* CENTER */
  .mc-main { flex: 1 1 auto; display: flex; flex-direction: column; min-width: 0; min-height: 0; }
  .mc-kpis { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; padding: 8px 14px 4px; }
  .mc-kpis :global(.sv-stat) { padding: 7px 12px !important; gap: 2px !important; border-radius: 9px !important; }
  .mc-kpis :global(.sv-stat__value) { font-size: 18px !important; }
  .mc-kpis :global(.sv-stat__label) { font-size: 11px !important; }
  .mc-kpis :global(.sv-stat__foot) { font-size: 11px !important; }
  .mc-toolbar { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 6px 14px; }
  .mc-toolbar-l { display: flex; flex-direction: column; min-width: 0; }
  .mc-title { font-weight: 600; }
  .mc-sub { font-size: 0.74rem; color: var(--sg-muted, #6b7280); }
  .mc-cal { flex: 1 1 auto; min-height: 0; padding: 0 8px 8px; }

  /* Scheduler event card */
  .mc-ev { display: flex; flex-direction: column; min-width: 0; line-height: 1.25; }
  .mc-ev-top { display: flex; align-items: center; gap: 5px; }
  .mc-ev-name { font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .mc-ev-status { width: 7px; height: 7px; border-radius: 50%; flex: none; margin-left: auto; }
  .mc-ev-sub { font-size: 0.72em; opacity: 0.85; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

  /* RIGHT panel: patient flow */
  .mc-flow { flex: 0 0 260px; display: flex; flex-direction: column; min-height: 0; border-left: 1px solid var(--sg-border, #e5e7eb); background: color-mix(in srgb, var(--sg-fg, #1f2937) 2%, transparent); }
  .mc-flow-head { padding: 14px 14px 10px; border-bottom: 1px solid var(--sg-border, #e5e7eb); }
  .mc-flow-title { display: block; font-weight: 700; font-size: 0.92rem; }
  .mc-flow-sub { display: block; font-size: 0.72rem; color: var(--sg-muted, #6b7280); margin-top: 2px; }
  .mc-flow-body { flex: 1 1 auto; overflow-y: auto; padding: 12px; display: flex; flex-direction: column; gap: 10px; }
  .mc-stage { border: 1px solid var(--sg-border, #e5e7eb); border-left: 3px solid var(--mc-stage-color, #94a3b8); border-radius: 9px; background: var(--sg-bg, #fff); padding: 9px 10px; }
  .mc-stage-head { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 6px; }
  .mc-stage-name { font-size: 0.78rem; font-weight: 700; color: var(--mc-stage-color, #334155); }
  .mc-stage-empty { font-size: 0.72rem; color: var(--sg-muted, #9ca3af); font-style: italic; padding: 2px 0 4px; }
  .mc-stage-list { display: flex; flex-direction: column; gap: 5px; }
  .mc-pt { display: flex; align-items: flex-start; gap: 7px; padding: 5px 6px; border-radius: 7px; transition: background 0.12s; }
  .mc-pt:hover { background: color-mix(in srgb, var(--mc-stage-color, #64748b) 10%, transparent); }
  .mc-pt-dot { width: 8px; height: 8px; border-radius: 50%; flex: none; margin-top: 4px; }
  .mc-pt-txt { display: flex; flex-direction: column; min-width: 0; }
  .mc-pt-name { font-size: 0.8rem; font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .mc-pt-meta { font-size: 0.68rem; color: var(--sg-muted, #6b7280); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

  /* RIGHT panel: waitlist summary */
  .mc-wl { border-top: 1px solid var(--sg-border, #e5e7eb); padding: 12px 14px 14px; flex: none; }
  .mc-wl-head { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 8px; }
  .mc-wl-title { font-size: 0.7rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: var(--sg-muted, #9ca3af); }
  .mc-wl-list { display: flex; flex-direction: column; gap: 4px; }
  .mc-wl-item { display: flex; align-items: center; gap: 7px; font-size: 0.78rem; padding: 3px 0; }
  .mc-wl-dot { width: 8px; height: 8px; border-radius: 50%; flex: none; }
  .mc-wl-name { flex: 1 1 auto; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .mc-wl-dur { font-size: 0.7rem; color: var(--sg-muted, #6b7280); flex: none; }
  .mc-wl-hint { margin-top: 8px; font-size: 0.7rem; color: var(--sg-muted, #9ca3af); font-style: italic; }
</style>
