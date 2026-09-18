# Gantt view: implementation plan

A Gantt view of the grid, built the way the Scheduler is built: the `gantt`
prop and its config types ship free in `@svgrid/grid`, the renderer ships in
`@svgrid/enterprise` and plugs in through a registry seam, the pure model math
lives in a framework-free `.ts` file with unit tests, and the view reads the
grid's filtered + sorted rows and writes back only through callbacks.

This document is the plan. Nothing here is implemented yet.

## 1. What "similar to the Scheduler" means in this codebase

The Scheduler is five things, and the Gantt copies each one.

| Scheduler today | File | Gantt equivalent |
| --- | --- | --- |
| `scheduler` prop + `SchedulerConfig` and event types (free) | `packages/grid/src/SvGrid.types.ts` | `gantt` prop + `GanttConfig` and event types |
| Registry seam: `registerSchedulerView` / `getSchedulerView` / `hasSchedulerView` | `packages/grid/src/scheduler-view.svelte.ts` | `gantt-view.svelte.ts` with `registerGanttView` / `getGanttView` / `hasGanttView` |
| `{:else if schedulerConfig}` branch: search box, mount the registered renderer, else an upsell note with the shared `enterpriseLicenseNote` snippet | `packages/grid/src/SvGrid.svelte` lines 1013-1060 | `{:else if ganttConfig}` branch between the scheduler and chart branches |
| Pure model: `resolveEvents`, `timelineAxis`, `timelineGeom`, `timelineRows`, unit-tested | `packages/grid/src/scheduler-model.ts` | `gantt-model.ts`: `resolveTasks`, `ganttTree`, `projectRange`, `ganttAxis`, `workingDays` |
| Pro renderer + `enableSchedulerView()` (soft-gated, idempotent, called by `installEnterprise`) | `packages/enterprise/src/SvGridScheduler.svelte`, `scheduler.ts`, `install.ts` | `SvGridGantt.svelte`, `gantt.ts` with `enableGanttView()`, one line in `install.ts` |
| Pro superset config read through a cast (`pcfg`) | `packages/enterprise/src/scheduler-config.ts` | `gantt-config.ts` with `GanttProConfig` |

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
  percentage of the axis window), the `TimelineAxis` / `TimelineTick` /
  `TimelineMajor` types, `toDate`, `startOfDay`, `addDays`, `isSameDay`.
- `packages/enterprise/src/scheduler-dependencies.ts`: `buildDependencyGraph`,
  `topoOrder`, `requiredStart`, `cascade`, `violations`. They take
  `{ id, from, to, type?, lag? }` and a `Map<key, {start, end}>`, which is
  exactly what a Gantt task list produces. Critical path builds on `topoOrder`.
- `packages/enterprise/src/scheduler-axis.ts`: `buildAxis`, `timeToX`,
  `xToTime`, `resolveZoom`, `zoomPresets`. The piecewise pixel axis gives the
  Gantt continuous zoom and weekend collapse for free.
- `packages/enterprise/src/scheduler-assignments.ts`: `resourceLoad`,
  `overallocations` for a Phase 3 resource histogram.
- Grid UI primitives the Scheduler already mounts: `SvDrawer`, `SvForm`,
  `SvMenuList`, `SvDateTimePicker`, `portalToBody`, `createDismissableLayer`.

Code to extract from `SvGridScheduler.svelte` into a shared helper so both
renderers use one copy:

- `depElbow(x1, y1, x2, y2)` (line 590) and the arrow-building loop above it
  (lines 571-589) become `timeline-arrows.ts` in enterprise: pure
  `dependencyArrows(rects, deps, violations, laneH)` returning
  `{ id, d, bad, hx, hy }[]`. The Scheduler switches to it in the same PR so
  the extraction is covered by the existing timeline e2e spec.

## 4. Phase 0: the free half in `@svgrid/grid`

Mergeable on its own. A grid with `gantt` set shows the upsell note, exactly
like `scheduler` does without enterprise.

### 4.1 Types (`SvGrid.types.ts`)

