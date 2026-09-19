# Gantt: config reference

Every option on the `gantt` prop, with the page that explains it. The base
config (`GanttConfig`) ships in `@svgrid/grid`; the Enterprise superset
(`GanttProConfig`) and the renderer ship in `@svgrid/enterprise`.

```ts
import { SvGrid, type GanttConfig, type GanttDependency } from '@svgrid/grid'
import { enableGanttView, type GanttProConfig } from '@svgrid/enterprise'

enableGanttView()

const cfg: GanttProConfig<any, Task> = { startField: 'start', endField: 'end' }
```

Every example on this page runs against one setup:

```svelte {preamble}
<script lang="ts">
  import { SvGrid, type GridColumns, type GanttDependency } from '@svgrid/grid'
  import { enableGanttView, type GanttProConfig } from '@svgrid/enterprise'

  enableGanttView()

  type Task = {
    id: string
    name: string
    owner?: string
    start: string
    end?: string
    progress?: number
    parentId?: string | null
    milestone?: boolean
    color?: string
  }

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
    { id: 't1', name: 'Interviews', parentId: 'p1', start: at(0), end: at(4), progress: 100, owner: 'Priya', color: '#7c3aed' },
    { id: 't2', name: 'Synthesis', parentId: 'p1', start: at(5), end: at(11), progress: 40, owner: 'Marco', color: '#7c3aed' },
    { id: 'p2', name: 'Build', parentId: null, start: at(12), owner: 'Sven' },
    { id: 't3', name: 'Implementation', parentId: 'p2', start: at(12), end: at(25), progress: 10, owner: 'Sven', color: '#2563eb' },
    { id: 'm1', name: 'Launch', parentId: null, start: at(26), milestone: true, color: '#f59e0b' },
  ])
  const dependencies: GanttDependency[] = [
    { id: 'd1', from: 't1', to: 't2' },
    { id: 'd2', from: 't2', to: 't3' },
    { id: 'd3', from: 't3', to: 'm1' },
  ]
  const columns: GridColumns<Task> = [
    { field: 'name', header: 'Task', width: 200 },
    { field: 'owner', header: 'Owner', width: 100 },
  ]
  function writeSpan(row: Task, start: Date, end: Date) {
    row.start = isoDay(start)
    const last = new Date(end.getTime() - 86_400_000)
    row.end = isoDay(last < start ? start : last)
  }
  const pro = (c: GanttProConfig<any, Task>) => c
</script>
```

## Fields

