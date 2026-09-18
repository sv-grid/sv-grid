# Gantt view: implementation plan

A Gantt view for SvGrid that lives entirely in `@svgrid/enterprise`, built the
way the Scheduler is built: a pure, unit-tested model file, a renderer
component that reads rows and writes back only through callbacks, a Pro
config superset, and a soft gate. The free grid is not changed.

Nothing here is implemented yet. Line numbers refer to commit `198c2f0`.

Contents

1. Where the Gantt lives and how it attaches to the grid
2. What "similar to the Scheduler" means in this codebase
3. A decision to make first
4. Reuse map
5. Phase 1: `SvGantt`, read-only
6. Phase 2: editing
7. Phase 3: planning features (`GanttProConfig`)
8. Demos, docs and the sweep
9. PR slicing, order and acceptance criteria
10. Open questions and risks

## 1. Where the Gantt lives and how it attaches to the grid

Everything goes under `packages/enterprise/src/gantt/`:

```
packages/enterprise/src/gantt/
  index.ts                 the subpath entry (`@svgrid/enterprise/gantt`), re-exported from the main index
  gantt-config.ts          GanttConfig, GanttProConfig, event types, GanttDependency
  gantt-model.ts           resolveTasks, ganttTree, projectRange, ganttAxis, working-day math
  gantt-model.test.ts
  gantt-critical-path.ts   Phase 3
  gantt-critical-path.test.ts
  timeline-arrows.ts       shared with SvGridScheduler (extracted from it)
  timeline-arrows.test.ts
  gantt.ts                 enableGantt(): the soft-gate latch, called by installEnterprise
  SvGantt.svelte           the component
  gantt.dom.test.ts
```

`SvGantt` is a standalone component, like `SvSheet`, not a `<SvGrid>` prop.
It composes a real `<SvGrid>` for the task table on the left and draws the
chart on the right:

```svelte
<script lang="ts">
  import { SvGantt } from '@svgrid/enterprise'
  const gantt = { startField: 'start', endField: 'end', parentField: 'parentId', progressField: 'progress' }
</script>

<SvGantt data={tasks} {columns} {gantt} getRowId={(r) => r.id} containerHeight={560} />
```

Why composition rather than a `gantt` prop on the free grid:

- The whole feature stays in the commercial package. No type, seam, upsell
  branch or message lands in `@svgrid/grid`, so the grid's base bundle and
  the `grid-wc` entry budgets (which have 0.3 KiB of headroom, see
  `packages/grid-wc/scripts/check-size.mjs` line 34) do not move.
- The task table is the real grid: sorting, filtering, the search box,
  column resize, inline editing, `treeData` chevrons and keyboard, row
  virtualization, themes. The Scheduler's resource gutter had to reimplement
  a table; this design does not. `SvSheet` (line 3254) already drives an
  inner grid through `onApiReady`, so the pattern exists in the package.
- The grid's `treeData` prop supplies the work-breakdown tree (expand,
  collapse, indent, `expanded` / `onExpandedChange`), and
  `api.getDisplayedRows()` gives the rows in display order after filter,
  sort and expansion. The Gantt draws one chart row per displayed row.

The alternative of one grid with a wide "chart column" (demo 45's pattern,
with the axis in a snippet header) was rejected: dependency arrows and the
today line must span rows, which means an overlay fighting the grid's
virtualizer and pinning internals, and the header axis would have to live
inside a column header. The composed design keeps the chart DOM entirely
under `SvGantt`'s control, as the Scheduler's timeline is.

How the two panes stay in step:

- Rows: `SvGantt` passes `data`, `columns`, `getRowId`, `treeData`,
  `rowHeight` (fixed) and `containerHeight` to the inner grid, captures `api`
  from `onApiReady`, and refreshes `displayed = api.getDisplayedRows()` on
  `onSortingChange`, `onFiltersChange`, `onExpandedChange`, and whenever
  `data` changes. Chart row `i` is displayed row `i`, at `top = i * rowHeight`.
- Vertical scroll: the grid scrolls inside `.sv-grid-container` (SvGrid
  line 1998, `ctrl.scrollContainer`). `SvGantt` finds that element under
  its own root once the api is ready, listens to its `scroll` event, and
  sets the chart pane's `scrollTop` to match; a wheel or drag over the
  chart sets the grid container's `scrollTop` the other way, with a
  reentrancy flag. A follow-up may add `api.getScrollElement()` to the grid
  so the class name is not load-bearing; Phase 1 uses the query.
- Virtualization: the grid windows its own rows. The chart pane renders
  bars for displayed rows within `scrollTop - 20 * rowHeight` to
  `scrollTop + height + 20 * rowHeight`, absolutely positioned by index, so a
  2,000-task plan costs what a 60-row plan costs. The arrow overlay spans
  every row (paths are cheap) and is computed from all displayed rows.
- Horizontal scroll belongs to the chart pane alone. The task table keeps
  its own horizontal scrollbar for wide column sets.
- The splitter between the panes resizes the table's width
  (`tableWidth`); the inner grid gets `containerHeight="100%"` inside a
  fixed-width flex item.

Soft gate: `gantt.ts` exports `enableGantt()` with the `enableServerRowModel`
shape (`packages/enterprise/src/server/enable.ts`): a latch that raises
`emitUnlicensedNudge()` once when no key is set. `installEnterprise` calls
it beside `enableBoardView()`, and `SvGantt` calls it on first mount, so an
app that only imports the component is still gated.

Package wiring: `packages/enterprise/package.json` gains a `./gantt` subpath
beside `./sheet` (lines 45-49) for apps that want the Gantt without the main
entry; the main `index.ts` re-exports the same names beside the Scheduler
Pro block (line 281). `scripts/build-cdn.mjs` bundles the main entry only,
which already includes it.

## 2. What "similar to the Scheduler" means in this codebase