```ts
export type GanttZoom = 'day' | 'week' | 'month' | 'quarter' | 'year'
export type GanttDependencyType = 'FS' | 'SS' | 'FF' | 'SF'
/** Same shape as enterprise's SchedulerDependency, declared here so the free
 *  config can name it. Enterprise helpers accept it structurally. */
export type GanttDependency = { id: string; from: string; to: string; type?: GanttDependencyType; lag?: number }

export type GanttTaskMoveEvent<TData>     = { row: TData; start: Date; end: Date }
export type GanttTaskResizeEvent<TData>   = { row: TData; start: Date; end: Date; edge: 'start' | 'end' }
export type GanttProgressChangeEvent<TData> = { row: TData; progress: number }
export type GanttTaskCommitEvent<TData>   = { row: TData; values: Partial<TData> }
export type GanttDrawerConfig<TData>      = SchedulerDrawerConfig<TData>   // same drawer shape

export type GanttConfig<TFeatures, TData> = {
  // fields
  startField: keyof TData & string          // required
  endField?: keyof TData & string           // or durationField
  durationField?: keyof TData & string      // working days when endField is absent
  titleField?: keyof TData & string         // default: first column's field
  progressField?: keyof TData & string      // 0..100
  parentField?: keyof TData & string        // WBS nesting; roots have null/undefined
  idField?: keyof TData & string            // default 'id' (only when getRowId is absent)
  milestoneField?: keyof TData & string     // boolean; zero-length tasks are milestones too
  colorField?: keyof TData & string
  color?: string
  // dependencies
  dependencies?: ReadonlyArray<GanttDependency>
  dependencyField?: keyof TData & string    // per-row list, like the scheduler
  autoReschedule?: boolean                  // default true when any dependency exists
  respectWorkingTime?: boolean              // cascade skips nonWorkingDays / holidays
  onDependenciesChange?: (moves: Array<{ id: string; start: Date; end: Date }>) => void
  onDependencyAdd?: (dep: GanttDependency) => void
  onDependencyRemove?: (id: string) => void
  // axis
  zoom?: GanttZoom                          // default 'week' (day ticks, week majors)
  zoomLevels?: ReadonlyArray<GanttZoom>     // which presets the stepper offers
  onZoomChange?: (zoom: GanttZoom) => void
  weekStartsOn?: 0 | 1 | 2 | 3 | 4 | 5 | 6
  nonWorkingDays?: ReadonlyArray<number>    // default [0, 6]
  holidays?: ReadonlyArray<Date | number | string>
  showWeekends?: boolean                    // shade, default true
  todayLine?: boolean                       // default true
  minDate?: Date | number | string
  maxDate?: Date | number | string
  rangePaddingDays?: number                 // window slack around the project, default 7
  // layout
  tableColumns?: ReadonlyArray<string>      // column ids for the left pane; default all
  tableWidth?: number                       // px, default 360; draggable splitter
  rowHeight?: number                        // px, default 32
  summaryBars?: boolean                     // parents draw a rolled-up bar, default true
  labelPosition?: 'inside' | 'right'        // default 'inside', falls back to 'right' when narrow
  // WBS collapse (uncontrolled by default; these make it controlled)
  collapsed?: ReadonlyArray<string>
  onCollapseChange?: (collapsed: string[]) => void
  // editing
  editable?: boolean
  history?: boolean                         // undo / redo like the scheduler
  onTaskMove?: (e: GanttTaskMoveEvent<TData>) => void
  onTaskResize?: (e: GanttTaskResizeEvent<TData>) => void
  onProgressChange?: (e: GanttProgressChangeEvent<TData>) => void
  onTaskAdd?: (start: Date, end: Date, parentId?: string) => void
  onTaskDelete?: (row: TData) => void
  // chrome
  task?: Snippet<[TData]>                   // custom bar body
  tooltip?: boolean | Snippet<[TData]>
  tooltipDelay?: number
  drawer?: boolean | GanttDrawerConfig<TData>
  onTaskCommit?: (e: GanttTaskCommitEvent<TData>) => void
  taskMenu?: (row: TData) => MenuItem[] | undefined
  searchable?: boolean
  searchPlaceholder?: string
}
```

Add `gantt?: GanttConfig<TFeatures, TData>` to `Props` next to `scheduler`.
Export every type from `packages/grid/src/index.ts` in a block beside the
scheduler exports.

Decisions baked into that shape:

