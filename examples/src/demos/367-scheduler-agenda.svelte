<script lang="ts">
  /**
   * 367. Agenda view + event editor
   * -------------------------------
   * The Agenda view is a chronological list grouped by day - handy on narrow
   * screens or for a "what's next" feed. Clicking any event opens the built-in
   * detail drawer (`scheduler.drawer` -> SvDrawer + SvForm with the UI-kit
   * editors), and `onEventCommit` mirrors the edit back onto the row.
   */
  import {
    SvGrid,
    type ColumnDef,
    type SchedulerEventCommitEvent,
  } from '@svgrid/grid'

  type Task = {
    id: number
    title: string
    start: string
    end: string
    owner: string
    priority: 'Low' | 'Medium' | 'High'
    notes: string
    color: string
  }

  const now = new Date()
  const base = new Date(now)
  base.setHours(0, 0, 0, 0)
  const p = (n: number) => String(n).padStart(2, '0')
  const iso = (d: Date) => `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`
  const at = (dayOffset: number, h: number, m = 0) => {
    const d = new Date(base)
    d.setDate(base.getDate() + dayOffset)
    d.setHours(h, m, 0, 0)
    return iso(d)
  }
  const PRI_COLOR = { High: '#dc2626', Medium: '#d97706', Low: '#16a34a' }

  let rows = $state<Task[]>([
    { id: 1, title: 'Finish scheduler docs', start: at(0, 9, 0), end: at(0, 10, 30), owner: 'Sam', priority: 'High', notes: 'Cover all four views', color: PRI_COLOR.High },
    { id: 2, title: 'Review PR #482', start: at(0, 14, 0), end: at(0, 14, 30), owner: 'Lee', priority: 'Medium', notes: '', color: PRI_COLOR.Medium },
    { id: 3, title: 'Book venue', start: at(1, 11, 0), end: at(1, 11, 30), owner: 'Ada', priority: 'Low', notes: 'Aurora or Delta', color: PRI_COLOR.Low },
    { id: 4, title: 'Ship 1.4.0', start: at(2, 16, 0), end: at(2, 17, 0), owner: 'Sam', priority: 'High', notes: 'Tag + release notes', color: PRI_COLOR.High },
    { id: 5, title: 'Customer onboarding', start: at(3, 10, 0), end: at(3, 11, 0), owner: 'Ada', priority: 'Medium', notes: '', color: PRI_COLOR.Medium },
    { id: 6, title: 'Team lunch', start: at(4, 12, 0), end: at(4, 13, 0), owner: 'Lee', priority: 'Low', notes: '', color: PRI_COLOR.Low },
  ])

  const columns: ColumnDef<any, Task>[] = [
    { field: 'title', header: 'Title', editorType: 'text' },
    { field: 'start', header: 'Start', editorType: 'datetime' },
    { field: 'end', header: 'End', editorType: 'datetime' },
    { field: 'owner', header: 'Owner', editorType: 'text' },
    { field: 'priority', header: 'Priority', editorType: 'list', editorOptions: ['Low', 'Medium', 'High'] },
    { field: 'notes', header: 'Notes', editorType: 'textarea' },
  ]

  function onEventCommit(e: SchedulerEventCommitEvent<Task>) {
    Object.assign(e.row, e.values)
    e.row.color = PRI_COLOR[e.row.priority] ?? e.row.color
  }
</script>

<section class="flex flex-col flex-1 min-h-0 gap-3">
  <div class="text-sm text-slate-600 dark:text-slate-300 shrink-0">
    The <strong>Agenda</strong> view lists events by day. <strong>Click</strong>
    any event to open the built-in detail drawer and edit its fields - saving
    mirrors back to the row (and re-colours by priority). Switch to Month for the
    calendar grid.
  </div>

  <div class="flex-1 min-h-0">
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
        views: ['agenda', 'month'],
        initialView: 'agenda',
        agendaDays: 14,
        drawer: { title: (r) => r.title, size: '420px' },
        onEventCommit,
      }}
    />
  </div>
</section>
