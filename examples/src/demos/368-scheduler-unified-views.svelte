<script lang="ts">
  /**
   * 368. One grid, three views - Table / Calendar / Kanban
   * ------------------------------------------------------
   * The SAME <SvGrid>, same data + columns, rendered three ways by swapping a
   * single prop: a plain table, a Calendar (`scheduler`), or a Kanban board
   * (`board`). Every edit - drag on the calendar, move a card between lanes,
   * or type in a cell - flows back to the one `rows` array, so the views always
   * agree. This is the "grid is the hero" story: pick the surface that fits the
   * task, keep one source of truth.
   */
  import {
    SvGrid,
    SvChip,
    SvAvatar,
    type ColumnDef,
    type BoardCardMoveEvent,
    type BoardCardCommitEvent,
    type SchedulerEventMoveEvent,
    type SchedulerEventResizeEvent,
    type SchedulerEventCommitEvent,
  } from '@svgrid/grid'
  import { enableSchedulerView, setLicenseKey } from '@svgrid/enterprise'

  // The calendar VIEW ships in @svgrid/enterprise; the board + table are free.
  setLicenseKey('SVENTERPRISE-DEV-LOCAL')
  enableSchedulerView()

  type Status = 'Backlog' | 'In progress' | 'Review' | 'Done'
  type Priority = 'Low' | 'Medium' | 'High'
  type Task = {
    id: number
    title: string
    start: string
    end: string
    status: Status
    assignee: string
    priority: Priority
    points: number
    color: string
  }

  const STATUS_COLOR: Record<Status, string> = {
    Backlog: '#64748b',
    'In progress': '#4f46e5',
    Review: '#d97706',
    Done: '#16a34a',
  }

  // Anchor everything on the current week so the calendar always shows "now".
  const monday = new Date()
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7))
  monday.setHours(0, 0, 0, 0)
  const p = (n: number) => String(n).padStart(2, '0')
  const iso = (d: Date) => `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`
  const at = (dayOffset: number, h: number, m = 0) => {
    const d = new Date(monday)
    d.setDate(monday.getDate() + dayOffset)
    d.setHours(h, m, 0, 0)
    return iso(d)
  }
  const task = (id: number, title: string, day: number, h: number, dur: number, status: Status, assignee: string, priority: Priority, points: number): Task => ({
    id, title, start: at(day, h), end: at(day, h + dur), status, assignee, priority, points, color: STATUS_COLOR[status],
  })

  let seq = 100
  let rows = $state<Task[]>([
    task(1, 'Design the calendar view', 0, 9, 2, 'In progress', 'Sam', 'High', 5),
    task(2, 'Spanning-bar month layout', 0, 13, 3, 'In progress', 'Lee', 'High', 5),
    task(3, 'Resource grouping', 1, 10, 2, 'Review', 'Ada', 'Medium', 3),
    task(4, 'Recurrence editor', 1, 14, 2, 'Backlog', 'Sam', 'Medium', 3),
    task(5, 'Drag + resize polish', 2, 9, 3, 'In progress', 'Lee', 'High', 2),
    task(6, 'Docs pass', 2, 14, 2, 'Backlog', 'Ada', 'Low', 2),
    task(7, 'Ship 1.5.0', 3, 15, 1, 'Backlog', 'Sam', 'High', 8),
    task(8, 'Retro', 4, 15, 1, 'Done', 'Lee', 'Low', 1),
  ])

  const lanes = [
    { id: 'Backlog', title: 'Backlog' },
    { id: 'In progress', title: 'In progress', color: STATUS_COLOR['In progress'], wipLimit: 3 },
    { id: 'Review', title: 'Review', color: STATUS_COLOR.Review },
    { id: 'Done', title: 'Done', color: STATUS_COLOR.Done },
  ]

  const columns: ColumnDef<any, Task>[] = [
    { field: 'title', header: 'Task', editorType: 'text', width: 230 },
    { field: 'status', header: 'Status', editorType: 'list', editorOptions: lanes.map((l) => l.id), width: 130 },
    { field: 'assignee', header: 'Assignee', editorType: 'text', width: 120 },
    { field: 'priority', header: 'Priority', editorType: 'list', editorOptions: ['Low', 'Medium', 'High'], width: 110 },
    { field: 'points', header: 'Points', editorType: 'number', width: 90 },
    { field: 'start', header: 'Start', editorType: 'datetime', width: 160 },
    { field: 'end', header: 'End', editorType: 'datetime', width: 160 },
  ]

  const VIEWS = [
    { id: 'table', label: 'Table' },
    { id: 'calendar', label: 'Calendar' },
    { id: 'board', label: 'Kanban' },
  ] as const
  let view = $state<(typeof VIEWS)[number]['id']>('calendar')

  const chipVariant = (pr: Priority) => (pr === 'High' ? 'danger' : pr === 'Medium' ? 'warning' : 'neutral')

  // --- calendar edits mirror back to the rows ---
  function onEventMove(e: SchedulerEventMoveEvent<Task>) {
    e.row.start = iso(e.start)
    e.row.end = iso(e.end)
  }
  function onEventResize(e: SchedulerEventResizeEvent<Task>) {
    e.row.start = iso(e.start)
    e.row.end = iso(e.end)
  }
  function onEventCommit(e: SchedulerEventCommitEvent<Task>) {
    Object.assign(e.row, e.values)
    e.row.color = STATUS_COLOR[e.row.status] ?? e.row.color
  }
  function onEventAdd(start: Date, end: Date) {
    rows = [...rows, { id: ++seq, title: 'New task', start: iso(start), end: iso(end), status: 'Backlog', assignee: 'Me', priority: 'Medium', points: 1, color: STATUS_COLOR.Backlog }]
  }
  function onEventDelete(row: Task) {
    rows = rows.filter((r) => r !== row)
  }
  // --- board edits mirror back too ---
  function onCardMove(e: BoardCardMoveEvent<Task>) {
    e.row.status = e.toLane as Status
    e.row.color = STATUS_COLOR[e.row.status] ?? e.row.color
  }
  function onCardCommit(e: BoardCardCommitEvent<Task>) {
    Object.assign(e.row, e.values)
    e.row.color = STATUS_COLOR[e.row.status] ?? e.row.color
  }
