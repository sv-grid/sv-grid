<script lang="ts">
  /**
   * 391. Operations timeline - collapse & zoom (Scheduler Pro)
   * ---------------------------------------------------------
   * A machine-shop timeline that COLLAPSES the parts of the axis nobody works -
   * nights fold to a thin gap, weekends to a marker - so the working hours fill
   * the width. A zoom stepper scales the axis from hourly detail out to a whole
   * week. Everything (bars, drag, now-line) maps through the compressed axis.
   * Toggle to the Table - same grid rows, just a view. Renderer: @svgrid/enterprise.
   */
  import { SvGrid, type ColumnDef, type SchedulerResource, type SchedulerEventMoveEvent, type SchedulerEventResizeEvent, type SchedulerEventCommitEvent } from '@svgrid/grid'
  import { enableSchedulerView, setLicenseKey, type SchedulerProConfig } from '@svgrid/enterprise'

  setLicenseKey('SVENTERPRISE-DEV-LOCAL')
  enableSchedulerView()

  type Job = { id: string; title: string; machine: string; kind: string; start: string; end: string; color: string }

  const machines: SchedulerResource[] = [
    { id: 'cnc1', title: 'CNC mill 1', color: '#4f46e5' },
    { id: 'cnc2', title: 'CNC mill 2', color: '#0891b2' },
    { id: 'laser', title: 'Laser cutter', color: '#db2777' },
    { id: 'press', title: 'Press brake', color: '#16a34a' },
  ]
  const kindColor: Record<string, string> = { Run: '#4f46e5', Setup: '#f59e0b', Maint: '#64748b', Rush: '#db2777' }

  const pad = (n: number) => String(n).padStart(2, '0')
  const iso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
  const base = new Date(); base.setHours(0, 0, 0, 0); base.setDate(base.getDate() - ((base.getDay() + 6) % 7)) // Monday
  const at = (dayOffset: number, h: number, m = 0) => { const d = new Date(base); d.setDate(d.getDate() + dayOffset); d.setHours(h, m, 0, 0); return iso(d) }
  const mk = (j: Omit<Job, 'color'>): Job => ({ ...j, color: kindColor[j.kind] ?? '#64748b' })

  let rows = $state<Job[]>([
    mk({ id: 'j1', title: 'Bracket run', machine: 'cnc1', kind: 'Run', start: at(0, 8), end: at(0, 12) }),
    mk({ id: 'j2', title: 'Fixture setup', machine: 'cnc1', kind: 'Setup', start: at(0, 13), end: at(0, 15) }),
    mk({ id: 'j3', title: 'Panel batch', machine: 'cnc1', kind: 'Run', start: at(1, 9), end: at(1, 17) }),
    mk({ id: 'j4', title: 'Housing run', machine: 'cnc2', kind: 'Run', start: at(0, 9), end: at(0, 16) }),
    mk({ id: 'j5', title: 'Calibration', machine: 'cnc2', kind: 'Maint', start: at(2, 8), end: at(2, 10) }),
    mk({ id: 'j6', title: 'Rush order', machine: 'laser', kind: 'Rush', start: at(1, 8), end: at(1, 11) }),
    mk({ id: 'j7', title: 'Sheet cut', machine: 'laser', kind: 'Run', start: at(3, 10), end: at(3, 17) }),
    mk({ id: 'j8', title: 'Bend series', machine: 'press', kind: 'Run', start: at(2, 13), end: at(2, 18) }),
    mk({ id: 'j9', title: 'PM service', machine: 'press', kind: 'Maint', start: at(4, 8), end: at(4, 11) }),
    mk({ id: 'j10', title: 'Bracket run 2', machine: 'cnc1', kind: 'Run', start: at(4, 9), end: at(4, 16) }),
  ])

  const columns: ColumnDef<any, Job>[] = [
    { field: 'title', header: 'Job', editorType: 'text', width: 150 },
    { field: 'machine', header: 'Machine', editorType: 'list', editorOptions: machines.map((m) => ({ value: m.id, label: m.title ?? m.id, color: m.color })), width: 130 },
    { field: 'kind', header: 'Kind', editorType: 'list', editorOptions: Object.keys(kindColor).map((k) => ({ value: k, label: k, color: kindColor[k] })), width: 110 },
    { field: 'start', header: 'Start', editorType: 'datetime', width: 150 },
    { field: 'end', header: 'End', editorType: 'datetime', width: 150 },
  ]

  let seq = 100
  function onEventMove(e: SchedulerEventMoveEvent<Job>) { e.row.start = iso(e.start); e.row.end = iso(e.end); if (e.toResource != null) e.row.machine = e.toResource }
  function onEventResize(e: SchedulerEventResizeEvent<Job>) { e.row.start = iso(e.start); e.row.end = iso(e.end) }
  function onEventAdd(start: Date, end: Date, resourceId?: string) {
    rows = [...rows, mk({ id: `j${++seq}`, title: 'New job', machine: resourceId ?? machines[0].id, kind: 'Run', start: iso(start), end: iso(end) })]
  }
  function onEventCommit(e: SchedulerEventCommitEvent<Job>) { Object.assign(e.row, e.values); e.row.color = kindColor[e.row.kind] ?? e.row.color }
  function onEventDelete(row: Job) { rows = rows.filter((r) => r !== row) }

  let view = $state<'timeline' | 'table'>('timeline')

  const schedulerCfg: SchedulerProConfig<any, Job> = {
    startField: 'start', endField: 'end', titleField: 'title', colorField: 'color',
    resourceField: 'machine', resources: machines,
    views: ['timelineWeek'], initialView: 'timelineWeek', weekStartsOn: 1,
    businessHours: { start: 8, end: 18 }, nonWorkingDays: [0, 6],
    collapseNonWorking: true, collapseWeekends: true, collapsedGapPx: 14,
    zoom: 3, // hourly to start
    editable: true, tooltip: true, drawer: true,
    onEventMove, onEventResize, onEventAdd, onEventCommit, onEventDelete,
  }
