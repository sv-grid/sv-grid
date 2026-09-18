# Gantt view: implementation plan

A Gantt view of the grid, built the way the Scheduler is built: the `gantt`
prop and its config types ship free in `@svgrid/grid`, the renderer ships in
`@svgrid/enterprise` and plugs in through a registry seam, the pure model math
lives in a framework-free `.ts` file with unit tests, and the view reads the
grid's filtered + sorted rows and writes back only through callbacks.

This document is the plan. Nothing here is implemented yet. Line numbers
refer to the tree at commit `198c2f0`.

Contents

1. What "similar to the Scheduler" means here
2. A decision to make first
3. Reuse map
4. Phase 0: the free half in `@svgrid/grid`
5. Phase 1: the Pro renderer, read-only
6. Phase 2: editing
7. Phase 3: planning features (`GanttProConfig`)
8. Demos, docs and the sweep
9. PR slicing, order and acceptance criteria
10. Open questions and risks

## 1. What "similar to the Scheduler" means in this codebase

The Scheduler is five things, and the Gantt copies each one.

| Scheduler today | File | Gantt equivalent |
| --- | --- | --- |
| `scheduler` prop + `SchedulerConfig` and event types (free) | `packages/grid/src/SvGrid.types.ts` lines 832-1110 | `gantt` prop + `GanttConfig` and event types |
| Registry seam: `registerSchedulerView` / `getSchedulerView` / `hasSchedulerView` | `packages/grid/src/scheduler-view.svelte.ts` | `gantt-view.svelte.ts` with `registerGanttView` / `getGanttView` / `hasGanttView` |
| `{:else if schedulerConfig}` branch: search box, mount the registered renderer, else an upsell note with the shared `enterpriseLicenseNote` snippet | `packages/grid/src/SvGrid.svelte` lines 1013-1060 | `{:else if ganttConfig}` branch between the scheduler and chart branches |
| Pure model: `resolveEvents`, `timelineAxis`, `timelineGeom`, `timelineRows`, unit-tested | `packages/grid/src/scheduler-model.ts` | `gantt-model.ts`: `resolveTasks`, `ganttTree`, `projectRange`, `ganttAxis`, `workingDays` |
| Pro renderer + `enableSchedulerView()` (soft-gated, idempotent, called by `installEnterprise`) | `packages/enterprise/src/SvGridScheduler.svelte`, `scheduler.ts`, `install.ts` | `SvGridGantt.svelte`, `gantt.ts` with `enableGanttView()`, one line in `install.ts` |
| Pro superset config read through a cast (`pcfg`, renderer line 306) | `packages/enterprise/src/scheduler-config.ts` | `gantt-config.ts` with `GanttProConfig` |
| Move / resize overlay keyed by row key, so consumers write no move code (renderer lines 211-216) | `SvGridScheduler.svelte` | the same four `$state` records: `startOf`, `endOf`, `progressOf`, `edits` |
| Undo / redo command stack, 100 deep, `Ctrl+Z` / `Ctrl+Shift+Z` / `Ctrl+Y` (renderer lines 1181-1225) | `SvGridScheduler.svelte` | copied with a `progress` command kind added |
| Drawer built from the grid's columns: `drawerFields` maps `col.header` and `col.editorType` to `FormField` (renderer line 2344) | `SvGridScheduler.svelte` | same builder, with Start / End / Progress pinned at the top |
| Timeline drag: `startTlDrag` / `onTlDragMove` / `onTlDragEnd` with a 3px threshold, preview state, snap, commit, cascade, history push (renderer lines 3008-3121) | `SvGridScheduler.svelte` | `startBarDrag` / `onBarDragMove` / `onBarDragEnd`, one code path for move, resize and progress |

What the Gantt does NOT copy: the Scheduler's rows are resources and its
columns are time. A Gantt's rows are the grid's rows themselves (tasks, one per
row, in grid order, nested by a parent field) and its left pane is a task table.
That is a different layout, so the Gantt is a sibling view (`gantt` prop), not
a ninth `SchedulerView`. It reuses the Scheduler's timeline math and its Pro
helpers rather than its component.

## 2. A decision to make first

`docs/help/rows/scheduler.md` line 682 says, in a call-out: "Scheduler, not a
Gantt ... there is no critical path, percent-done, baselines, or
work-breakdown structure, and none are planned." Demo 389's meta FAQ says the
same. Shipping a Gantt view reverses that statement. The plan below assumes the
reversal is intended and includes rewording that call-out to point at the new
page. Confirm before Phase 1 starts.

## 3. Reuse map

Existing code the Gantt consumes without change:

- `packages/grid/src/scheduler-model.ts`: `timelineGeom` (bar left/width as a
  percentage of the axis window, with `continuesLeft/Right` clip flags), the
  `TimelineAxis` / `TimelineTick` / `TimelineMajor` types, and `groupMajors`
  (currently module-private; export it), plus `toDate`, `startOfDay`,
  `addDays`, `isSameDay` from date-core.
- `packages/enterprise/src/scheduler-dependencies.ts`: `buildDependencyGraph`,
  `topoOrder`, `hasCycle`, `requiredStart`, `cascade`, `violations`. They take
  `{ id, from, to, type?, lag? }` and a `Map<key, {start, end}>`, which is
  exactly what a Gantt task list produces. `lag` stays in minutes; the Gantt
  writes `lagDays * 1440`. Critical path builds on `topoOrder`.
- `packages/enterprise/src/scheduler-axis.ts`: `buildAxis`, `timeToX`,
  `xToTime`, `resolveZoom`, `zoomPresets`. The piecewise pixel axis gives the
  Gantt continuous zoom and weekend collapse for free.
- `packages/enterprise/src/scheduler-assignments.ts`: `resourceLoad`,
  `overallocations` for the Phase 3 resource histogram.
- Grid UI primitives the Scheduler already mounts: `SvDrawer`, `SvForm`,
  `SvMenuList`, `SvDateTimePicker`, `SvNumberInput`, `portalToBody`,
  `createDismissableLayer`, `onScrollOutside`, `popIn`.

Code to extract from `SvGridScheduler.svelte` into a shared helper so both
renderers use one copy:

- `depElbow(x1, y1, x2, y2)` (line 590) and the arrow-building loop above it
  (lines 571-589) become `packages/enterprise/src/timeline-arrows.ts`:

  ```ts
  export type BarRect = { left: number; right: number; midY: number }
  export type Arrow = { id: string; d: string; bad: boolean; hx: number; hy: number }
  export function elbowPath(x1: number, y1: number, x2: number, y2: number, loopDy: number): string
  export function dependencyArrows(
    rects: ReadonlyMap<string, BarRect>,
    deps: ReadonlyArray<{ id: string; from: string; to: string; type?: DependencyType }>,
    badIds: ReadonlySet<string>,
    loopDy: number,
  ): Arrow[]
  ```

  The Scheduler switches to it in the same PR (it passes `tlLaneH` as
  `loopDy`), so the extraction is covered by the existing
  `tests/e2e/scheduler-timeline.spec.ts` and a new unit test.

