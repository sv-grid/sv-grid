<script lang="ts">
  /**
   * 365. Resource scheduling (people / rooms as columns)
   * ----------------------------------------------------
   * Point `resourceField` at a column and the Day view splits into one column
   * per resource (like a room- or staff-booking board). Drag an event across
   * columns and `onEventMove` gives you both the new time AND the new resource
   * (e.toResource), which we mirror onto the row.
   */
  import {
    SvGrid,
    type ColumnDef,
    type SchedulerEventMoveEvent,
    type SchedulerResource,
  } from '@svgrid/grid'

  type Booking = { id: number; title: string; start: string; end: string; room: string; color: string }

  const now = new Date()
  const today = new Date(now)
  today.setHours(0, 0, 0, 0)
  const p = (n: number) => String(n).padStart(2, '0')
  const iso = (d: Date) => `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`
  const at = (h: number, m = 0) => {
    const d = new Date(today)
    d.setHours(h, m, 0, 0)
    return iso(d)
  }

  const rooms: SchedulerResource[] = [
    { id: 'Aurora', title: 'Aurora (12)', color: '#4f46e5' },
    { id: 'Borealis', title: 'Borealis (6)', color: '#0891b2' },
    { id: 'Cosmos', title: 'Cosmos (4)', color: '#d97706' },
    { id: 'Delta', title: 'Delta (8)', color: '#16a34a' },
  ]

  let rows = $state<Booking[]>([
    { id: 1, title: 'All-hands', start: at(9, 0), end: at(10, 0), room: 'Aurora', color: '#4f46e5' },
    { id: 2, title: 'Design crit', start: at(10, 30), end: at(12, 0), room: 'Borealis', color: '#0891b2' },
    { id: 3, title: 'Vendor call', start: at(11, 0), end: at(12, 0), room: 'Cosmos', color: '#d97706' },
    { id: 4, title: 'Interview loop', start: at(13, 0), end: at(15, 0), room: 'Delta', color: '#16a34a' },
    { id: 5, title: 'Board meeting', start: at(14, 0), end: at(15, 30), room: 'Aurora', color: '#4f46e5' },
    { id: 6, title: 'Team lunch', start: at(12, 0), end: at(13, 0), room: 'Delta', color: '#16a34a' },
    { id: 7, title: 'Retro', start: at(16, 0), end: at(17, 0), room: 'Borealis', color: '#0891b2' },
  ])

  const columns: ColumnDef<any, Booking>[] = [
    { field: 'title', header: 'Title', editorType: 'text' },
    { field: 'start', header: 'Start', editorType: 'datetime' },
    { field: 'end', header: 'End', editorType: 'datetime' },
    { field: 'room', header: 'Room', editorType: 'list', editorOptions: rooms.map((r) => r.id) },
  ]

  const roomColor = (id: string) => rooms.find((r) => r.id === id)?.color ?? '#4f46e5'

  function onEventMove(e: SchedulerEventMoveEvent<Booking>) {
    e.row.start = iso(e.start)
    e.row.end = iso(e.end)
    if (e.toResource != null) {
      e.row.room = e.toResource
      e.row.color = roomColor(e.toResource)
    }
  }
</script>

<section class="flex flex-col flex-1 min-h-0 gap-3">
  <div class="text-sm text-slate-600 dark:text-slate-300 shrink-0">
    The <strong>Day</strong> view is split into one column per <strong>room</strong>
    (<code>resourceField: 'room'</code>). Drag a booking to another room or time -
    the move reports both the new time and the new resource.
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
        resourceField: 'room',
        resources: rooms,
        views: ['day', 'week'],
        initialView: 'day',
        dayStartHour: 8,
        dayEndHour: 18,
        slotMinutes: 30,
        editable: true,
        onEventMove,
      }}
    />
  </div>
</section>
