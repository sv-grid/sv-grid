<script lang="ts">
  /**
   * 363. Scheduler / calendar mode
   * ------------------------------
   * The SAME <SvGrid>, same data + columns, rendered two ways: as a table, or
   * as a full calendar by setting one `scheduler` prop. Rows become events
   * bucketed by time; switch Month / Week / Day / Agenda in the toolbar. Drag
   * an event to a new day/time and `onEventMove` writes the new start/end back
   * onto your own row (so the Table view agrees). Just like the Kanban board,
   * the calendar is a pure *view of the grid*.
   */
  import {
    SvGrid,
    describeRecurrence,
    type ColumnDef,
    type RecurrenceRule,
    type SchedulerEventMoveEvent,
    type SchedulerEventResizeEvent,
    type SchedulerEventCommitEvent,
  } from '@svgrid/grid'
  import { enableSchedulerView, setLicenseKey } from '@svgrid/enterprise'

  // The scheduler / calendar VIEW ships in @svgrid/enterprise. Register it once
  // (setLicenseKey avoids the unlicensed watermark in this gallery).
  setLicenseKey('SVENTERPRISE-DEV-LOCAL')
  enableSchedulerView()

  type Meeting = {
    id: number
    title: string
    start: string
    end: string
    kind: 'Meeting' | 'Focus' | 'Review' | 'Personal'
    owner: string
    color: string
    allDay?: boolean
    repeat?: RecurrenceRule | RecurrenceRule[] | null
  }

  // Build ISO datetimes anchored on the CURRENT week so the demo always shows
  // events "now" without a fixed date.
  const now = new Date()
  const monday = new Date(now)
  monday.setDate(now.getDate() - ((now.getDay() + 6) % 7)) // this week's Monday
  monday.setHours(0, 0, 0, 0)
  const at = (dayOffset: number, h: number, m = 0) => {
    const d = new Date(monday)
    d.setDate(monday.getDate() + dayOffset)
    d.setHours(h, m, 0, 0)
    // local ISO (no timezone shift)
    const p = (n: number) => String(n).padStart(2, '0')
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`
  }

  const KIND_COLOR = {
    Meeting: '#4f46e5',
    Focus: '#0891b2',
    Review: '#d97706',
    Personal: '#16a34a',
  }

  let seq = 100
  let rows = $state<Meeting[]>([
    { id: 1, title: 'Sprint planning', start: at(0, 9, 30), end: at(0, 11, 0), kind: 'Meeting', owner: 'Sam', color: KIND_COLOR.Meeting },
    { id: 2, title: 'Deep work: grid views', start: at(0, 13, 0), end: at(0, 16, 0), kind: 'Focus', owner: 'Lee', color: KIND_COLOR.Focus },
    { id: 3, title: 'Design review', start: at(1, 10, 0), end: at(1, 11, 30), kind: 'Review', owner: 'Ada', color: KIND_COLOR.Review },
    { id: 4, title: '1:1 with Ada', start: at(1, 15, 0), end: at(1, 15, 30), kind: 'Meeting', owner: 'Sam', color: KIND_COLOR.Meeting },
    { id: 5, title: 'Release cut', start: at(2, 14, 0), end: at(2, 15, 0), kind: 'Review', owner: 'Lee', color: KIND_COLOR.Review },
    { id: 6, title: 'Gym', start: at(2, 18, 0), end: at(2, 19, 0), kind: 'Personal', owner: 'Sam', color: KIND_COLOR.Personal },
    { id: 7, title: 'Customer call', start: at(3, 11, 0), end: at(3, 12, 0), kind: 'Meeting', owner: 'Ada', color: KIND_COLOR.Meeting },
    { id: 8, title: 'Retro', start: at(4, 15, 30), end: at(4, 16, 30), kind: 'Review', owner: 'Lee', color: KIND_COLOR.Review },
    // A multi-day all-day event: renders as one continuous bar in the all-day row.
    { id: 9, title: 'Team offsite', start: at(1, 0), end: at(4, 0), kind: 'Personal', owner: 'All', color: KIND_COLOR.Personal, allDay: true },
  ])

  const columns: ColumnDef<any, Meeting>[] = [
    { field: 'title', header: 'Title', editorType: 'text', width: 220 },
    { field: 'start', header: 'Start', editorType: 'datetime', width: 170 },
    { field: 'end', header: 'End', editorType: 'datetime', width: 170 },
    { field: 'kind', header: 'Type', editorType: 'list', editorOptions: ['Meeting', 'Focus', 'Review', 'Personal'], width: 120 },
    { field: 'owner', header: 'Owner', editorType: 'text', width: 110 },
  ]

  // Table view: a read-only "Repeat" column renders each event's recurrence rule
  // as a readable summary via `describeRecurrence` (the rule is a structured
  // object, so a plain field would show "[object Object]").
  const tableColumns: ColumnDef<any, Meeting>[] = [
    ...columns,
    { id: 'repeat', header: 'Repeat', fieldFn: (r) => describeRecurrence(r.repeat) || '-', width: 200 },
  ]

  let view = $state<'calendar' | 'table'>('calendar')

  const iso = (d: Date) => {
    const p = (n: number) => String(n).padStart(2, '0')
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`
  }

  // The scheduler applied the move to its overlay already; we mirror the new
  // start/end onto our row so the Table view (and any persistence) agree.
  function onEventMove(e: SchedulerEventMoveEvent<Meeting>) {
    e.row.start = iso(e.start)
    e.row.end = iso(e.end)
    e.row.allDay = e.allDay // dragging to/from the all-day row flips this
  }
  function onEventResize(e: SchedulerEventResizeEvent<Meeting>) {
    e.row.start = iso(e.start)
    e.row.end = iso(e.end)
  }
  function onEventCommit(e: SchedulerEventCommitEvent<Meeting>) {
    Object.assign(e.row, e.values)
    e.row.color = KIND_COLOR[e.row.kind] ?? e.row.color
  }

  // --- full CRUD: add, delete, update all flow back to `rows` ---
  function makeEvent(start: Date, end: Date, allDay = false): Meeting {
    return { id: ++seq, title: 'New event', start: iso(start), end: iso(end), allDay, kind: 'Meeting', owner: 'Me', color: KIND_COLOR.Meeting }
  }
  // Fires when a slot is double-clicked or a pending range is confirmed; `allDay`
  // is true for the all-day row / a whole-day range, so we create an all-day event.
  function onEventAdd(start: Date, end: Date, _resourceId?: string, allDay = false) {
    rows = [...rows, makeEvent(start, end, allDay)]
  }
  // The drawer's Delete button (shown because onEventDelete is set) fires this.
  function onEventDelete(row: Meeting) {
    rows = rows.filter((r) => r !== row)
  }
  // Toolbar "Add event" button - drops a 1h event at noon today (always in view).
  function addEventNow() {
    const s = new Date()
    s.setHours(12, 0, 0, 0)
    rows = [...rows, makeEvent(s, new Date(s.getTime() + 60 * 60000))]
  }