- The WBS comes from `parentField` in the config, not from the grid's
  `treeData` prop. With `treeData` on, collapsed children never reach the view
  (`allRowsBeforePagination` is the expanded row model), so a collapsed phase
  would lose its tasks. The Gantt owns its tree and its collapse state; parents
  need a rolled-up summary bar anyway. Docs say: set `gantt.parentField`, leave
  `treeData` off.
- Dates are local calendar days. No `timeZone` in Phase 1; the Scheduler's
  pseudo-local machinery is not needed for day-granularity planning. Hour-level
  zoom comes from the Pro axis in Phase 3.
- `GanttDependency` is declared in the free grid because the free config must
  name it. `SchedulerDependency` stays where it is.

### 4.2 Seam (`gantt-view.svelte.ts`)

Copy `board-view.svelte.ts` verbatim with the names changed. Thirty lines.

### 4.3 `SvGrid.svelte`

- `const ganttConfig = $derived(opt.gantt)` beside `schedulerConfig`.
- A `{:else if ganttConfig}` branch after the scheduler branch and before the
  chart branch, mirroring lines 1013-1060: root classes
  `sv-grid-root sv-grid-gantt-root`, the same `containerHeight` style, the
  `sv-grid-board-search` box bound to `ctrl.globalFilter` with placeholder
  `Search tasks...`, then the renderer mounted with
  `data={boardData} columns={opt.columns} gantt={ganttConfig} getRowId={opt.getRowId}`,
  else the upsell `<div class="sv-grid-scheduler-upsell">` (reuse the class,
  it is already generic) with `{@render enterpriseLicenseNote()}`.
- Strings go through `grid-messages.ts` like the pivot upsell does
  (`ganttUpsellTitle`, `ganttUpsellBody`), not inline, so `localeText` covers
  them.

### 4.4 Model (`gantt-model.ts`)

Pure, no Svelte, no `new Date()` without an argument, the same rules as
`scheduler-model.ts`.

```ts
export type GanttTaskSpec<TData> = { getKey, getStart, getEnd?, getDuration?, getTitle?, getProgress?, getParent?, getMilestone?, getColor? }
export type ResolvedTask<TData> = { key, row, title, start, end, progress, milestone, parentKey?, color? }
export function resolveTasks<TData>(rows, spec, opts: { nonWorkingDays, holidays }): ResolvedTask<TData>[]
//   endField wins; else start + durationField working days; else start (a milestone)

export type GanttNode<TData> = { task: ResolvedTask<TData>; depth: number; hasChildren: boolean; summary?: { start: Date; end: Date; progress: number } }
export function ganttTree<TData>(tasks, opts: { collapsed: ReadonlySet<string> }): GanttNode<TData>[]
//   roots in input order, children under their parent in input order, orphans as roots,
//   collapsed subtrees skipped; summary = min(start), max(end), duration-weighted progress
//   (the rollup rule demo 29 uses)

export function projectRange(tasks, opts: { paddingDays; minDate?; maxDate? }): { start: Date; end: Date }

export function ganttAxis(start: Date, end: Date, zoom: GanttZoom, opts: { weekStartsOn; today?: Date | null }): TimelineAxis
//   returns the scheduler's TimelineAxis shape so the header markup is the same:
//   day  -> ticks: days,    majors: weeks ("Sep 14 - 20")
//   week -> ticks: days,    majors: months      (the default)
//   month-> ticks: weeks,   majors: months
//   quarter -> ticks: months, majors: quarters
//   year -> ticks: months,  majors: years

export function workingDays(start: Date, end: Date, nonWorkingDays, holidays): number
export function addWorkingDays(start: Date, days: number, nonWorkingDays, holidays): Date
export function snapToWorkingDay(d: Date, dir: 1 | -1, nonWorkingDays, holidays): Date
```

Export the helpers from `index.ts` beside the scheduler-model block so the
demo table's Duration column and consumer code can use them.

### 4.5 Tests

- `gantt-model.test.ts`: task resolution (end vs duration vs milestone), tree
  order / depth / orphans / collapse, summary rollups, project range with
  padding and min/max clamps, every zoom's ticks and majors including a range
  that starts mid-week and mid-month, working-day arithmetic across a weekend
  and a holiday.
- `svgrid.gantt-seam.test.ts`: mirrors `svgrid.selection-bar-seam.test.ts`.
  `hasGanttView()` is false, the upsell renders, the search box binds to the
  global filter, the renderer receives filtered rows once registered with a
  stub component.
