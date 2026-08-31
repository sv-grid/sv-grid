<script lang="ts">
  /**
   * 397. Multi-calendar overlay (Enterprise Scheduler Pro)
   * -----------------------------------------------------
   * Several calendars overlaid on one week - Work, Personal, Family, Holidays -
   * each colour-coded from a legend you can toggle. Turning a calendar off hides
   * its events across every view; an event's colour comes from its calendar unless
   * it sets its own. The same grid rows power the Table. Renderer: @svgrid/enterprise.
   */
  import { SvGrid, type ColumnDef, type SchedulerEventMoveEvent, type SchedulerEventResizeEvent, type SchedulerEventCommitEvent } from '@svgrid/grid'
  import { enableSchedulerView, setLicenseKey, type SchedulerProConfig } from '@svgrid/enterprise'

  setLicenseKey('SVENTERPRISE-DEV-LOCAL')
  enableSchedulerView()

  const calendars = [
    { id: 'work', title: 'Work', color: '#4f46e5' },
    { id: 'personal', title: 'Personal', color: '#16a34a' },
    { id: 'family', title: 'Family', color: '#db2777' },
    { id: 'holidays', title: 'Holidays', color: '#d97706' },
  ]

  type Ev = { id: string; title: string; cal: string; start: string; end: string; allDay?: boolean }
  const pad = (n: number) => String(n).padStart(2, '0')
  const iso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
  const monday = new Date(); monday.setHours(0, 0, 0, 0); monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7))
  const at = (day: number, h: number, m = 0) => { const d = new Date(monday); d.setDate(monday.getDate() + day); d.setHours(h, m, 0, 0); return iso(d) }

  let seq = 100
  let rows = $state<Ev[]>([
    { id: 'e1', title: 'Standup', cal: 'work', start: at(0, 9), end: at(0, 9, 30) },
    { id: 'e2', title: 'Design review', cal: 'work', start: at(1, 11), end: at(1, 12) },
    { id: 'e3', title: '1:1 with Sam', cal: 'work', start: at(2, 14), end: at(2, 14, 30) },
    { id: 'e4', title: 'Sprint planning', cal: 'work', start: at(4, 13), end: at(4, 14) },
    { id: 'e5', title: 'Gym', cal: 'personal', start: at(0, 18), end: at(0, 19) },
    { id: 'e6', title: 'Dentist', cal: 'personal', start: at(2, 10), end: at(2, 11) },
    { id: 'e7', title: 'Book club', cal: 'personal', start: at(3, 19), end: at(3, 20, 30) },
    { id: 'e8', title: 'Lunch with Alex', cal: 'family', start: at(2, 12, 30), end: at(2, 13, 30) },
    { id: 'e9', title: "Mom's birthday", cal: 'family', start: at(5, 0), end: at(6, 0), allDay: true },
    { id: 'e10', title: 'Public holiday', cal: 'holidays', start: at(0, 0), end: at(1, 0), allDay: true },
    { id: 'e11', title: 'School closed', cal: 'holidays', start: at(4, 0), end: at(5, 0), allDay: true },
  ])

  const columns: ColumnDef<any, Ev>[] = [
    { field: 'title', header: 'Event', editorType: 'text', width: 170 },
    { field: 'cal', header: 'Calendar', editorType: 'list', editorOptions: calendars.map((c) => ({ value: c.id, label: c.title, color: c.color })), width: 120 },
    { field: 'start', header: 'Start', editorType: 'datetime', width: 160 },
    { field: 'end', header: 'End', editorType: 'datetime', width: 160 },
  ]

  function onEventMove(e: SchedulerEventMoveEvent<Ev>) { e.row.start = iso(e.start); e.row.end = iso(e.end) }
  function onEventResize(e: SchedulerEventResizeEvent<Ev>) { e.row.start = iso(e.start); e.row.end = iso(e.end) }
  function onEventCommit(e: SchedulerEventCommitEvent<Ev>) { Object.assign(e.row, e.values) }
  function onEventAdd(start: Date, end: Date) { rows = [...rows, { id: `e${++seq}`, title: 'New event', cal: 'work', start: iso(start), end: iso(end) }] }
  function onEventDelete(row: Ev) { rows = rows.filter((r) => r !== row) }

  let view = $state<'timeline' | 'table'>('timeline')

  const schedulerCfg: SchedulerProConfig<any, Ev> = {
    startField: 'start', endField: 'end', titleField: 'title', allDayField: 'allDay',
    calendars, calendarField: 'cal',
    views: ['week', 'month', 'day', 'agenda'], initialView: 'week', weekStartsOn: 1,
    dayStartHour: 7, dayEndHour: 21, slotMinutes: 30,
    editable: true, tooltip: true, drawer: true,
    onEventMove, onEventResize, onEventCommit, onEventAdd, onEventDelete,
  }
</script>

<section class="mc">
  <header class="mc-head">
    <div class="mc-title">
      <strong>My calendars</strong>
      <span class="mc-sub">Toggle a calendar in the legend to overlay or hide it</span>
    </div>
    <div class="mc-seg" role="tablist" aria-label="View">
      <button class="mc-seg-btn" role="tab" aria-selected={view === 'timeline'} class:mc-on={view === 'timeline'} onclick={() => (view = 'timeline')}>Calendar</button>
      <button class="mc-seg-btn" role="tab" aria-selected={view === 'table'} class:mc-on={view === 'table'} onclick={() => (view = 'table')}>Table</button>
    </div>
  </header>
  <div class="mc-body">
    {#if view === 'timeline'}
      <SvGrid data={rows} columns={columns} getRowId={(r) => r.id} containerHeight="100%" scheduler={schedulerCfg} />
    {:else}
      <SvGrid data={rows} columns={columns} getRowId={(r) => r.id} containerHeight="100%" editable />
    {/if}
  </div>
</section>

<style>
  .mc { display: flex; flex: 1 1 auto; flex-direction: column; min-height: 0; border: 1px solid var(--sg-border, #e5e7eb); border-radius: 12px; overflow: hidden; background: var(--sg-bg, #fff); }
  .mc-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 10px 14px; border-bottom: 1px solid var(--sg-border, #e5e7eb); }
  .mc-title { display: flex; flex-direction: column; gap: 2px; }
  .mc-sub { font-size: 0.78rem; color: var(--sg-muted, #6b7280); }
  .mc-seg { display: inline-flex; border: 1px solid var(--sg-border, #e5e7eb); border-radius: 8px; overflow: hidden; }
  .mc-seg-btn { border: 0; background: var(--sg-bg, #fff); color: var(--sg-muted, #6b7280); font: inherit; font-size: 0.82rem; padding: 5px 12px; cursor: pointer; }
  .mc-seg-btn.mc-on { background: var(--sg-accent, #4f46e5); color: #fff; }
  .mc-body { flex: 1 1 auto; min-height: 0; padding: 8px; }
</style>
