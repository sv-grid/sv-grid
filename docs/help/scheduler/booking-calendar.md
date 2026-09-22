---
seoTitle: Build a booking calendar in Svelte - the scheduler view
seoDescription: A clinic calendar on a Svelte data grid: a column per provider, working hours and no double-booking, a drawer to add and edit, a weekly slot, a timeline.
keywords: svelte scheduler, booking calendar svelte, resource scheduler svelte, appointment calendar grid, no double booking calendar
---

# Build a booking calendar

One `scheduler` prop turns the grid's rows into events on a calendar,
and the [Scheduler reference](../rows/scheduler.md) lists everything the
prop can say. This page builds a clinic's front-desk calendar, one
option at a time on the same rows: appointments from two date fields, a
column per provider, each provider's own hours with a hard rule against
booking over them or over each other, a drawer that adds, edits and
deletes, a slot that repeats every week, the day as a timeline, a colour
per visit type, and the Table button that shows the same rows as a grid.

The calendar renderer ships in `@svgrid/enterprise`;
`enableSchedulerView()` once lights it up, and the `scheduler` prop and
its types are part of the free grid. The examples share a week of
appointments anchored on today, so the calendar always opens with
something in view.

```svelte {preamble}
<script lang="ts">
  import { SvGrid, tableFeatures, rowSortingFeature, type GridColumns, type RecurrenceRule } from '@svgrid/grid'
  import { enableSchedulerView } from '@svgrid/enterprise'

  enableSchedulerView()

  type Visit = {
    id: number
    patient: string
    kind: 'Consult' | 'Follow-up' | 'Procedure' | 'Admin'
    provider: 'smith' | 'jones' | 'okafor'
    start: string
    end: string
    color?: string
    repeat?: RecurrenceRule | null
  }

  // Local ISO minutes, the shape the date pickers parse and write.
  const p = (n: number) => String(n).padStart(2, '0')
  const iso = (d: Date) => `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`
  // Offset from the Monday of the current week, so the week always opens
  // with visits in view and each one sits inside its provider's hours.
  const monday = new Date()
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7))
  const at = (dayOffset: number, hour: number, mins = 0) => {
    const d = new Date(monday)
    d.setDate(d.getDate() + dayOffset)
    d.setHours(hour, mins, 0, 0)
    return iso(d)
  }

  const KIND_COLOR: Record<Visit['kind'], string> = { Consult: '#2563eb', 'Follow-up': '#16a34a', Procedure: '#dc2626', Admin: '#64748b' }
  const visit = (id: number, patient: string, kind: Visit['kind'], provider: Visit['provider'], day: number, hour: number, minutes: number, mins = 0): Visit =>
    ({ id, patient, kind, provider, start: at(day, hour, mins), end: at(day, hour, mins + minutes), color: KIND_COLOR[kind] })

  let visits = $state<Visit[]>([
    visit(1, 'A. Mensah', 'Consult', 'smith', 0, 9, 30),
    visit(2, 'R. Ito', 'Follow-up', 'smith', 0, 10, 30),
    visit(3, 'L. Novak', 'Procedure', 'jones', 0, 9, 90),
    visit(4, 'S. Duarte', 'Consult', 'okafor', 0, 11, 30),
    visit(5, 'M. Chen', 'Follow-up', 'jones', 1, 14, 30),
    visit(6, 'P. Singh', 'Consult', 'smith', 1, 15, 30),
    visit(7, 'K. Adeyemi', 'Procedure', 'okafor', 2, 10, 60),
    visit(8, 'T. Brooks', 'Follow-up', 'okafor', 3, 9, 30, 30),
  ])

  const providers = [
    { id: 'smith', title: 'Dr Smith', color: '#4f46e5', availability: [{ days: [1, 3, 5], start: 9, end: 13 }, { days: [2, 4], start: 14, end: 18 }] },
    { id: 'jones', title: 'Dr Jones', color: '#0891b2', availability: [{ days: [1, 2, 3, 4, 5], start: 8, end: 12 }, { days: [1, 2, 3, 4, 5], start: 13, end: 16 }] },
    { id: 'okafor', title: 'Dr Okafor', color: '#d97706', availability: [{ days: [1, 2, 3, 4, 5], start: 9, end: 17 }] },
  ]

  const columns: GridColumns<Visit> = [
    { field: 'patient', header: 'Patient', width: 150, editorType: 'text' },
    { field: 'kind', header: 'Visit', width: 110, editorType: 'select', editorOptions: ['Consult', 'Follow-up', 'Procedure', 'Admin'] },
    { field: 'provider', header: 'Provider', width: 110, editorType: 'select', editorOptions: ['smith', 'jones', 'okafor'] },
    { field: 'start', header: 'Start', width: 160 },
    { field: 'end', header: 'End', width: 160 },
  ]
  const features = tableFeatures({ rowSortingFeature })

  let nextId = 100
  // A new array, not a push: the grid takes the rows again when `data` is
  // a different reference, and an in-place push never reaches the calendar.
  const addVisit = (start: Date, end: Date, provider?: string) => {
    visits = [...visits, { id: ++nextId, patient: 'New patient', kind: 'Consult', provider: (provider as Visit['provider']) ?? 'smith', start: iso(start), end: iso(end), color: KIND_COLOR.Consult }]
  }
</script>
```

