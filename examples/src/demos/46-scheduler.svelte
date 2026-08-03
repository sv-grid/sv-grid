<script lang="ts">
  /**
   * 46. Clinic day scheduler (Enterprise Scheduler view)
   * ---------------------------------------------------
   * The same <SvGrid>, rendered as a real calendar by setting one `scheduler`
   * prop: providers become resource columns, appointment rows become events laid
   * out on the hour axis. Drag to reschedule, drag an edge to resize, drag across
   * providers to reassign, click to edit in the built-in drawer; a live now-line
   * ticks. The calendar renderer ships in @svgrid/enterprise.
   *
   * (Previously a hand-rolled timeline; now it uses the first-class Scheduler.)
   */
  import {
    SvGrid,
    type ColumnDef,
    type SchedulerResource,
    type SchedulerEventMoveEvent,
    type SchedulerEventResizeEvent,
    type SchedulerEventCommitEvent,
  } from '@svgrid/grid'
  import { enableSchedulerView, setLicenseKey } from '@svgrid/enterprise'

  setLicenseKey('SVENTERPRISE-DEV-LOCAL')
  enableSchedulerView()

  type ApptType = 'Consult' | 'Procedure' | 'Follow-up' | 'Admin' | 'Break'
  type Appt = { id: number; title: string; provider: string; type: ApptType; patient: string; start: string; end: string; color: string }

  const TYPE: Record<ApptType, string> = {
    Consult: '#4f46e5', Procedure: '#db2777', 'Follow-up': '#0891b2', Admin: '#64748b', Break: '#94a3b8',
  }
  const types = Object.keys(TYPE) as ApptType[]

  type Provider = SchedulerResource & { role: string }
  const providers: Provider[] = [
    { id: 'smith', title: 'Dr. Smith', role: 'Family medicine', color: '#4f46e5' },
    { id: 'jones', title: 'Dr. Jones', role: 'Dermatology', color: '#0891b2' },
    { id: 'lee', title: 'Dr. Lee', role: 'Cardiology', color: '#16a34a' },
    { id: 'okafor', title: 'NP Okafor', role: 'Primary care', color: '#d97706' },
  ]

  const pad = (n: number) => String(n).padStart(2, '0')
  const iso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const at = (h: number, m = 0) => { const d = new Date(today); d.setHours(h, m, 0, 0); return iso(d) }
  const mk = (a: Omit<Appt, 'color'>): Appt => ({ ...a, color: TYPE[a.type] })

  let seq = 100
  let rows = $state<Appt[]>([
    mk({ id: 1, title: 'Annual check', provider: 'smith', type: 'Consult', patient: 'A. Reed', start: at(8, 0), end: at(8, 45) }),
    mk({ id: 2, title: 'Med titration', provider: 'smith', type: 'Follow-up', patient: 'B. Owens', start: at(9, 0), end: at(9, 30) }),
    mk({ id: 3, title: 'Charting', provider: 'smith', type: 'Admin', patient: '-', start: at(10, 0), end: at(10, 30) }),
    mk({ id: 4, title: 'New patient', provider: 'smith', type: 'Consult', patient: 'C. Patel', start: at(11, 0), end: at(11, 45) }),
    mk({ id: 5, title: 'Skin biopsy', provider: 'jones', type: 'Procedure', patient: 'D. Wright', start: at(8, 30), end: at(9, 30) }),
    mk({ id: 6, title: 'Mole screening', provider: 'jones', type: 'Consult', patient: 'E. Lee', start: at(10, 0), end: at(10, 30) }),
    mk({ id: 7, title: 'Lunch', provider: 'jones', type: 'Break', patient: '-', start: at(12, 0), end: at(13, 0) }),
    mk({ id: 8, title: 'ECG', provider: 'lee', type: 'Procedure', patient: 'F. Brooks', start: at(9, 0), end: at(10, 0) }),
    mk({ id: 9, title: 'Post-op follow-up', provider: 'lee', type: 'Follow-up', patient: 'G. Adler', start: at(11, 0), end: at(11, 30) }),
    mk({ id: 10, title: 'Care team huddle', provider: 'lee', type: 'Admin', patient: '-', start: at(13, 30), end: at(14, 0) }),
    mk({ id: 11, title: 'Symptom review', provider: 'okafor', type: 'Consult', patient: 'H. Mason', start: at(8, 15), end: at(9, 0) }),
    mk({ id: 12, title: 'Lab review', provider: 'okafor', type: 'Follow-up', patient: 'I. Cole', start: at(10, 0), end: at(10, 30) }),
    mk({ id: 13, title: 'Infusion', provider: 'okafor', type: 'Procedure', patient: 'J. Ng', start: at(11, 30), end: at(13, 0) }),
    mk({ id: 14, title: 'Initial consult', provider: 'lee', type: 'Consult', patient: 'K. Brooks', start: at(15, 0), end: at(15, 45) }),
  ])

  const columns: ColumnDef<any, Appt>[] = [
    { field: 'title', header: 'Appointment', editorType: 'text', width: 160 },
    { field: 'patient', header: 'Patient', editorType: 'text', width: 120 },
    { field: 'provider', header: 'Provider', editorType: 'list', editorOptions: providers.map((p) => ({ value: p.id, label: p.title ?? p.id, color: p.color })), width: 120 },
    { field: 'type', header: 'Type', editorType: 'list', editorOptions: types.map((t) => ({ value: t, label: t, color: TYPE[t] })), width: 120 },
    { field: 'start', header: 'Start', editorType: 'datetime', width: 150 },
    { field: 'end', header: 'End', editorType: 'datetime', width: 150 },
  ]

  function onEventMove(e: SchedulerEventMoveEvent<Appt>) { e.row.start = iso(e.start); e.row.end = iso(e.end); if (e.toResource != null) e.row.provider = e.toResource }
  function onEventResize(e: SchedulerEventResizeEvent<Appt>) { e.row.start = iso(e.start); e.row.end = iso(e.end) }
  function onEventCommit(e: SchedulerEventCommitEvent<Appt>) { Object.assign(e.row, e.values); e.row.color = TYPE[e.row.type] ?? e.row.color }
  function onEventDelete(row: Appt) { rows = rows.filter((r) => r !== row) }
  function onEventAdd(start: Date, end: Date, resourceId?: string) {
    rows = [...rows, mk({ id: ++seq, title: 'New appointment', provider: resourceId ?? providers[0].id, type: 'Consult', patient: '', start: iso(start), end: iso(end) })]
  }