- `svgrid.upsell-license.test.ts`: add the fifth gate. Its header comment
  already anticipates this.

### 4.6 Budgets and generated surfaces

- The seam file, the `SvGrid.svelte` branch and the two messages sit on the
  base bundle path. Expect roughly 0.3 to 0.5 KB gzipped. Run `pnpm size`,
  then acknowledge the measurement in `packages/grid/scripts/measure-size.mjs`
  and in `packages/grid-wc/scripts/check-size.mjs`, both with the dated note
  those files use. Do not type a number without running the tool.
- `packages/grid-wc`: run `node scripts/generate-surface.mjs` so `gantt`
  appears in `surface.generated.js` and `types/elements.d.ts`; the parity test
  fails otherwise. No hand edits.
- Changeset: `@svgrid/grid: minor`.

## 5. Phase 1: the Pro renderer, read-only

`packages/enterprise/src/SvGridGantt.svelte`, `gantt.ts`, `gantt-config.ts`,
plus the shared `timeline-arrows.ts` extraction. `installEnterprise` gains
`enableGanttView()`. `index.ts` exports `enableGanttView`, `SvGridGantt`,
`GanttProConfig`.

### 5.1 Props

Identical to the Scheduler's: `data`, `columns`, `gantt`, `getRowId`. Generic
over `TFeatures, TData`. The Pro fields are read through
`const pcfg = $derived(gantt as unknown as GanttProConfig<...>)`.

### 5.2 DOM layout

```
.sv-gantt                              flex row, fills the container
  .sv-gantt-table   (width: tableWidth)
    .sv-gantt-table-head               one cell per column in `tableColumns`
    .sv-gantt-table-body               one row per GanttNode, height: rowHeight
  .sv-gantt-splitter                   pointer-drag resizes tableWidth
  .sv-gantt-chart   (overflow-x: auto)
    .sv-gantt-axis                     sticky top: majors row over ticks row
    .sv-gantt-body                     position: relative, width: axis px
      .sv-gantt-row  x N               gridlines, weekend / holiday shading
        .sv-gantt-bar | -summary | -milestone
      svg.sv-gantt-deps                arrow overlay, pointer-events: none
      .sv-gantt-today                  the dashed today line
```

One vertical scroller wraps both bodies so rows never drift apart; only the
chart pane scrolls horizontally. Both heads are `position: sticky`. The
table's cells use the column's `header`, `width`, `format` and, when present,
its `cell` snippet, through the same `renderSnippet` path `SvGridBoard` uses
for card fields. Tree rows indent the title cell by `depth * 14px` and get a
chevron. Every colour comes from `--sg-*` tokens; class prefix `sv-gantt-`.

The left pane is the renderer's own light table, not an embedded `<SvGrid>`.
That matches the Scheduler's resource gutter and avoids running two row models
for one view. The trade-off (no inline editing, no column resize in the pane)
is listed under open questions.

### 5.3 Rendering pipeline

1. `spec` from config plus the move / resize / progress overlay (the
   Scheduler's pattern at line 211: a `$state` record keyed by row key; the
   consumer never sees a mutated row).
2. `tasks = resolveTasks(data, spec)`; `nodes = ganttTree(tasks, collapsed)`.
3. `range = projectRange(tasks)`, then either the free percentage axis
   (`ganttAxis` + `timelineGeom`) or, when `pcfg.zoom` is a `ZoomLevel` or
   `collapseWeekends` is on, the Pro pixel axis (`buildAxis` + `timeToX`).
   The renderer keeps one `xOf(date)` function so every bar, gridline, arrow
   and drop target goes through the same map.
4. Bars: a normal task is a rounded bar with an inner progress fill
   (`width: progress%`); a parent is a thin summary bar with end caps and no
   grips; a milestone is a rotated square at `start`. Labels sit inside when
   the bar is wide enough, else to the right (`labelPosition`).
5. Arrows: `barRects` (left, right, midY per key, computed from row index and
   `rowHeight`) feed `dependencyArrows()`; violations paint dashed red via
   `violations()`.
6. Today line, weekend and holiday shading, hover tooltip (the Scheduler's
   tooltip code path, same delay handling), collapse on chevron click,
   horizontal scroll-into-view of today on mount, a zoom stepper in a small
   toolbar above the chart when `zoomLevels` has more than one entry.