## 4. Phase 0: the free half in `@svgrid/grid`

Mergeable on its own. A grid with `gantt` set shows the upsell note, exactly
like `scheduler` does without enterprise.

### 4.1 Types (`SvGrid.types.ts`)

Placed after `SchedulerConfig`, before `Props`. Every field carries a doc
comment in the style of `SchedulerConfig`; the sketch below lists the surface.

```ts
/** Axis presets: which unit is a tick and which is the grouping row above it. */
export type GanttZoom = 'day' | 'week' | 'month' | 'quarter' | 'year'
export type GanttDependencyType = 'FS' | 'SS' | 'FF' | 'SF'

/** Same shape as enterprise's SchedulerDependency, declared here so the free
 *  config can name it. `lag` is in DAYS for the Gantt (negative = a lead). */
export type GanttDependency = {
  id: string
  from: string
  to: string
  type?: GanttDependencyType
  lag?: number
}

export type GanttTaskMoveEvent<TData extends RowData = RowData> = {
  row: TData
  start: Date
  end: Date
  /** Rows shifted with this one: the moved parent's subtree (not cascaded successors). */
  subtree?: Array<{ row: TData; start: Date; end: Date }>
}
export type GanttTaskResizeEvent<TData extends RowData = RowData> = {
  row: TData
  start: Date
  end: Date
  edge: 'start' | 'end'
}
export type GanttProgressChangeEvent<TData extends RowData = RowData> = {
  row: TData
  /** 0..100, in whole percent. */
  progress: number
}
export type GanttTaskCommitEvent<TData extends RowData = RowData> = {
  row: TData
  values: Partial<TData>
}
/** The drawer takes the scheduler's config shape (field list, title, width). */
export type GanttDrawerConfig<TData extends RowData = RowData> = SchedulerDrawerConfig<TData>

export type GanttConfig<
  TFeatures extends TableFeatures = TableFeatures,
  TData extends RowData = RowData,
> = {
  // --- fields --------------------------------------------------------------
  /** Field holding each task's start (`Date` | epoch-ms | ISO string). Required. */
  startField: keyof TData & string
  /** Field holding the end (exclusive of the last day when a date-only value). */
  endField?: keyof TData & string
  /** Working-day length, used when `endField` is absent. `1` = one working day. */
  durationField?: keyof TData & string
  /** Task label. Defaults to the first column's field. */
  titleField?: keyof TData & string
  /** 0..100 percent complete. Drives the inner fill and the summary rollup. */
  progressField?: keyof TData & string
  /** Field holding the parent task's id. Roots hold null / undefined. Turns the
   *  flat rows into a work-breakdown tree; parents draw summary bars. */
  parentField?: keyof TData & string
  /** Boolean field marking a milestone. A task whose end equals its start is a
   *  milestone regardless. */
  milestoneField?: keyof TData & string
  /** Per-task accent color (any CSS color). Else `color`, else the accent token. */
  colorField?: keyof TData & string
  color?: string

  // --- dependencies ---------------------------------------------------------
  /** Predecessor -> successor links. `from` / `to` are row ids (`getRowId`). */
  dependencies?: ReadonlyArray<GanttDependency>
  /** Per-row field holding this row's links (`GanttDependency[]` or successor ids). */
  dependencyField?: keyof TData & string
  /** Push successors forward after a move / resize. Default true when any link exists. */
  autoReschedule?: boolean
  /** Cascaded starts land on working days (`nonWorkingDays` / `holidays`). Default true. */
  respectWorkingTime?: boolean
  onDependenciesChange?: (moves: Array<{ id: string; start: Date; end: Date }>) => void
  onDependencyAdd?: (dep: GanttDependency) => void
  onDependencyRemove?: (id: string) => void

  // --- axis -----------------------------------------------------------------
  /** Initial preset. Default `'week'` (day ticks under month majors). */
  zoom?: GanttZoom
  /** Presets the toolbar stepper offers. Default all five. One entry hides the stepper. */
  zoomLevels?: ReadonlyArray<GanttZoom>
  onZoomChange?: (zoom: GanttZoom) => void
  weekStartsOn?: 0 | 1 | 2 | 3 | 4 | 5 | 6
  /** Weekday numbers treated as non-working. Default `[0, 6]`. */
  nonWorkingDays?: ReadonlyArray<number>
  /** Dates treated as non-working (shaded, skipped by working-day math). */
  holidays?: ReadonlyArray<Date | number | string>
  /** Shade non-working days. Default true. */
  showNonWorking?: boolean
  /** The dashed today line. Default true. */
  todayLine?: boolean
  /** Clamp the axis window and every drag. */
  minDate?: Date | number | string
  maxDate?: Date | number | string
  /** Calendar days of slack around the first start and last end. Default 7. */
  rangePaddingDays?: number

  // --- layout ---------------------------------------------------------------
  /** Column ids shown in the task table. Default: every leaf column. */
  tableColumns?: ReadonlyArray<string>
  /** Initial task-table width in px. Default 360. A splitter resizes it. */
  tableWidth?: number
  /** Row height in px. Default 32. */
  rowHeight?: number
  /** Parents draw a rolled-up summary bar. Default true. */
  summaryBars?: boolean
  /** Where the bar label sits. Default `'inside'`, falling back to `'right'`
   *  when the bar is narrower than the label. */
  labelPosition?: 'inside' | 'right' | 'none'

  // --- WBS collapse (uncontrolled by default) ---------------------------------
  collapsed?: ReadonlyArray<string>
  onCollapseChange?: (collapsed: string[]) => void

  // --- editing ----------------------------------------------------------------
  /** Enable drag-to-move, edge resize, the progress grip and link drawing. */
  editable?: boolean
  /** Undo / redo with Ctrl/Cmd+Z and Ctrl/Cmd+Shift+Z (or Ctrl+Y). */
  history?: boolean
  onTaskMove?: (e: GanttTaskMoveEvent<TData>) => void
  onTaskResize?: (e: GanttTaskResizeEvent<TData>) => void
  onProgressChange?: (e: GanttProgressChangeEvent<TData>) => void
  /** Double-click empty chart space: create a task on that day under that row's parent. */
  onTaskAdd?: (start: Date, end: Date, parentId?: string) => void
  onTaskDelete?: (row: TData) => void

  // --- chrome -----------------------------------------------------------------
  /** Custom bar body. Receives the row. */
  task?: Snippet<[TData]>
  tooltip?: boolean | Snippet<[TData]>
  tooltipDelay?: number
  drawer?: boolean | GanttDrawerConfig<TData>
  onTaskCommit?: (e: GanttTaskCommitEvent<TData>) => void
  taskMenu?: (row: TData) => MenuItem[] | undefined
  searchable?: boolean
  searchPlaceholder?: string
}
```