</script>

{#snippet apptBody(row: Appt)}
  <span class="cs-ev"><span class="cs-ev-t">{row.title}</span>{#if row.patient && row.patient !== '-'}<span class="cs-ev-p">{row.patient}</span>{/if}</span>
{/snippet}

<section class="cs">
  <header class="cs-head">
    <div class="cs-title">Clinic day scheduler</div>
    <div class="cs-legend">
      {#each types as t (t)}<span class="cs-legend-item"><span class="cs-dot" style:background={TYPE[t]}></span>{t}</span>{/each}
    </div>
  </header>
  <div class="cs-cal">
    <SvGrid
      data={rows}
      columns={columns}
      getRowId={(r) => String(r.id)}
      containerHeight="100%"
      scheduler={{
        startField: 'start', endField: 'end', titleField: 'title', colorField: 'color',
        resourceField: 'provider', resources: providers,
        views: ['day', 'week'], initialView: 'day', weekStartsOn: 1,
        dayStartHour: 7, dayEndHour: 20,
        event: apptBody, tooltip: true, editable: true, drawer: true,
        onEventMove, onEventResize, onEventCommit, onEventDelete, onEventAdd,
      }}
    />
  </div>
</section>

<style>
  .cs { display: flex; flex: 1 1 auto; flex-direction: column; min-height: 0; border: 1px solid var(--sg-border, #e5e7eb); border-radius: 12px; overflow: hidden; background: var(--sg-bg, #fff); }
  .cs-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 10px 14px; border-bottom: 1px solid var(--sg-border, #e5e7eb); }
  .cs-title { font-weight: 700; }
  .cs-legend { display: flex; flex-wrap: wrap; gap: 12px; }
  .cs-legend-item { display: flex; align-items: center; gap: 6px; font-size: 0.78rem; color: var(--sg-muted, #6b7280); }
  .cs-dot { width: 10px; height: 10px; border-radius: 3px; }
  .cs-cal { flex: 1 1 auto; min-height: 0; padding: 8px; }
  .cs-ev { display: flex; flex-direction: column; min-width: 0; line-height: 1.2; }
  .cs-ev-t { font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .cs-ev-p { font-size: 0.72em; opacity: 0.85; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
</style>
