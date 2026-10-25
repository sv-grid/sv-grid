# `@svgrid/grid` · `scheduler-model.ts`

Auto-generated. Source: `packages\grid\src\scheduler-model.ts`.

### `type ResolvedEvent`

A concrete event instance placed on the calendar (one row may yield many when
 it recurs). `key` is unique per instance; `rowKey` ties it back to its row.

```ts
export type ResolvedEvent<TData = unknown> = {
  key: string
  rowKey: string
  row: TData
  title: string
  start: Date
  end: Date
  allDay: boolean
  color?: string
  /** Optional secondary accent (e.g. a category) shown as a left strip, distinct
   *  from the main `color`. */
  color2?: string
  /** Free/busy status (busy | free | tentative | oof) for a distinct visual. */
  status?: string
  resourceId?: string
  /** True when this instance came from expanding a recurrence rule. */
  recurring: boolean
  /** For a recurring instance, its canonical (pre-override) occurrence start -
   *  the identity used to key {@link RecurrenceException} overrides. */
  occurrenceStart?: Date
  /** True when a recurring instance carries a per-occurrence override. */
  isException?: boolean
}
```

### `type RecurrenceException`

A per-occurrence override of a recurring event (the model's shape; the
 component maps the consumer's `SchedulerException` onto this).

```ts
export type RecurrenceException = {
  occurrenceStart: DateLike
  deleted?: boolean
  start?: DateLike | null
  end?: DateLike | null
  title?: string
  allDay?: boolean
  /** Per-occurrence overrides for any other field, merged over the row for just
   *  this occurrence (attendees, calendar, color, resource, ...). */
  fields?: Record<string, unknown>
}
```

### `type EventSpec`

Field accessors the model uses to read an event off a row. The component
 builds this from `SchedulerConfig`, applying its move/edit overlay first so
 a dragged event resolves at its new time without mutating the source row.

```ts
export type EventSpec<TData> = {
  getKey: (row: TData) => string
  getStart: (row: TData) => DateLike | null | undefined
  getEnd?: (row: TData) => DateLike | null | undefined
  getAllDay?: (row: TData) => boolean
  getTitle?: (row: TData) => string
  getColor?: (row: TData) => string | undefined
  /** Optional secondary accent color (rendered as a left strip). */
  getSecondaryColor?: (row: TData) => string | undefined
  /** Optional free/busy status. */
  getStatus?: (row: TData) => string | undefined
  getResource?: (row: TData) => string | undefined
  getRecurrence?: (
    row: TData,
  ) => RecurrenceRule | ReadonlyArray<RecurrenceRule> | null | undefined
  /** Per-occurrence overrides for a recurring row (deleted / moved / edited). */
  getExceptions?: (row: TData) => ReadonlyArray<RecurrenceException> | null | undefined
  /** Fallback event length (minutes) when a row has a start but no end. Default 60. */
  defaultDurationMin?: number
}
```

### `type WorkingWindow`

One working window: `[start, end)` hours, optionally limited to `days`
 (weekday 0 = Sun … 6 = Sat). Omitting `days` applies it to every day.

```ts
export type WorkingWindow = {
  days?: ReadonlyArray<number>
  start: number
  end: number
}
```

### `function workingIntervals`

The working `[startMin, endMin]` intervals for `weekday`, from `windows`,
clamped to `[bandStartMin, bandEndMin]` and merged. Empty = the whole day is
off. Pure; used for per-resource availability shading + enforcement.

```ts
export function workingIntervals(
  weekday: number,
  windows: ReadonlyArray<WorkingWindow>,
  bandStartMin: number,
  bandEndMin: number,
): Array<[number, number]>
```

### `function withinWorking`

True when `[startMin, endMin]` lies wholly inside one working interval.

```ts
export function withinWorking(
  startMin: number,
  endMin: number,
  intervals: ReadonlyArray<readonly [number, number]>,
): boolean
```

### `function hasConflict`

True when placing `[start,end]` on `resourceId` would overlap another event on
the SAME resource (ignoring the event identified by `excludeRowKey`). Used to
enforce `disableConflicts` (no double-booking). All-day/timed both count.

```ts
export function hasConflict<TData>(
  start: Date,
  end: Date,
  resourceId: string | undefined,
  events: ReadonlyArray<ResolvedEvent<TData>>,
  excludeRowKey?: string,
): boolean
```

### `function overlapCount`

How many events on the SAME resource overlap `[start,end]` (excluding
`excludeRowKey`). Used to enforce `maxEventsPerSlot` (resource capacity): a
move/create is blocked when this count would reach the cap.

```ts
export function overlapCount<TData>(
  start: Date,
  end: Date,
  resourceId: string | undefined,
  events: ReadonlyArray<ResolvedEvent<TData>>,
  excludeRowKey?: string,
): number
```

### `function overlapsBands`

True when the minute range `[sMin,eMin)` overlaps any of the given hour bands.

```ts
export function overlapsBands(
  sMin: number,
  eMin: number,
  bands: ReadonlyArray<{ start: number; end: number }>,
): boolean
```

### `function resolveEvents`

Resolve `rows` into the event instances visible in `[rangeStart, rangeEnd]`.
Recurring rows are expanded to one instance per matching day (keeping the base
event's time-of-day and duration); single rows are included when they overlap
the window. Result is sorted by start (all-day first within a start).

```ts
export function resolveEvents<TData>(
  rows: ReadonlyArray<TData>,
  spec: EventSpec<TData>,
  rangeStart: Date,
  rangeEnd: Date,
): ResolvedEvent<TData>[]
```

### `function eventsOnDay`

Events that touch `day` (any calendar day the event spans), timed + all-day.

```ts
export function eventsOnDay<TData>(
  events: ReadonlyArray<ResolvedEvent<TData>>,
  day: Date,
): ResolvedEvent<TData>[]
```

### `type MonthSegment`

A continuous month-view bar for one event within one week row: the columns it
spans (`startCol`..`endCol`, 0-6) and the `lane` (stack row) it sits in. Events
that cross a week boundary are split into one segment per week (with
`continuesLeft`/`continuesRight` flags so the view can flatten that edge).

```ts
export type MonthSegment<TData = unknown> = {
  event: ResolvedEvent<TData>
  startCol: number
  endCol: number
  lane: number
  continuesLeft: boolean
  continuesRight: boolean
}
```

### `function monthWeekSegments`

Lay out one week row of the month grid as continuous spanning bars. `weekStart`
is the local-midnight first day of the 7-day row. Returns each overlapping
event as a {@link MonthSegment} clipped to the week, with greedy lane packing
so bars never overlap, plus the total `laneCount`.

```ts
export function monthWeekSegments<TData>(
  events: ReadonlyArray<ResolvedEvent<TData>>,
  weekStart: Date,
): { segments: MonthSegment<TData>[]; laneCount: number }
```

### `type PositionedEvent`

A timed event positioned within a time-grid column. `topPct`/`heightPct` are
 0-100 of the visible day; `leftPct`/`widthPct`/`zIndex` place it horizontally
 among overlapping peers (already resolved for the chosen collision mode).

```ts
export type PositionedEvent<TData = unknown> = {
  event: ResolvedEvent<TData>
  topPct: number
  heightPct: number
  col: number
  colCount: number
  leftPct: number
  widthPct: number
  zIndex: number
}
```

### `type OverflowMarker`

A `+N more` tile emitted by `cap` mode for the events that didn't fit.

```ts
export type OverflowMarker<TData = unknown> = {
  topPct: number
  heightPct: number
  leftPct: number
  widthPct: number
  /** Number of hidden events this tile stands for. */
  count: number
  /** The hidden events (chronological), for the "+N more" popover. */
  events: ResolvedEvent<TData>[]
}
```

### `type DayLayout`

The full time-grid layout for one day: positioned events + any overflow tiles.

```ts
export type DayLayout<TData = unknown> = {
  events: PositionedEvent<TData>[]
  overflows: OverflowMarker<TData>[]
}
```

### `type LayoutOptions`

Tuning for event layout: how overlapping events share horizontal space.

```ts
export type LayoutOptions = {
  dayStartHour?: number
  dayEndHour?: number
  /** Collision layout mode. Default `split`. */
  mode?: SchedulerCollisionMode
  /** `cap` mode: max columns before overflow (min 2). Default 3. */
  maxColumns?: number
  /** `stack` mode: horizontal offset per overlapping event, in % of column. */
  stackOffsetPct?: number
  /** `stack` mode: the narrowest a stacked event may get, in % of column. */
  stackMinWidthPct?: number
}
```

### `function layoutDayEvents`

Lay out the timed events of a single day for the time-grid, resolving
collisions per {@link SchedulerCollisionMode}. `dayStartHour`/`dayEndHour`
bound the visible band (e.g. 8..18); events are clamped to it. All-day events
are ignored here (the view renders them in a separate all-day row).

```ts
export function layoutDayEvents<TData>(
  dayEvents: ReadonlyArray<ResolvedEvent<TData>>,
  day: Date,
  opts: LayoutOptions = {},
): DayLayout<TData>
```

### `type AgendaGroup`

One day's bucket of events for the agenda (list) view.

```ts
export type AgendaGroup<TData = unknown> = {
  day: Date
  events: ResolvedEvent<TData>[]
}
```

### `function agendaGroups`

Group resolved events by calendar day for the agenda view (days with no
 events are omitted; groups and their events are in chronological order).

```ts
export function agendaGroups<TData>(
  events: ReadonlyArray<ResolvedEvent<TData>>,
): AgendaGroup<TData>[]
```

### `function rangeForView`

The visible date window for a view anchored on `anchor`. Used both to size the
grid and to bound event resolution (recurrence expansion clips to it).
`agendaDays` controls the agenda span (default 30).

```ts
export function rangeForView(
  view: SchedulerView,
  anchor: Date,
  weekStartsOn = 0,
  agendaDays = 30,
): { start: Date; end: Date }
```

### `function daysForView`

The 7 (or fewer) day columns rendered for the week / day views.

```ts
export function daysForView(view: SchedulerView, anchor: Date, weekStartsOn = 0): Date[]
```

### `function navigateAnchor`

Move the anchor one view-unit in `dir` (-1 back, +1 forward).

```ts
export function navigateAnchor(view: SchedulerView, anchor: Date, dir: number): Date
```

### `type TimelineTick`

One column of the timeline's minor (tick) header row.

```ts
export type TimelineTick = {
  start: Date
  end: Date
  leftPct: number
  widthPct: number
  label: string
  today: boolean
}
```

### `type TimelineMajor`

One cell of the timeline's major (grouping) header row, spanning several ticks.

```ts
export type TimelineMajor = { label: string; leftPct: number; widthPct: number }
```

### `type TimelineAxis`

The horizontal axis: its window [start, end] (the day band for `timelineDay`),
 the minor `ticks`, and the coarser `majors` above them.

```ts
export type TimelineAxis = {
  start: Date
  end: Date
  totalMs: number
  ticks: TimelineTick[]
  majors: TimelineMajor[]
}
```

### `function timelineAxis`

Build the timeline header axis for `view` over `[rangeStart, rangeEnd]`. For
`timelineDay` the axis is clamped to the `dayStartHour..dayEndHour` band (so
events outside it clip, matching the vertical day view). Ticks are hours (day),
days (week / month) or months (year); majors are the date, the month(s), or
quarters. All geometry is percentage of the axis window.

```ts
export function timelineAxis(
  view: SchedulerView,
  rangeStart: Date,
  rangeEnd: Date,
  opts: { dayStartHour?: number; dayEndHour?: number; today?: Date | null } = {},
): TimelineAxis
```

### `function timelineGeom`

An event's horizontal geometry within the axis window, or `null` when it
 falls entirely outside it. `continuesLeft/Right` flag a clipped edge.

```ts
export function timelineGeom(
  start: Date,
  end: Date,
  axisStart: Date,
  axisMs: number,
): { leftPct: number; widthPct: number; continuesLeft: boolean; continuesRight: boolean } | null
```

### `type TimelineRow`

One resource's timeline row: its events lane-packed so overlaps stack.

```ts
export type TimelineRow<TData = unknown> = {
  resource: SchedulerResource | null
  laneCount: number
  items: { event: ResolvedEvent<TData>; lane: number }[]
}
```

### `function timelineRows`

Bucket `events` by resource into rows (a single `null` row when there are no
resources), then greedily lane-pack each row so overlapping events stack. An
event whose `resourceId` matches no resource is dropped.

```ts
export function timelineRows<TData>(
  resources: ReadonlyArray<SchedulerResource> | null | undefined,
  events: ReadonlyArray<ResolvedEvent<TData>>,
): TimelineRow<TData>[]
```
