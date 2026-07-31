<script lang="ts">
  /**
   * 370. Staff shift roster (resources in the Week view)
   * ----------------------------------------------------
   * A weekly staff roster: `resourceField` groups the Week grid by team member,
   * so every person gets their own column-per-day block. Drag a shift to another
   * person or time to reassign it; the legend filters a person in/out. The event
   * FILL is the person (matches the legend); the LEFT STRIP is the role
   * (`secondaryColorField`). Double-click an empty slot to add a shift.
   */
  import {
    SvGrid,
    type ColumnDef,
    type SchedulerResource,
    type SchedulerEventMoveEvent,
    type SchedulerEventResizeEvent,
    type SchedulerEventCommitEvent,
  } from '@svgrid/grid'
  import { enableSchedulerView, setLicenseKey } from '@svgrid/enterprise'

  setLicenseKey('SVENTERPRISE-DEV-LOCAL')
  enableSchedulerView()

  type Role = 'Barista' | 'Cashier' | 'Kitchen' | 'Manager'
  type Shift = { id: number; title: Role; start: string; end: string; staff: string; color: string; staffColor: string }

  // Role palette - shown as the LEFT STRIP of each shift (secondaryColorField).
  const ROLE_COLOR: Record<Role, string> = {
    Barista: '#4f46e5',
    Cashier: '#0891b2',
    Kitchen: '#d97706',
    Manager: '#16a34a',
  }

  // Person palette chosen to CONTRAST with the role palette above, so the fill
  // (person) and the left strip (role) stay visually distinct.
  const staff: SchedulerResource[] = [
    { id: 'Alex', title: 'Alex', color: '#dc2626' },
    { id: 'Jordan', title: 'Jordan', color: '#7c3aed' },
    { id: 'Sam', title: 'Sam', color: '#2563eb' },
    { id: 'Taylor', title: 'Taylor', color: '#db2777' },
  ]
  // Person palette - the main event FILL (colorField), matching the legend.
  const STAFF_COLOR: Record<string, string> = Object.fromEntries(staff.map((s) => [s.id, s.color!]))

  const monday = new Date()
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7))
  monday.setHours(0, 0, 0, 0)
  const p = (n: number) => String(n).padStart(2, '0')
  const iso = (d: Date) => `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`
  const at = (dayOffset: number, h: number) => {
    const d = new Date(monday)
    d.setDate(monday.getDate() + dayOffset)
    d.setHours(h, 0, 0, 0)
    return iso(d)
  }
  const shift = (id: number, role: Role, staffId: string, day: number, from: number, to: number): Shift => ({
    id, title: role, staff: staffId, start: at(day, from), end: at(day, to),
    color: ROLE_COLOR[role], staffColor: STAFF_COLOR[staffId],
  })

  let seq = 100
  let rows = $state<Shift[]>([
    shift(1, 'Barista', 'Alex', 0, 8, 12), shift(2, 'Barista', 'Alex', 1, 8, 12), shift(3, 'Manager', 'Alex', 3, 12, 18),
    shift(4, 'Cashier', 'Jordan', 0, 12, 18), shift(5, 'Cashier', 'Jordan', 2, 8, 14), shift(6, 'Cashier', 'Jordan', 4, 12, 18),
    shift(7, 'Kitchen', 'Sam', 0, 7, 15), shift(8, 'Kitchen', 'Sam', 1, 7, 15), shift(9, 'Kitchen', 'Sam', 3, 7, 15),
    shift(10, 'Manager', 'Taylor', 1, 9, 17), shift(11, 'Barista', 'Taylor', 2, 12, 18), shift(12, 'Cashier', 'Taylor', 4, 8, 14),
  ])

  // The Role / Staff editors show a color swatch per option (the role palette /
  // person palette), so the dropdown that PICKS the color also previews it.
  const ROLE_OPTIONS = (Object.keys(ROLE_COLOR) as Role[]).map((r) => ({ value: r, label: r, color: ROLE_COLOR[r] }))
  const STAFF_OPTIONS = staff.map((s) => ({ value: s.id, label: s.title, color: s.color }))

  const columns: ColumnDef<any, Shift>[] = [
    { field: 'title', header: 'Role', editorType: 'list', editorOptions: ROLE_OPTIONS, width: 120 },
    { field: 'staff', header: 'Staff', editorType: 'list', editorOptions: STAFF_OPTIONS, width: 110 },
    { field: 'start', header: 'Start', editorType: 'datetime', width: 160 },
    { field: 'end', header: 'End', editorType: 'datetime', width: 160 },
  ]

  let view = $state<'calendar' | 'table'>('calendar')

  function onEventMove(e: SchedulerEventMoveEvent<Shift>) {
    e.row.start = iso(e.start)
    e.row.end = iso(e.end)
    // Dragging to another person's columns reassigns the shift - update the fill.
    if (e.toResource != null) {
      e.row.staff = e.toResource
      e.row.staffColor = STAFF_COLOR[e.toResource] ?? e.row.staffColor
    }
  }
  function onEventResize(e: SchedulerEventResizeEvent<Shift>) {
    e.row.start = iso(e.start)
    e.row.end = iso(e.end)
  }
  function onEventCommit(e: SchedulerEventCommitEvent<Shift>) {
    Object.assign(e.row, e.values)
    e.row.color = ROLE_COLOR[e.row.title] ?? e.row.color // left strip = role
    e.row.staffColor = STAFF_COLOR[e.row.staff] ?? e.row.staffColor // fill = person
  }
  function onEventAdd(start: Date, end: Date, resourceId?: string) {
    const staffId = resourceId ?? staff[0].id
    rows = [...rows, { id: ++seq, title: 'Barista', staff: staffId, start: iso(start), end: iso(end), color: ROLE_COLOR.Barista, staffColor: STAFF_COLOR[staffId] }]
  }
  function onEventDelete(row: Shift) {
    rows = rows.filter((r) => r !== row)
  }
</script>

<section class="flex flex-col flex-1 min-h-0 gap-3">
  <div class="flex items-center justify-between gap-3 shrink-0">
    <div class="text-sm text-slate-600 dark:text-slate-300">
      A weekly <strong>staff roster</strong>: the Week grid groups by
      <strong>person</strong> (<code>resourceField: 'staff'</code>). Drag a shift to
      another person or time to reassign, resize to change hours, and use the legend
      to focus on one person. Event <strong>fill = person</strong> (matches the
      legend); the <strong>left strip = role</strong>.
    </div>
    <div class="inline-flex rounded-md border border-slate-300 dark:border-slate-600 overflow-hidden text-sm shrink-0">
      <button
        class="px-3 py-1 {view === 'calendar' ? 'bg-slate-800 text-white' : 'bg-transparent'}"
        onclick={() => (view = 'calendar')}>Calendar</button>
      <button
        class="px-3 py-1 {view === 'table' ? 'bg-slate-800 text-white' : 'bg-transparent'}"
        onclick={() => (view = 'table')}>Table</button>
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
          colorField: 'staffColor',
          secondaryColorField: 'color',
          resourceField: 'staff',
          resources: staff,
          views: ['week', 'day'],
          initialView: 'week',
          weekStartsOn: 1,
          dayStartHour: 7,
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
</section>