| Scheduler today | File | Gantt equivalent |
| --- | --- | --- |
| `SchedulerConfig` and event types | `packages/grid/src/SvGrid.types.ts` lines 832-1110 | `GanttConfig` and event types in `gantt/gantt-config.ts` |
| Pure model: `resolveEvents`, `timelineAxis`, `timelineGeom`, `timelineRows`, unit-tested | `packages/grid/src/scheduler-model.ts` | `gantt/gantt-model.ts`: `resolveTasks`, `ganttTree`, `projectRange`, `ganttAxis`, `workingDays` |
| Pro renderer registered by `enableSchedulerView()` (soft-gated, idempotent, called by `installEnterprise`) | `SvGridScheduler.svelte`, `scheduler.ts`, `install.ts` | `SvGantt.svelte`, `gantt.ts` with `enableGantt()`, one line in `install.ts` |
| Pro superset config read through a cast (`pcfg`, renderer line 306) | `scheduler-config.ts` | `GanttProConfig` in `gantt-config.ts`, read the same way |
| Move / resize overlay keyed by row key, so consumers write no move code (renderer lines 211-216) | `SvGridScheduler.svelte` | the same `$state` records: `startOf`, `endOf`, `progressOf`, `edits` |
| Undo / redo command stack, 100 deep, `Ctrl+Z` / `Ctrl+Shift+Z` / `Ctrl+Y` (renderer lines 1181-1225) | `SvGridScheduler.svelte` | copied with a `progress` command kind added |
| Drawer built from the grid's columns: `drawerFields` maps `col.header` and `col.editorType` to `FormField` (renderer line 2344) | `SvGridScheduler.svelte` | same builder, Start / End / Progress pinned first |
| Timeline drag: `startTlDrag` / `onTlDragMove` / `onTlDragEnd` with a 3px threshold, preview state, snap, commit, cascade, history push (renderer lines 3008-3121) | `SvGridScheduler.svelte` | `startBarDrag` / `onBarDragMove` / `onBarDragEnd`, one code path for move, resize, progress and link |
| Search, filters and sort flow through because the view reads the grid's displayed rows | `SvGrid.svelte` line 192 (`boardData`) | `api.getDisplayedRows()` from the inner grid |

What the Gantt does not copy: the Scheduler's rows are resources and its
columns are time. A Gantt's rows are the tasks themselves in grid order,
nested by a parent field, with a task table on the left. So it is a sibling
component that reuses the Scheduler's timeline math and Pro helpers, not a
ninth `SchedulerView`.

## 3. A decision to make first

`docs/help/rows/scheduler.md` line 682 says, in a call-out: "Scheduler, not a
Gantt ... there is no critical path, percent-done, baselines, or
work-breakdown structure, and none are planned." Demo 389's meta FAQ says the
same. Shipping a Gantt reverses that statement. The plan assumes the reversal
is intended and includes rewording that call-out to point at the new page.
Confirm before Phase 1 starts.

## 4. Reuse map

Consumed without change:

- `@svgrid/grid` exports: `timelineGeom` and the `TimelineAxis` /
  `TimelineTick` / `TimelineMajor` types from `scheduler-model.ts`;
  `toDate`, `startOfDay`, `addDays`, `isSameDay` from date-core;
  `SvGrid`, `SvDrawer`, `SvForm`, `SvMenuList`, `SvDateTimePicker`,
  `SvNumberInput`, `SvButton`, `portalToBody`, `createDismissableLayer`,
  `onScrollOutside`, `popIn`, `renderSnippet`. `groupMajors` in
  `scheduler-model.ts` is module-private today; export it (a one-line grid
  change, the only one, and optional: the Gantt can carry its own copy).
- `packages/enterprise/src/scheduler-dependencies.ts`: `buildDependencyGraph`,
  `topoOrder`, `hasCycle`, `requiredStart`, `cascade`, `violations`. They
  take `{ id, from, to, type?, lag? }` and a `Map<key, {start, end}>`, which
  is what a Gantt task list produces. `lag` stays in minutes there; the
  Gantt's `lag` is in days and is multiplied by 1440 at the boundary.
- `packages/enterprise/src/scheduler-axis.ts`: `buildAxis`, `timeToX`,
  `xToTime`, `resolveZoom`, `zoomPresets` for continuous zoom and weekend
  collapse.
- `packages/enterprise/src/scheduler-assignments.ts`: `resourceLoad`,
  `overallocations` for the Phase 3 resource histogram.
- `packages/enterprise/src/license.ts` and `watermark.ts` for the gate.

Extracted from `SvGridScheduler.svelte` into `gantt/timeline-arrows.ts` so
both renderers share one copy:

```ts
export type BarRect = { left: number; right: number; midY: number }
export type Arrow = { id: string; d: string; bad: boolean; hx: number; hy: number }
/** Orthogonal elbow between two anchors; loops around by `loopDy` when the
 *  successor sits left of the predecessor. Scheduler line 590 today. */
export function elbowPath(x1: number, y1: number, x2: number, y2: number, loopDy: number): string
/** One arrow per link whose ends are both in `rects`; FS/SS/FF/SF pick the
 *  anchors. Scheduler lines 571-589 today. */
export function dependencyArrows(
  rects: ReadonlyMap<string, BarRect>,
  deps: ReadonlyArray<{ id: string; from: string; to: string; type?: DependencyType }>,
  badIds: ReadonlySet<string>,
  loopDy: number,
): Arrow[]
```

The Scheduler switches to it in the same PR (passing `tlLaneH` as `loopDy`),
covered by `tests/e2e/scheduler-timeline.spec.ts` and a new unit test.

## 5. Phase 1: `SvGantt`, read-only

### 5.1 Config (`gantt/gantt-config.ts`)

Every field carries a doc comment in the style of `SchedulerConfig`.

