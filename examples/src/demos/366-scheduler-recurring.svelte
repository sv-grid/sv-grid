<script lang="ts">
  /**
   * 366. Recurring events (editable patterns)
   * -----------------------------------------
   * A row can carry a `recurrenceField` (a RecurrenceRule, or array of them)
   * and the scheduler renders one event per matching day in view - reusing the
   * same pure recurrence engine behind SvCalendar. Because `drawer` +
   * `recurrenceField` are set, clicking any event opens a RECURRENCE EDITOR
   * (add / change / remove the repeat pattern), and dragging / resizing a
   * recurring event edits the whole series' time + duration.
   */
  import {
    SvGrid,
    describeRecurrence,
    type ColumnDef,
    type RecurrenceRule,
    type SchedulerEventCommitEvent,
    type SchedulerEventMoveEvent,
    type SchedulerEventResizeEvent,
  } from '@svgrid/grid'
  import { enableSchedulerView, setLicenseKey } from '@svgrid/enterprise'

  setLicenseKey('SVENTERPRISE-DEV-LOCAL')
  enableSchedulerView()

  type Event = {
    id: number
    title: string
    start: string
    end: string
    color: string
    repeat?: RecurrenceRule | RecurrenceRule[]
  }

  const now = new Date()
  const monday = new Date(now)
  monday.setDate(now.getDate() - ((now.getDay() + 6) % 7))
  monday.setHours(0, 0, 0, 0)
  const p = (n: number) => String(n).padStart(2, '0')
  const iso = (d: Date) => `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`
  const at = (dayOffset: number, h: number, m = 0) => {
    const d = new Date(monday)
    d.setDate(monday.getDate() + dayOffset)
    d.setHours(h, m, 0, 0)
    return iso(d)
  }

  let rows = $state<Event[]>([
    // Daily standup, every weekday at 9:30.
    { id: 1, title: 'Daily standup', start: at(0, 9, 30), end: at(0, 9, 45), color: '#4f46e5', repeat: { freq: 'weekly', weekdays: [1, 2, 3, 4, 5] } },
    // Weekly 1:1 every Tuesday.
    { id: 2, title: '1:1 with lead', start: at(1, 15, 0), end: at(1, 15, 30), color: '#0891b2', repeat: { freq: 'weekly', weekdays: [2] } },
    // Sprint review every other Friday.
    { id: 3, title: 'Sprint review', start: at(4, 14, 0), end: at(4, 15, 0), color: '#d97706', repeat: { freq: 'weekly', weekdays: [5], interval: 2, from: at(4, 14, 0) } },
    // A one-off (no repeat).
    { id: 4, title: 'Quarterly planning', start: at(2, 10, 0), end: at(2, 12, 0), color: '#16a34a' },
  ])

  const columns: ColumnDef<any, Event>[] = [
    { field: 'title', header: 'Title', editorType: 'text', width: 200 },
    { field: 'start', header: 'Start', editorType: 'datetime', width: 170 },
    { field: 'end', header: 'End', editorType: 'datetime', width: 170 },
  ]

  // The table view adds a read-only "Repeat" column: the recurrence rule is a
  // structured object, so `describeRecurrence` turns it into a readable summary
  // ("Weekly on weekdays", "Every 2 weeks on Fri") instead of "[object Object]".
  const tableColumns: ColumnDef<any, Event>[] = [
    ...columns,
    { id: 'repeat', header: 'Repeat', fieldFn: (r) => describeRecurrence(r.repeat) || '-', width: 220 },
  ]

  let view = $state<'calendar' | 'table'>('calendar')
  let seq = 100

  // Saving the drawer mirrors the edited fields + the recurrence rule back.
  function onEventCommit(e: SchedulerEventCommitEvent<Event>) {
    Object.assign(e.row, e.values)
  }
  // Dragging / resizing a recurring event edits the whole series' time.
  function onEventMove(e: SchedulerEventMoveEvent<Event>) {
    e.row.start = iso(e.start)
    e.row.end = iso(e.end)
  }
  function onEventResize(e: SchedulerEventResizeEvent<Event>) {
    e.row.start = iso(e.start)
    e.row.end = iso(e.end)
  }
  function onEventAdd(start: Date, end: Date) {
    rows = [...rows, { id: ++seq, title: 'New event', start: iso(start), end: iso(end), color: '#4f46e5' }]
  }
  function onEventDelete(row: Event) {
    rows = rows.filter((r) => r !== row)
  }
</script>

<section class="flex flex-col flex-1 min-h-0 gap-3">
  <div class="flex items-center justify-between gap-3 shrink-0">
    <div class="text-sm text-slate-600 dark:text-slate-300">
      Rows with a <code>repeat</code> rule render as repeated events (doubled left
      border). <strong>Click</strong> any event to edit its pattern in the drawer
      (add / change / remove the repeat), or <strong>drag / resize</strong> a
      recurring event to shift the whole series' time. Double-click a slot to add.
    </div>
    <div class="inline-flex rounded-md border border-slate-300 dark:border-slate-600 overflow-hidden text-sm shrink-0">
      <button class="px-3 py-1 {view === 'calendar' ? 'bg-slate-800 text-white' : 'bg-transparent'}" onclick={() => (view = 'calendar')}>Calendar</button>
      <button class="px-3 py-1 {view === 'table' ? 'bg-slate-800 text-white' : 'bg-transparent'}" onclick={() => (view = 'table')}>Table</button>
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
          recurrenceField: 'repeat',
          initialView: 'week',
          weekStartsOn: 1,
          dayStartHour: 8,
          dayEndHour: 18,
          editable: true,
          drawer: true,
          onEventCommit,
          onEventMove,
          onEventResize,
          onEventAdd,
          onEventDelete,
        }}
      />
    {:else}
      <SvGrid
        data={rows}
        columns={tableColumns}
        getRowId={(r) => String(r.id)}
        showPagination={false}
        rowHeight={36}
        containerHeight="100%"
        fitColumns
      />
    {/if}
  </div>
</section>