</script>

<section class="flex flex-col flex-1 min-h-0 gap-3">
  <div class="flex items-center justify-between gap-3 shrink-0">
    <div class="sc-note text-sm">
      The same grid, two views. <strong>Add</strong> (button or double-click an
      empty slot), <strong>drag</strong> to reschedule, drag an edge to resize,
      <strong>click</strong> to edit (and make any event <strong>recurring</strong>
      from the drawer), and <strong>delete</strong> - every change flows back to
      the rows. Toggle Calendar / Table to see it is one grid.
    </div>
    <div class="flex items-center gap-2 shrink-0">
      <button
        class="sc-btn rounded-md px-3 py-1 text-sm"
        onclick={addEventNow}>+ Add event</button>
      <div class="sc-switch inline-flex rounded-md overflow-hidden text-sm">
        <button
          class="px-3 py-1 {view === 'calendar' ? 'sc-on' : 'bg-transparent'}"
          onclick={() => (view = 'calendar')}>Calendar</button>
        <button
          class="px-3 py-1 {view === 'table' ? 'sc-on' : 'bg-transparent'}"
          onclick={() => (view = 'table')}>Table</button>
      </div>
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
          allDayField: 'allDay',
          titleField: 'title',
          colorField: 'color',
          recurrenceField: 'repeat',
          initialView: 'week',
          weekStartsOn: 1,
          dayStartHour: 0,
          dayEndHour: 24,
          editable: true,
          drawer: true,
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
        columns={tableColumns}
        getRowId={(r) => String(r.id)}
        sortable
        enableInlineEditing
        rowHeight={36}
        containerHeight="100%"
        fitColumns
      />
    {/if}
  </div>

  <footer class="sc-muted text-sm shrink-0">
    {rows.length} events this week
  </footer>
</section>

<style>
  .sc-note   { color: var(--sg-muted, #475569); }
  .sc-muted  { color: var(--sg-muted, #64748b); }
  .sc-switch { border: 1px solid var(--sg-border, #cbd5e1); }
  .sc-btn {
    border: 1px solid var(--sg-border, #cbd5e1);
    background: var(--sg-bg, transparent);
    color: var(--sg-fg, inherit);
  }
  .sc-btn:hover { background: var(--sg-row-hover-bg, #f1f5f9); }
  .sc-on {
    background: var(--sg-accent, #1e293b);
    color: var(--sg-on-accent, #fff);
  }
</style>
