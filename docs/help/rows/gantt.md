# Gantt chart mode

Set one `gantt` prop and the grid renders its rows as a **task table beside a
time chart**: one bar per row, placed by its start and finish, nested into a
work-breakdown tree, with arrows between linked tasks. It is the same
`<SvGrid>`, the same `data` and `columns` - only the presentation changes.

Like [Kanban board mode](/help/rows/kanban-board) and the
[scheduler](/help/rows/scheduler), the Gantt is a pure **view of the grid**: it
renders the grid's already filtered, sorted and searched rows and writes back
only through callbacks - it never mutates your data.

> **Enterprise feature.** The `gantt` prop and its config types are part of the
> free grid, but the *renderer* ships in `@svgrid/enterprise`. Register it once
> and the view lights up:
>
> ```ts
> import { setLicenseKey, enableGanttView } from '@svgrid/enterprise'
> setLicenseKey('YOUR-KEY')   // omit to run soft-gated with a watermark
> enableGanttView()
> ```
>
> `installEnterprise(api)` also calls `enableGanttView()` for you. Without the
> renderer registered, a grid with a `gantt` prop shows an upgrade note.

<div data-docs-demo="474-gantt-intro" data-height="620"></div>

Every example below runs against this setup.

```svelte {preamble}
<script lang="ts">
  import { SvGrid, type GridColumns, type GanttDependency } from '@svgrid/grid'
  import { enableGanttView, type GanttProConfig } from '@svgrid/enterprise'

  enableGanttView()

  // One row type wide enough for every example on this page.
  type Task = {
    id: string
    name: string
    owner?: string
    start: string
    end?: string
    days?: number
    progress?: number
    parentId?: string | null
    milestone?: boolean
    color?: string
    blockedBy?: string[]
    bStart?: string
    bEnd?: string
  }

  // Anchored on a Monday so the weekend shading is obvious in every sample.
  const pad = (n: number) => String(n).padStart(2, '0')
  const isoDay = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
  const base = new Date()
  base.setHours(0, 0, 0, 0)
  base.setDate(base.getDate() - ((base.getDay() + 6) % 7))
  const at = (dayOffset: number) => {
    const d = new Date(base)
    d.setDate(d.getDate() + dayOffset)
    return isoDay(d)
  }

  let data = $state<Task[]>([
    { id: 'p1', name: 'Discovery', parentId: null, start: at(0), owner: 'Priya' },
    { id: 't1', name: 'Interviews', parentId: 'p1', start: at(0), end: at(4), progress: 100, owner: 'Priya', bStart: at(0), bEnd: at(3) },
    { id: 't2', name: 'Synthesis', parentId: 'p1', start: at(5), end: at(11), progress: 40, owner: 'Marco', bStart: at(4), bEnd: at(9) },
    { id: 'p2', name: 'Build', parentId: null, start: at(12), owner: 'Sven' },
    { id: 't3', name: 'Implementation', parentId: 'p2', start: at(12), end: at(25), progress: 10, owner: 'Sven', bStart: at(10), bEnd: at(23) },
    { id: 'm1', name: 'Launch', parentId: null, start: at(26), milestone: true },
  ])

  const rows = data
  const tasks = data
  const dependencies: GanttDependency[] = [
    { id: 'd1', from: 't1', to: 't2' },
    { id: 'd2', from: 't2', to: 't3' },
    { id: 'd3', from: 't3', to: 'm1' },
  ]
  const holidays = [at(17)]

  const columns: GridColumns<Task> = [
    { field: 'name', header: 'Task', width: 200 },
    { field: 'owner', header: 'Owner', width: 100 },
    { field: 'start', header: 'Start', width: 110 },
    { field: 'end', header: 'Finish', width: 110 },
  ]

  // The view reports what it wants and never writes your rows, so every editing
  // example needs this. `end` is exclusive on the way back, and these rows store
  // an inclusive date-only finish, so it subtracts a day.
  function writeSpan(row: Task, start: Date, end: Date) {
    row.start = isoDay(start)
    const last = new Date(end.getTime() - 86_400_000)
    row.end = isoDay(last < start ? start : last)
  }

  // Resources for the load-strip example, with a capacity field of their own.
  const crews = [
    { id: 'Priya', title: 'Priya', cap: 2 },
    { id: 'Marco', title: 'Marco', cap: 1 },
    { id: 'Sven', title: 'Sven', cap: 1 },
  ]

  // The Enterprise config is a superset of the free grid's, so the `gantt` prop
  // accepts it - but an inline object literal is checked against the narrower
  // type. Real code writes `const cfg: GanttProConfig<any, Task> = { ... }`;
  // this one-liner is just so the Pro examples below can stay inline.
  const pro = (c: GanttProConfig<any, Task>) => c
</script>
```

