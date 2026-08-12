<script lang="ts">
  /**
   * 396. Bookable slots / find-a-time (Enterprise Scheduler Pro)
   * -----------------------------------------------------------
   * A booking page, Calendly-style: pick a service (which sets the duration) and
   * the scheduler lights up every OPEN slot on each provider - the free time left
   * after existing appointments, each provider's own hours, and a 10-min cleanup
   * buffer. Click a slot to book it. The same grid rows power the Table. Renderer
   * ships in @svgrid/enterprise.
   */
  import { SvGrid, type ColumnDef, type SchedulerResource, type SchedulerEventMoveEvent, type SchedulerEventResizeEvent } from '@svgrid/grid'
  import { enableSchedulerView, setLicenseKey, type SchedulerProConfig } from '@svgrid/enterprise'

  setLicenseKey('SVENTERPRISE-DEV-LOCAL')
  enableSchedulerView()

  type Prov = SchedulerResource & { availability: { start: number; end: number }[] }
  const providers: Prov[] = [
    { id: 'ada', title: 'Dr. Ada', color: '#4f46e5', availability: [{ start: 9, end: 13 }, { start: 14, end: 17 }] }, // lunch 13-14
    { id: 'ben', title: 'Dr. Ben', color: '#0891b2', availability: [{ start: 10, end: 16 }] },
    { id: 'cara', title: 'Dr. Cara', color: '#16a34a', availability: [{ start: 8, end: 12 }] }, // mornings only
  ]

  const SERVICES = [
    { name: 'Consult', dur: 30, color: '#4f46e5' },
    { name: 'Cleaning', dur: 60, color: '#0891b2' },
    { name: 'Whitening', dur: 90, color: '#db2777' },
  ]
  let svc = $state(SERVICES[0])

  type Appt = { id: string; title: string; provider: string; client: string; start: string; end: string; color: string }
  const pad = (n: number) => String(n).padStart(2, '0')
  const iso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const at = (h: number, m = 0) => { const d = new Date(today); d.setHours(h, m, 0, 0); return iso(d) }

  let seq = 100
  let rows = $state<Appt[]>([
    { id: 'p1', title: 'Consult', provider: 'ada', client: 'A. Reed', start: at(9), end: at(9, 30), color: '#4f46e5' },
    { id: 'p2', title: 'Cleaning', provider: 'ada', client: 'B. Owens', start: at(11), end: at(12), color: '#0891b2' },
    { id: 'p3', title: 'Whitening', provider: 'ben', client: 'C. Patel', start: at(10, 30), end: at(12), color: '#db2777' },
    { id: 'p4', title: 'Consult', provider: 'cara', client: 'D. Wright', start: at(9), end: at(9, 30), color: '#4f46e5' },
  ])

  const columns: ColumnDef<any, Appt>[] = [
    { field: 'title', header: 'Service', editorType: 'text', width: 130 },
    { field: 'client', header: 'Client', editorType: 'text', width: 120 },
    { field: 'provider', header: 'Provider', editorType: 'list', editorOptions: providers.map((p) => ({ value: p.id, label: p.title ?? p.id, color: p.color })), width: 110 },
    { field: 'start', header: 'Start', editorType: 'datetime', width: 150 },
    { field: 'end', header: 'End', editorType: 'datetime', width: 150 },
  ]

  let patient = $state('Jordan Ellis')
  let lastBooked = $state('')
  function onSlotPick(start: Date, end: Date, resourceId?: string) {
    const prov = providers.find((p) => p.id === resourceId)
    const name = patient.trim() || 'New patient'
    rows = [...rows, { id: `p${++seq}`, title: svc.name, provider: resourceId ?? providers[0].id, client: name, start: iso(start), end: iso(end), color: svc.color }]
    lastBooked = `${svc.name} for ${name} with ${prov?.title ?? resourceId} at ${pad(start.getHours())}:${pad(start.getMinutes())}`
  }
  function onEventMove(e: SchedulerEventMoveEvent<Appt>) { e.row.start = iso(e.start); e.row.end = iso(e.end); if (e.toResource != null) e.row.provider = e.toResource }
  function onEventResize(e: SchedulerEventResizeEvent<Appt>) { e.row.start = iso(e.start); e.row.end = iso(e.end) }

  let view = $state<'timeline' | 'table'>('timeline')

  const schedulerCfg: SchedulerProConfig<any, Appt> = $derived({
    startField: 'start', endField: 'end', titleField: 'title', colorField: 'color',
    resourceField: 'provider', resources: providers,
    bookable: { durationMin: svc.dur, stepMin: 30 },
    bufferAfterMin: 10,
    onSlotPick,
    views: ['timelineDay'], initialView: 'timelineDay',
    businessHours: { start: 8, end: 18 }, dayStartHour: 8, dayEndHour: 18, timelineTickMinWidth: 96, timelineLaneHeight: 30,
    // A booking page: the open slots ARE the interaction, so no cell range-select
    // or event multi-select (which would compete with the slots visually).
    rangeSelectable: false, eventSelectable: false,
    event: apptBody, editable: true, tooltip: true, drawer: true,
    onEventMove, onEventResize,
  })