## Events from two fields

`startField` is the one required option; with `endField` an event has
its real length. The toolbar offers Month, Week, Day and Agenda; `views`
narrows and orders them, `initialView` picks the first, `dayStartHour`
and `dayEndHour` set the band the time grid shows and `slotMinutes` the
snap.

```svelte {runnable}
<SvGrid data={visits} {columns} getRowId={(r) => String(r.id)}
  scheduler={{ startField: 'start', endField: 'end', titleField: 'patient', views: ['week', 'day', 'agenda'], initialView: 'week', weekStartsOn: 1, dayStartHour: 8, dayEndHour: 18, slotMinutes: 15 }}
  containerHeight={480} />
```

The title is the `titleField`, the patient here. Start and end may be a
`Date`, an epoch number or an ISO string; the values above are local
ISO minutes, the shape the date pickers parse and write.

## A column per provider

`resourceField` names the field that decides the column, and
`resources` fixes the order, the titles and a colour each. Day view is
a column per provider; Week view groups each provider's seven days
under a spanning header; a legend in every view toggles a provider's
events. `editable` turns on drag to move, drag across columns to
reassign, and grips at the ends to resize, snapped to `slotMinutes`;
the scheduler applies each as an overlay and `onEventMove` /
`onEventResize` are where the app writes the row.

```svelte {runnable}
<SvGrid data={visits} {columns} getRowId={(r) => String(r.id)}
  scheduler={{
    startField: 'start', endField: 'end', titleField: 'patient',
    resourceField: 'provider', resources: providers,
    views: ['day', 'week'], initialView: 'day', initialDate: at(0, 0), dayStartHour: 8, dayEndHour: 18, slotMinutes: 15,
    editable: true,
    onEventMove: (e) => { e.row.start = iso(e.start); e.row.end = iso(e.end); if (e.toResource) e.row.provider = e.toResource as Visit['provider'] },
    onEventResize: (e) => { e.row.start = iso(e.start); e.row.end = iso(e.end) },
  }}
  containerHeight={480} />
```

Drag A. Mensah from Dr Smith's column into Dr Okafor's: `e.toResource`
says where it landed. A focused event moves a slot with the up and down
arrows and a day with left and right; Enter opens its editor.

## Each provider's hours, and no double-booking

A clinic's rule is that a visit lands in the provider's working hours
and not on top of another. `businessHours` and `nonWorkingDays` shade
the time outside the global window; each resource's `availability`
overrides it with its own windows, by weekday, so Dr Smith's Monday
afternoon is grey and Dr Jones's lunch hour is. Shading is a hint until
`restrictToBusinessHours` makes it a rule: a drag, a resize or a new
event outside the window snaps back. `disableConflicts` refuses an
overlap on the same resource with a brief flash; two providers may
overlap freely.

```svelte {runnable}
<SvGrid data={visits} {columns} getRowId={(r) => String(r.id)}
  scheduler={{
    startField: 'start', endField: 'end', titleField: 'patient',
    resourceField: 'provider', resources: providers,
    views: ['day', 'week'], initialView: 'day', dayStartHour: 7, dayEndHour: 19, slotMinutes: 15,
    businessHours: { start: 9, end: 17 }, nonWorkingDays: [0, 6], restrictToBusinessHours: true, disableConflicts: true, shadeUntilNow: true,
    editable: true,
    onEventMove: (e) => { e.row.start = iso(e.start); e.row.end = iso(e.end); if (e.toResource) e.row.provider = e.toResource as Visit['provider'] },
    onEventResize: (e) => { e.row.start = iso(e.start); e.row.end = iso(e.end) },
  }}
  containerHeight={480} />
```