## The minimum

Point `gantt.startField` at the field holding each task's start. That is the
only required option. With an `endField` too, bars get their real length. The
title defaults to the first column's field.

```svelte {runnable}
<SvGrid {data} {columns} gantt={{ startField: 'start', endField: 'end' }} />
```

### How dates are read

Three rules, worth knowing before you shape your data:

- **Days are local calendar days.** A date-only string is parsed as local
  midnight, never UTC. (`new Date('2026-09-14')` is UTC midnight, which west of
  Greenwich is the 13th - a bar a day early on every task.)
- **`end` is exclusive, except a date-only string is inclusive of its day.** So
  `{ start: '2026-09-14', end: '2026-09-16' }` is the **three-day** task a person
  typing those dates means. A value carrying a time (a `Date`, epoch-ms, or an
  ISO string with `T`) is taken literally.
- **A task with a start but no end and no duration is a milestone** - it renders
  as a diamond.

Instead of an end you can give a length in **working days** with
`durationField`. A three-day task starting Thursday ends Tuesday, because the
weekend is skipped:

```svelte {runnable}
<SvGrid {data} {columns}
  gantt={{ startField: 'start', durationField: 'days', nonWorkingDays: [0, 6] }} />
```

## Work breakdown

Set `parentField` to the field holding each row's **parent id** and the flat
rows nest into a tree. A row with children gets a collapse chevron and draws a
**summary bar** rolled up from every descendant, so a phase carries no dates of
its own - there is nothing to keep in sync by hand.

```svelte {runnable}
<SvGrid {data} {columns}
  gantt={{
    startField: 'start', endField: 'end',
    parentField: 'parentId',
    progressField: 'progress',
  }} />
```

A summary's percent is **weighted by duration**, not by task count: a two-day
task at 100% beside a six-day task at 0% reads as 25% done, not 50%. Weighting
by count would report progress the plan has not made. Descendants with no
duration (milestones) weigh nothing, so a parent holding only milestones falls
back to their plain mean.

Rows whose parent id matches no task become roots rather than vanishing, which
is what keeps a filtered-out phase from hiding its tasks.

> **Do not also set `treeData`.** The Gantt owns its own tree because it needs
> every descendant - a collapsed phase still contributes to its summary bar -
> whereas `treeData` hides collapsed children from the view before the renderer
> sees them. Setting both makes summaries under-report, and the grid warns about
> it in development.

Collapse is the Gantt's own state by default. Hoist it with `collapsed` and
`onCollapseChange` to persist it or drive it from elsewhere:

```svelte {runnable}
<SvGrid {data} {columns}
  gantt={{
    startField: 'start', endField: 'end', parentField: 'parentId',
    collapsed: ['p1'],
    onCollapseChange: (next) => console.log('collapsed', next),
  }} />
```

## Bars, progress and milestones

| Option | What it draws |
| --- | --- |
| `progressField` | A 0-100 fill inside the bar, and the rollup on parents. |
| `milestoneField` | A diamond instead of a bar. A zero-length task is one anyway. |
| `colorField` / `color` | The bar's accent, per task or for all of them. |
| `summaryBars` | `false` draws parents as ordinary bars instead of a rolled-up spine. |
| `labelPosition` | `'inside'` (default, falling back to the right when the bar is too narrow), `'right'`, or `'none'`. |
| `task` | A snippet for a custom bar body, in place of the label. |