```ts
import type { RowData, TableFeatures, ColumnDef, MenuItem, SchedulerDrawerConfig, SchedulerResource } from '@svgrid/grid'
import type { Snippet } from 'svelte'
import type { DependencyType } from '../scheduler-dependencies'
import type { ZoomLevel } from '../scheduler-axis'

/** Axis presets: which unit is a tick and which is the grouping row above it. */
export type GanttZoom = 'day' | 'week' | 'month' | 'quarter' | 'year'

/** Same shape as SchedulerDependency; `lag` is in DAYS here (negative = a lead). */
export type GanttDependency = { id: string; from: string; to: string; type?: DependencyType; lag?: number }

export type GanttTaskMoveEvent<TData extends RowData = RowData> = {
  row: TData; start: Date; end: Date
  /** The moved parent's descendants, shifted by the same delta (not cascaded successors). */
  subtree?: Array<{ row: TData; start: Date; end: Date }>
}
export type GanttTaskResizeEvent<TData extends RowData = RowData> = { row: TData; start: Date; end: Date; edge: 'start' | 'end' }
export type GanttProgressChangeEvent<TData extends RowData = RowData> = { row: TData; progress: number }
export type GanttTaskCommitEvent<TData extends RowData = RowData> = { row: TData; values: Partial<TData> }
export type GanttDrawerConfig<TData extends RowData = RowData> = SchedulerDrawerConfig<TData>

export type GanttConfig<TFeatures extends TableFeatures = TableFeatures, TData extends RowData = RowData> = {
  // --- fields --------------------------------------------------------------
  startField: keyof TData & string                 // required; Date | epoch-ms | ISO string
  endField?: keyof TData & string                  // exclusive; a date-only string is inclusive of that day
  durationField?: keyof TData & string             // working days, used when endField is absent
  titleField?: keyof TData & string                // default: first column's field
  progressField?: keyof TData & string             // 0..100
  parentField?: keyof TData & string               // WBS nesting; also fed to the inner grid's treeData
  milestoneField?: keyof TData & string            // boolean; end == start is a milestone regardless
  colorField?: keyof TData & string
  color?: string

  // --- dependencies ---------------------------------------------------------
  dependencies?: ReadonlyArray<GanttDependency>
  dependencyField?: keyof TData & string           // per-row GanttDependency[] or successor ids
  autoReschedule?: boolean                         // default true when any link exists
  respectWorkingTime?: boolean                     // cascaded starts land on working days; default true
  onDependenciesChange?: (moves: Array<{ id: string; start: Date; end: Date }>) => void
  onDependencyAdd?: (dep: GanttDependency) => void
  onDependencyRemove?: (id: string) => void

  // --- axis -----------------------------------------------------------------
  zoom?: GanttZoom                                 // default 'week' (day ticks under month majors)
  zoomLevels?: ReadonlyArray<GanttZoom>            // stepper presets; one entry hides the stepper
  onZoomChange?: (zoom: GanttZoom) => void
  weekStartsOn?: 0 | 1 | 2 | 3 | 4 | 5 | 6
  nonWorkingDays?: ReadonlyArray<number>           // default [0, 6]
  holidays?: ReadonlyArray<Date | number | string>
  showNonWorking?: boolean                         // shade; default true
  todayLine?: boolean                              // default true
  minDate?: Date | number | string
  maxDate?: Date | number | string
  rangePaddingDays?: number                        // default 7

  // --- layout ---------------------------------------------------------------
  tableWidth?: number                              // px, default 360; the splitter resizes it
  rowHeight?: number                               // px, default 32; passed to the inner grid
  summaryBars?: boolean                            // parents draw a rolled-up bar; default true
  labelPosition?: 'inside' | 'right' | 'none'      // default 'inside', falls back to 'right' when narrow
  showTable?: boolean                              // default true; false hides the table pane (chart only)

  // --- editing ----------------------------------------------------------------
  editable?: boolean                               // drag-to-move, edge resize, progress grip, link drawing
  history?: boolean
  onTaskMove?: (e: GanttTaskMoveEvent<TData>) => void
  onTaskResize?: (e: GanttTaskResizeEvent<TData>) => void
  onProgressChange?: (e: GanttProgressChangeEvent<TData>) => void
  onTaskAdd?: (start: Date, end: Date, parentId?: string) => void
  onTaskDelete?: (row: TData) => void

  // --- chrome -----------------------------------------------------------------
  task?: Snippet<[TData]>
  tooltip?: boolean | Snippet<[TData]>
  tooltipDelay?: number
  drawer?: boolean | GanttDrawerConfig<TData>
  onTaskCommit?: (e: GanttTaskCommitEvent<TData>) => void
  taskMenu?: (row: TData) => MenuItem[] | undefined
}

/** Phase 3. Structurally assignable to `gantt`; read through a cast like the scheduler's pcfg. */
export type GanttProConfig<TFeatures extends TableFeatures = TableFeatures, TData extends RowData = RowData> =
  GanttConfig<TFeatures, TData> & {
    criticalPath?: boolean
    baselineStartField?: keyof TData & string
    baselineEndField?: keyof TData & string
    constraintField?: keyof TData & string           // 'ASAP' | 'ALAP' | 'MSO' | 'MFO' | 'SNET' | 'SNLT' | 'FNET' | 'FNLT'
    constraintDateField?: keyof TData & string
    zoom?: GanttZoom | number | ZoomLevel            // number / ZoomLevel select the Pro pixel axis
    zoomLevels?: ReadonlyArray<GanttZoom> | ReadonlyArray<ZoomLevel>
    collapseWeekends?: boolean
    collapsedGapPx?: number
    resourceField?: keyof TData & string
    resources?: ReadonlyArray<SchedulerResource>
    resourceHistogram?: boolean | { capacityField?: string; height?: number }
    onCriticalPathChange?: (keys: string[]) => void
  }
```

`SvGantt`'s own props, separate from the config object:

```ts
let {
  data, columns, gantt, getRowId,
  features,                    // grid features for the table (sorting, filtering, editing ...)
  containerHeight = 520,       // number | string, like SvGrid
  searchable = true,           // the grid's global filter box above the table
  expanded, onExpandedChange,  // forwarded to the inner grid (controlled WBS state)
  onApiReady,                  // the inner grid's api, for consumers who want it
  ...gridProps                 // any other SvGrid prop is passed through (editable, rowClass, localization ...)
}: SvGanttProps<TFeatures, TData> = $props()
```

Conventions the config commits to:

- Dates are local calendar days, `end` exclusive. A task on Sep 14 with a
  one-day duration has `start = Sep 14 00:00`, `end = Sep 15 00:00`. A
  date-only `endField` string like `2026-09-14` is read as the end OF that
  day, the inclusive convention every planning tool uses, so
  `{ start: '2026-09-14', end: '2026-09-16' }` draws three days. A timestamp
  with a time part is used as-is. `resolveTasks` documents this and tests
  pin it.
- The WBS comes from `parentField`. `SvGantt` forwards it to the inner grid
  as `treeData={{ parentField, column: titleColumnId }}`, so the table gets
  chevrons and indentation from the grid, while the model builds its own
  tree from ALL rows (`data`, not the displayed subset) for summary rollups
  and dependency anchoring into collapsed subtrees.