Add to `Props`, right after `scheduler`:

```ts
/**
 * Gantt mode. When set, the grid renders its rows as a task table beside a
 * time chart (bars by start / end, a work-breakdown tree by `parentField`,
 * dependency arrows). A view of the grid like the scheduler and board.
 */
gantt?: GanttConfig<TFeatures, TData>
```

Export the types from `packages/grid/src/index.ts` in a block after the
scheduler exports (line 123), with the same comment style.

Decisions baked into that shape:

- The WBS comes from `parentField` in the config, not from the grid's
  `treeData` prop. With `treeData` on, collapsed children never reach the view
  (`allRowsBeforePagination`, controller line 1638, is the expanded row
  model), so a collapsed phase would lose its tasks. The Gantt owns its tree
  and its collapse state; parents need a rolled-up summary bar anyway. Docs
  say: set `gantt.parentField`, leave `treeData` off. `SvGrid.svelte` warns
  once in dev when both are set.
- Dates are local calendar days, `end` exclusive. A task on Sep 14 with a
  one-day duration has `start = Sep 14 00:00`, `end = Sep 15 00:00`. A
  date-only string like `2026-09-14` for `endField` is read as the END of that
  day (the inclusive convention every planning tool uses), so a row
  `{ start: '2026-09-14', end: '2026-09-16' }` draws a three-day bar. A
  timestamp with a time part is used as-is. `resolveTasks` documents this and
  tests pin it.
- No `timeZone` in Phase 1. Day-granularity planning does not need the
  Scheduler's pseudo-local machinery. Hour-level zoom comes from the Pro axis
  in Phase 3.
- `GanttDependency` is declared in the free grid because the free config must
  name it. `SchedulerDependency` stays where it is; the helpers are structural.
- Row order among siblings is the grid's order. Sorting the grid by start
  reorders tasks within each phase; the phase stays the parent. Filtering out
  a parent keeps its children as roots (they do not vanish), the same rule
  `treeData` uses for missing parents.

### 4.2 Seam (`gantt-view.svelte.ts`)

Copy `board-view.svelte.ts` verbatim with the names changed. Thirty lines.
Export `registerGanttView`, `getGanttView`, `hasGanttView`.

### 4.3 `SvGrid.svelte`

- `import { getGanttView } from "./gantt-view.svelte"` beside line 56.
- `const ganttConfig = $derived(opt.gantt)` beside `schedulerConfig` (line 80).
- A `{:else if ganttConfig}` branch after the scheduler branch (line 1060) and
  before the chart branch, mirroring lines 1013-1060 exactly:
  - root: `class="sv-grid-root sv-grid-gantt-root"`, the same
    `containerHeight` style and `sv-grid-root-fill` class.
  - search: the `sv-grid-board-search` label bound to `ctrl.globalFilter`,
    placeholder `ganttConfig.searchPlaceholder ?? messages.ganttSearchPlaceholder`,
    `aria-label="Search tasks"`.
  - renderer: `<GanttView data={boardData} columns={opt.columns} gantt={ganttConfig} getRowId={opt.getRowId} />`.
  - upsell: `<div class="sv-grid-scheduler-upsell sv-grid-gantt-upsell" role="note">`
    with `<strong>{messages.ganttUpsellTitle}</strong><p>{messages.ganttUpsellBody}</p>`
    and `{@render enterpriseLicenseNote()}`.
- Strings in `grid-messages.ts` beside the pivot keys (lines 113-114 and
  193-194): `ganttUpsellTitle: 'Gantt view'`,
  `ganttUpsellBody: 'The Gantt view is an Enterprise feature. Install @svgrid/enterprise and call enableGanttView() to render it.'`,
  `ganttSearchPlaceholder: 'Search tasks...'`.
- Branch precedence stays board, scheduler, gantt, chart, pivot, table. Two
  view props set at once is a consumer error; the first wins, as today.

### 4.4 Model (`gantt-model.ts`)

Pure, no Svelte, no `new Date()` without an argument, the same rules as
`scheduler-model.ts`. Exported from `index.ts` after the scheduler-model block
(line 173).

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

export type WorkingCalendar = {
  nonWorkingDays: ReadonlyArray<number>
  holidays: ReadonlySet<number>        // startOfDay(date).getTime()
}

export type ResolvedTask<TData = unknown> = {
  key: string
  row: TData
  title: string
  start: Date          // local midnight
  end: Date            // local midnight, exclusive
  progress: number     // 0..100, clamped
  milestone: boolean
  parentKey: string | null
  color?: string
}

/** Rows without a readable start are skipped (a backlog row is not a bar).
 *  End wins over duration; duration counts working days from start; neither
 *  gives a milestone (end = start). Date-only end strings are inclusive. */
export function resolveTasks<TData>(
  rows: ReadonlyArray<TData>,
  spec: GanttTaskSpec<TData>,
  cal: WorkingCalendar,
): ResolvedTask<TData>[]

export type GanttNode<TData = unknown> = {
  task: ResolvedTask<TData>
  depth: number
  hasChildren: boolean
  collapsed: boolean
  /** Present on a parent: rolled up from every descendant (collapsed or not). */
  summary?: { start: Date; end: Date; progress: number }
}

/**
 * Order tasks as a work-breakdown tree: roots in input order, each parent's
 * children directly under it in input order, orphans (parent key unknown)
 * promoted to roots. Descendants of a collapsed node are omitted from the
 * list but still feed its summary. Summary = min(start), max(end), and
 * progress = the duration-weighted mean of the LEAF descendants (a milestone
 * weighs 0 days; a parent with only milestones takes their plain mean).
 * A cycle in parent links (a -> b -> a) is broken at the first repeat and
 * both rows become roots.
 */
export function ganttTree<TData>(
  tasks: ReadonlyArray<ResolvedTask<TData>>,
  collapsed: ReadonlySet<string>,
): GanttNode<TData>[]

/** The visible flat index of every node, for arrow geometry: key -> row index. */
export function nodeIndex<TData>(nodes: ReadonlyArray<GanttNode<TData>>): Map<string, number>

/** [min start - padding, max end + padding], clamped to min/max, never empty:
 *  no tasks gives [today - padding, today + padding] using the injected today. */
export function projectRange(
  tasks: ReadonlyArray<ResolvedTask<unknown>>,
  opts: { paddingDays: number; today: Date; minDate?: Date; maxDate?: Date },
): { start: Date; end: Date }