```svelte {runnable}
<SvGrid {data} {columns}
  gantt={{
    startField: 'start', endField: 'end', parentField: 'parentId',
    progressField: 'progress',
    milestoneField: 'milestone',
    colorField: 'color',
    labelPosition: 'right',
  }} />
```

## Dependencies

Link tasks with predecessor -> successor **dependencies** and the chart draws an
arrow between them. Four link types are supported - `FS` (finish-to-start, the
default), `SS`, `FF`, `SF` - plus an optional `lag` in **days** (negative for a
lead).

```svelte {runnable}
<SvGrid {data} {columns}
  gantt={{
    startField: 'start', endField: 'end', parentField: 'parentId',
    dependencies,
  }} />
```

`from` / `to` are **row ids** (your `getRowId`). Provide them as a flat
`dependencies` array, or per row through `dependencyField` - an array of
`GanttDependency` objects, or just a list of successor ids:

```svelte {runnable}
<SvGrid {data} {columns}
  gantt={{ startField: 'start', endField: 'end', dependencyField: 'blockedBy' }} />
```

A link that is not currently satisfied - a successor sitting too early to be
legal - draws as a **dashed red arrow**. Cyclic links are ignored rather than
flagged: with a cycle there is no answer to what "late" would mean, and ignoring
them is what stops an auto-reschedule from looping.

A link pointing into a **collapsed** phase re-anchors on that phase's summary
bar, so folding a phase never makes an arrow disappear. A link to a row the grid
has filtered out simply draws nothing.

## Editing

Set `editable` and the chart becomes a plan you can change: drag a bar to move
it, drag either edge to resize, drag the diamond on the fill to set percent, and
drag the handle at a bar's end onto another bar to draw a link.

The view **never mutates your rows**. It moves its own overlay so the drag is
live, and reports what it wants through a callback; writing the row is yours.

```svelte {runnable}
<SvGrid {data} {columns}
  gantt={{
    startField: 'start', endField: 'end', parentField: 'parentId',
    progressField: 'progress',
    dependencies,
    editable: true,
    history: true,
    drawer: true,
    onTaskMove: (e) => {
      writeSpan(e.row, e.start, e.end)
      // A phase carries its children: one callback, the whole batch.
      for (const s of e.subtree ?? []) writeSpan(s.row, s.start, s.end)
    },
    onTaskResize: (e) => writeSpan(e.row, e.start, e.end),
    onProgressChange: (e) => { e.row.progress = e.progress },
    onDependenciesChange: (moves) => {
      for (const m of moves) {
        const row = data.find((r) => r.id === m.id)
        if (row) writeSpan(row, m.start, m.end)
      }
    },
  }} />
```

> **`end` is exclusive on the way back too.** If your rows store an inclusive
> date-only finish, subtract a day when you write it:
>
> ```ts
> function writeSpan(row: Task, start: Date, end: Date) {
>   row.start = isoDay(start)
>   const last = new Date(end.getTime() - 86_400_000)
>   row.end = isoDay(last < start ? start : last)
> }
> ```

### What each gesture reports

| Gesture | Callback | Notes |
| --- | --- | --- |
| Drag a bar | `onTaskMove` | Keeps the duration. Dragging a **phase** moves its whole subtree and fills `subtree` with the batch. |
| Drag an edge | `onTaskResize` | `edge` says which one. A bar never shrinks below a day. |
| Drag the progress diamond | `onProgressChange` | Whole 5% steps. Leaves only; a phase shows its rollup. |
| Drag a bar's end handle onto another bar | `onDependencyAdd` | The edge you drag from and the half you drop on pick `FS` / `SS` / `FF` / `SF`. |
| Right-click an arrow | `onDependencyRemove` | |
| Double-click empty space | `onTaskAdd` | Creates a one-day task in that row's phase. |
| Drawer save | `onTaskCommit` | Start, Finish and Progress are pinned above the column fields. |

A drag under three pixels counts as a click, so clicking a bar still opens the
drawer rather than nudging the plan by a day.

### Auto-reschedule

With dependencies present, moving or resizing a task pushes its successors
forward far enough to keep every link legal, preserving each one's duration.
The shifts arrive together in `onDependenciesChange`. Cascading only ever pushes
**forward** - it never pulls a task earlier - and with `respectWorkingTime` (on
by default) a cascaded start lands on a working day.

