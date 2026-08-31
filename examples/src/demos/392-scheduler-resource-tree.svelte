<script lang="ts">
  /**
   * 392. Grouped resources (Enterprise Scheduler Pro)
   * -------------------------------------------------
   * A clinic day where providers are organised into a collapsible TREE - buildings
   * to departments to providers/rooms - in the timeline gutter. Click a group to
   * collapse it (persisted). Appointments schedule onto the leaf providers; drag,
   * resize, double-click to add. Toggle to the Table - the groups are just a way to
   * read the same grid rows. Renderer ships in @svgrid/enterprise.
   */
  import { SvGrid, type ColumnDef, type SchedulerResource, type SchedulerEventMoveEvent, type SchedulerEventResizeEvent, type SchedulerEventCommitEvent } from '@svgrid/grid'
  import { enableSchedulerView, setLicenseKey, type SchedulerProConfig, type SchedulerResourceGroup } from '@svgrid/enterprise'

  setLicenseKey('SVENTERPRISE-DEV-LOCAL')
  enableSchedulerView()

  type Provider = SchedulerResource & { dept: string }
  const providers: Provider[] = [
    { id: 'reed', title: 'Dr. Reed', color: '#4f46e5', dept: 'cardio' },
    { id: 'cho', title: 'Dr. Cho', color: '#0891b2', dept: 'cardio' },
    { id: 'lane', title: 'Dr. Lane', color: '#db2777', dept: 'derm' },
    { id: 'voss', title: 'Dr. Voss', color: '#16a34a', dept: 'radio' },
    { id: 'mri', title: 'MRI room', color: '#d97706', dept: 'radio' },
  ]
  // Departments nest under buildings (parentId) - two levels of grouping.
  const groups: SchedulerResourceGroup[] = [
    { id: 'bldg-a', title: 'Main building' },
    { id: 'cardio', title: 'Cardiology', parentId: 'bldg-a' },
    { id: 'derm', title: 'Dermatology', parentId: 'bldg-a' },
    { id: 'annex', title: 'Imaging annex' },
    { id: 'radio', title: 'Radiology', parentId: 'annex' },
  ]

  type Appt = { id: string; title: string; provider: string; patient: string; start: string; end: string; color: string }
  const provColor = Object.fromEntries(providers.map((p) => [p.id, p.color!]))
  const pad = (n: number) => String(n).padStart(2, '0')
  const iso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const at = (h: number, m = 0) => { const d = new Date(today); d.setHours(h, m, 0, 0); return iso(d) }
  const mk = (a: Omit<Appt, 'color'>): Appt => ({ ...a, color: provColor[a.provider] ?? '#64748b' })

  let seq = 100
  let rows = $state<Appt[]>([
    mk({ id: 'a1', title: 'Stress test', provider: 'reed', patient: 'A. Reed', start: at(9), end: at(10) }),
    mk({ id: 'a2', title: 'Echo', provider: 'reed', patient: 'B. Owens', start: at(11), end: at(12) }),
    mk({ id: 'a3', title: 'Consult', provider: 'cho', patient: 'C. Patel', start: at(9, 30), end: at(10, 15) }),
    mk({ id: 'a4', title: 'Follow-up', provider: 'cho', patient: 'D. Wright', start: at(13), end: at(13, 30) }),
    mk({ id: 'a5', title: 'Mole screen', provider: 'lane', patient: 'E. Lee', start: at(10), end: at(10, 45) }),
    mk({ id: 'a6', title: 'Biopsy', provider: 'lane', patient: 'F. Brooks', start: at(14), end: at(15) }),
    mk({ id: 'a7', title: 'CT scan', provider: 'voss', patient: 'G. Adler', start: at(9), end: at(9, 45) }),
    mk({ id: 'a8', title: 'Report read', provider: 'voss', patient: '-', start: at(11), end: at(12) }),
    mk({ id: 'a9', title: 'MRI knee', provider: 'mri', patient: 'H. Mason', start: at(10), end: at(11, 30) }),
    mk({ id: 'a10', title: 'MRI brain', provider: 'mri', patient: 'I. Cole', start: at(13), end: at(14, 30) }),
  ])

  const columns: ColumnDef<any, Appt>[] = [
    { field: 'title', header: 'Appointment', editorType: 'text', width: 150 },
    { field: 'patient', header: 'Patient', editorType: 'text', width: 120 },
    { field: 'provider', header: 'Provider', editorType: 'list', editorOptions: providers.map((p) => ({ value: p.id, label: p.title ?? p.id, color: p.color })), width: 120 },
    { field: 'start', header: 'Start', editorType: 'datetime', width: 150 },
    { field: 'end', header: 'End', editorType: 'datetime', width: 150 },
  ]

  function onEventMove(e: SchedulerEventMoveEvent<Appt>) { e.row.start = iso(e.start); e.row.end = iso(e.end); if (e.toResource != null) e.row.provider = e.toResource }
  function onEventResize(e: SchedulerEventResizeEvent<Appt>) { e.row.start = iso(e.start); e.row.end = iso(e.end) }
  function onEventCommit(e: SchedulerEventCommitEvent<Appt>) { Object.assign(e.row, e.values); e.row.color = provColor[e.row.provider] ?? e.row.color }
  function onEventDelete(row: Appt) { rows = rows.filter((r) => r !== row) }
  function onEventAdd(start: Date, end: Date, resourceId?: string) {
    rows = [...rows, mk({ id: `a${++seq}`, title: 'New appointment', provider: resourceId ?? providers[0].id, patient: '', start: iso(start), end: iso(end) })]
  }

  let view = $state<'timeline' | 'table'>('timeline')

  const schedulerCfg: SchedulerProConfig<any, Appt> = {
    startField: 'start', endField: 'end', titleField: 'title', colorField: 'color',
    resourceField: 'provider', resources: providers,
    resourceGroups: groups, resourceGroupOf: (r) => (r as Provider).dept,
    collapsibleGroups: true, groupPersistKey: 'svgrid-clinic-groups',
    views: ['timelineDay'], initialView: 'timelineDay',
    businessHours: { start: 8, end: 18 }, dayStartHour: 7, dayEndHour: 19, timelineTickMinWidth: 96,
    editable: true, tooltip: true, drawer: true,
    onEventMove, onEventResize, onEventCommit, onEventDelete, onEventAdd,
  }