/**
 * The header axis over [start, end) for a preset. Returns the scheduler's
 * TimelineAxis shape (ticks + majors as percentages) so the header markup
 * matches the timeline's:
 *   day     -> ticks: days       majors: weeks   ("14 - 20 Sep")
 *   week    -> ticks: days       majors: months  ("September 2026")   (default)
 *   month   -> ticks: weeks      majors: months
 *   quarter -> ticks: months     majors: quarters ("Q3 2026")
 *   year    -> ticks: months     majors: years
 * Week ticks start on `weekStartsOn`; a partial first / last tick keeps its
 * true width so bars never drift against the header.
 */
export function ganttAxis(
  start: Date,
  end: Date,
  zoom: GanttZoom,
  opts: { weekStartsOn: number; today?: Date | null },
): TimelineAxis

/** Recommended pixel width of one tick per preset, the free-axis equivalent of
 *  the scheduler's `timelineTickMinWidth` defaults (renderer line 400). */
export const ganttTickWidth: Record<GanttZoom, number>   // day 48, week 28, month 40, quarter 96, year 72

export function isWorkingDay(d: Date, cal: WorkingCalendar): boolean
export function workingDays(start: Date, end: Date, cal: WorkingCalendar): number
export function addWorkingDays(start: Date, days: number, cal: WorkingCalendar): Date
/** The next (dir 1) or previous (dir -1) working day at or after / before `d`. */
export function snapToWorkingDay(d: Date, dir: 1 | -1, cal: WorkingCalendar): Date
export function makeCalendar(nonWorkingDays?: ReadonlyArray<number>, holidays?: ReadonlyArray<DateLike>): WorkingCalendar
```

`addWorkingDays` and `snapToWorkingDay` carry the same 4000-iteration guard
`buildAxis` uses so a calendar with every day off cannot loop.

### 4.5 Tests

`packages/grid/src/gantt-model.test.ts`, one `describe` per function:

- `resolveTasks`: end wins over duration; duration of 3 across a weekend ends
  on the following Wednesday; a date-only end string is inclusive; a
  timestamp end is exact; no end and no duration gives a milestone; a missing
  start skips the row; progress clamps to 0..100 and `NaN` becomes 0;
  `milestoneField` true forces a milestone even with a span.
- `ganttTree`: order with two roots and nested children; orphan promoted;
  parent cycle broken; collapse hides descendants but the summary still spans
  them; summary progress weighted by leaf durations (two leaves of 2 and 6
  days at 100% and 0% give 25%); milestones weigh zero; a parent of only
  milestones averages plainly; `nodeIndex` matches list positions.
- `projectRange`: padding on both sides; `minDate` / `maxDate` clamp; empty
  input centres on the injected today.
- `ganttAxis`: for every preset, ticks tile the range with no gap and no
  overlap (sum of widths is 100 within 1e-6); majors group the right ticks;
  a range starting on a Wednesday under `weekStartsOn: 1` produces a short
  first week tick; the today flag lands on exactly one tick.
- Working days: `workingDays` over a week with `[0, 6]` is 5; a holiday
  removes one; `addWorkingDays(Fri, 1)` is Monday; `snapToWorkingDay` in both
  directions; an all-off calendar returns the input rather than looping.

`packages/grid/src/svgrid.gantt-seam.test.ts`, mirroring
`svgrid.selection-bar-seam.test.ts`: `hasGanttView()` is false and
`.sv-grid-gantt-upsell` renders; the search box binds to the global filter
(type `Ada`, the stub renderer receives one row); after `registerGanttView`
with a stub component the stub receives `data`, `columns`, `gantt`, `getRowId`;
`localeText` overrides `ganttUpsellTitle`.

`svgrid.upsell-license.test.ts`: add the fifth gate. Its header comment
already anticipates this.

### 4.6 Budgets and generated surfaces

- The seam file, the `SvGrid.svelte` branch and the three messages sit on the
  base bundle path. Expect roughly 0.3 to 0.5 KB gzipped. Run `pnpm size`,
  then acknowledge the measurement in `packages/grid/scripts/measure-size.mjs`
  (`BUDGET_KB`, line 52) and in `packages/grid-wc/scripts/check-size.mjs`,
  both with the dated note those files use. Do not type a number without
  running the tool.
- `packages/grid-wc`: run `node scripts/generate-surface.mjs` so `gantt`
  appears in `surface.generated.js` and `types/elements.d.ts`; the parity test
  fails otherwise. No hand edits. The element comments that list "board,
  scheduler" (generate-surface line 8, check-size line 30) gain "gantt".
- Changeset: `@svgrid/grid: minor`.

## 5. Phase 1: the Pro renderer, read-only

`packages/enterprise/src/SvGridGantt.svelte`, `gantt.ts`, `gantt-config.ts`,
plus the shared `timeline-arrows.ts` extraction. `installEnterprise` gains
`enableGanttView()` after `enableBoardView()`. `index.ts` exports
`enableGanttView`, `SvGridGantt`, `GanttProConfig`, and the arrow helper.

### 5.1 Props and config defaults

Identical to the Scheduler's: `data`, `columns`, `gantt`, `getRowId`. Generic
over `TFeatures, TData`. The Pro fields are read through
`const pcfg = $derived(gantt as unknown as GanttProConfig<TFeatures, TData>)`.

```ts
const rowH        = $derived(gantt.rowHeight ?? 32)
const barH        = $derived(rowH - 10)            // 22 at the default
const zoomLadder  = $derived(gantt.zoomLevels ?? ['day', 'week', 'month', 'quarter', 'year'])
let   zoomOverride = $state<GanttZoom | null>(null)
const zoom        = $derived(zoomOverride ?? gantt.zoom ?? 'week')
const cal         = $derived(makeCalendar(gantt.nonWorkingDays ?? [0, 6], gantt.holidays))
const editable    = $derived(gantt.editable === true)
const autoResched = $derived(gantt.autoReschedule ?? depList.length > 0)
let   tableW      = $state(gantt.tableWidth ?? 360)   // svelte-ignore state_referenced_locally
```

### 5.2 Row key, overlay and spec

The same three pieces the Scheduler has at lines 195-260:

- `key(row)`: `getRowId(row, index)` when given, else a `WeakMap` synthetic id
  pinned to the row object, so the overlay survives re-sorts and data
  replacement.
- Overlay: `startOf`, `endOf`, `progressOf` as `$state<Record<string, ...>>`
  plus `edits` for drawer saves. `fieldValue(row, field)` reads `edits` first.
- `spec`: `getStart: r => startOf[key(r)] ?? fieldValue(r, gantt.startField)`,
  and so on for end, duration, progress, parent, milestone, colour. Title
  falls back to the first `field` column like the Scheduler's `titleField`.

Then the derived chain:

```ts
const tasks    = $derived(resolveTasks(data, spec, cal))
const taskByKey = $derived(new Map(tasks.map(t => [t.key, t])))
let   collapsedLocal = $state(new Set<string>())
const collapsed = $derived(gantt.collapsed ? new Set(gantt.collapsed) : collapsedLocal)
const nodes    = $derived(ganttTree(tasks, collapsed))
const rowIndex = $derived(nodeIndex(nodes))
const range    = $derived(projectRange(tasks, { paddingDays: gantt.rangePaddingDays ?? 7, today, minDate, maxDate }))
```

### 5.3 Axis and the one `xOf` function

Two axis modes, chosen once:

- Free axis (default): `axis = ganttAxis(range.start, range.end, zoom, ...)`,
  `axisPx = axis.ticks.length * ganttTickWidth[zoom]`, and
  `xOf(d) = timelineGeom(d, d, axis.start, axis.totalMs)` reduced to
  `(d - start) / totalMs * axisPx`. `dateAtX(x)` is the inverse.
- Pro axis (Phase 3, when `pcfg.zoom` is a `ZoomLevel` or `collapseWeekends`
  is set): `axis = buildAxis(range.start, range.end, { pxPerMinute, nonWorkingDays, collapseWeekends, collapsedGapPx })`,
  `xOf = d => timeToX(d, axis)`, `dateAtX = x => xToTime(x, axis)`, and the
  header ticks are generated per `ZoomLevel.tickMinutes` like the Scheduler's
  `proAxisData` (renderer line 365).

Every bar, gridline, shading band, arrow anchor, drop preview and the today
line goes through `xOf`. Nothing else computes a pixel from a date.

### 5.4 DOM layout

```
.sv-gantt                              display: flex; height: 100%
  .sv-gantt-toolbar                    zoom stepper (SvButton group), Today, Expand / Collapse all
  .sv-gantt-scroll                     overflow-y: auto; the ONE vertical scroller
    .sv-gantt-panes                    display: flex; min-height: 100%
      .sv-gantt-table                  width: var(--gantt-table-w); flex: none
        .sv-gantt-table-head           position: sticky; top: 0; height = axis head height
          .sv-gantt-th  x cols
        .sv-gantt-table-row  x N       height: var(--gantt-row-h)
          .sv-gantt-td  x cols         first cell: indent + chevron + title
      .sv-gantt-splitter               width: 5px; cursor: col-resize
      .sv-gantt-chart                  flex: 1; overflow-x: auto; overflow-y: hidden
        .sv-gantt-axis                 position: sticky; top: 0; width: axisPx
          .sv-gantt-majors / .sv-gantt-ticks
        .sv-gantt-body                 position: relative; width: axisPx; height: N * rowH
          .sv-gantt-shade   x bands    non-working columns, absolute, full height
          .sv-gantt-gridline x ticks   1px, full height
          .sv-gantt-row  x N           absolute; top: i * rowH; full width
            .sv-gantt-bar | .sv-gantt-summary | .sv-gantt-milestone
              .sv-gantt-progress       inner fill
              .sv-gantt-grip-l / -r    resize grips (Phase 2)
              .sv-gantt-grip-p         progress grip (Phase 2)
              .sv-gantt-link-dot       connector handles (Phase 2)
            .sv-gantt-label            when labelPosition resolves to right
          svg.sv-gantt-deps            arrow overlay, pointer-events: none, z-index 3
          .sv-gantt-today              dashed line at xOf(today)
