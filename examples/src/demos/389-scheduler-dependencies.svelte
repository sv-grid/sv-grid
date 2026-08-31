<script lang="ts">
  /**
   * 389. Sequenced bookings (Enterprise Scheduler Pro)
   * --------------------------------------------------
   * A service centre where a job flows through stations IN ORDER - a car can't be
   * washed before it's repaired. Bookings are linked so a step can only start once
   * the one it depends on finishes; drag or resize a booking and the steps that
   * follow slide forward to stay legal (respecting opening hours). Dependencies are
   * an OPTIONAL convenience for ordered bookings - the Scheduler is a resource
   * scheduler, not a project planner. Toggle to the Table - same grid rows, a view.
   */
  import { SvGrid, type ColumnDef, type SchedulerResource, type SchedulerEventMoveEvent, type SchedulerEventResizeEvent } from '@svgrid/grid'
  import { enableSchedulerView, setLicenseKey, type SchedulerProConfig, type SchedulerDependency } from '@svgrid/enterprise'

  setLicenseKey('SVENTERPRISE-DEV-LOCAL')
  enableSchedulerView()

  type Job = { id: string; title: string; station: string; vehicle: string; start: string; end: string; color: string }

  const stations: SchedulerResource[] = [
    { id: 'intake', title: 'Intake', color: '#7c3aed' },
    { id: 'diag', title: 'Diagnostics', color: '#db2777' },
    { id: 'repair', title: 'Repair bay', color: '#2563eb' },
    { id: 'paint', title: 'Paint & body', color: '#0891b2' },
    { id: 'handover', title: 'Handover', color: '#16a34a' },
  ]
  const stationColor = Object.fromEntries(stations.map((s) => [s.id, s.color!]))

  const pad = (n: number) => String(n).padStart(2, '0')
  const iso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
  // Monday of the current week.
  const base = new Date(); base.setHours(0, 0, 0, 0); base.setDate(base.getDate() - ((base.getDay() + 6) % 7))
  const at = (dayOffset: number, h = 9) => { const d = new Date(base); d.setDate(d.getDate() + dayOffset); d.setHours(h, 0, 0, 0); return iso(d) }
  const mk = (j: Omit<Job, 'color'>): Job => ({ ...j, color: stationColor[j.station] ?? '#64748b' })

  const VEHICLE = 'Blue sedan · ABC-123'
  let rows = $state<Job[]>([
    mk({ id: 's1', title: 'Check-in & intake', station: 'intake', vehicle: VEHICLE, start: at(0), end: at(0, 17) }),
    mk({ id: 's2', title: 'Diagnostics', station: 'diag', vehicle: VEHICLE, start: at(1), end: at(1, 17) }),
    mk({ id: 's3', title: 'Parts & estimate', station: 'diag', vehicle: VEHICLE, start: at(2), end: at(2, 17) }),
    mk({ id: 's4', title: 'Mechanical repair', station: 'repair', vehicle: VEHICLE, start: at(3), end: at(3, 17) }),
    mk({ id: 's5', title: 'Body & paint', station: 'paint', vehicle: VEHICLE, start: at(1), end: at(2, 17) }),
    mk({ id: 's6', title: 'Reassembly & road test', station: 'repair', vehicle: VEHICLE, start: at(4), end: at(4, 17) }),
    mk({ id: 's7', title: 'Wash & detail', station: 'paint', vehicle: VEHICLE, start: at(5), end: at(5, 17) }),
    mk({ id: 's8', title: 'Handover to customer', station: 'handover', vehicle: VEHICLE, start: at(6), end: at(6, 17) }),
  ])

  // Ordering links (finish-to-start). Repair + body work both feed reassembly (a diamond).
  const dependencies: SchedulerDependency[] = [
    { id: 'd1', from: 's1', to: 's2', type: 'FS' },
    { id: 'd2', from: 's2', to: 's3', type: 'FS' },
    { id: 'd3', from: 's3', to: 's4', type: 'FS' },
    { id: 'd4', from: 's1', to: 's5', type: 'FS' },
    { id: 'd5', from: 's4', to: 's6', type: 'FS' },
    { id: 'd6', from: 's5', to: 's6', type: 'FS' },
    { id: 'd7', from: 's6', to: 's7', type: 'FS' },
    { id: 'd8', from: 's7', to: 's8', type: 'FS' },
  ]

  const columns: ColumnDef<any, Job>[] = [
    { field: 'title', header: 'Step', editorType: 'text', width: 170 },
    { field: 'station', header: 'Station', editorType: 'list', editorOptions: stations.map((s) => ({ value: s.id, label: s.title ?? s.id, color: s.color })), width: 130 },
    { field: 'vehicle', header: 'Vehicle', editorType: 'text', width: 150 },
    { field: 'start', header: 'Start', editorType: 'datetime', width: 150 },
    { field: 'end', header: 'End', editorType: 'datetime', width: 150 },
  ]

  const byId = (id: string) => rows.find((r) => r.id === id)
  function onEventMove(e: SchedulerEventMoveEvent<Job>) { e.row.start = iso(e.start); e.row.end = iso(e.end); if (e.toResource != null) e.row.station = e.toResource }
  function onEventResize(e: SchedulerEventResizeEvent<Job>) { e.row.start = iso(e.start); e.row.end = iso(e.end) }
  // Persist the cascaded shifts so the dependent steps stick where they slid.
  let lastCascade = $state(0)
  function onDependenciesChange(moves: Array<{ id: string; start: Date; end: Date }>) {
    for (const m of moves) { const r = byId(m.id); if (r) { r.start = iso(m.start); r.end = iso(m.end) } }
    lastCascade = moves.length
  }

  let view = $state<'timeline' | 'table'>('timeline')

  const schedulerCfg: SchedulerProConfig<any, Job> = {
    startField: 'start', endField: 'end', titleField: 'title', colorField: 'color',
    resourceField: 'station', resources: stations,
    views: ['timelineWeek', 'timelineMonth'], initialView: 'timelineWeek', weekStartsOn: 1,
    businessHours: { start: 9, end: 17 },
    editable: true, tooltip: true, drawer: true,
    dependencies, autoReschedule: true, dependencyRespectWorkingTime: true,
    onEventMove, onEventResize, onDependenciesChange,
  }