- No `timeZone` in Phase 1. Hour-level zoom comes from the Pro axis in Phase 3.
- Row order among siblings is the inner grid's order. Sorting the table by
  start reorders tasks within each phase; filtering out a parent keeps its
  children as roots, the rule the grid's `treeData` already applies.

### 5.2 Model (`gantt/gantt-model.ts`)

Pure, no Svelte, no `new Date()` without an argument, the same rules as
`scheduler-model.ts`.

```ts
export type GanttTaskSpec<TData> = {
  getKey: (row: TData) => string
  getStart: (row: TData) => DateLike | null | undefined
  getEnd?: (row: TData) => DateLike | null | undefined
  getDuration?: (row: TData) => number | null | undefined      // working days
  getTitle?: (row: TData) => string
  getProgress?: (row: TData) => number | null | undefined
  getParent?: (row: TData) => string | null | undefined
  getMilestone?: (row: TData) => boolean
  getColor?: (row: TData) => string | undefined
}
export type WorkingCalendar = { nonWorkingDays: ReadonlyArray<number>; holidays: ReadonlySet<number> }
export type ResolvedTask<TData = unknown> = {
  key: string; row: TData; title: string
  start: Date; end: Date                // local midnight; end exclusive
  progress: number; milestone: boolean; parentKey: string | null; color?: string
}

/** Rows without a readable start are skipped. End wins over duration; duration
 *  counts working days from start; neither gives a milestone (end = start).
 *  Date-only end strings are inclusive. Progress is clamped; NaN reads as 0. */
export function resolveTasks<TData>(rows, spec, cal): ResolvedTask<TData>[]

export type GanttNode<TData = unknown> = {
  task: ResolvedTask<TData>; depth: number; hasChildren: boolean; collapsed: boolean
  summary?: { start: Date; end: Date; progress: number }    // parents only, over EVERY descendant
}
/** WBS order: roots in input order, children under their parent in input
 *  order, orphans promoted to roots, parent cycles broken at the first repeat.
 *  Descendants of a collapsed node are omitted but still feed its summary.
 *  Summary progress = duration-weighted mean of the leaf descendants (a
 *  milestone weighs 0; a parent of only milestones takes their plain mean). */
export function ganttTree<TData>(tasks, collapsed: ReadonlySet<string>): GanttNode<TData>[]
/** key -> visible ancestor key, for anchoring arrows into collapsed subtrees. */
export function visibleAnchor<TData>(nodes, allTasks): Map<string, string>

/** [min start - padding, max end + padding], clamped to min/max; empty input
 *  centres on the injected today. */
export function projectRange(tasks, opts: { paddingDays: number; today: Date; minDate?: Date; maxDate?: Date }): { start: Date; end: Date }

/** The header axis over [start, end) for a preset, in the scheduler's
 *  TimelineAxis shape (ticks + majors as percentages):
 *    day     -> ticks: days     majors: weeks    ("14 - 20 Sep")
 *    week    -> ticks: days     majors: months   ("September 2026")   (default)
 *    month   -> ticks: weeks    majors: months
 *    quarter -> ticks: months   majors: quarters ("Q3 2026")
 *    year    -> ticks: months   majors: years
 *  Week ticks start on `weekStartsOn`; a partial first / last tick keeps its
 *  true width so bars never drift against the header. */
export function ganttAxis(start: Date, end: Date, zoom: GanttZoom, opts: { weekStartsOn: number; today?: Date | null }): TimelineAxis
/** Pixel width of one tick per preset. */
export const ganttTickWidth: Record<GanttZoom, number>   // day 48, week 28, month 40, quarter 96, year 72

export function makeCalendar(nonWorkingDays?, holidays?): WorkingCalendar
export function isWorkingDay(d: Date, cal): boolean
export function workingDays(start: Date, end: Date, cal): number
export function addWorkingDays(start: Date, days: number, cal): Date
export function snapToWorkingDay(d: Date, dir: 1 | -1, cal): Date    // 4000-step guard like buildAxis
```

### 5.3 The component, top to bottom

State and derived chain:

```ts
let api = $state<SvGridApi<TFeatures, TData> | null>(null)
let displayed = $state<ReadonlyArray<TData>>([])            // api.getDisplayedRows() snapshot
let scrollTop = $state(0)                                    // mirrored from the grid container
let tableW = $state(gantt.tableWidth ?? 360)                 // svelte-ignore state_referenced_locally
let zoomOverride = $state<GanttZoom | null>(null)
let collapsedLocal = $state(new Set<string>())               // from onExpandedChange when uncontrolled

// overlay, never mutates the consumer's rows (scheduler lines 211-216)
let startOf = $state<Record<string, Date>>({})
let endOf = $state<Record<string, Date>>({})
let progressOf = $state<Record<string, number>>({})
let edits = $state<Record<string, Record<string, unknown>>>({})

const rowH   = $derived(gantt.rowHeight ?? 32)
const barH   = $derived(rowH - 10)
const cal    = $derived(makeCalendar(gantt.nonWorkingDays ?? [0, 6], gantt.holidays))
const zoom   = $derived(zoomOverride ?? gantt.zoom ?? 'week')
const spec   = $derived.by<GanttTaskSpec<TData>>(() => ({ getKey: key, getStart: r => startOf[key(r)] ?? fieldValue(r, gantt.startField), /* ... */ }))
const tasks  = $derived(resolveTasks(data, spec, cal))                   // ALL rows: rollups need collapsed children
const byKey  = $derived(new Map(tasks.map(t => [t.key, t])))
const collapsed = $derived(expanded ? keysCollapsedIn(expanded) : collapsedLocal)
const tree   = $derived(ganttTree(tasks, collapsed))                     // for summaries + anchors
const nodeOf = $derived(new Map(tree.map(n => [n.task.key, n])))
const rows   = $derived(displayed.map(r => nodeOf.get(key(r))).filter(Boolean))   // chart rows = grid rows, in grid order
const range  = $derived(projectRange(tasks, { paddingDays: gantt.rangePaddingDays ?? 7, today, minDate, maxDate }))
```

