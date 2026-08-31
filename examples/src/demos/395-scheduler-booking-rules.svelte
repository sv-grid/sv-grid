<script lang="ts">
  /**
   * 395. Booking rules - buffers, lead time, duration (Enterprise Scheduler Pro)
   * ---------------------------------------------------------------------------
   * A salon day where every appointment needs a 15-minute cleanup BUFFER around it,
   * must be booked at least an hour ahead (lead time), and runs 30-90 minutes. Drag
   * an appointment back-to-back with another and it snaps back with the reason; the
   * same rules gate creating and resizing. Renderer ships in @svgrid/enterprise.
   */
  import { SvGrid, type ColumnDef, type SchedulerResource, type SchedulerEventMoveEvent, type SchedulerEventResizeEvent, type SchedulerEventCommitEvent } from '@svgrid/grid'
  import { enableSchedulerView, setLicenseKey, type SchedulerProConfig } from '@svgrid/enterprise'

  setLicenseKey('SVENTERPRISE-DEV-LOCAL')
  enableSchedulerView()

  const stylists: SchedulerResource[] = [
    { id: 'mia', title: 'Mia', color: '#7c3aed' },
    { id: 'raj', title: 'Raj', color: '#0891b2' },
    { id: 'noa', title: 'Noa', color: '#db2777' },
  ]
  const svcColor: Record<string, string> = { Cut: '#7c3aed', Colour: '#db2777', Style: '#0891b2', Treatment: '#16a34a' }
  const services = Object.keys(svcColor)

  type Appt = { id: string; title: string; service: string; client: string; stylist: string; start: string; end: string; color: string }
  const pad = (n: number) => String(n).padStart(2, '0')
  const iso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const at = (h: number, m = 0) => { const d = new Date(today); d.setHours(h, m, 0, 0); return iso(d) }
  const mk = (a: Omit<Appt, 'color'>): Appt => ({ ...a, color: svcColor[a.service] ?? '#64748b' })

  let seq = 100
  let rows = $state<Appt[]>([
    mk({ id: 'a1', title: 'Cut', service: 'Cut', client: 'A. Reed', stylist: 'mia', start: at(10), end: at(10, 45) }),
    mk({ id: 'a2', title: 'Colour', service: 'Colour', client: 'B. Owens', stylist: 'mia', start: at(11, 30), end: at(12, 45) }),
    mk({ id: 'a3', title: 'Style', service: 'Style', client: 'C. Patel', stylist: 'raj', start: at(10, 30), end: at(11, 15) }),
    mk({ id: 'a4', title: 'Cut', service: 'Cut', client: 'D. Wright', stylist: 'raj', start: at(13), end: at(13, 45) }),
    mk({ id: 'a5', title: 'Treatment', service: 'Treatment', client: 'E. Lee', stylist: 'noa', start: at(11), end: at(12) }),
    mk({ id: 'a6', title: 'Cut', service: 'Cut', client: 'F. Brooks', stylist: 'noa', start: at(14), end: at(14, 45) }),
  ])

  const columns: ColumnDef<any, Appt>[] = [
    { field: 'title', header: 'Service', editorType: 'list', editorOptions: services.map((s) => ({ value: s, label: s, color: svcColor[s] })), width: 130 },
    { field: 'client', header: 'Client', editorType: 'text', width: 120 },
    { field: 'stylist', header: 'Stylist', editorType: 'list', editorOptions: stylists.map((s) => ({ value: s.id, label: s.title ?? s.id, color: s.color })), width: 110 },
    { field: 'start', header: 'Start', editorType: 'datetime', width: 150 },
    { field: 'end', header: 'End', editorType: 'datetime', width: 150 },
  ]

  function onEventMove(e: SchedulerEventMoveEvent<Appt>) { e.row.start = iso(e.start); e.row.end = iso(e.end); if (e.toResource != null) e.row.stylist = e.toResource }
  function onEventResize(e: SchedulerEventResizeEvent<Appt>) { e.row.start = iso(e.start); e.row.end = iso(e.end) }
  function onEventCommit(e: SchedulerEventCommitEvent<Appt>) { Object.assign(e.row, e.values); e.row.color = svcColor[e.row.service] ?? e.row.color }
  function onEventAdd(start: Date, end: Date, resourceId?: string) {
    rows = [...rows, mk({ id: `a${++seq}`, title: 'Cut', service: 'Cut', client: '', stylist: resourceId ?? stylists[0].id, start: iso(start), end: iso(end) })]
  }
  function onEventDelete(row: Appt) { rows = rows.filter((r) => r !== row) }

  let view = $state<'timeline' | 'table'>('timeline')

  const schedulerCfg: SchedulerProConfig<any, Appt> = {
    startField: 'start', endField: 'end', titleField: 'title', colorField: 'color',
    resourceField: 'stylist', resources: stylists,
    // Booking rules: 15-min cleanup buffer, 1h min notice, 30-90 min appointments.
    bufferBeforeMin: 15, bufferAfterMin: 15,
    minLeadMin: 60, minDurationMin: 30, maxDurationMin: 90,
    views: ['timelineDay'], initialView: 'timelineDay',
    businessHours: { start: 9, end: 18 }, dayStartHour: 9, dayEndHour: 18, timelineTickMinWidth: 110, timelineLaneHeight: 26,
    editable: true, tooltip: true, drawer: true,
    onEventMove, onEventResize, onEventCommit, onEventAdd, onEventDelete,
  }
</script>

<section class="bk">
  <header class="bk-head">
    <div class="bk-title">
      <strong>Salon day</strong>
      <span class="bk-sub">15-min buffer around every appointment, 1h min notice, 30-90 min - try dragging two back-to-back</span>
    </div>
    <div class="bk-seg" role="tablist" aria-label="View">
      <button class="bk-seg-btn" role="tab" aria-selected={view === 'timeline'} class:bk-on={view === 'timeline'} onclick={() => (view = 'timeline')}>Timeline</button>
      <button class="bk-seg-btn" role="tab" aria-selected={view === 'table'} class:bk-on={view === 'table'} onclick={() => (view = 'table')}>Table</button>
    </div>
  </header>
  <div class="bk-body">
    {#if view === 'timeline'}
      <SvGrid data={rows} columns={columns} getRowId={(r) => r.id} containerHeight="100%" scheduler={schedulerCfg} />
    {:else}
      <SvGrid data={rows} columns={columns} getRowId={(r) => r.id} containerHeight="100%" editable />
    {/if}
  </div>
</section>

<style>
  .bk { display: flex; flex: 1 1 auto; flex-direction: column; min-height: 0; border: 1px solid var(--sg-border, #e5e7eb); border-radius: 12px; overflow: hidden; background: var(--sg-bg, #fff); }
  .bk-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 10px 14px; border-bottom: 1px solid var(--sg-border, #e5e7eb); }
  .bk-title { display: flex; flex-direction: column; gap: 2px; }
  .bk-sub { font-size: 0.78rem; color: var(--sg-muted, #6b7280); }
  .bk-seg { display: inline-flex; border: 1px solid var(--sg-border, #e5e7eb); border-radius: 8px; overflow: hidden; }
  .bk-seg-btn { border: 0; background: var(--sg-bg, #fff); color: var(--sg-muted, #6b7280); font: inherit; font-size: 0.82rem; padding: 5px 12px; cursor: pointer; }
  .bk-seg-btn.bk-on { background: var(--sg-accent, #4f46e5); color: var(--sg-on-accent, #fff); }
  .bk-body { flex: 1 1 auto; min-height: 0; padding: 8px; }
</style>