</script>

<section class="pj">
  <header class="pj-head">
    <div class="pj-title">
      <strong>Service workflow</strong>
      <span class="pj-sub">Drag a booking - the steps that depend on it slide forward automatically</span>
    </div>
    <div class="pj-right">
      {#if lastCascade > 0}<span class="pj-badge">Rescheduled {lastCascade} step{lastCascade === 1 ? '' : 's'}</span>{/if}
      <div class="pj-seg" role="tablist" aria-label="View">
        <button class="pj-seg-btn" role="tab" aria-selected={view === 'timeline'} class:pj-on={view === 'timeline'} onclick={() => (view = 'timeline')}>Timeline</button>
        <button class="pj-seg-btn" role="tab" aria-selected={view === 'table'} class:pj-on={view === 'table'} onclick={() => (view = 'table')}>Table</button>
      </div>
    </div>
  </header>

  <div class="pj-body">
    {#if view === 'timeline'}
      <SvGrid data={rows} columns={columns} getRowId={(r) => r.id} containerHeight="100%" scheduler={schedulerCfg} />
    {:else}
      <SvGrid data={rows} columns={columns} getRowId={(r) => r.id} containerHeight="100%" editable />
    {/if}
  </div>
</section>

<style>
  .pj { display: flex; flex: 1 1 auto; flex-direction: column; min-height: 0; border: 1px solid var(--sg-border, #e5e7eb); border-radius: 12px; overflow: hidden; background: var(--sg-bg, #fff); }
  .pj-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 10px 14px; border-bottom: 1px solid var(--sg-border, #e5e7eb); }
  .pj-title { display: flex; flex-direction: column; gap: 2px; }
  .pj-sub { font-size: 0.78rem; color: var(--sg-muted, #6b7280); }
  .pj-right { display: flex; align-items: center; gap: 10px; }
  .pj-badge { font-size: 0.74rem; font-weight: 600; color: #16a34a; background: color-mix(in srgb, #16a34a 12%, transparent); padding: 3px 8px; border-radius: 999px; }
  .pj-seg { display: inline-flex; border: 1px solid var(--sg-border, #e5e7eb); border-radius: 8px; overflow: hidden; }
  .pj-seg-btn { border: 0; background: var(--sg-bg, #fff); color: var(--sg-muted, #6b7280); font: inherit; font-size: 0.82rem; padding: 5px 12px; cursor: pointer; }
  .pj-seg-btn.pj-on { background: var(--sg-accent, #4f46e5); color: var(--sg-on-accent, #fff); }
  .pj-body { flex: 1 1 auto; min-height: 0; padding: 8px; }
</style>