### 5.4 Tests

`gantt.dom.test.ts` in the enterprise `dom` project, modelled on
`board.dom.test.ts`: `enableGanttView()` then mount `SvGridGantt` directly.
Asserts row count and order, indent depth, summary bar span, milestone
element, progress fill width, arrow count and a `bad` arrow for a violating
link, collapse hides descendants, search filters rows (mount through `SvGrid`
for that one). `timeline-arrows.test.ts` covers the extracted elbow paths for
FS / SS / FF / SF and the backward loop.

### 5.5 Changeset and docs

`@svgrid/enterprise: minor`. Docs and the first demo land in this phase (see
section 8) so the page and the view ship together.

## 6. Phase 2: editing

All in `SvGridGantt.svelte`, following the Scheduler's timeline handlers
(`startTlDrag` / `onTlDragMove` / `onTlDragEnd`, lines 3008-3120) one for one.

- Drag-to-move: pointer capture, `xToTime` / inverse of `xOf`, snap to whole
  days (`snapToWorkingDay` when `respectWorkingTime`), live overlay, commit to
  `onTaskMove` on release. Moving a parent moves its subtree by the same delta.
- Edge resize: left and right grips, `onTaskResize` with `edge`.
- Progress handle: a small grip on the progress fill; drag sets 0..100 in 5%
  steps, fires `onProgressChange`.
- Auto-reschedule: after a move / resize call `cascade()` with the overlay
  times; write the shifts into the overlay; fire `onDependenciesChange`. The
  `snapForward` hook is `snapToWorkingDay` when `respectWorkingTime` is set.
- Dependency drawing: a connector dot appears at each bar end on hover; drag
  it onto another bar to fire `onDependencyAdd` with a generated id, `FS` by
  default (`SS` when dropped on the start edge). Right-click an arrow for
  Remove (`onDependencyRemove`). A link that would create a cycle is refused
  with the Scheduler's "flash" treatment (`hasCycle`).
- Double-click empty space: `onTaskAdd(start, start + 1 day, parentIdOfRow)`.
- Keyboard: arrows nudge the focused bar by a day (Shift: a week), `Enter`
  opens the drawer, `Delete` fires `onTaskDelete`, `Escape` cancels a drag.
  Bars are `role="row"` cells with `aria-label` "title, start to end, N%".
- Drawer: `drawer: true | GanttDrawerConfig` reuses the Scheduler's
  `SvDrawer` + `SvForm` block; save fires `onTaskCommit`.
- Undo / redo: `history: true` replays the last move / resize / progress the
  way the Scheduler's history stack does.
- Context menu: `taskMenu(row)` through `SvMenuList`.

Tests: extend `gantt.dom.test.ts` with pointer-event sequences for move,
resize, progress and link drawing; assert the callbacks and that source rows
are untouched. E2E `tests/e2e/gantt.spec.ts` (drag, resize, draw a link, zoom)
runs only on a checkout with the website submodule, like the scheduler specs.

## 7. Phase 3: planning features (`GanttProConfig`)

`packages/enterprise/src/gantt-config.ts`, read through `pcfg`:

- `criticalPath?: boolean`. New pure `gantt-critical-path.ts`:
  `criticalPath(times, deps)` does the forward / backward pass over
  `topoOrder`, returns `{ critical: Set<key>, slackMs: Map<key, number>, finish: Date }`.
  Critical bars and arrows get `sv-gantt-critical`; a Slack column is
  available to the table through an exported `slackDays` helper. Unit tests
  cover a chain, a diamond, a lag, and an isolated task.
- `baselineStartField` / `baselineEndField`: a ghost bar under each task.
- `constraintField` (`ASAP` / `MSO` / `SNET` / `FNLT`) with `constraintDateField`:
  cascade respects them; a violated constraint paints like a violated link.
- `zoom` as a `ZoomLevel`, `zoomLevels` as a ladder, `collapseWeekends`,
  `collapsedGapPx`: the Pro axis from `scheduler-axis.ts`, which also brings
  hour-level ticks for short projects.
- `resourceField` / `resources` plus a resource histogram strip below the
  chart built on `resourceLoad` / `overallocations`.
