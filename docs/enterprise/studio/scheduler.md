# Scheduler / calendar view

Any grid whose rows carry a date can render as a **calendar** instead of a table -
a Month / Week / Day / Agenda (and Timeline) view where each row becomes an event
placed by time. It is a **view of the grid**, exactly like the [Kanban board](./app-designer.md):
same rows, same data source, same edit form - only the presentation changes. Drag
an event to reschedule it and the new time is written back through the data source.

The calendar renderer ships in `@svgrid/enterprise`; the generated app registers it
once with `enableSchedulerView()` and then renders `<SvGrid scheduler={...}>`.

![The scheduler view: the grid's rows rendered as a week calendar with timed events, an all-day lane, Month / Week / Day / Agenda switches, and a Calendar / Table toggle.](/docs-media/studio-scheduler.png)

## Turn it on

In the [visual designer](./app-designer.md), select a grid block and expand
**Scheduler / calendar** in the inspector. Tick **Render rows as a calendar /
scheduler** and map the fields:

- **Start (date) field** - required; the event's start (a `date` / `datetime` field).
- **End field** - optional; omit and each event uses a default duration.
- **Title** - the event label (defaults to the first column).
- **Color** - a field whose value tints the event (e.g. a status or priority enum).
- **Resource** - optional; splits the Week / Day grid into one column per value
  (per person, room, or machine) - a resource scheduler.
- **Opens on** - Month, Week, Day, Agenda, or a Timeline view.
- **Drag to move / resize** - turns on drag-to-reschedule and edge-resize, writing
  the new start / end back through the data source (optimistic, then persisted).
- **Event detail drawer** - a built-in panel to view / edit an event's fields.

The canvas preview switches to the live calendar as soon as you map a start field,
so you can try Month / Week / Day and drag events right in the designer.

> The scheduler is a **render mode**: it is mutually exclusive with row **grouping**
> and **tree data** on the same grid. Pick one.

## What it generates

The block compiles to the grid's own `scheduler` prop plus write-back handlers -
real, typed Svelte, not a black box:

```svelte
<script lang="ts">
  import { enableSchedulerView } from '@svgrid/enterprise'
  enableSchedulerView()
  // ... load allRows ...
</script>

<SvGrid
  data={allRows}
  columns={columns}
  getRowId={(r) => String(r.id)}
  scheduler={{
    startField: 'startedAt',
    endField: 'dueDate',
    titleField: 'title',
    colorField: 'priority',
    resourceField: 'assignee',
    initialView: 'week',
    editable: true,
    drawer: true,
    onEventMove: (e) => { /* patch start/end on the row, persist */ },
    onEventCommit: (e) => { /* save the drawer's edits */ },
  }}
/>
```

A resource / title / color field that points at a relation is resolved to its
display column automatically (e.g. `assigneeId` renders as the assignee's name).

## The calendar block

The standalone **calendar** block (a dedicated "Schedule" screen) uses the same
renderer - a Month calendar with a detail drawer, read-first. Use it for a simple
"events on a month grid" screen; use the grid **Scheduler view** above when you
want Week / Day time-grids, per-resource columns, timelines, or drag-to-reschedule.

## In the sample apps

Several starter apps ship a scheduler so you can see it end to end:

- **Projects** - a task **timeline** (start -> due) with one row per assignee, tinted by priority.
- **People Ops (HR)** - a **leave calendar**: time-off as a per-employee resource scheduler.
- **HireDesk (ATS)** - interviews on a **Week** grid, colored by pipeline stage.
- **Evently**, **HealthClinic**, **FitClub**, and the restaurant app - month event calendars.

## See also

- The underlying grid feature and its live demos: [Scheduler / calendar mode](#/demos/363-scheduler-intro),
  [timeline views](#/demos/371-scheduler-timeline), and the real-world apps built on it -
  [Horizon calendar client](#/demos/381-scheduler-app-calendar), [Meridian Clinic](#/demos/382-scheduler-app-clinic),
  [Dispatch board](#/demos/383-scheduler-app-dispatch), [Portfolio roadmap](#/demos/384-scheduler-app-roadmap),
  and [Broadcast content calendar](#/demos/385-scheduler-app-content).
- [App designer](./app-designer.md) - the block palette and inspector.
- [Kanban board](./app-designer.md) - the other "view of the grid".