`key(row)` is `getRowId(row, index)` when given, else a `WeakMap` synthetic
id pinned to the row object (the Scheduler's rule), and the same `getRowId`
goes to the inner grid so `treeData` ids and Gantt keys agree.

Axis and the one `xOf` function:

- Free axis (default): `axis = ganttAxis(range.start, range.end, zoom, ...)`,
  `axisPx = axis.ticks.length * ganttTickWidth[zoom]`,
  `xOf(d) = (d - axis.start) / axis.totalMs * axisPx`, `dateAtX` the inverse.
- Pro axis (Phase 3): `buildAxis` / `timeToX` / `xToTime`, ticks per
  `ZoomLevel.tickMinutes` like the Scheduler's `proAxisData` (line 365).

Every bar, gridline, shading band, arrow anchor, drop preview and the today
line goes through `xOf`. Nothing else computes a pixel from a date.

DOM:

```
.sv-gantt                                  flex column; height: containerHeight
  .sv-gantt-toolbar                        search (grid global filter), zoom stepper, Today, Expand / Collapse all
  .sv-gantt-panes                          flex row; flex: 1; min-height: 0
    .sv-gantt-table  (width: tableW)       <SvGrid ... containerHeight="100%" rowHeight={rowH} treeData virtualization />
    .sv-gantt-splitter                     5px; cursor: col-resize
    .sv-gantt-chart                        flex: 1; overflow: auto (both axes); scrollTop mirrored
      .sv-gantt-axis                       sticky top; height = grid header height; majors row over ticks row
      .sv-gantt-body                       position: relative; width: axisPx; height: rows.length * rowH
        .sv-gantt-shade   x bands          non-working columns
        .sv-gantt-gridline x ticks
        .sv-gantt-row  x windowed rows     absolute; top: i * rowH
          .sv-gantt-bar | .sv-gantt-summary | .sv-gantt-milestone
            .sv-gantt-progress             inner fill
            .sv-gantt-grip-l / -r          (Phase 2)
            .sv-gantt-grip-p               (Phase 2)
            .sv-gantt-link-dot             (Phase 2)
          .sv-gantt-label                  when the label sits to the right
        svg.sv-gantt-deps                  arrow overlay; pointer-events: none; z-index 3
        .sv-gantt-today                    dashed line at xOf(today)
```

The axis head is exactly as tall as the grid's header (`headerHeight` is
passed to the grid and used for the axis), so row zero lines up on both
sides. Hovering a chart row sets `hoverKey`; the grid gets
`rowClass={({ row }) => key(row) === hoverKey ? 'sv-gantt-hover' : undefined}`
and the reverse hover comes from the grid's row `mouseenter` through a
delegated listener on the table pane.

Bars:

- Task: `left: xOf(start)`, `width: max(2, xOf(end) - xOf(start))`, centred
  vertically, accent from `color` via `--sv-gantt-accent`, inner
  `.sv-gantt-progress` at `width: progress%`. Label inside when the bar is
  wider than the label plus 12px, else `.sv-gantt-label` to the right.
- Summary (parent): 8px tall, 6px down-facing end caps as `::before` /
  `::after`, progress as a darker fill, no grips, label always right.
- Milestone: a 14px square rotated 45 degrees at `xOf(start)`.
- Every bar: `tabindex="0"`, `role="row"` inside the chart's `role="grid"`,
  `aria-label="Title, 14 Sep to 20 Sep, 40%"`, `data-key`.

Arrows:

```ts
const depList  = $derived(mergeDeps(gantt.dependencies, gantt.dependencyField, data))   // lag days -> minutes
const depTimes = $derived(new Map(tasks.map(t => [t.key, { start: t.start, end: t.end }])))
const depBad   = $derived(new Set(violations(depTimes, depList).map(d => d.id)))
const anchor   = $derived(visibleAnchor(rows, tasks))                 // collapsed child -> its visible parent
const barRects = $derived.by(() => {
  const m = new Map<string, BarRect>()
  rows.forEach((n, i) => { const t = n.summary ?? n.task; m.set(n.task.key, { left: xOf(t.start), right: xOf(t.end), midY: i * rowH + rowH / 2 }) })
  return m
})
const arrows   = $derived(dependencyArrows(barRects, depList.map(d => ({ ...d, from: anchor.get(d.from) ?? d.from, to: anchor.get(d.to) ?? d.to })), depBad, rowH))
```

A link to a filtered-out row is skipped, as the Scheduler does.

Everything else in Phase 1:

- Today line at `xOf(today)`; `today` refreshed every 60s like demo 45.
- Non-working shading: one band per non-working day under the free axis;
  under the Pro axis the `break` / `collapsed` segments are the bands.
- Tooltip: the Scheduler's `tooltipCfg` / delay / `sv-sched-tooltip` block
  (lines 1232-1250, 3886-3900): title, start to end, N working days, N%,
  parent title.
- Collapse: the grid's chevrons. `onExpandedChange` updates `collapsedLocal`
  (or is forwarded when controlled). Toolbar Expand all / Collapse all call
  `api.expandAllGroups()` / `collapseAllGroups()`.
- Zoom stepper over `zoomLevels`, `Ctrl+wheel` over the chart; zooming keeps
  the date under the pointer fixed (record `dateAtX(pointer)`, re-scroll so
  `xOf(that date)` lands on the same client x).
- Scroll today into view on mount (centre it; fall back to the first task).
- Search: the toolbar box is the inner grid's global filter (`showGlobalFilter`
  on the grid, or a `bind` through `api.setGlobalFilter`), so the table and
  chart filter together.

### 5.4 Tests

`gantt/gantt-model.test.ts`, one `describe` per function:

- `resolveTasks`: end wins over duration; duration 3 across a weekend ends
  on the following Wednesday; date-only end inclusive; timestamp end exact;
  no end and no duration gives a milestone; missing start skips; progress
  clamps and `NaN` reads 0; `milestoneField` forces a milestone.
- `ganttTree`: two roots with nested children; orphan promoted; parent cycle
  broken; collapse hides descendants but the summary spans them; weighted
  progress (leaves of 2 and 6 days at 100% and 0% give 25%); milestones
  weigh zero; `visibleAnchor` maps a hidden grandchild to its visible ancestor.