| Option | Purpose | Page |
| --- | --- | --- |
| `startField` *(required)* | Field holding each task's start. | [Getting started](./start.md#how-dates-are-read) |
| `endField` | Field holding the finish. A date-only string is inclusive of its day. | [Getting started](./start.md#how-dates-are-read) |
| `durationField` | Length in **working** days, used when `endField` is absent. | [Getting started](./start.md#how-dates-are-read) |
| `titleField` | The task name. Defaults to the first column's field. | [Getting started](./start.md) |
| `progressField` | Percent complete (0-100); drives the fill and the rollup. | [Bars, progress and milestones](./start.md#bars-progress-and-milestones) |
| `parentField` | Parent task id - nests the rows into a work-breakdown tree. | [Work breakdown](./work-breakdown.md) |
| `milestoneField` | Boolean marking a milestone. A zero-length task is one anyway. | [Bars, progress and milestones](./start.md#bars-progress-and-milestones) |
| `colorField` / `color` | Per-task accent, or one for every bar. | [Colours](./customizing.md#colours-and-the-css-hooks) |

```svelte {runnable}
<SvGrid {data} {columns} getRowId={(r) => r.id}
  gantt={{
    startField: 'start', endField: 'end', titleField: 'name',
    progressField: 'progress', parentField: 'parentId', milestoneField: 'milestone', colorField: 'color',
  }} />
```

## Dependencies

| Option | Purpose | Page |
| --- | --- | --- |
| `dependencies` | Links as a flat list of `{ id, from, to, type?, lag? }`. `lag` is in days. | [Dependencies](./dependencies.md) |
| `dependencyField` | Per-row links on the predecessor: objects, or successor ids. | [Where the links come from](./dependencies.md#where-the-links-come-from) |
| `autoReschedule` | Cascade successors forward on an edit. Defaults to on with any link. | [Auto-reschedule](./dependencies.md#auto-reschedule) |
| `respectWorkingTime` | Schedule in working time: moves and cascades land on working days and keep working lengths, slack is in working days. Default `true`. | [Auto-reschedule](./dependencies.md#auto-reschedule) |
| `onDependenciesChange` | The cascaded shifts, `{ id, start, end }[]`. | [Auto-reschedule](./dependencies.md#auto-reschedule) |
| `onDependencyAdd` | A link drawn by hand, as a `GanttDependency`. | [Drawing and removing links](./dependencies.md#drawing-and-removing-links) |
| `onDependencyRemove` | A link removed from the arrow's menu, by id. | [Drawing and removing links](./dependencies.md#drawing-and-removing-links) |

```svelte {runnable}
<SvGrid {data} {columns} getRowId={(r) => r.id}
  gantt={{
    startField: 'start', endField: 'end', parentField: 'parentId',
    dependencies, autoReschedule: false,
  }} />
```

## The axis

| Option | Purpose | Page |
| --- | --- | --- |
| `zoom` | The preset the chart opens on: `day`, `week` (default), `month`, `quarter`, `year`. | [Zoom presets](./axis-and-working-time.md#zoom-presets) |
| `zoomLevels` | The presets the stepper and Ctrl+wheel move between. | [Zoom presets](./axis-and-working-time.md#zoom-presets) |
| `onZoomChange` | Fired with the new preset. | [Zoom presets](./axis-and-working-time.md#zoom-presets) |
| `weekStartsOn` | First day of the week, 0-6 (default 0). | [Non-working days](./axis-and-working-time.md#non-working-days-and-holidays) |
| `nonWorkingDays` / `holidays` / `showNonWorking` | Which days are off, and whether to shade them. | [Non-working days](./axis-and-working-time.md#non-working-days-and-holidays) |
| `todayLine` | The dashed today line. On by default. | [The window](./axis-and-working-time.md#the-window) |
| `minDate` / `maxDate` / `rangePaddingDays` | The axis window and its slack. | [The window](./axis-and-working-time.md#the-window) |

```svelte {runnable}
<SvGrid {data} {columns} getRowId={(r) => r.id}
  gantt={{
    startField: 'start', endField: 'end', parentField: 'parentId',
    zoom: 'day', zoomLevels: ['day', 'week'], weekStartsOn: 1, rangePaddingDays: 3,
  }} />
```

## Layout and collapse

| Option | Purpose | Page |
| --- | --- | --- |
| `tableColumns` | The task pane's columns, incl. `__duration`, `__progress`, `__slack`. | [The task table](./start.md#the-task-table) |
| `tableWidth` | The pane's width in px (default 360); the splitter resizes it. | [The task table](./start.md#the-task-table) |
| `rowHeight` | Height of one task row (default 32). | [Bars, progress and milestones](./start.md#bars-progress-and-milestones) |
| `summaryBars` | Parents draw a rolled-up spine (default) or an ordinary bar. | [How a summary rolls up](./work-breakdown.md#how-a-summary-rolls-up) |
| `labelPosition` | `'inside'`, `'right'` or `'none'` for the built-in label. | [The bar body](./customizing.md#the-bar-body) |
| `collapsed` / `onCollapseChange` | Controlled work-breakdown collapse. | [Collapse](./work-breakdown.md#collapse) |
| `searchable` / `searchPlaceholder` | The toolbar search box. | [Search, filter and sort](./start.md#search-filter-and-sort-flow-through) |

## Editing

| Option | Purpose | Page |
| --- | --- | --- |
| `editable` | Drag to move, resize, set progress and draw links. | [Editing](./editing.md) |
| `history` | Undo / redo with `Ctrl/Cmd+Z` and `Ctrl/Cmd+Shift+Z`. | [Undo and redo](./editing.md#undo-and-redo) |
| `onTaskMove` / `onTaskResize` / `onProgressChange` | Fired with the new values; write them to your rows. | [What each gesture reports](./editing.md#what-each-gesture-reports) |
| `onTaskAdd` / `onTaskDelete` | Create on a double-click or from the menu; delete from the menu, drawer or Delete key. | [Adding and deleting tasks](./editing.md#adding-and-deleting-tasks) |
| `drawer` / `onTaskCommit` | The built-in detail drawer and its save callback. | [The drawer](./editing.md#the-drawer) |

```svelte {runnable}
<SvGrid {data} {columns} getRowId={(r) => r.id}
  gantt={{
    startField: 'start', endField: 'end', parentField: 'parentId', progressField: 'progress',
    editable: true, history: true, drawer: true,
    onTaskMove: (e) => writeSpan(e.row, e.start, e.end),
    onTaskResize: (e) => writeSpan(e.row, e.start, e.end),
    onProgressChange: (e) => { e.row.progress = e.progress },
    onTaskCommit: (e) => Object.assign(e.row, e.values),
  }} />
```

## Chrome

| Option | Purpose | Page |
| --- | --- | --- |
| `task` | A snippet for a custom task-bar body. | [The bar body](./customizing.md#the-bar-body) |
| `tooltip` / `tooltipDelay` | `true` for the built-in hover card, a snippet for your own, and its delay. | [The tooltip](./customizing.md#the-tooltip) |
| `taskMenu` | Extra right-click items for a bar. | [The context menu](./customizing.md#the-context-menu) |

## Gantt Pro

The Enterprise options, on `GanttProConfig`:

| Option | Purpose | Page |
| --- | --- | --- |
| `criticalPath` / `onCriticalPathChange` | Ring the chain with no slack, and report its task ids. | [The critical path](./critical-path.md#the-critical-path) |
| `baselineStartField` / `baselineEndField` | The agreed dates, drawn as a ghost bar under each task. | [Baselines](./critical-path.md#baselines) |
| `constraintField` / `constraintDateField` | Pin a task's dates; the cascade stops at the constraint. | [Constraints](./critical-path.md#constraints) |
| `resourceField` / `resources` | Who is on each task, and the ordered resource list. | [Resource load](./resources.md) |
| `resourceHistogram` | The load strip: `true`, or `{ capacityField, height }`. | [The load strip](./resources.md#the-load-strip) |
| `collapseWeekends` / `collapsedGapPx` | Fold non-working days out of the axis, and the marker's width. | [Folding weekends out](./axis-and-working-time.md#folding-weekends-out-of-the-axis) |

```svelte {runnable}
<SvGrid {data} {columns} getRowId={(r) => r.id}
  gantt={pro({
    startField: 'start', endField: 'end', parentField: 'parentId',
    dependencies, criticalPath: true, tableColumns: ['name', '__slack'],
    collapseWeekends: true,
  })} />
```

## Event types

All in `@svgrid/grid`:

| Type | Fields |
| --- | --- |
| `GanttDependency` | `id`, `from`, `to`, `type?` (`'FS' \| 'SS' \| 'FF' \| 'SF'`), `lag?` in days. |
| `GanttTaskMoveEvent` | `row`, `start`, `end`, and `subtree?` - the descendants moved with a phase, each `{ row, start, end }`. |
| `GanttTaskResizeEvent` | `row`, `start`, `end`, `edge` (`'start' \| 'end'`). |
| `GanttProgressChangeEvent` | `row`, `progress` (0-100). |
| `GanttTaskCommitEvent` | `row`, `values` - the fields the drawer changed. |
| `GanttZoom` | `'day' \| 'week' \| 'month' \| 'quarter' \| 'year'`. |
| `GanttDrawerConfig` | `fields`, `title`, `side`, `size`, `submitLabel`, `columns` - the same shape as the scheduler's drawer. |

`GanttConstraint` (`'ASAP' \| 'ALAP' \| 'MSO' \| 'MFO' \| 'SNET' \| 'SNLT' \| 'FNET' \| 'FNLT'`) is in `@svgrid/enterprise`.

## The helpers

`@svgrid/enterprise` (and its `/gantt` entry point) also exports the pure
functions the renderer is built from, for reports, tests and your own views:

| Export | Does |
| --- | --- |
| `criticalPath(times, deps, cal?)`, `slackDays(result, id)` | The planning passes, in working time with a calendar. |
| `resourceLoad(assignments, columns, opts)`, `overallocations(rows)` | The load strip's numbers. |
| `resolveTasks`, `ganttTree`, `projectRange`, `ganttAxis`, `ganttScale` | Rows to bars, the tree, the window, the axis, the date-to-pixel scale. |
| `makeCalendar`, `isWorkingDay`, `workingDays`, `addWorkingDays`, `startForWorkingDays`, `moveWorkingSpan`, `snapToWorkingDay` | Working-time arithmetic. |
| `dependencyArrows`, `elbowPath` | The arrow geometry, shared with the scheduler's timeline. |

## See also

- [Gantt chart mode](../gantt.md) - the hub, with every demo.
- [Scheduler / calendar mode](../rows/scheduler.md) - the `scheduler` prop, whose drawer and resource types the Gantt shares.