</script>

<section class="flex flex-col flex-1 min-h-0 gap-3">
  <div class="flex items-center justify-between gap-3 shrink-0">
    <div class="text-sm text-slate-600 dark:text-slate-300">
      One <code>&lt;SvGrid&gt;</code>, one <code>rows</code> array, <strong>three views</strong>.
      Reschedule on the calendar, drag a card between lanes, or edit a cell - every
      change flows back to the same data, so all three stay in sync.
    </div>
    <div class="inline-flex rounded-md border border-slate-300 dark:border-slate-600 overflow-hidden text-sm shrink-0">
      {#each VIEWS as v (v.id)}
        <button
          class="px-3 py-1 {view === v.id ? 'bg-slate-800 text-white' : 'bg-transparent'}"
          onclick={() => (view = v.id)}>{v.label}</button>
      {/each}
    </div>
  </div>

  <div class="flex-1 min-h-0">
    {#if view === 'calendar'}
      <SvGrid
        data={rows}
        columns={columns}
        getRowId={(r) => String(r.id)}
        containerHeight="100%"
        scheduler={{
          startField: 'start',
          endField: 'end',
          titleField: 'title',
          colorField: 'color',
          initialView: 'week',
          weekStartsOn: 1,
          dayStartHour: 8,
          dayEndHour: 19,
          editable: true,
          drawer: true,
          onEventMove,
          onEventResize,
          onEventCommit,
          onEventAdd,
          onEventDelete,
        }}
      />
    {:else if view === 'board'}
      <SvGrid
        responsive={true}
        data={rows}
        columns={columns}
        getRowId={(r) => String(r.id)}
        containerHeight="100%"
        board={{
          groupBy: 'status',
          lanes,
          editable: true,
          collapsibleLanes: true,
          onCardMove,
          onCardCommit,
          card: taskCard,
        }}
      />
    {:else}
      <SvGrid
        data={rows}
        columns={columns}
        getRowId={(r) => String(r.id)}
        sortable
        enableInlineEditing
        showPagination={false}
        rowHeight={36}
        containerHeight="100%"
        fitColumns
      />
    {/if}
  </div>

  <footer class="text-sm text-slate-500 dark:text-slate-400 shrink-0">
    {rows.length} tasks · {rows.reduce((s, r) => s + r.points, 0)} points
  </footer>
</section>

{#snippet taskCard(t: Task)}
  <div class="flex flex-col gap-2">
    <div class="font-semibold text-[0.84rem] leading-snug">{t.title}</div>
    <div class="flex items-center justify-between gap-2">
      <span class="inline-flex items-center gap-1.5 text-[0.74rem] text-slate-500 dark:text-slate-400">
        <SvAvatar name={t.assignee} size={20} />
        {t.assignee}
      </span>
      <SvChip variant={chipVariant(t.priority)}>{t.priority}</SvChip>
    </div>
    <div class="text-[0.7rem] text-slate-400">{t.points} pts</div>
  </div>
{/snippet}