Try to drop R. Ito onto L. Novak's procedure: refused. Try to move a
visit into Dr Smith's afternoon on this Monday: refused. The arrow keys
are held to the same rules as a drag. `hasConflict` is the same check as
a function, for a booking form that should say so before the drag.

## Add, edit, delete

Double-click an empty slot and `onEventAdd(start, end, resourceId)`
fires with the slot and the column: append a row. `drawer` opens a
detail drawer on a click: a When editor with start and end as full
date-and-time pickers, then an `SvForm` of the other columns from their
`editorType`; Save fires `onEventCommit` with the changed values. With
`onEventDelete` set the drawer has a Delete button, and a right-click on
an event has Edit and Delete built in.

```svelte {runnable}
<SvGrid data={visits} {columns} getRowId={(r) => String(r.id)}
  scheduler={{
    startField: 'start', endField: 'end', titleField: 'patient',
    resourceField: 'provider', resources: providers,
    views: ['day', 'week'], initialView: 'day', dayStartHour: 8, dayEndHour: 18, slotMinutes: 15,
    businessHours: { start: 9, end: 17 }, nonWorkingDays: [0, 6], restrictToBusinessHours: true, disableConflicts: true,
    editable: true,
    drawer: { fields: ['patient', 'kind', 'provider'], title: (row) => `${row.patient} - ${row.kind}`, size: '400px' },
    onEventAdd: (start, end, resourceId) => addVisit(start, end, resourceId),
    onEventCommit: (e) => { Object.assign(e.row, e.values); e.row.color = KIND_COLOR[e.row.kind] },
    onEventDelete: (row) => (visits = visits.filter((v) => v.id !== row.id)),
    onEventMove: (e) => { e.row.start = iso(e.start); e.row.end = iso(e.end); if (e.toResource) e.row.provider = e.toResource as Visit['provider'] },
    onEventResize: (e) => { e.row.start = iso(e.start); e.row.end = iso(e.end) },
  }}
  containerHeight={480} />
```

Double-click 15:00 in Dr Okafor's column: a Consult for a new patient
appears there; click it, change the visit type, Save. Because the row
is what changed, the colour follows in `onEventCommit`.

## A slot that repeats

A row with a `recurrenceField` is drawn once per matching day in the
window, each instance with the base row's time of day and length. The
rule is the same `RecurrenceRule` `SvCalendar` uses: `daily` with an
`interval`, `weekly` with `weekdays`, `monthly` by `day` or by a
positional `weekOfMonth`, `yearly`, ended by `until` or a `count`.

```svelte {runnable}
<script lang="ts">
  const withClinic: Visit[] = [
    ...visits,
    { id: 90, patient: 'Vaccination clinic', kind: 'Admin', provider: 'jones', start: at(0, 13), end: at(0, 14), color: KIND_COLOR.Admin, repeat: { freq: 'weekly', weekdays: [1, 3] } },
  ]
</script>

<SvGrid data={withClinic} {columns} getRowId={(r) => String(r.id)}
  scheduler={{
    startField: 'start', endField: 'end', titleField: 'patient', recurrenceField: 'repeat',
    resourceField: 'provider', resources: providers,
    views: ['week', 'month'], initialView: 'week', weekStartsOn: 1, dayStartHour: 8, dayEndHour: 18,
  }}
  containerHeight={480} />
```