Set `autoReschedule: false` to draw the arrows without moving anything.

A link that would close a **cycle**, or one that already exists, is refused: both
bars flash and no callback fires. A cycle has no legal schedule, so there is
nothing the cascade could do with it.

### Keyboard

Bars are focusable, so the whole plan is reachable without a mouse.

| Key | Does |
| --- | --- |
| `Left` / `Right` | Move a day. With `Shift`, a week. With `Alt`, stretch the finish. |
| `+` / `-` | Step progress by 5. |
| `Enter` | Open the drawer. |
| `Delete` | `onTaskDelete`. |
| `Escape` | Cancel the drag in progress, restoring the bar. |
| `Ctrl/Cmd+Z`, `Ctrl/Cmd+Shift+Z` | Undo / redo, with `history`. |

Undo **re-fires the callbacks** with the reversed values, cascade included, so
your data follows it back rather than drifting out of step with the chart.

## Working time and the axis

Non-working days are shaded, and every duration and cascade calculation skips
them.

```svelte {runnable}
<SvGrid {data} {columns}
  gantt={{
    startField: 'start', endField: 'end',
    nonWorkingDays: [0, 6],   // Sun + Sat, the default
    holidays,
    weekStartsOn: 1,
    zoom: 'week',
  }} />
```

Five axis presets, each a tick unit under a coarser grouping row:

| `zoom` | Ticks | Grouped by |
| --- | --- | --- |
| `day` | days (named) | weeks |
| `week` *(default)* | days | months |
| `month` | weeks | months |
| `quarter` | months | quarters |
| `year` | months | years |

The toolbar shows a zoom stepper over `zoomLevels` (all five by default; a
single entry hides it), and `Ctrl`/`Cmd`+wheel over the chart steps it too,
keeping the date under the pointer fixed. `onZoomChange` reports the change.

The window spans the first start to the last finish plus `rangePaddingDays` (7)
of slack, clamped by `minDate` / `maxDate`. A dashed **today line** crosses the
chart (`todayLine: false` to hide it).

## The task table

The left pane lists the same rows. By default it shows every column that has a
`field`; name and order them with `tableColumns`, which also accepts two
built-ins that need no column definition:

