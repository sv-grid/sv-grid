# The same rows as a grid, a scheduler and a board

The Gantt is one of four ways the grid can render a set of rows. The others
are the table itself, the [scheduler](../rows/scheduler.md) and the
[Kanban board](../rows/kanban-board.md), and all four are the same `<SvGrid>`
with a different prop. This page is about running more than one of them over
one array: what to switch, how the edits get back, and the one data-shape rule
that keeps the views in step.

<div data-docs-demo="478-gantt-four-views" data-height="620"></div>

## One grid, one prop per view

Each view is a prop on `<SvGrid>`; the rest of the props stay as they are:

```svelte
{#if view === 'grid'}
  <SvGrid {data} {columns} getRowId={(r) => r.id} sortable enableInlineEditing />
{:else if view === 'gantt'}
  <SvGrid {data} {columns} getRowId={(r) => r.id} gantt={ganttCfg} />
{:else if view === 'scheduler'}
  <SvGrid {data} {columns} getRowId={(r) => r.id} scheduler={schedulerCfg} />
{:else}
  <SvGrid {data} {columns} getRowId={(r) => r.id} board={boardCfg} />
{/if}
```

`data`, `columns` and `getRowId` are shared, which is what makes the views
agree: a row is the same object with the same id in all four. The columns do
double duty - the table shows them, the Gantt's task pane lists the ones named
in `tableColumns`, and the scheduler's and board's drawers edit them with each
column's `editorType`.

Switching the prop remounts the view, so anything a view keeps for itself (the
Gantt's collapse state, the scheduler's current date, a lane's scroll) starts
over. Hoist what should survive: `collapsed` / `onCollapseChange` on the
Gantt, `initialDate` on the scheduler.

## Which view for which question

| Question | View | The prop |
| --- | --- | --- |
| What is the list, and can I edit a cell? | Table | none |
| When does each task run, and what depends on what? | Gantt | `gantt` |
| Who is busy when, and who has room? | Scheduler, timeline views | `scheduler` with `resourceField` |
| What state is each item in, and what is next? | Kanban | `board` with `groupBy` |

The Gantt and the scheduler overlap on "when". The Gantt is for a **plan**: a
tree of tasks, links between them, a finish date the whole thing turns on. The
scheduler is for **bookings**: rooms, shifts, appointments, one resource per
row, with a calendar's month / week / day views. A task with an owner can go
on either; a project with phases and dependencies belongs on the Gantt.

## Edits flow one way: through callbacks

No view mutates a row. Each reports what it wants and you write it:

| View | Gesture | Callback |
| --- | --- | --- |
| Table | inline edit commits | `onCellValueChange` (the value is already on the row) |
| Gantt | drag, resize, progress grip | `onTaskMove`, `onTaskResize`, `onProgressChange` |
| Scheduler | drag to a time or a resource, resize | `onEventMove`, `onEventResize` |
| Kanban | drag to a lane | `onCardMove` |

Because the rows are shared, an edit in one view is the next view's data.
Write the status in `onCardMove` and the table's Status column has it; write
the dates in `onTaskMove` and the scheduler's bar has moved. The demo above
names the last write and the view that asked for it under the switcher.

Derived fields are yours to keep consistent. The demo sets `progress` to 100
when a card lands on **Done** and flips the status to **Done** when the Gantt's
progress grip reaches 100, so neither view can contradict the other.

## One date shape for every view

The views read a date-only string differently, and it is the one thing that
will put them out of step:

- The **Gantt** reads `'2026-09-16'` as the local calendar day, and an
  `endField` holding a date-only string as **inclusive** of that day.
- The **scheduler** reads it with `new Date(...)`, which is UTC midnight -
  west of Greenwich that is the 15th - and its end is always exclusive.

So the same `{ start: '2026-09-14', end: '2026-09-16' }` is a three-day bar on
the Gantt and a two-day event (or a day early) on the scheduler.

Store **timestamps with an exclusive end** when rows feed both. A local ISO
string without an offset (`'2026-09-14T00:00'`) parses as local time in every
browser, and both views take a value carrying a time literally:

```ts
type Row = {
  id: string
  name: string
  start: string   // '2026-09-14T00:00' - local midnight
  end: string     // '2026-09-17T00:00' - exclusive: the 14th, 15th and 16th
  allDay: boolean // true, so the scheduler draws a whole-day bar
}

const iso = (d: Date) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`

function writeSpan(row: Row, start: Date, end: Date) {
  // Every view hands back `end` exclusive, so it is stored as it comes.
  row.start = iso(start)
  row.end = iso(end)
}
```

The table then formats the dates for display: `end` minus a day is the last
day a task runs, which is what a Finish column should say.

## Phases and milestones are Gantt-only rows

A phase row carries no dates of its own; a milestone has no length. Both are
rows the Gantt draws (as a summary bar and a diamond) and the other views
would render as an empty card or an hour-long event. Give such rows a `kind`
and hand the table, scheduler and board the tasks only:

```ts
const tasks = $derived(rows.filter((r) => r.kind === 'task'))
```

The Gantt gets `rows`; the other three get `tasks`. Both are views of the same
array, so the write-back rule above still holds.

## Four synced views at once

The switcher above shows one view at a time. Two of the scheduler demos put
four views on screen together in a dockable workspace, all reading one array:

<div data-docs-demo="387-scheduler-financial" data-height="640"></div>

<div data-docs-demo="388-scheduler-hr" data-height="640"></div>

## See also

- [Kanban board mode](../rows/kanban-board.md) - the `board` prop.
- [Scheduler / calendar mode](../rows/scheduler.md) - the `scheduler` prop and its timeline views.
- [Editing](./editing.md) - every Gantt callback and what arrives in it.