- `projectRange`: padding; clamps; empty input.
- `ganttAxis`: for every preset, ticks tile the range (widths sum to 100
  within 1e-6, no gaps); majors group correctly; a Wednesday start under
  `weekStartsOn: 1` gives a short first week; the today flag lands once.
- Working days: 5 in a week; a holiday removes one; `addWorkingDays(Fri, 1)`
  is Monday; snapping both directions; an all-off calendar returns the input.

`gantt/gantt.dom.test.ts` in the enterprise `dom` project (jsdom, the
grid's `test-setup.ts` stubs), modelled on `board.dom.test.ts` and
`SvSheet.state.dom.test.ts` since it mounts an inner grid. Fixture: three
phases, eight tasks, two milestones, four links, one violating.

- one chart row per displayed grid row, in the grid's order; a sort on the
  inner grid (`api.setSorting`) reorders the chart rows to match.
- a leaf bar's `style.left` / `style.width` match `xOf`; a milestone renders
  at `xOf(start)`; the phase row draws a summary spanning its children with
  the weighted fill.
- arrow count equals link count; the violating one carries `sv-gantt-dep-bad`.
- `api.setRowExpanded(phaseId, false)` removes the descendants' chart rows
  and re-anchors the arrow into the subtree on the parent's summary bar.
- typing in the toolbar search filters both panes.
- `expanded` / `onExpandedChange` round-trip when controlled.
- setting the grid container's `scrollTop` moves the chart pane's.

`gantt/timeline-arrows.test.ts`: forward `elbowPath` is four points; a
backward link loops with six; `dependencyArrows` picks FS / SS / FF / SF
anchors from the right edges.

### 5.5 Docs, demo, changeset

The docs page, demo 474 and the scheduler call-out land in this phase
(section 8). Changeset: `@svgrid/enterprise: minor`; `@svgrid/grid: patch`
only if `groupMajors` is exported.

## 6. Phase 2: editing

All in `SvGantt.svelte`, following the Scheduler's timeline handlers
(lines 3008-3121) with one `BarDrag` state for every mode.

```ts
type DragMode = 'move' | 'resize-start' | 'resize-end' | 'progress' | 'link'
type BarDrag = {
  key: string; node: GanttNode<TData>; mode: DragMode
  startX: number; startY: number; moved: boolean
  grabOffsetMs: number; durationMs: number
  origStart: Date; origEnd: Date; origProgress: number
  previewStart: Date; previewEnd: Date; previewProgress: number
  linkTargetKey?: string; linkEdge?: 'start' | 'end'
}
let drag = $state<BarDrag | null>(null)
```

- Threshold: 3px before `moved` flips, so a click still opens the drawer
  and never fires a zero move.
- Snap: `startOfDay(d)` for move and resize-start, `addDays(startOfDay(d), 1)`
  for resize-end; under the Pro hour-level axis the tick, the Scheduler's
  `fine` rule (line 3047). With `respectWorkingTime` a move landing on a
  non-working day slides to the next working day; a resize keeps calendar
  days (a task can span a weekend).
- Move: `previewStart = snap(dateAtX(clientX) - grabOffsetMs)`,
  `previewEnd = previewStart + durationMs`, clamped to `[minDate, maxDate]`.
  A parent moves its whole subtree by the same delta; the commit fires one
  `onTaskMove` with `subtree` filled so the consumer writes the batch.
- Resize: minimum one day (or one tick); milestones do not resize.
- Progress: `round((clientX - barLeft) / barWidth * 20) * 5`, clamped;
  `onProgressChange`. Leaves only; a parent's progress is the rollup.
- Link: `.sv-gantt-link-dot` on each bar edge starts a `link` drag; a
  temporary path follows the pointer; hovering another bar sets the target
  and the edge (left half start, right half end). On release: end to start
  is `FS`, start to start `SS`, end to end `FF`, start to end `SF`. Refused
  (300ms `sv-gantt-refused` flash on both bars, the Scheduler's
  `bookingBlocked` treatment) when `hasCycle([...deps, candidate])` or the
  pair is already linked. Otherwise
  `onDependencyAdd({ id: `dep-${from}-${to}-${Date.now()}`, from, to, type })`.
  Right-click on an arrow opens `SvMenuList` with Remove.
- Commit (`onBarDragEnd`): write the overlay, emit the callback, then
  `cascadeDeps(key, start, end)` (the Scheduler's routine at line 599 with
  `snapForward = d => snapToWorkingDay(d, 1, cal)`), then `pushHistory`.
- History: the Scheduler's stack with `kind: 'move' | 'resize' | 'progress'`
  and `subtree` deltas recorded so undoing a parent move restores its
  children. Undo re-emits the callbacks with the reversed values; cascaded
  shifts are part of the same command.
- Double-click empty chart space: `onTaskAdd(day, day + 1, parentKeyOf(rowUnderPointer))`.
- Keyboard on a focused bar (Scheduler `onEventKey`, line 1958):
  `ArrowLeft` / `ArrowRight` move by a day, `Shift` by seven, `Alt` resizes
  the end; `+` / `-` change progress by 5; `Enter` opens the drawer;
  `Delete` fires `onTaskDelete`; `Escape` cancels a drag. `Ctrl+Z` /
  `Ctrl+Shift+Z` / `Ctrl+Y` when `history` is on, ignored while the inner
  grid is editing a cell (the Scheduler's input-target check, line 1218).
- Drawer: `drawer: true | GanttDrawerConfig` reuses the Scheduler's
  `SvDrawer` + `SvForm` block and `drawerFields` builder. Start, End (or
  Duration) and Progress are pinned first; the rest come from the columns.
  Save writes `edits[key]`, fires `onTaskCommit`, and runs the cascade when
  dates changed. The inner grid's inline editing is the other edit path; a
  consumer that sets `editable` on the grid writes rows directly and the
  chart follows through `data`.
- Context menu: Edit (with drawer), Add subtask (with `onTaskAdd`), Delete
  (with `onTaskDelete`), then `taskMenu(row)` items, through `SvMenuList`
  with the board's dismissable-layer pattern.

Tests: extend `gantt.dom.test.ts` with pointer sequences (`pointerdown`,
`pointermove` on `window`, `pointerup`):

- a 3-tick drag fires `onTaskMove` with start + 3 days, same duration; the
  source row is unchanged; the bar moved.
- a 1px drag fires nothing and a click opens the drawer.
- right grip fires `onTaskResize` with `edge: 'end'`; left with `'start'`;
  a milestone has no grips.
- a drop on Saturday with `respectWorkingTime` starts on Monday.
- moving a parent fires one `onTaskMove` whose `subtree` lists every
  descendant shifted by the delta.
- with links, moving a predecessor fires `onDependenciesChange` with the
  cascaded successors; `autoReschedule: false` does not.
- the progress grip at the midpoint fires `onProgressChange` with 50.
- link drawing A end to B start fires `FS`; to B end fires `FF`; a cycle
  fires nothing and both bars get `sv-gantt-refused`.
- `Ctrl+Z` after a move re-fires `onTaskMove` with the original dates.
- `ArrowRight` on a focused bar moves it one day.
- drawer save with a new end fires `onTaskCommit` and the cascade.

`tests/e2e/gantt.spec.ts` (website checkout only, like the scheduler
specs): drag a bar and read its tooltip dates; resize; draw a link and
count arrows; zoom in twice and check the tick width; collapse a phase from
the table chevron and count chart rows; sort the table by a column and
check the first bar's key.

## 7. Phase 3: planning features (`GanttProConfig`)

### 7.1 Critical path (`gantt/gantt-critical-path.ts`, pure)

```ts
export type CpmResult = {
  critical: Set<string>; slackMs: Map<string, number>
  earliest: Map<string, EventTimes>; latest: Map<string, EventTimes>; finish: Date
}
export function criticalPath(times: ReadonlyMap<string, EventTimes>, deps: ReadonlyArray<SchedulerDependency>): CpmResult
export function slackDays(result: CpmResult, key: string, cal: WorkingCalendar): number
```

Forward pass in `topoOrder`: `ES = max(own start, requiredStart over
predecessors)`, `EF = ES + duration`; finish = max EF. Backward pass in
reverse: `LF = min(finish, the latest finish each successor link allows)`,
`LS = LF - duration`. `slack = LS - ES`; critical below one minute. Unlinked
tasks keep their own dates with `slack = finish - own end`, so an unlinked
late task is not "critical". Cyclic links are ignored, as in `cascade`.
Parents are excluded; a link naming a parent resolves to its last-finishing
leaf for FS / FF and first-starting leaf for SS / SF.

The renderer adds `sv-gantt-critical` to critical bars and arrows, and the
demo adds a Slack column to the table through `slackDays`. Tests: a chain
of three; a diamond where the longer branch is critical; a lag that flips
the branch; an isolated task; an SS link; a cycle ignored.

### 7.2 Baselines

`baselineStartField` / `baselineEndField` draw a 6px grey `.sv-gantt-baseline`
under the bar; the tooltip shows the variance in working days.

### 7.3 Constraints

`constraintField` + `constraintDateField` per row. `cascade` in
`scheduler-dependencies.ts` gains an optional
`bounds?: ReadonlyMap<string, { minStart?: Date; maxEnd?: Date }>` argument
(backwards compatible; every scheduler test unchanged). `SNET` and `MSO`
raise the floor, `FNLT` and `MFO` set a ceiling, `ALAP` schedules against
the latest-start pass. A cascade that would break a ceiling stops there and
the bar paints `sv-gantt-constrained`; a glyph before the label shows the
constraint kind.

### 7.4 Pro axis and hours

`zoom` as a number or `ZoomLevel` switches to `buildAxis` / `timeToX` with
`pxPerMinute` from `resolveZoom`, which brings hour ticks for short projects
and `collapseWeekends`. `zoomLevels` may then be the Scheduler's
`zoomPresets`. Stepper and wheel work the same.

### 7.5 Resources

`resourceField` shows the resource in the tooltip and, with
`resourceHistogram`, a strip under the chart with one bar per tick per
resource from `resourceLoad`; over-capacity ticks paint red through
`overallocations`. Assignment is edited in the drawer or the table, not by drag.

## 8. Demos, docs and the sweep

### 8.1 Demos

Ids continue from 473. Add `'Gantt'` to `DemoCategory` and to
`ENTERPRISE_CATEGORIES` in `examples/src/shared/registry.ts` (lines 439 and
486), between `'Kanban'` and `'Scheduler'`. Each demo needs
`meta/<id>.json` (description, five keywords, three FAQ entries, no dash
characters), `prompts/<id>.md`, and a `website/src/lib/demos.ts` entry.

- `474-gantt-intro`, "Project plan": a 14-week release with four phases, 18
  tasks, three milestones, 12 FS links and one SS link, progress on every
  leaf, sortable and filterable task columns (Name, Owner, Start, Duration,
  Progress), `tooltip: true`, read-only.
- `475-gantt-editing`, "Plan editing": the same data with `editable`,
  `history`, `drawer`, link drawing, a holiday list, `respectWorkingTime`,
  inline editing in the table, and a log panel printing every callback so
  the write-back is visible.
- `476-gantt-critical-path`, "Critical path and baselines": a construction
  schedule with `criticalPath`, baselines, a Slack column, `collapseWeekends`
  and the `ZoomLevel` ladder down to hours.
- Demo 45 stays as the free, no-plug-in recipe. Its meta and the recipe
  paragraph in `docs/help/recipes.md` (line 215) gain one sentence pointing
  at `SvGantt`.

Website registration is a separate commit in the private submodule;
`pnpm demos:count` fails until it lands. The submodule is not checked out in
this environment. Thumbnails come from `pnpm thumbs` afterwards.

### 8.2 Docs page: `docs/help/rows/gantt.md`

H1 "Gantt chart" (the title template adds "Svelte"). Structured like
`scheduler.md`:

1. Intro: `SvGantt`, a task table beside a time chart, the same rows,
   columns and editing as the grid; the Enterprise call-out with
   `setLicenseKey` and the soft gate; the demo embed for 474.
2. `{preamble}` block: a `Task` type (`id`, `name`, `owner`, `start`, `end`,
   `progress`, `parentId`, `milestone`), a dataset anchored on today with
   the `at()` helper the scheduler page uses, `columns`, a `deps` array.
3. The minimum: `startField` + `endField`.
4. Work breakdown: `parentField`, summary bars, chevrons, controlled
   `expanded`.
5. Bars, progress and milestones: `progressField`, `milestoneField`,
   colours, `labelPosition`, the `task` snippet.
6. Dependencies and auto-reschedule: the four types, `lag` in days,
   `dependencyField`, `autoReschedule`, `respectWorkingTime`, violations,
   cycles.
7. Editing: `editable`, the callbacks with a write-back example, link
   drawing, the drawer, inline table editing, `history`, keyboard.
8. Working time and the axis: `nonWorkingDays`, `holidays`, `zoom`,
   `zoomLevels`, `minDate` / `maxDate`, `rangePaddingDays`.
9. The task table: it is a `<SvGrid>`; `features`, sorting, filtering,
   `tableWidth`, `showTable: false`, `onApiReady`.
10. Gantt Pro: critical path, baselines, constraints, the Pro axis,
    resources, each with a snippet and the 476 embed.
11. Config reference table, then a Gantt Pro table (the scheduler page's
    format at line 910), then the `SvGantt` props table.
12. More examples: 475 and 476.

Every fenced `ts` / `svelte` block must type-check
(`tools/docs-snippets.test.ts`). Add the page to the `help/rows` section of
`docs/docs.json` with `node tools/build-docs-index.mjs`, which also
regenerates `llms.txt` and `llms-full.txt` and needs `website/public`.

### 8.3 Text to change elsewhere

- `docs/help/rows/scheduler.md` line 682: reword the call-out to "Scheduler
  or Gantt? The Scheduler is a resource / booking / calendar view. For a
  project plan with a work-breakdown tree, percent-done, critical path and
  baselines, use [SvGantt](/help/rows/gantt)." Keep the sentence that
  scheduler dependencies are an opt-in convenience.
- `examples/src/demos/meta/389-scheduler-dependencies.json`: the "Is this a
  Gantt chart?" answer points at the Gantt page.
- One-line mentions: `AGENTS.md` line 27, `README.md` line 208,
  `packages/grid/README.md` line 164, `packages/enterprise/README.md`,
  `skills/svgrid/SKILL.md` line 136, `packages/svgrid-sv/index.mjs` line 68.
- `docs/changelog.md` is generated from changesets; do not edit by hand.

### 8.4 Later, not in this plan

- Studio: `GanttViewConfig` in `packages/enterprise/src/studio/project.ts`
  beside `SchedulerViewConfig` (line 191), the inspector section, an
  `SvGantt` emitter in `emit-project.ts` beside `schedulerConfigExpr` (line
  886), and `docs/enterprise/studio/gantt.md`.
- `api.getScrollElement()` on the grid, so `SvGantt` stops querying
  `.sv-grid-container`.
- MCP: `packages/mcp` `build:manifests` regenerates `data.ts` once demos and
  docs exist.
- Print / PDF of the chart through `exportGrid`.

## 9. PR slicing, order and acceptance criteria

1. Phase 1, part A (pure). `gantt/gantt-config.ts`, `gantt/gantt-model.ts`
   + test, `gantt/timeline-arrows.ts` + test with the Scheduler switched to
   it, `gantt/gantt.ts`, the `install.ts` line, `gantt/index.ts`, the
   `./gantt` subpath, main index exports. About 350 lines of types, 350 of
   model, 400 of tests.
   Done when: `pnpm --filter @svgrid/enterprise test` and `pnpm test:types`
   pass; `scheduler-timeline.spec.ts` still passes on a website checkout.
2. Phase 1, part B (component). `SvGantt.svelte` read-only (about 1,100
   lines with styles), `gantt.dom.test.ts`, demo 474 with meta and prompt,
   `gantt.md` and the docs index, the scheduler call-out and demo 389 FAQ,
   changeset.
   Done when: 474 renders the fixture with arrows, summaries and
   milestones; sorting and filtering the table reorder and filter the
   chart; the panes scroll together; `tools/docs-snippets.test.ts` passes.
3. Phase 2 (editing). Drag, resize, progress, link drawing, cascade,
   history, keyboard, drawer, menu; demo 475; `gantt.spec.ts`.
   Done when: every callback in the demo's log panel fires from the
   gesture that should fire it and source rows are unchanged until the
   consumer writes them.
4. Phase 3 (planning). `gantt-critical-path.ts` + tests, the `bounds`
   argument on `cascade` + tests, baselines, constraints, Pro axis,
   resources; demo 476.
   Done when: the diamond fixture highlights the longer branch and the
   histogram paints the over-allocated tick.
5. The sweep. README and skill lines, Studio, MCP regen, thumbnails, the
   optional `api.getScrollElement()`.

Every PR runs `pnpm test`, `pnpm test:types`, `pnpm lint` and
`pnpm --filter @svgrid/enterprise test`, matching `.github/workflows/test.yml`.
No grid bundle budget changes unless `groupMajors` is exported (then
`pnpm size` and a note in `measure-size.mjs`).

## 10. Open questions and risks

- Scroll mirroring between two scrollers can jitter on trackpads. The
  Scheduler avoids it by owning one scroller. Mitigation: mirror in the
  `scroll` handler with `requestAnimationFrame` coalescing and a reentrancy
  flag; if it still shows, the fallback is to make the chart pane
  non-scrolling vertically and translate its body by `-scrollTop` instead.
- `api.getDisplayedRows()` returns data rows only, in display order. The
  Gantt needs depth per row for nothing (the grid indents its own cells)
  and gets summaries from the model's full tree, so no grid API addition
  is required. If pagination is ever turned on for the inner grid the chart
  shows the page; the docs say to leave it off.
- Row heights must be uniform. `rowHeight` is forced to a number on the
  inner grid; `autoRowHeight` and `rowResize` are not forwarded.
- `GanttDependency` and `SchedulerDependency` are the same shape with a
  different `lag` unit (days vs minutes). One type would need a unit flag;
  two types with a boundary conversion is simpler.
- Inclusive date-only ends: documented and tested, but a consumer whose end
  strings already mean exclusive midnight will see bars a day too long.
  `endInclusive: false` can be added if it comes up.
- Time zones and sub-day durations: deferred to the Pro axis.
- `cascade` gains an optional `bounds` argument in Phase 3; every scheduler
  dependency test must still pass unchanged.