</script>

<section class="cl">
  <header class="cl-head">
    <div class="cl-title">
      <strong>Clinic day</strong>
      <span class="cl-sub">Providers grouped by building and department - click a group to collapse it</span>
    </div>
    <div class="cl-seg" role="tablist" aria-label="View">
      <button class="cl-seg-btn" role="tab" aria-selected={view === 'timeline'} class:cl-on={view === 'timeline'} onclick={() => (view = 'timeline')}>Timeline</button>
      <button class="cl-seg-btn" role="tab" aria-selected={view === 'table'} class:cl-on={view === 'table'} onclick={() => (view = 'table')}>Table</button>
    </div>
  </header>
  <div class="cl-body">
    {#if view === 'timeline'}
      <SvGrid data={rows} columns={columns} getRowId={(r) => r.id} containerHeight="100%" scheduler={schedulerCfg} />
    {:else}
      <SvGrid data={rows} columns={columns} getRowId={(r) => r.id} containerHeight="100%" editable />
    {/if}
  </div>
</section>

<style>
  .cl { display: flex; flex: 1 1 auto; flex-direction: column; min-height: 0; border: 1px solid var(--sg-border, #e5e7eb); border-radius: 12px; overflow: hidden; background: var(--sg-bg, #fff); }
  .cl-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 10px 14px; border-bottom: 1px solid var(--sg-border, #e5e7eb); }
  .cl-title { display: flex; flex-direction: column; gap: 2px; }
  .cl-sub { font-size: 0.78rem; color: var(--sg-muted, #6b7280); }
  .cl-seg { display: inline-flex; border: 1px solid var(--sg-border, #e5e7eb); border-radius: 8px; overflow: hidden; }
  .cl-seg-btn { border: 0; background: var(--sg-bg, #fff); color: var(--sg-muted, #6b7280); font: inherit; font-size: 0.82rem; padding: 5px 12px; cursor: pointer; }
  .cl-seg-btn.cl-on { background: var(--sg-accent, #4f46e5); color: var(--sg-on-accent, #fff); }
  .cl-body { flex: 1 1 auto; min-height: 0; padding: 8px; }
</style>