</script>

{#snippet apptBody(row: Appt)}
  <span class="bs-ev"><span class="bs-ev-t">{row.title}</span>{#if row.client}<span class="bs-ev-c">{row.client}</span>{/if}</span>
{/snippet}

<section class="bs">
  <header class="bs-head">
    <div class="bs-title">
      <strong>Book an appointment</strong>
      <span class="bs-sub">Enter a name, pick a service, then click an open (+) slot on any provider</span>
    </div>
    <div class="bs-seg" role="tablist" aria-label="View">
      <button class="bs-seg-btn" role="tab" aria-selected={view === 'timeline'} class:bs-on2={view === 'timeline'} onclick={() => (view = 'timeline')}>Timeline</button>
      <button class="bs-seg-btn" role="tab" aria-selected={view === 'table'} class:bs-on2={view === 'table'} onclick={() => (view = 'table')}>Table</button>
    </div>
  </header>
  <div class="bs-bar">
    <label class="bs-field"><span class="bs-field-l">Patient</span><input class="bs-input" bind:value={patient} placeholder="Patient name" /></label>
    <div class="bs-svc" role="group" aria-label="Service">
      {#each SERVICES as s (s.name)}
        <button class="bs-svc-btn" class:bs-on={svc.name === s.name} onclick={() => (svc = s)}><span class="bs-dot" style:background={s.color}></span>{s.name} · {s.dur}m</button>
      {/each}
    </div>
    {#if lastBooked}<span class="bs-booked">✓ {lastBooked}</span>{/if}
  </div>
  <div class="bs-body">
    {#if view === 'timeline'}
      <SvGrid data={rows} columns={columns} getRowId={(r) => r.id} containerHeight="100%" scheduler={schedulerCfg} />
    {:else}
      <SvGrid data={rows} columns={columns} getRowId={(r) => r.id} containerHeight="100%" editable showPagination={false} />
    {/if}
  </div>
</section>

<style>
  .bs { display: flex; flex: 1 1 auto; flex-direction: column; min-height: 0; border: 1px solid var(--sg-border, #e5e7eb); border-radius: 12px; overflow: hidden; background: var(--sg-bg, #fff); }
  .bs-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 10px 14px; border-bottom: 1px solid var(--sg-border, #e5e7eb); flex-wrap: wrap; }
  .bs-title { display: flex; flex-direction: column; gap: 2px; }
  .bs-sub { font-size: 0.78rem; color: var(--sg-muted, #6b7280); }
  .bs-bar { display: flex; align-items: center; gap: 14px; padding: 8px 14px; border-bottom: 1px solid var(--sg-border, #e5e7eb); flex-wrap: wrap; }
  .bs-field { display: flex; align-items: center; gap: 7px; }
  .bs-field-l { font-size: 0.78rem; color: var(--sg-muted, #6b7280); }
  .bs-input { border: 1px solid var(--sg-border, #e5e7eb); border-radius: 7px; background: var(--sg-bg, #fff); color: inherit; font: inherit; font-size: 0.82rem; padding: 4px 9px; width: 150px; }
  .bs-input:focus { outline: none; border-color: var(--sg-accent, #4f46e5); }
  .bs-svc { display: inline-flex; gap: 6px; flex-wrap: wrap; }
  .bs-svc-btn { display: flex; align-items: center; gap: 6px; border: 1px solid var(--sg-border, #e5e7eb); border-radius: 999px; background: var(--sg-bg, #fff); color: inherit; font: inherit; font-size: 0.8rem; padding: 4px 12px; cursor: pointer; }
  .bs-svc-btn.bs-on { border-color: var(--sg-accent, #4f46e5); color: var(--sg-accent, #4f46e5); font-weight: 600; }
  .bs-dot { width: 9px; height: 9px; border-radius: 3px; }
  .bs-booked { margin-left: auto; font-size: 0.8rem; font-weight: 600; color: #16a34a; }
  .bs-seg { display: inline-flex; border: 1px solid var(--sg-border, #e5e7eb); border-radius: 8px; overflow: hidden; }
  .bs-seg-btn { border: 0; background: var(--sg-bg, #fff); color: var(--sg-muted, #6b7280); font: inherit; font-size: 0.82rem; padding: 5px 12px; cursor: pointer; }
  .bs-seg-btn.bs-on2 { background: var(--sg-accent, #4f46e5); color: #fff; }
  .bs-body { flex: 1 1 auto; min-height: 0; padding: 8px; }
  .bs-ev { display: flex; flex-direction: column; min-width: 0; line-height: 1.15; }
  .bs-ev-t { font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .bs-ev-c { font-size: 0.72em; opacity: 0.85; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
</style>
