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
  import { enableGanttView } from '@svgrid/enterprise'

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
    { id: 't1', name: 'Interviews', parentId: 'p1', start: at(0), end: at(4), progress: 100, owner: 'Priya' },
    { id: 't2', name: 'Synthesis', parentId: 'p1', start: at(5), end: at(11), progress: 40, owner: 'Marco' },
    { id: 'p2', name: 'Build', parentId: null, start: at(12), owner: 'Sven' },
    { id: 't3', name: 'Implementation', parentId: 'p2', start: at(12), end: at(25), progress: 10, owner: 'Sven' },
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

## See also

- [Scheduler / calendar mode](/help/rows/scheduler) - the resource and booking
  view. Use it for appointments and shifts; use the Gantt for a project plan.
- [Kanban board mode](/help/rows/kanban-board) - the same rows as cards in lanes.
- [Tree data](/help/rows/tree-data) - hierarchy in the table itself.