</script>

<section class="op">
  <header class="op-head">
    <div class="op-title">
      <strong>Shop floor schedule</strong>
      <span class="op-sub">Nights and weekends collapse out; use +/- to zoom hourly to weekly</span>
    </div>
    <div class="op-seg" role="tablist" aria-label="View">
      <button class="op-seg-btn" role="tab" aria-selected={view === 'timeline'} class:op-on={view === 'timeline'} onclick={() => (view = 'timeline')}>Timeline</button>
      <button class="op-seg-btn" role="tab" aria-selected={view === 'table'} class:op-on={view === 'table'} onclick={() => (view = 'table')}>Table</button>
    </div>
  </header>

  <div class="op-body">
    {#if view === 'timeline'}
      <SvGrid data={rows} columns={columns} getRowId={(r) => r.id} containerHeight="100%" scheduler={schedulerCfg} />
    {:else}
      <SvGrid data={rows} columns={columns} getRowId={(r) => r.id} containerHeight="100%" editable />
    {/if}
  </div>
</section>

<style>
  .op { display: flex; flex: 1 1 auto; flex-direction: column; min-height: 0; border: 1px solid var(--sg-border, #e5e7eb); border-radius: 12px; overflow: hidden; background: var(--sg-bg, #fff); }
  .op-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 10px 14px; border-bottom: 1px solid var(--sg-border, #e5e7eb); }
  .op-title { display: flex; flex-direction: column; gap: 2px; }
  .op-sub { font-size: 0.78rem; color: var(--sg-muted, #6b7280); }
  .op-seg { display: inline-flex; border: 1px solid var(--sg-border, #e5e7eb); border-radius: 8px; overflow: hidden; }
  .op-seg-btn { border: 0; background: var(--sg-bg, #fff); color: var(--sg-muted, #6b7280); font: inherit; font-size: 0.82rem; padding: 5px 12px; cursor: pointer; }
  .op-seg-btn.op-on { background: var(--sg-accent, #4f46e5); color: var(--sg-on-accent, #fff); }
  .op-body { flex: 1 1 auto; min-height: 0; padding: 8px; }
</style>
