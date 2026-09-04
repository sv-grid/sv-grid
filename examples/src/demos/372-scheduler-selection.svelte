<script lang="ts">
  /**
   * 372. Selecting cells & events
   * -----------------------------
   * Three kinds of selection on the same scheduler:
   *   - `rangeSelectable` - drag across empty slots to MARK a continuous
   *     date/time range (drag across days for a multi-day span), then press Enter
   *     or right-click -> "Add Event" to create ONE event from it. `onRangeSelect`
   *     gives the `start`/`end` datetimes. Selecting alone never creates anything.
   *   - `eventSelectable` - Ctrl/Cmd-click events to multi-select (Shift-click for
   *     a range); the set moves together when you drag one, and Delete removes them.
   */
  import {
    SvGrid,
    type ColumnDef,
    type SchedulerRangeSelection,
    type SchedulerEventMoveEvent,
    type SchedulerEventResizeEvent,
    type SchedulerEventCommitEvent,
  } from '@svgrid/grid'
  import { enableSchedulerView, setLicenseKey } from '@svgrid/enterprise'

  setLicenseKey('SVENTERPRISE-DEV-LOCAL')
  enableSchedulerView()

  type Ev = { id: number; title: string; start: string; end: string; color: string; allDay?: boolean }

  const monday = new Date()
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7))
  monday.setHours(0, 0, 0, 0)
  const pad = (n: number) => String(n).padStart(2, '0')
  const iso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
  const at = (day: number, h: number, m = 0) => {
    const d = new Date(monday)
    d.setDate(monday.getDate() + day)
    d.setHours(h, m, 0, 0)
    return iso(d)
  }
  const PALETTE = ['#4f46e5', '#0891b2', '#d97706', '#16a34a', '#db2777']

  let seq = 100
  let rows = $state<Ev[]>([
    { id: 1, title: 'Standup', start: at(0, 9, 0), end: at(0, 9, 30), color: PALETTE[0] },
    { id: 2, title: 'Review', start: at(1, 10, 0), end: at(1, 11, 0), color: PALETTE[1] },
    { id: 3, title: 'Focus', start: at(2, 13, 0), end: at(2, 15, 0), color: PALETTE[2] },
    { id: 4, title: 'Sync', start: at(3, 11, 0), end: at(3, 12, 0), color: PALETTE[3] },
  ])

  const columns: ColumnDef<any, Ev>[] = [
    { field: 'title', header: 'Title', editorType: 'text', width: 200 },
    { field: 'start', header: 'Start', editorType: 'datetime', width: 170 },
    { field: 'end', header: 'End', editorType: 'datetime', width: 170 },
  ]

  let view = $state<'calendar' | 'table'>('calendar')
  let selectedCount = $state(0)
  let lastRange = $state('')

  const make = (start: Date, end: Date): Ev => ({ id: ++seq, title: 'New', start: iso(start), end: iso(end), color: PALETTE[seq % PALETTE.length] })

  // A range select is a CONTINUOUS date/time span - create ONE event from it.
  // Dragging the all-day row makes an all-day event; the hourly grid a timed one.
  function onRangeSelect(sel: SchedulerRangeSelection) {
    if (sel.allDay) {
      rows = [...rows, { id: ++seq, title: 'New', start: iso(sel.start), end: iso(sel.end), color: PALETTE[seq % PALETTE.length], allDay: true }]
      lastRange = `all-day · ${sel.days.length} day(s)`
      return
    }
    rows = [...rows, make(sel.start, sel.end)]
    lastRange = `${Math.round((sel.end.getTime() - sel.start.getTime()) / 60000)} min`
  }
  function onEventSelectionChange(sel: Ev[]) {
    selectedCount = sel.length
  }
  // Double-clicking an empty slot creates an event there.
  function onEventAdd(start: Date, end: Date) {
    rows = [...rows, make(start, end)]
  }
  function onEventMove(e: SchedulerEventMoveEvent<Ev>) {
    e.row.start = iso(e.start)
    e.row.end = iso(e.end)
    e.row.allDay = e.allDay // dragging to/from the all-day row flips this
  }
  function onEventResize(e: SchedulerEventResizeEvent<Ev>) {
    e.row.start = iso(e.start)
    e.row.end = iso(e.end)
  }
  function onEventCommit(e: SchedulerEventCommitEvent<Ev>) {
    Object.assign(e.row, e.values)
  }
  function onEventDelete(row: Ev) {
    rows = rows.filter((r) => r !== row)
  }
</script>

<section class="flex flex-col flex-1 min-h-0 gap-3">
  <div class="flex items-center justify-between gap-3 shrink-0">
    <div class="sc-lead text-sm">
      <strong>Drag</strong> (or <strong>click</strong>) empty slots to mark a
      <strong>date/time range</strong>; <strong>arrow keys</strong> move the cell,
      <strong>Shift+arrows</strong> extend it. Press <strong>Enter</strong> or
      right-click → <strong>Add Event</strong> to create it (<strong>Esc</strong>
      cancels). <strong>Ctrl/Cmd-click</strong> events to multi-select (Shift-click
      a range); drag one to move them together, or <strong>Delete</strong> to remove.
    </div>
    <div class="sc-seg inline-flex rounded-md overflow-hidden text-sm shrink-0">
      <button class="sc-seg-btn px-3 py-1 {view === 'calendar' ? 'sc-on' : ''}" onclick={() => (view = 'calendar')}>Calendar</button>
      <button class="sc-seg-btn px-3 py-1 {view === 'table' ? 'sc-on' : ''}" onclick={() => (view = 'table')}>Table</button>
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
          initialView: 'week',
          weekStartsOn: 1,
          dayStartHour: 0,
          dayEndHour: 24,
          editable: true,
          drawer: true,
          history: true,
          rangeSelectable: true,
          eventSelectable: true,
          onRangeSelect,
          onEventSelectionChange,
          onEventAdd,
          onEventMove,
          onEventResize,
          onEventCommit,
          onEventDelete,
        }}
      />
    {:else}
      <SvGrid
      columnResize data={rows} columns={columns} getRowId={(r) => String(r.id)} sortable enableInlineEditing rowHeight={36} containerHeight="100%" fitColumns />
    {/if}
  </div>

  <footer class="sc-foot text-sm shrink-0">
    {rows.length} events · {selectedCount} selected{lastRange ? ` · last drag: ${lastRange}` : ''}
  </footer>
</section>

<style>
  .sc-lead { color: var(--sg-fg, #475569); }
  .sc-foot { color: var(--sg-muted, #64748b); }
  .sc-seg { border: 1px solid var(--sg-border, #cbd5e1); }
  .sc-seg-btn { background: transparent; color: var(--sg-fg, #0f172a); }
  .sc-seg-btn:hover { background: var(--sg-row-hover-bg, #f1f5f9); }
  .sc-seg-btn.sc-on { background: var(--sg-accent, #1e293b); color: var(--sg-on-accent, #fff); }
</style>