- Row windowing when `nodes.length` exceeds ~300: fixed `rowHeight` makes it
  an index range, the same idea the grid's own virtualiser uses.

## 8. Demos, docs and the sweep

Demo ids continue from 473. Category: add `'Gantt'` to `DemoCategory` and to
`ENTERPRISE_CATEGORIES` in `examples/src/shared/registry.ts`, beside
`'Scheduler'`. Each demo needs `meta/<id>.json` and `prompts/<id>.md`.

- `474-gantt-intro`: a release plan with phases (WBS), progress, milestones,
  FS links, today line, a Gantt / Table toggle over the same rows.
- `475-gantt-editing`: drag, resize, progress grip, link drawing, auto-
  reschedule with working days, undo, drawer.
- `476-gantt-critical-path`: critical path highlight, slack column, baselines,
  weekend collapse and the zoom ladder.
- Demo 45 stays (it is the free, no-plug-in recipe). Its recipe paragraph in
  `docs/help/recipes.md` gets one sentence pointing at the Pro view.

Website registration (`website/src/lib/demos.ts`) is a separate commit in the
private submodule; `pnpm demos:count` fails until it lands. The submodule is
not checked out in this environment.

Docs:

- New `docs/help/rows/gantt.md`, structured like `scheduler.md`: intro, the
  Enterprise call-out with `enableGanttView()`, demo embed, a `{preamble}`
  block, "The minimum", "Work breakdown", "Bars, progress, milestones",
  "Dependencies and auto-reschedule", "Editing", "Zoom and working time",
  "Gantt Pro" (critical path, baselines, constraints, resources), a config
  reference table, "More examples". Every fenced `ts` block must type-check
  (`tools/docs-snippets.test.ts`).
- Add the page to the `help/rows` section in `docs/docs.json` by running
  `node tools/build-docs-index.mjs` (regenerates `llms.txt`, `llms-full.txt`
  and the JSON; needs the website checkout for the served copies).
- Reword the "Scheduler, not a Gantt" call-out in `scheduler.md` and demo
  389's FAQ answer to point at the Gantt page.
- One-line mentions: `AGENTS.md` ("Kanban board + scheduler renderers"),
  `README.md` line 208, `packages/grid/README.md` line 164,
  `packages/enterprise/README.md`, `skills/svgrid/SKILL.md` line 136,
  `packages/svgrid-sv/index.mjs` line 68, `packages/grid-wc` comments that
  list the views.
- `docs/changelog.md` is generated from changesets; do not edit by hand.

Later, not in this plan: Studio (`GanttViewConfig` in
`packages/enterprise/src/studio/project.ts`, the inspector, `emit-project.ts`,
`docs/enterprise/studio/gantt.md`), and the MCP data regen
(`packages/mcp` `build:manifests`) once demos and docs exist.

## 9. PR slicing and order

1. Phase 0 (grid): types, seam, `SvGrid.svelte` branch, model, tests, budget
   notes, surface regen, changeset. Roughly 900 lines with tests.
2. Phase 1 (enterprise): renderer read-only, `timeline-arrows.ts` extraction,
   dom tests, demo 474, `gantt.md`, doc call-out rewording, changeset.
   Roughly 1,400 lines plus the doc.
3. Phase 2: editing, demo 475, e2e spec.
4. Phase 3: critical path and the rest of `GanttProConfig`, demo 476.
5. The sweep: README and skill lines, Studio, MCP regen.

Every PR runs `pnpm test`, `pnpm test:types`, `pnpm lint`,
`pnpm --filter @svgrid/enterprise test`, and PR 1 also `pnpm size` and the
grid-wc build + size check, matching `.github/workflows/test.yml`.

## 10. Open questions

- Left pane: own light table (this plan) or an embedded `<SvGrid>` for full
  editing and column features at the cost of two row models and scroll sync.
  Start with the light table; revisit after Phase 2 if demos want inline
  editing in the pane.
- Should `GanttDependency` and `SchedulerDependency` become one type? Moving
  the scheduler's to the free grid is a public re-export change in enterprise;
  leaving both is harmless because the helpers are structural.
- Row ordering: grid sort order versus WBS order. The plan keeps the grid's
  sorted order among siblings and nests children under parents; sorting by
  start date then reorders within each phase, which is the usual expectation.
- Time zones and sub-day durations: deferred to the Pro axis in Phase 3.
