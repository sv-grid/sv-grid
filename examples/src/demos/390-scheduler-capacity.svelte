<script lang="ts">
  /**
   * 390. Staffing board - multi-assignment, utilization & summaries (Scheduler Pro)
   * ------------------------------------------------------------------------------
   * A weekly staffing timeline where one shift can be assigned to SEVERAL people
   * (it appears under each). A per-person utilization HISTOGRAM sits under each
   * row (bars turn red where someone is over-booked), and a sticky bottom SUMMARY
   * strip totals the shifts per day. Drag a shift onto another person to reassign.
   * Toggle to the Table - same grid rows, just a view. Renderer: @svgrid/enterprise.
   */
  import { SvGrid, type ColumnDef, type SchedulerResource, type SchedulerEventMoveEvent, type SchedulerEventResizeEvent } from '@svgrid/grid'
  import { enableSchedulerView, setLicenseKey, type SchedulerProConfig } from '@svgrid/enterprise'

  setLicenseKey('SVENTERPRISE-DEV-LOCAL')
  enableSchedulerView()

  type Shift = { id: string; title: string; role: string; assignees: string[]; start: string; end: string; color: string }

  const people: SchedulerResource[] = [
    { id: 'ana', title: 'Ana Ruiz', color: '#4f46e5' },
    { id: 'ben', title: 'Ben Cole', color: '#0891b2' },
    { id: 'cara', title: 'Cara Ng', color: '#db2777' },
    { id: 'dan', title: 'Dan Ott', color: '#16a34a' },
  ]
  const roleColor: Record<string, string> = { Front: '#4f46e5', Kitchen: '#db2777', Delivery: '#0891b2', Support: '#16a34a' }

  const pad = (n: number) => String(n).padStart(2, '0')
  const iso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
  const base = new Date(); base.setHours(0, 0, 0, 0); base.setDate(base.getDate() - ((base.getDay() + 6) % 7)) // Monday
  const at = (dayOffset: number, h: number) => { const d = new Date(base); d.setDate(d.getDate() + dayOffset); d.setHours(h, 0, 0, 0); return iso(d) }
  const mk = (s: Omit<Shift, 'color'>): Shift => ({ ...s, color: roleColor[s.role] ?? '#64748b' })

  let rows = $state<Shift[]>([
    mk({ id: 's1', title: 'Opening', role: 'Front', assignees: ['ana', 'ben'], start: at(0, 8), end: at(0, 12) }),
    mk({ id: 's2', title: 'Lunch rush', role: 'Kitchen', assignees: ['cara'], start: at(0, 11), end: at(0, 15) }),
    // Ana double-booked Mon afternoon -> her histogram bar goes red.
    mk({ id: 's3', title: 'Prep', role: 'Kitchen', assignees: ['ana'], start: at(0, 10), end: at(0, 14) }),
    mk({ id: 's4', title: 'Deliveries', role: 'Delivery', assignees: ['dan'], start: at(1, 9), end: at(1, 17) }),
    mk({ id: 's5', title: 'Front counter', role: 'Front', assignees: ['ben', 'cara'], start: at(1, 12), end: at(1, 18) }),
    mk({ id: 's6', title: 'Evening', role: 'Front', assignees: ['ana'], start: at(2, 15), end: at(2, 21) }),
    mk({ id: 's7', title: 'Support desk', role: 'Support', assignees: ['dan', 'ben'], start: at(2, 9), end: at(2, 13) }),
    mk({ id: 's8', title: 'Closing', role: 'Kitchen', assignees: ['cara'], start: at(3, 16), end: at(3, 22) }),
    mk({ id: 's9', title: 'Weekend open', role: 'Front', assignees: ['ana', 'dan'], start: at(5, 8), end: at(5, 14) }),
  ])

  const columns: ColumnDef<any, Shift>[] = [
    { field: 'title', header: 'Shift', editorType: 'text', width: 150 },
    { field: 'role', header: 'Role', editorType: 'list', editorOptions: Object.keys(roleColor).map((r) => ({ value: r, label: r, color: roleColor[r] })), width: 120 },
    { id: 'assignees', header: 'Assigned', width: 160, fieldFn: (r: Shift) => r.assignees.map((id) => people.find((p) => p.id === id)?.title ?? id).join(', ') },
    { field: 'start', header: 'Start', editorType: 'datetime', width: 150 },
    { field: 'end', header: 'End', editorType: 'datetime', width: 150 },
  ]

  const byId = (id: string) => rows.find((r) => r.id === id)
  function onEventMove(e: SchedulerEventMoveEvent<Shift>) { e.row.start = iso(e.start); e.row.end = iso(e.end) }
  function onEventResize(e: SchedulerEventResizeEvent<Shift>) { e.row.start = iso(e.start); e.row.end = iso(e.end) }
  // Reassign: drop a shift onto another person -> swap that person in.
  let lastReassign = $state('')
  function onAssignmentChange(c: { eventId: string; from?: string; to?: string }) {
    const row = byId(c.eventId)
    if (!row || !c.to) return
    const next = row.assignees.filter((a) => a !== c.from)
    if (!next.includes(c.to)) next.push(c.to)
    row.assignees = next
    lastReassign = `${row.title} -> ${people.find((p) => p.id === c.to)?.title ?? c.to}`
  }

  let view = $state<'timeline' | 'table'>('timeline')

  const schedulerCfg: SchedulerProConfig<any, Shift> = {
    startField: 'start', endField: 'end', titleField: 'title', colorField: 'color',
    resourceField: 'assignees', resources: people,
    views: ['timelineWeek'], initialView: 'timelineWeek', weekStartsOn: 1,
    timelineLaneHeight: 46, timelineTickMinWidth: 270,
    editable: true, tooltip: true, drawer: true,
    assignmentField: 'assignees',
    resourceHistogram: { height: 22 },
    columnSummary: { label: 'Shifts', reducer: 'count', position: 'bottom' },
    onEventMove, onEventResize, onAssignmentChange,
  }