- **`__duration`** - the task's length in working days.
- **`__progress`** - a small meter plus the percent.
- **`__slack`** - days of room before the task would move the project finish.
  Needs `criticalPath` (see [Gantt Pro](#gantt-pro)); blank without it.

```svelte {runnable}
<SvGrid {data} {columns}
  gantt={{
    startField: 'start', endField: 'end', parentField: 'parentId',
    progressField: 'progress',
    tableColumns: ['name', 'owner', '__duration', '__progress'],
    tableWidth: 340,
    rowHeight: 34,
  }} />
```

Drag the divider to resize the pane. The table and the chart share one
scroll container, so their rows can never drift apart.

The pane is a compact list, not a second grid: it has no inline editing or
per-column menus. Sorting and filtering happen on the grid itself, which is why
the usual pattern is a **Gantt / Table toggle** over the same rows (demo 474
shows it) - flip the `gantt` prop off and the full table is back, with every
column feature.

## Search, filter and sort flow through

The Gantt draws the rows the grid hands it, after filtering and sorting. So the
search box above the chart, any column filters, and the sort order all apply
without the view knowing about them.

Sorting reorders tasks **within each phase**; children stay under their parent.

## Gantt Pro

Five options turn the chart from a picture of the plan into a tool for
questioning it. They live on `GanttProConfig`, the Enterprise superset of the
`gantt` config - structurally assignable to the prop, so the free grid never
needs to know about them:

```ts
import type { GanttProConfig } from '@svgrid/enterprise'

const cfg: GanttProConfig<any, Task> = { startField: 'start', /* ... */ }
```

### The critical path

`criticalPath: true` runs the two passes every planner knows: a forward one
giving each task its **earliest** start and finish, a backward one giving it its
**latest**. Where the two agree the task has no slack - it cannot slip a day
without moving the project's finish - and that chain, with the arrows along it,
is ringed in red.

```svelte {runnable}
<SvGrid {data} {columns}
  gantt={pro({
    startField: 'start', endField: 'end', parentField: 'parentId',
    dependencies,
    criticalPath: true,
    tableColumns: ['name', '__duration', '__slack'],
    onCriticalPathChange: (keys) => console.log('critical', keys),
  })} />
```

Two rules worth knowing, because both are judgement calls rather than
arithmetic:

- **A task in no dependency is never critical**, however late it runs. It is not
  on any path, so calling it critical would point at something the schedule does
  not actually turn on. It still gets a slack figure for the `__slack` column.
- **Cyclic links are ignored**, exactly as the cascade ignores them: a cycle has
  no legal schedule, so there is no earliest or latest to compute through it.

The pass is a pure function, so a report or a test can call it without rendering
anything:

```ts
import { criticalPath, slackDays } from '@svgrid/enterprise'

const result = criticalPath(times, dependencies)
result.critical              // Set<string> of task ids
result.finish                // the earliest the project can end
slackDays(result, 'task-7')  // whole days of room
```

### Baselines

`baselineStartField` / `baselineEndField` draw the originally agreed dates as a
**ghost bar** under each task. Where the plan now finishes later than the
baseline did, the ghost turns red and the tooltip says by how many days.

```svelte {runnable}
<SvGrid {data} {columns}
  gantt={pro({
    startField: 'start', endField: 'end', parentField: 'parentId',
    baselineStartField: 'bStart', baselineEndField: 'bEnd',
    tooltip: true,
  })} />
```

### Constraints

`constraintField` pins a task's dates in the classic planning vocabulary, with
the date itself in `constraintDateField`:

| Constraint | Means |
| --- | --- |
| `ASAP` *(default)* | Schedule as early as the links allow. |
| `MSO` / `MFO` | Must start / finish **on** the date. |
| `SNET` / `SNLT` | Start no earlier / no later than. |
| `FNET` / `FNLT` | Finish no earlier / no later than. |

A constrained bar carries a small glyph, and one whose own dates already break
its rule is flagged. More usefully, the **cascade respects the ceiling**: pushing
a chain into a task that must finish by a contract date stops *at* the date and
leaves the link drawn as unsatisfied, rather than overrunning it silently. A
constraint and a dependency that disagree have no schedule satisfying both, so
showing the conflict beats breaking one of them behind your back.

### Resource load

`resourceField` names the field holding who is on each task; `resourceHistogram`
sums them into a strip under the chart - one row per resource, one bar per axis
column, counting the tasks that touch it, with anything past capacity in red.

```svelte {runnable}
<SvGrid {data} {columns}
  gantt={pro({
    startField: 'start', endField: 'end', parentField: 'parentId',
    resourceField: 'owner',
    resources: crews,
    resourceHistogram: { capacityField: 'cap', height: 80 },
  })} />
```

A cell's number is **how many of that resource's tasks overlap the column**, not
an average and not person-hours. On a day or week axis that is exactly
concurrency; on a coarser one it counts everything touching the column, which
reads high rather than low. Only **leaves** are counted - a phase is its
children, so counting it too would book its owner twice for the same work.

Omit `resources` and the rows come from the data, in the order the tasks first
name them, each with a capacity of one. `resourceField` on its own (no
histogram) still puts the resource in the tooltip.

### A folded axis

`collapseWeekends` takes the whole non-working days out of the timeline and
leaves a narrow hatched marker where each run was, so a quarter fits in the width
a month used to take. Working days keep their real size - nothing is squashed -
and a task that does run over a folded weekend still draws across it.

```svelte {runnable}
<SvGrid {data} {columns}
  gantt={pro({
    startField: 'start', endField: 'end', parentField: 'parentId',
    zoom: 'week', collapseWeekends: true, collapsedGapPx: 10,
  })} />
```

`collapsedGapPx: 0` removes the folded days outright: Friday's finish and
Monday's start land on the same pixel. Only the day-granular presets (`day`,
`week`) have weekend columns to fold; at `month` and coarser a tick is never
wholly non-working, so the option is ignored rather than shrinking a week by
part of itself.

### Pro config reference

| Option | Purpose |
| --- | --- |
| `criticalPath` / `onCriticalPathChange` | Ring the chain with no slack, and report its task ids. |
| `baselineStartField` / `baselineEndField` | The agreed dates, drawn as a ghost bar under each task. |
| `constraintField` / `constraintDateField` | Pin a task's dates; the cascade stops at the constraint. |
| `resourceField` / `resources` | Who is on each task, and the ordered resource list. |
| `resourceHistogram` | The load strip: `true`, or `{ capacityField, height }`. |
| `collapseWeekends` / `collapsedGapPx` | Fold non-working days out of the axis, and the marker's width. |

## Config reference

| Option | Purpose |
| --- | --- |
| `startField` *(required)* | Field holding each task's start. |
| `endField` | Field holding the finish. A date-only string is inclusive of its day. |
| `durationField` | Length in WORKING days, used when `endField` is absent. |
| `titleField` | The task name. Defaults to the first column's field. |
| `progressField` | Percent complete (0-100); drives the fill and the rollup. |
| `parentField` | Parent task id - nests the rows into a work-breakdown tree. |
| `milestoneField` | Boolean marking a milestone. A zero-length task is one anyway. |
| `colorField` / `color` | Per-task accent, or one for every bar. |
| `dependencies` / `dependencyField` | Links (`{ id, from, to, type?, lag? }`), as a flat list or per row. `lag` is in days. |
| `autoReschedule` / `respectWorkingTime` | Cascade successors forward on an edit, landing on working days. |
| `onDependenciesChange` / `onDependencyAdd` / `onDependencyRemove` | The link callbacks. |
| `zoom` / `zoomLevels` / `onZoomChange` | The axis preset, the stepper's presets, and the change callback. |
| `weekStartsOn` | First day of the week, 0-6 (default 0). |
| `nonWorkingDays` / `holidays` / `showNonWorking` | Which days are off, and whether to shade them. |
| `todayLine` | The dashed today line. On by default. |
| `minDate` / `maxDate` / `rangePaddingDays` | The axis window and its slack. |
| `tableColumns` / `tableWidth` | The task pane's columns (incl. `__duration`, `__progress`) and width. |
| `rowHeight` | Height of one task row (default 32). |
| `summaryBars` / `labelPosition` | Parent bar style, and where a bar's label sits. |
| `collapsed` / `onCollapseChange` | Controlled work-breakdown collapse. |
| `editable` / `history` | Drag to move, resize, set progress and draw links; undo / redo. |
| `onTaskMove` / `onTaskResize` / `onProgressChange` | Fired with the new values; write them to your rows. |
| `onTaskAdd` / `onTaskDelete` | Create on a double-click of empty space; delete from the menu. |
| `task` / `tooltip` / `tooltipDelay` | A custom bar body, and the hover tooltip. |
| `drawer` / `onTaskCommit` | The built-in detail drawer and its save callback. |
| `taskMenu` | Right-click menu items for a bar. |
| `searchable` / `searchPlaceholder` | The toolbar search box. |

## More examples

### Plan editing

Every gesture with a log panel listing the callbacks it fires: drag, resize, the
progress grip, drawing links, auto-reschedule over a holiday, and undo.

<div data-docs-demo="475-gantt-editing" data-height="600"></div>

### Critical path & baselines

A fit-out schedule with the planning layer on: the chain with no slack ringed in
red, a Slack column for everything else, baseline ghosts that redden where the
plan has drifted, and two pinned tasks where a cascade stops at the constraint.

<div data-docs-demo="476-gantt-critical-path" data-height="620"></div>

### Resource load & a folded axis

A field-service quarter with a load strip under the chart, per-resource capacity,
and the weekends folded out of the timeline.

<div data-docs-demo="477-gantt-resources" data-height="620"></div>

## See also

- [Scheduler / calendar mode](/help/rows/scheduler) - the resource and booking
  view. Use it for appointments and shifts; use the Gantt for a project plan.
- [Kanban board mode](/help/rows/kanban-board) - the same rows as cards in lanes.
- [Tree data](/help/rows/tree-data) - hierarchy in the table itself.
