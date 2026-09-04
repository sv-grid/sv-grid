<script lang="ts">
  /**
   * 371. Timeline views - Day / Week (resources as rows)
   * ----------------------------------------------------
   * The SAME <SvGrid>, rendered as a horizontal *timeline* for short-horizon
   * resource planning: each team is a row, time runs left→right on a scrollable
   * axis, and work items are horizontal bars sized to real durations. Switch the
   * zoom - Day (hour ticks) or Week (day ticks) - in the toolbar.
   *   - Drag a bar to re-time it, to another team's row to reassign, or an edge
   *     to resize.
   *   - `rangeSelectable`: click or drag empty space to mark a time range (arrow
   *     keys move it, Shift+arrows extend), then Enter / "Add Event" to create.
   *   - `eventSelectable`: Ctrl/Cmd-click bars to multi-select, Delete to remove.
   * The Month / Year roadmap zooms live in the next demo.
   */
  import {
    SvGrid,
    type ColumnDef,
    type SchedulerResource,
    type SchedulerRangeSelection,
    type SchedulerEventMoveEvent,
    type SchedulerEventResizeEvent,
    type SchedulerEventCommitEvent,
  } from '@svgrid/grid'
  import { enableSchedulerView, setLicenseKey } from '@svgrid/enterprise'

  setLicenseKey('SVENTERPRISE-DEV-LOCAL')
  enableSchedulerView()

  type Status = 'Planned' | 'Active' | 'At risk'
  type Task = { id: number; title: string; team: string; status: Status; start: string; end: string; color: string; statusColor: string }

  const teams: SchedulerResource[] = [
    { id: 'Platform', title: 'Platform', color: '#6366f1' },
    { id: 'Mobile', title: 'Mobile', color: '#0ea5e9' },
    { id: 'Design', title: 'Design', color: '#db2777' },
    { id: 'Data', title: 'Data', color: '#14b8a6' },
    { id: 'QA', title: 'QA', color: '#a855f7' },
  ]
  const TEAM: Record<string, string> = Object.fromEntries(teams.map((t) => [t.id, t.color!]))
  const STATUS: Record<Status, string> = { Planned: '#94a3b8', Active: '#22c55e', 'At risk': '#f59e0b' }
  const STATUSES: Status[] = ['Planned', 'Active', 'At risk']

  const p = (n: number) => String(n).padStart(2, '0')
  const iso = (d: Date) => `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  const monday = new Date(now)
  monday.setDate(now.getDate() - ((now.getDay() + 6) % 7))

  const withH = (base: Date, h: number, m = 0) => {
    const d = new Date(base)
    d.setHours(h, m, 0, 0)
    return d
  }
  const wd = (dow: number) => {
    const d = new Date(monday)
    d.setDate(monday.getDate() + dow)
    return d
  }

  let seq = 100
  const task = (id: number, title: string, team: string, status: Status, start: string, end: string): Task => ({
    id, title, team, status, start, end, color: TEAM[team], statusColor: STATUS[status],
  })
  // A same-day work block (Day zoom): hours from..to on `date`.
  const block = (id: number, title: string, team: string, status: Status, date: Date, from: number, to: number) =>
    task(id, title, team, status, iso(withH(date, from)), iso(withH(date, to)))
  // A multi-day span (Week zoom): whole days [from, toExclusive).
  const span = (id: number, title: string, team: string, status: Status, from: Date, toExclusive: Date) =>
    task(id, title, team, status, iso(from), iso(toExclusive))

  let rows = $state<Task[]>([
    // --- TODAY: half- to full-day allocations (Day zoom is always populated) ---
    block(1, 'Auth service', 'Platform', 'Active', now, 9, 18),
    block(2, 'Release 4.2', 'Mobile', 'Active', now, 9, 14),
    block(3, 'Crash triage', 'Mobile', 'At risk', now, 14, 18),
    block(4, 'Design system', 'Design', 'Active', now, 9, 16),
    block(5, 'Pipeline rebuild', 'Data', 'At risk', now, 9, 18),
    block(6, 'Regression run', 'QA', 'Active', now, 10, 17),
    // --- OTHER WEEKDAYS: intra-day blocks so the Week zoom has spread ---
    block(7, 'Sprint review', 'Platform', 'Planned', wd(1), 10, 13),
    block(8, 'Store submission', 'Mobile', 'Planned', wd(2), 9, 12),
    block(9, 'Usability test', 'Design', 'Active', wd(3), 13, 17),
    block(10, 'Load testing', 'QA', 'At risk', wd(3), 9, 15),
    // --- THIS WEEK: multi-day work (Week zoom) ---
    span(11, 'Auth refactor', 'Platform', 'Active', wd(0), wd(4)),
    span(12, 'Onboarding flow', 'Mobile', 'Planned', wd(1), wd(5)),
    span(13, 'Brand refresh', 'Design', 'Active', wd(0), wd(3)),
    span(14, 'Warehouse migration', 'Data', 'At risk', wd(2), wd(5)),
    span(15, 'E2E automation', 'QA', 'Planned', wd(3), wd(6)),
  ])

  const columns: ColumnDef<any, Task>[] = [
    { field: 'title', header: 'Work item', editorType: 'text', width: 200 },
    { field: 'team', header: 'Team', editorType: 'list', editorOptions: teams.map((t) => ({ value: t.id, label: t.title ?? t.id, color: t.color })), width: 130 },
    { field: 'status', header: 'Status', editorType: 'list', editorOptions: STATUSES.map((s) => ({ value: s, label: s, color: STATUS[s] })), width: 120 },
    { field: 'start', header: 'Start', editorType: 'datetime', width: 160 },
    { field: 'end', header: 'End', editorType: 'datetime', width: 160 },
  ]

  let view = $state<'calendar' | 'table'>('calendar')
  let selectedCount = $state(0)
  let lastRange = $state('')

  function onRangeSelect(sel: SchedulerRangeSelection) {
    const team = sel.resourceIds[0] ?? teams[0].id
    rows = [...rows, task(++seq, 'New work item', team, 'Planned', iso(sel.start), iso(sel.end))]
    const hrs = Math.round((sel.end.getTime() - sel.start.getTime()) / 3.6e6)
    lastRange = `${team} · ${hrs}h`
  }
  function onEventSelectionChange(sel: Task[]) {
    selectedCount = sel.length
  }
  function onEventMove(e: SchedulerEventMoveEvent<Task>) {
    e.row.start = iso(e.start)
    e.row.end = iso(e.end)
    if (e.toResource != null) {
      e.row.team = e.toResource
      e.row.color = TEAM[e.toResource] ?? e.row.color
    }
  }
  function onEventResize(e: SchedulerEventResizeEvent<Task>) {
    e.row.start = iso(e.start)
    e.row.end = iso(e.end)
  }
  function onEventCommit(e: SchedulerEventCommitEvent<Task>) {
    Object.assign(e.row, e.values)
    e.row.color = TEAM[e.row.team] ?? e.row.color
    e.row.statusColor = STATUS[e.row.status] ?? e.row.statusColor
  }
  function onEventAdd(start: Date, end: Date, resourceId?: string) {
    const team = resourceId ?? teams[0].id
    rows = [...rows, task(++seq, 'New work item', team, 'Planned', iso(start), iso(end))]
  }
  function onEventDelete(row: Task) {
    rows = rows.filter((r) => r !== row)
  }
</script>

<section class="flex flex-col flex-1 min-h-0 gap-3">
  <div class="flex items-center justify-between gap-3 shrink-0">
    <div class="text-sm demo-note">
      A <strong>resource timeline</strong> (Day / Week): teams are rows, time runs
      left→right. Drag a bar to re-time it, to another team's row to reassign, or
      an edge to resize. <strong>Click or drag empty space</strong> to select a
      range (<strong>arrows</strong> move it, <strong>Shift+arrows</strong> extend,
      <strong>Enter</strong> creates); <strong>Ctrl/Cmd-click</strong> bars to
      multi-select, <strong>Delete</strong> to remove. Fill = team,
      <strong>left strip = status</strong> (<span style="color:#94a3b8">Planned</span> /
      <span style="color:#22c55e">Active</span> /
      <span style="color:#f59e0b">At risk</span>).
    </div>
    <div class="view-toggle inline-flex rounded-md overflow-hidden text-sm shrink-0">
      <button class="px-3 py-1 {view === 'calendar' ? 'is-on' : ''}" onclick={() => (view = 'calendar')}>Calendar</button>
      <button class="px-3 py-1 {view === 'table' ? 'is-on' : ''}" onclick={() => (view = 'table')}>Table</button>
    </div>
  </div>

  <div class="flex-1 min-h-0">
    {#if view === 'calendar'}
      <SvGrid
      columnResize
        data={rows}
        columns={columns}
        getRowId={(r) => String(r.id)}
        containerHeight="100%"
        scheduler={{
          startField: 'start',
          endField: 'end',
          titleField: 'title',
          colorField: 'color',
          secondaryColorField: 'statusColor',
          resourceField: 'team',
          resources: teams,
          views: ['timelineDay', 'timelineWeek'],
          initialView: 'timelineWeek',
          weekStartsOn: 1,
          dayStartHour: 7,
          dayEndHour: 19,
          editable: true,
          drawer: true,
          rangeSelectable: true,
          eventSelectable: true,
          onRangeSelect,
          onEventSelectionChange,
          onEventMove,
          onEventResize,
          onEventCommit,
          onEventAdd,
          onEventDelete,
        }}
      />
    {:else}
      <SvGrid
      columnResize
        data={rows}
        columns={columns}
        getRowId={(r) => String(r.id)}
        sortable
        enableInlineEditing
        rowHeight={36}
        containerHeight="100%"
        fitColumns
      />
    {/if}
  </div>

  <footer class="text-sm demo-note shrink-0">
    {rows.length} work items · {selectedCount} selected{lastRange ? ` · last range: ${lastRange}` : ''}
  </footer>
</section>

<style>
  .demo-note { color: var(--sg-muted, #475569); }

  .view-toggle { border: 1px solid var(--sg-border, #cbd5e1); }
  .view-toggle button {
    background: transparent;
    color: var(--sg-fg, #0f172a);
    cursor: pointer;
  }
  .view-toggle button.is-on {
    background: var(--sg-accent, #1e293b);
    color: var(--sg-on-accent, #fff);
  }
</style>
