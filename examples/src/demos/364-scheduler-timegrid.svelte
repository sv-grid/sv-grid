<script lang="ts">
  /**
   * 364. Time-grid (week / day) with drag + resize
   * ----------------------------------------------
   * The Week and Day views lay overlapping events out into side-by-side
   * columns (the packing math lives in the pure scheduler-model). `editable`
   * turns on drag-to-move and bottom-edge resize; both snap to `slotMinutes`
   * and fire `onEventMove` / `onEventResize` where you persist the new times.
   */
  import {
    SvGrid,
    type ColumnDef,
    type SchedulerEventMoveEvent,
    type SchedulerEventResizeEvent,
    type SchedulerCollisionMode,
  } from '@svgrid/grid'
  import { enableSchedulerView, setLicenseKey } from '@svgrid/enterprise'

  setLicenseKey('SVENTERPRISE-DEV-LOCAL')
  enableSchedulerView()

  type Slot = { id: number; title: string; start: string; end: string; color: string }

  const now = new Date()
  const today = new Date(now)
  today.setHours(0, 0, 0, 0)
  const p = (n: number) => String(n).padStart(2, '0')
  const iso = (d: Date) => `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`
  const at = (dayOffset: number, h: number, m = 0) => {
    const d = new Date(today)
    d.setDate(today.getDate() + dayOffset)
    d.setHours(h, m, 0, 0)
    return iso(d)
  }

  // Several events that overlap on "today" to show collision handling - the
  // 09:00-11:00 block piles up 6 events at once so the modes differ clearly.
  let rows = $state<Slot[]>([
    { id: 1, title: 'Standup', start: at(0, 9, 0), end: at(0, 10, 0), color: '#4f46e5' },
    { id: 2, title: 'Pairing: DnD', start: at(0, 9, 0), end: at(0, 11, 0), color: '#0891b2' },
    { id: 3, title: 'Interview', start: at(0, 9, 0), end: at(0, 10, 30), color: '#d97706' },
    { id: 4, title: 'Design crit', start: at(0, 9, 30), end: at(0, 11, 0), color: '#7c3aed' },
    { id: 5, title: 'Vendor call', start: at(0, 9, 30), end: at(0, 10, 30), color: '#dc2626' },
    { id: 6, title: '1:1', start: at(0, 10, 0), end: at(0, 11, 0), color: '#0d9488' },
    { id: 7, title: 'Lunch & learn', start: at(0, 12, 0), end: at(0, 13, 0), color: '#16a34a' },
    { id: 8, title: 'Roadmap sync', start: at(0, 13, 30), end: at(0, 14, 30), color: '#4f46e5' },
    { id: 9, title: 'Focus block', start: at(0, 14, 30), end: at(0, 17, 0), color: '#0891b2' },
    { id: 10, title: 'Bug triage', start: at(0, 15, 0), end: at(0, 16, 0), color: '#dc2626' },
    { id: 11, title: 'Demo prep', start: at(1, 10, 0), end: at(1, 12, 0), color: '#d97706' },
  ])

  const MODES: { id: SchedulerCollisionMode; label: string }[] = [
    { id: 'split', label: 'Split' },
    { id: 'cap', label: 'Cap + more' },
    { id: 'stack', label: 'Stack' },
  ]
  let mode = $state<SchedulerCollisionMode>('split')

  const columns: ColumnDef<any, Slot>[] = [
    { field: 'title', header: 'Title', editorType: 'text' },
    { field: 'start', header: 'Start', editorType: 'datetime' },
    { field: 'end', header: 'End', editorType: 'datetime' },
  ]

  function onEventMove(e: SchedulerEventMoveEvent<Slot>) {
    e.row.start = iso(e.start)
    e.row.end = iso(e.end)
  }
  function onEventResize(e: SchedulerEventResizeEvent<Slot>) {
    e.row.end = iso(e.end)
  }
</script>

<section class="flex flex-col flex-1 min-h-0 gap-3">
  <div class="flex items-center justify-between gap-3 shrink-0">
    <div class="text-sm text-slate-600 dark:text-slate-300">
      <strong>Drag</strong> an event to move it, or its <strong>top / bottom
      edge</strong> to resize. The 9-11am block collides 6-deep - switch the
      <strong>collision mode</strong> to see how it is displayed.
    </div>
    <div class="inline-flex rounded-md border border-slate-300 dark:border-slate-600 overflow-hidden text-sm shrink-0">
      {#each MODES as m (m.id)}
        <button
          class="px-3 py-1 {mode === m.id ? 'bg-slate-800 text-white' : 'bg-transparent'}"
          onclick={() => (mode = m.id)}>{m.label}</button>
      {/each}
    </div>
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
        views: ['week', 'day'],
        initialView: 'day',
        weekStartsOn: 1,
        slotMinutes: 15,
        dayStartHour: 8,
        dayEndHour: 18,
        editable: true,
        collisionMode: mode,
        maxColumns: 3,
        onEventMove,
        onEventResize,
      }}
    />
  </div>
</section>
