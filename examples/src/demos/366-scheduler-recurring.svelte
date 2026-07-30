<script lang="ts">
  /**
   * 366. Recurring events
   * ----------------------
   * A row can carry a `recurrenceField` (a RecurrenceRule, or array of them)
   * and the scheduler renders one event per matching day in view - reusing the
   * same pure recurrence engine behind SvCalendar. The base row keeps its
   * time-of-day and duration; recurring instances are shown but not dragged
   * (edit the series in the Table view).
   */
  import { SvGrid, type ColumnDef, type RecurrenceRule } from '@svgrid/grid'

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

  let view = $state<'calendar' | 'table'>('calendar')
</script>

<section class="flex flex-col flex-1 min-h-0 gap-3">
  <div class="flex items-center justify-between gap-3 shrink-0">
    <div class="text-sm text-slate-600 dark:text-slate-300">
      Rows with a <code>repeat</code> rule render as repeated events - the daily
      standup fills every weekday, the 1:1 every Tuesday, the review every other
      Friday. Recurring instances have a doubled left border. Switch to
      <strong>Week</strong> or <strong>Month</strong> to see them span.
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
        }}
      />
    {:else}
      <SvGrid
        data={rows}
        columns={columns}
        getRowId={(r) => String(r.id)}
        showPagination={false}
        rowHeight={36}
        containerHeight="100%"
        fitColumns
      />
    {/if}
  </div>
</section>