The drawer's When editor can write the rule too, and an edit to one
instance can be kept as an exception to the series; the reference has
the [editing patterns](../rows/scheduler.md#recurring-events).

## The day as a timeline

The `timeline*` views turn the layout sideways: time runs left to right,
each provider is a row, and an event is a bar. `timelineDay` has hour
ticks, `timelineWeek` and `timelineMonth` day ticks, `timelineYear`
months. Drag a bar sideways to re-time it, to another row to reassign
it, or an edge to resize it.

```svelte {runnable}
<SvGrid data={visits} {columns} getRowId={(r) => String(r.id)}
  scheduler={{
    startField: 'start', endField: 'end', titleField: 'patient',
    resourceField: 'provider', resources: providers,
    views: ['timelineDay', 'timelineWeek', 'day'], initialView: 'timelineDay', dayStartHour: 8, dayEndHour: 18,
    editable: true, disableConflicts: true,
    onEventMove: (e) => { e.row.start = iso(e.start); e.row.end = iso(e.end); if (e.toResource) e.row.provider = e.toResource as Visit['provider'] },
    onEventResize: (e) => { e.row.start = iso(e.start); e.row.end = iso(e.end) },
  }}
  containerHeight={360} />
```

`resourceAreaWidth`, `timelineLaneHeight` and `timelineSlotMinutes`
tune the geometry; a click or a drag on empty space marks a range and
Enter creates the event there.

## A colour per visit type

`colorField` reads a colour from the row, which is how a visit type
paints an event; the resource colour paints the provider's legend chip
and column header, never the events. The rows here carry `color` from
their `kind`; without a `colorField` every event takes the calendar's
one accent.

```svelte {runnable}
<SvGrid data={visits} {columns} getRowId={(r) => String(r.id)}
  scheduler={{ startField: 'start', endField: 'end', titleField: 'patient', colorField: 'color', resourceField: 'provider', resources: providers, views: ['week'], initialView: 'week', weekStartsOn: 1, dayStartHour: 8, dayEndHour: 18 }}
  containerHeight={440} />
```

## The Table button

The same rows, columns and `getRowId` with the `scheduler` prop absent
are the table. Every scheduler in the gallery ships this switch: the
calendar is a view of the grid, so the search, the filters and the sort
flow into it, and the table is what the front desk exports at the end
of the day.

```svelte {runnable}
<script lang="ts">
  let view = $state<'calendar' | 'table'>('calendar')
</script>

<div style="display: flex; gap: 4px; margin-bottom: 8px">
  <button type="button" onclick={() => (view = 'calendar')} aria-pressed={view === 'calendar'}>Calendar</button>
  <button type="button" onclick={() => (view = 'table')} aria-pressed={view === 'table'}>Table</button>
</div>
{#if view === 'calendar'}
  <SvGrid data={visits} {columns} getRowId={(r) => String(r.id)}
    scheduler={{
      startField: 'start', endField: 'end', titleField: 'patient', colorField: 'color',
      resourceField: 'provider', resources: providers,
      views: ['day', 'week', 'agenda'], initialView: 'day', dayStartHour: 8, dayEndHour: 18, slotMinutes: 15,
      businessHours: { start: 9, end: 17 }, nonWorkingDays: [0, 6], restrictToBusinessHours: true, disableConflicts: true,
      editable: true, drawer: { fields: ['patient', 'kind', 'provider'] },
      onEventAdd: (start, end, resourceId) => addVisit(start, end, resourceId),
      onEventCommit: (e) => { Object.assign(e.row, e.values); e.row.color = KIND_COLOR[e.row.kind] },
      onEventDelete: (row) => (visits = visits.filter((v) => v.id !== row.id)),
      onEventMove: (e) => { e.row.start = iso(e.start); e.row.end = iso(e.end); if (e.toResource) e.row.provider = e.toResource as Visit['provider'] },
      onEventResize: (e) => { e.row.start = iso(e.start); e.row.end = iso(e.end) },
    }}
    containerHeight={460} />
{:else}
  <SvGrid data={visits} {columns} {features} getRowId={(r) => String(r.id)} sortable editable rowHeight={34} containerHeight={460} />
{/if}
```

<div data-docs-demo="382-scheduler-app-clinic" data-height="700"></div>

## See also

- [Scheduler / calendar mode](../rows/scheduler.md) - the reference: every option, collisions, time zones, selection, the Pro layer (dependencies, utilisation, find-a-time), the twenty-two demos.
- [Kanban: a sprint board](../kanban/sprint-board.md) - the other view of the same rows, built the same way.
- [SvCalendar](../ui-components/sv-calendar.md) - the recurrence rule and the date pickers the drawer uses.
- [Scheduling](../scheduling.md) - a different thing: cron jobs and reminders, not a calendar of rows.