</script>

<section class="st">
  <header class="st-head">
    <div class="st-title">
      <strong>Weekly staffing</strong>
      <span class="st-sub">One shift can cover several people; the bars show each person's load</span>
    </div>
    <div class="st-right">
      {#if lastReassign}<span class="st-badge">Reassigned {lastReassign}</span>{/if}
      <div class="st-seg" role="tablist" aria-label="View">
        <button class="st-seg-btn" role="tab" aria-selected={view === 'timeline'} class:st-on={view === 'timeline'} onclick={() => (view = 'timeline')}>Timeline</button>
        <button class="st-seg-btn" role="tab" aria-selected={view === 'table'} class:st-on={view === 'table'} onclick={() => (view = 'table')}>Table</button>
      </div>
    </div>
  </header>

  <div class="st-body">
    {#if view === 'timeline'}
      <SvGrid data={rows} columns={columns} getRowId={(r) => r.id} containerHeight="100%" scheduler={schedulerCfg} />
    {:else}
      <SvGrid data={rows} columns={columns} getRowId={(r) => r.id} containerHeight="100%" editable />
    {/if}
  </div>
</section>

<style>
  .st { display: flex; flex: 1 1 auto; flex-direction: column; min-height: 0; border: 1px solid var(--sg-border, #e5e7eb); border-radius: 12px; overflow: hidden; background: var(--sg-bg, #fff); }
  .st-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 10px 14px; border-bottom: 1px solid var(--sg-border, #e5e7eb); }
  .st-title { display: flex; flex-direction: column; gap: 2px; }
  .st-sub { font-size: 0.78rem; color: var(--sg-muted, #6b7280); }
  .st-right { display: flex; align-items: center; gap: 10px; }
  .st-badge { font-size: 0.74rem; font-weight: 600; color: var(--sg-accent, #2563eb); background: color-mix(in srgb, var(--sg-accent, #2563eb) 12%, transparent); padding: 3px 8px; border-radius: 999px; }
  .st-seg { display: inline-flex; border: 1px solid var(--sg-border, #e5e7eb); border-radius: 8px; overflow: hidden; }
  .st-seg-btn { border: 0; background: var(--sg-bg, #fff); color: var(--sg-muted, #6b7280); font: inherit; font-size: 0.82rem; padding: 5px 12px; cursor: pointer; }
  .st-seg-btn.st-on { background: var(--sg-accent, #4f46e5); color: var(--sg-on-accent, #fff); }
  .st-body { flex: 1 1 auto; min-height: 0; padding: 8px; }
</style>