```

One vertical scroller wraps both panes so rows never drift apart; only the
chart pane scrolls horizontally. Both heads are sticky at the same height
(two header rows, 24px each). Hovering a table row highlights its chart row
and the reverse, through a shared `hoverKey` state and a class.

The table cells use each column's `header` (string form; a snippet header
falls back to the field name like the Scheduler's `headerLabel`), `width`,
and value formatting: a `Date` through `toLocaleDateString`, numbers as-is,
the board's `fmt` rule (SvGridBoard line 63). A column `cell` snippet renders
through `renderSnippet` with a minimal `CellContext` (row, value) when it is
a function; string templates render as text. Tree rows indent the title cell
by `depth * 14px` and get a chevron button (`aria-expanded`).

The table pane also offers two built-in columns a consumer can name in
`tableColumns` without defining them: `__duration` (working days from the
resolved task) and `__progress` (a small bar). They exist so the demo table
does not need helper columns in `columns`.

The left pane is the renderer's own light table, not an embedded `<SvGrid>`.
That matches the Scheduler's resource gutter and avoids running two row models
for one view. The trade-off (no inline editing, no column resize in the pane)
is listed under open questions.

### 5.5 Bars

- Normal task: `left: xOf(start)`, `width: max(2, xOf(end) - xOf(start))`,
  `top: (rowH - barH) / 2`, rounded, background from `color` with the
  Scheduler's `--sv-sched-accent` pattern renamed `--sv-gantt-accent`. Inner
  `.sv-gantt-progress` with `width: progress%` and a darker mix of the accent.
  Label inside when `width >= labelWidth + 12`, else `.sv-gantt-label` to the
  right (`labelPosition: 'right'` forces it; `'none'` hides it).
- Summary (parent): height 8px, centred, with 6px down-facing end caps drawn
  as `::before` / `::after` triangles; progress as a darker inner fill; no
  grips; label always to the right.
- Milestone: a 14px square rotated 45 degrees at `xOf(start)`, label to the
  right.
- Every bar: `tabindex="0"`, `role="row"` inside the chart `role="grid"`
  region, `aria-label="Title, 14 Sep to 20 Sep, 40%"`, `data-key`.
- Clipping: a bar that starts before `range.start` (only possible with
  `minDate`) gets `sv-gantt-bar-clip-l`, the Scheduler's `continuesLeft`.

### 5.6 Arrows

```ts
const depList = $derived.by(() => merge(gantt.dependencies, per-row gantt.dependencyField))
const depTimes = $derived(new Map(tasks.map(t => [t.key, { start: t.start, end: t.end }])))
const depBad   = $derived(new Set(violations(depTimes, depList).map(d => d.id)))
const barRects = $derived.by(() => {
  const m = new Map<string, BarRect>()
  for (const [i, n] of nodes.entries()) {
    const t = n.summary ?? n.task
    m.set(n.task.key, { left: xOf(t.start), right: xOf(t.end), midY: i * rowH + rowH / 2 })
  }
  return m
})
const arrows = $derived(dependencyArrows(barRects, depList, depBad, rowH))
```

A link whose endpoint is inside a collapsed subtree draws to the collapsed
parent's summary bar (`nodeIndex` resolves the nearest visible ancestor). A
link to a filtered-out row is skipped, as the Scheduler does.

### 5.7 Everything else in Phase 1

- Today line at `xOf(today)`, `today` refreshed every 60s like demo 45.
- Non-working shading: one band per non-working day in `range` under the
  free axis; under the Pro axis the `break` / `collapsed` segments are the
  bands.
- Tooltip: the Scheduler's `tooltipCfg` / delay / `sv-sched-tooltip` block
  (renderer lines 1232-1250 and 3886-3900) with title, start to end, N days,
  N%, and the parent's title.
- Collapse: chevron click toggles `collapsedLocal` or calls
  `onCollapseChange`; the toolbar's Expand all / Collapse all does the set.
- Zoom stepper: `SvButton` minus / plus over `zoomLadder`, fires
  `onZoomChange`; `Ctrl+wheel` over the chart steps it too. Zooming keeps the
  date under the pointer fixed: record `dateAtX(pointer)` before, scroll so
  `xOf(that date)` lands on the same client x after.
- Scroll today into view on mount (centre it; fall back to the first task).
- Search flows through `SvGrid`'s global filter untouched.

### 5.8 Tests

`packages/enterprise/src/gantt.dom.test.ts` in the `dom` project, modelled
on `board.dom.test.ts` (call `enableGanttView()`, mount `SvGridGantt`
directly, `flushSync`). Fixture: three phases, eight tasks, two milestones,
four links, one violating.

- renders one table row and one chart row per visible node in tree order;
  indent equals depth times 14px.
- a leaf bar's `style.left` and `style.width` match `xOf` for its dates;
  a milestone renders `.sv-gantt-milestone` at `xOf(start)`.
- the phase row draws `.sv-gantt-summary` spanning its children; its
  progress fill equals the weighted rollup.
- `.sv-gantt-deps path.sv-gantt-dep-line` count equals the link count; the
  violating one carries `sv-gantt-dep-bad`.
- clicking a chevron removes the descendants and adds `sv-gantt-collapsed`
  to the parent; an arrow into the collapsed subtree re-anchors on the parent.
- `tableColumns: ['title', '__duration']` renders two header cells and the
  duration column shows working days.
- mounted through `<SvGrid gantt=...>`: typing in the search box filters the
  rows (mirrors the board test that mounts `SvGrid`).
- `timeline-arrows.test.ts`: `elbowPath` for a forward link is four points;
  a backward link loops with six points; `dependencyArrows` picks the FS /
  SS / FF / SF anchors from the right edges.

### 5.9 Changeset and docs

`@svgrid/enterprise: minor`. The docs page and the first demo land in this
phase (section 8) so the page and the view ship together.

## 6. Phase 2: editing

All in `SvGridGantt.svelte`, following the Scheduler's timeline handlers
(renderer lines 3008-3121) one for one, with one `BarDrag` state for the
three modes.

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

- Threshold: 3px (`DRAG_THRESHOLD`) before `moved` flips, so a click still
  opens the drawer and never fires a zero move.
- Snap: `snapDay(d) = startOfDay(d)` for move and resize-start,
  `addDays(startOfDay(d), 1)` for resize-end; under the Pro hour-level axis
  the snap is the tick, exactly the Scheduler's `fine` rule (line 3047).
  With `respectWorkingTime` (default true) a move that lands on a
  non-working day slides to the next working day; a resize keeps calendar
  days (a task can span a weekend).
- Move: `previewStart = snapDay(dateAtX(clientX) - grabOffsetMs)`, `previewEnd = previewStart + durationMs`,
  clamped to `[minDate, maxDate]`. A parent moves its whole subtree by the
  same delta; the preview shows every bar shifted; the commit fires one
  `onTaskMove` with `subtree` filled, so the consumer writes the batch.
- Resize: `min length` is one day (or one tick); a milestone cannot resize.
- Progress: `previewProgress = clamp(round((clientX - barLeft) / barWidth * 20) * 5, 0, 100)`,
  fires `onProgressChange`. Only leaves have the grip; a parent's progress is
  the rollup.
- Link: the `.sv-gantt-link-dot` on each bar edge starts a `link` drag. While
  dragging, a temporary path follows the pointer; hovering another bar sets
  `linkTargetKey` and the edge (left half = start, right half = end). On
  release the type is `FS` for end to start, `SS` start to start, `FF` end to
  end, `SF` start to end. The new link is refused (a 300ms red flash on both
  bars, the Scheduler's `bookingBlocked` treatment) when `hasCycle([...deps, candidate])`
  or the pair is already linked. Otherwise `onDependencyAdd({ id: `dep-${from}-${to}-${Date.now()}`, from, to, type })`.
  Right-click on an arrow opens `SvMenuList` with Remove, calling
  `onDependencyRemove(id)`.
- Commit (`onBarDragEnd`): write the overlay, emit the callback, then
  `cascadeDeps(key, start, end)` (the Scheduler's routine at line 599 with
  `snapForward = d => snapToWorkingDay(d, 1, cal)` when `respectWorkingTime`),
  then `pushHistory`.
- History: the Scheduler's stack with `kind: 'move' | 'resize' | 'progress'`
  and `subtree` deltas recorded so undoing a parent move restores its
  children. Undo re-emits the callbacks with the reversed values, so the
  consumer's data follows; cascaded shifts are recorded in the same command.
- Double-click empty chart space: `onTaskAdd(day, day + 1, parentKeyOf(rowUnderPointer))`.
- Keyboard on a focused bar (Scheduler `onEventKey`, line 1958):
  `ArrowLeft` / `ArrowRight` move by a day, with `Shift` by seven, with `Alt`
  resize the end; `+` / `-` change progress by 5; `Enter` opens the drawer;
  `Delete` fires `onTaskDelete`; `Escape` cancels an active drag and restores
  the preview. `Ctrl+Z` / `Ctrl+Shift+Z` / `Ctrl+Y` when `history` is on.
- Drawer: `drawer: true | GanttDrawerConfig` reuses the Scheduler's
  `SvDrawer` + `SvForm` block and `drawerFields` builder. Start, End (or
  Duration) and Progress are pinned first with date / number types; the rest
  come from `drawerFieldCols`. Save writes `edits[key]`, fires `onTaskCommit`,
  and when start / end changed also runs the cascade.
- Context menu: Edit (with drawer), Add subtask (with `onTaskAdd`), Delete
  (with `onTaskDelete`), then `taskMenu(row)` items, through `SvMenuList`
  with the board's dismissable-layer pattern.

### 6.1 Tests

Extend `gantt.dom.test.ts` with pointer sequences (`pointerdown`,
`pointermove` on `window`, `pointerup`), the same helper the board test uses:

- a 3-tick drag on a leaf fires `onTaskMove` with start + 3 days and the
  same duration; the source row is unchanged; the bar's `style.left` moved.
- a 1px drag fires nothing and a click opens the drawer.
- dragging the right grip fires `onTaskResize` with `edge: 'end'`; the left
  grip with `edge: 'start'`; a milestone has no grips.
- a drag landing on Saturday with `respectWorkingTime` starts on Monday.
- moving a parent fires one `onTaskMove` whose `subtree` lists every
  descendant shifted by the same delta.
- with links, moving a predecessor fires `onDependenciesChange` with the
  cascaded successors and their bars moved; `autoReschedule: false` does not.
- the progress grip at the bar's midpoint fires `onProgressChange` with 50.
- link drawing from A's end onto B's start fires `onDependencyAdd` with `FS`;
  onto B's end with `FF`; a link that would close a cycle fires nothing and
  both bars get `sv-gantt-refused`.
- `Ctrl+Z` after a move re-fires `onTaskMove` with the original dates.
- `ArrowRight` on a focused bar moves it by one day.
- drawer save with a new end fires `onTaskCommit` and the cascade.

`tests/e2e/gantt.spec.ts` (needs the website checkout, like the scheduler
specs): drag a bar and read its tooltip dates; resize; draw a link and count
arrows; zoom in twice and check the tick width; collapse a phase.

## 7. Phase 3: planning features (`GanttProConfig`)

`packages/enterprise/src/gantt-config.ts`, structurally assignable to the
`gantt` prop, read through `pcfg`:

```ts
export type GanttProConfig<TFeatures, TData> = GanttConfig<TFeatures, TData> & {
  criticalPath?: boolean
  baselineStartField?: keyof TData & string
  baselineEndField?: keyof TData & string
  constraintField?: keyof TData & string          // 'ASAP' | 'ALAP' | 'MSO' | 'MFO' | 'SNET' | 'SNLT' | 'FNET' | 'FNLT'
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

### 7.1 Critical path (`gantt-critical-path.ts`, pure)

```ts
export type CpmResult = {
  critical: Set<string>
  slackMs: Map<string, number>
  earliest: Map<string, EventTimes>
  latest: Map<string, EventTimes>
  finish: Date
}
export function criticalPath(
  times: ReadonlyMap<string, EventTimes>,
  deps: ReadonlyArray<SchedulerDependency>,
  opts?: { keys?: Iterable<string> },
): CpmResult
```

Forward pass in `topoOrder`: `ES = max(own start, requiredStart over
predecessors)`, `EF = ES + duration`. Project finish = max EF. Backward pass
in reverse order: `LF = min(finish, over successors of the latest start
that link allows)`, `LS = LF - duration`. `slack = LS - ES`; critical when
slack is below one minute. Tasks outside every link keep their own dates and
a slack of `finish - own end`, so an unlinked late task is not "critical".
Cyclic links are ignored, as in `cascade`. Parents are excluded from the pass
(their bars are rollups); a link that names a parent is treated as a link to
its last-finishing leaf for FS / FF and first-starting leaf for SS / SF.

The renderer adds `sv-gantt-critical` to critical bars and their arrows, and
exports `slackDays(result, key, cal)` so a consumer can add a Slack column.
Tests: a chain of three; a diamond where the longer branch is critical; a
lag that flips which branch is critical; an isolated task; an SS link; a
cycle ignored.

### 7.2 Baselines

`baselineStartField` / `baselineEndField` draw a 6px grey bar under the task
bar (`.sv-gantt-baseline`) and the tooltip shows the variance in working
days. A missing baseline draws nothing.

### 7.3 Constraints

`constraintField` and `constraintDateField` per row. `cascade` gets a
`floor` / `ceiling` per key through a wrapper in the renderer: `SNET` and
`MSO` raise the floor, `FNLT` and `MFO` set a ceiling, `ALAP` schedules
against the latest-start pass. A cascade that would break a ceiling stops at
it and the bar paints `sv-gantt-constrained` (the violation colour). A small
glyph before the label shows the constraint kind. Kept in Phase 3 because
`cascade` in `scheduler-dependencies.ts` needs an optional
`bounds?: ReadonlyMap<string, { minStart?: Date; maxEnd?: Date }>` argument,
which is a small, backwards-compatible change to a shared file.

### 7.4 Pro axis and hours

`zoom` as a number or `ZoomLevel` switches to `buildAxis` / `timeToX` with
`pxPerMinute` from `resolveZoom`, which brings hour-level ticks for short
projects and `collapseWeekends`. `zoomLevels` may then be the Scheduler's
`zoomPresets` ladder. The stepper and the wheel work the same.

### 7.5 Resources

`resourceField` shows the resource in the tooltip and, with
`resourceHistogram`, a strip under the chart with one bar per tick per
resource from `resourceLoad`; over-capacity ticks paint red through
`overallocations`. Assigning is not a drag in this phase; the drawer edits
the field.

### 7.6 Row windowing

When `nodes.length` is above 300, only rows intersecting the scroller's
viewport plus 20 on each side render; rows are absolutely positioned by
index so nothing else changes. The arrow overlay still spans every row
(paths are cheap); `barRects` is computed for all nodes.

## 8. Demos, docs and the sweep

### 8.1 Demos

Ids continue from 473. Category: add `'Gantt'` to `DemoCategory` and to
`ENTERPRISE_CATEGORIES` in `examples/src/shared/registry.ts` (lines 439 and
486), between `'Kanban'` and `'Scheduler'`. Each demo needs
`meta/<id>.json` (description, five keywords, three FAQ entries, no dash
characters) and `prompts/<id>.md`, and a `website/src/lib/demos.ts` entry.

- `474-gantt-intro`, "Project plan": a 14-week software release with four
  phases (Discovery, Design, Build, Launch), 18 tasks, three milestones, 12
  FS links and one SS link, progress on every leaf, a Gantt / Table toggle
  over the same rows (the pattern demo 389 uses), `tableColumns: ['name', 'owner', '__duration', '__progress']`.
  Read-only, `tooltip: true`.
- `475-gantt-editing`, "Plan editing": the same data with `editable`,
  `history`, `drawer`, link drawing, a holiday list, `respectWorkingTime`,
  and a log panel that prints every callback so the write-back is visible.
- `476-gantt-critical-path`, "Critical path and baselines": a construction
  schedule with `criticalPath`, baselines that differ from the plan, a Slack
  column, `collapseWeekends`, and the `ZoomLevel` ladder down to hours.
- Demo 45 stays (it is the free, no-plug-in recipe). Its meta and the recipe
  paragraph in `docs/help/recipes.md` (line 215) gain one sentence pointing
  at the Pro view.

Website registration (`website/src/lib/demos.ts`) is a separate commit in the
private submodule; `pnpm demos:count` fails until it lands. The submodule is
not checked out in this environment. Thumbnails come from `pnpm thumbs`
after the website has the entries.

### 8.2 Docs page: `docs/help/rows/gantt.md`

Structured like `scheduler.md`. Sections and what each holds:

1. Intro: one `gantt` prop, task table beside a time chart, a view of the
   grid; the Enterprise call-out with `enableGanttView()` and the
   `installEnterprise` note; the demo embed for 474.
2. `{preamble}` block: `enableGanttView()`, a `Task` type with `id`, `name`,
   `owner`, `start`, `end`, `progress`, `parentId`, `milestone`, and a small
   dataset anchored on today with the `at()` helper the scheduler page uses;
   `columns`; a `deps` array.
3. The minimum: `startField` + `endField`, what renders.
4. Work breakdown: `parentField`, summary bars, collapse, controlled
   `collapsed`, the note about `treeData`.
5. Bars, progress and milestones: `progressField`, `milestoneField`,
   colours, `labelPosition`, the `task` snippet.
6. Dependencies and auto-reschedule: the four types, `lag` in days,
   `dependencyField`, `autoReschedule`, `respectWorkingTime`, violations,
   cycles.
7. Editing: `editable`, the callbacks with a write-back example, link
   drawing, the drawer, `history`, keyboard.
8. Working time and the axis: `nonWorkingDays`, `holidays`, `zoom`,
   `zoomLevels`, `minDate` / `maxDate`, `rangePaddingDays`.
9. The task table: `tableColumns`, `__duration`, `__progress`, `tableWidth`,
   column `cell` snippets, the light-table limits.
10. Gantt Pro: critical path, baselines, constraints, the Pro axis,
    resources, each with a short snippet and the demo embed for 476.
11. Config reference table, then a Gantt Pro table (the scheduler page's
    format at line 910).
12. More examples: 475 and 476 with one paragraph each.

Every fenced `ts` / `svelte` block must type-check
(`tools/docs-snippets.test.ts`). Titles get "Svelte" from the template
(`seo-guardrails`), so the H1 is "Gantt chart mode". Add the page to the
`help/rows` section of `docs/docs.json` by running
`node tools/build-docs-index.mjs`, which also regenerates `llms.txt` and
`llms-full.txt` and needs `website/public` for the served copies.

### 8.3 Text to change elsewhere

- `docs/help/rows/scheduler.md` line 682: reword the call-out to "Scheduler
  or Gantt? The Scheduler is a resource / booking / calendar view. For a
  project plan with a work-breakdown tree, percent-done, critical path and
  baselines, use the [Gantt view](/help/rows/gantt)." Keep the sentence that
  scheduler dependencies are an opt-in convenience.
- `examples/src/demos/meta/389-scheduler-dependencies.json`: the "Is this a
  Gantt chart?" answer points at the Gantt view.
- One-line mentions: `AGENTS.md` line 27 ("Kanban board + scheduler
  renderers"), `README.md` line 208, `packages/grid/README.md` line 164,
  `packages/enterprise/README.md`, `skills/svgrid/SKILL.md` line 136,
  `packages/svgrid-sv/index.mjs` line 68, `packages/grid-wc` comments that
  list the views, `packages/grid-wc/test/enterprise-interop.test.ts` header.
- `docs/changelog.md` is generated from changesets; do not edit by hand.

### 8.4 Later, not in this plan

- Studio: `GanttViewConfig` in `packages/enterprise/src/studio/project.ts`
  beside `SchedulerViewConfig` (line 191), the inspector section, a
  `ganttConfigExpr` in `emit-project.ts` beside `schedulerConfigExpr` (line
  886) with the write-back handlers against the controller, the
  `usesGantt` import wiring (line 1932), and `docs/enterprise/studio/gantt.md`.
- MCP: `packages/mcp` `build:manifests` regenerates `data.ts` from demos and
  docs once they exist.
- Export: print / PDF of the chart through `exportGrid` is a separate
  feature.

## 9. PR slicing, order and acceptance criteria

1. Phase 0 (grid). Types, seam, `SvGrid.svelte` branch, messages, model,
   the three test files, budget notes, surface regen, changeset. About 400
   lines of types and docs comments, 350 of model, 450 of tests.
   Done when: `pnpm test`, `pnpm test:types`, `pnpm lint`, `pnpm size:check`
   and the grid-wc build + `size:check` + parity test pass; a grid with
   `gantt` set shows the upsell with the licensing line.
2. Phase 1 (enterprise, read-only). `timeline-arrows.ts` + its test and the
   Scheduler switched to it; `gantt.ts`, `gantt-config.ts` (Pro type only),
   `SvGridGantt.svelte` (about 1,200 lines including styles); `gantt.dom.test.ts`;
   demo 474 with meta and prompt; `gantt.md` and the docs index; the
   scheduler call-out and demo 389 FAQ; changeset.
   Done when: the enterprise suite passes; `scheduler-timeline.spec.ts`
   still passes on a website checkout; 474 renders the fixture with arrows,
   summaries and milestones; `tools/docs-snippets.test.ts` passes.
3. Phase 2 (editing). Drag, resize, progress, link drawing, cascade,
   history, keyboard, drawer, menu; demo 475; `gantt.spec.ts`.
   Done when: every callback in the demo's log panel fires from the
   gesture that should fire it and the source rows are unchanged until the
   consumer writes them.
4. Phase 3 (planning). `gantt-critical-path.ts` + tests, the `bounds`
   argument on `cascade` + tests, baselines, constraints, Pro axis,
   resources, windowing; demo 476.
   Done when: the diamond fixture highlights the longer branch and the
   histogram paints the over-allocated tick.
5. The sweep. README and skill lines, Studio, MCP regen, thumbnails.

Every PR runs `pnpm test`, `pnpm test:types`, `pnpm lint`,
`pnpm --filter @svgrid/enterprise test`, and PR 1 also `pnpm size` and the
grid-wc build + size check, matching `.github/workflows/test.yml`.

## 10. Open questions and risks

- Left pane: own light table (this plan) or an embedded `<SvGrid>` for full
  editing and column features at the cost of two row models and scroll sync.
  Start with the light table; revisit after Phase 2 if demos want inline
  editing in the pane. If it flips, the `SvGrid.svelte` branch would mount
  the real table with a `gantt` column region instead of a renderer, which
  is a different seam; decide before Phase 1 code is written.
- Should `GanttDependency` and `SchedulerDependency` become one type? Moving
  the scheduler's to the free grid is a public re-export change in enterprise;
  leaving both is harmless because the helpers are structural. Note the unit
  mismatch: scheduler `lag` is minutes, Gantt `lag` is days, converted at the
  boundary.
- Row ordering: grid sort order versus WBS order. The plan keeps the grid's
  sorted order among siblings and nests children under parents.
- Inclusive date-only ends: the convention is documented and tested, but a
  consumer whose end strings already mean exclusive midnight will see bars a
  day too long. `endInclusive: false` can be added if it comes up.
- Time zones and sub-day durations: deferred to the Pro axis in Phase 3.
- Bundle budgets: the grid-wc entry has 0.3 KiB of headroom (check-size
  comment). Phase 0 will need a measured bump in both budget files.
- `cascade` gains an optional `bounds` argument in Phase 3; every scheduler
  dependency test must still pass unchanged.
