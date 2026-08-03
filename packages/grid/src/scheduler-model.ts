/**
 * scheduler-model - the pure, framework-free core behind SvGridScheduler (the
 * calendar / scheduler *view of the grid*). No Svelte, no DOM: just date math
 * over the native `Date`, so every rule here is unit-tested directly.
 *
 * It does three things the view leans on:
 *   1. resolve rows into concrete event instances for a visible window, expanding
 *      recurring rows via the shared `recurrence` engine (see recurrence.ts);
 *   2. pack overlapping timed events into side-by-side columns for the time-grid
 *      (week / day) views;
 *   3. compute the visible date range + navigation for each view.
 *
 * Deliberately avoids the arg-less `new Date()` / `Date.now()` (they are
 * non-deterministic and unavailable in some execution contexts) - the caller
 * supplies "today"/the anchor date and passes it in.
 */
import {
  addDays,
  addMonths,
  startOfDay,
  startOfMonth,
  startOfWeek,
  withTime,
  toDate,
  isSameDay,
  type DateLike,
} from './datetime/date-core'
import { expandRecurrence, type RecurrenceRule } from './recurrence'
import type { SchedulerView, SchedulerResource, SchedulerCollisionMode } from './SvGrid.types'

export type { SchedulerView, SchedulerResource, SchedulerCollisionMode }

/** A concrete event instance placed on the calendar (one row may yield many when
 *  it recurs). `key` is unique per instance; `rowKey` ties it back to its row. */
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

/** A per-occurrence override of a recurring event (the model's shape; the
 *  component maps the consumer's `SchedulerException` onto this). */
export type RecurrenceException = {
  occurrenceStart: DateLike
  deleted?: boolean
  start?: DateLike | null
  end?: DateLike | null
  title?: string
  allDay?: boolean
}

/** Field accessors the model uses to read an event off a row. The component
 *  builds this from `SchedulerConfig`, applying its move/edit overlay first so
 *  a dragged event resolves at its new time without mutating the source row. */
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

const MS_MIN = 60_000

/** True when [aStart,aEnd] and [bStart,bEnd] overlap (touching counts as overlap
 *  only for zero-length events). */
function rangesOverlap(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date): boolean {
  return aStart.getTime() < bEnd.getTime() && aEnd.getTime() > bStart.getTime()
}

/** One working window: `[start, end)` hours, optionally limited to `days`
 *  (weekday 0 = Sun … 6 = Sat). Omitting `days` applies it to every day. */
export type WorkingWindow = {
  days?: ReadonlyArray<number>
  start: number
  end: number
}

/**
 * The working `[startMin, endMin]` intervals for `weekday`, from `windows`,
 * clamped to `[bandStartMin, bandEndMin]` and merged. Empty = the whole day is
 * off. Pure; used for per-resource availability shading + enforcement.
 */
export function workingIntervals(
  weekday: number,
  windows: ReadonlyArray<WorkingWindow>,
  bandStartMin: number,
  bandEndMin: number,
): Array<[number, number]> {
  const raw: Array<[number, number]> = []
  for (const w of windows) {
    if (w.days && !w.days.includes(weekday)) continue
    const s = Math.max(bandStartMin, w.start * 60)
    const e = Math.min(bandEndMin, w.end * 60)
    if (e > s) raw.push([s, e])
  }
  raw.sort((a, b) => a[0] - b[0])
  const merged: Array<[number, number]> = []
  for (const iv of raw) {
    const last = merged[merged.length - 1]
    if (last && iv[0] <= last[1]) last[1] = Math.max(last[1], iv[1])
    else merged.push([iv[0], iv[1]])
  }
  return merged
}

/** True when `[startMin, endMin]` lies wholly inside one working interval. */
export function withinWorking(
  startMin: number,
  endMin: number,
  intervals: ReadonlyArray<readonly [number, number]>,
): boolean {
  return intervals.some(([a, b]) => startMin >= a && endMin <= b)
}

/**
 * True when placing `[start,end]` on `resourceId` would overlap another event on
 * the SAME resource (ignoring the event identified by `excludeRowKey`). Used to
 * enforce `disableConflicts` (no double-booking). All-day/timed both count.
 */
export function hasConflict<TData>(
  start: Date,
  end: Date,
  resourceId: string | undefined,
  events: ReadonlyArray<ResolvedEvent<TData>>,
  excludeRowKey?: string,
): boolean {
  for (const e of events) {
    if (e.rowKey === excludeRowKey) continue
    if ((e.resourceId ?? undefined) !== (resourceId ?? undefined)) continue
    if (rangesOverlap(start, end, e.start, e.end)) return true
  }
  return false
}

/**
 * How many events on the SAME resource overlap `[start,end]` (excluding
 * `excludeRowKey`). Used to enforce `maxEventsPerSlot` (resource capacity): a
 * move/create is blocked when this count would reach the cap.
 */
export function overlapCount<TData>(
  start: Date,
  end: Date,
  resourceId: string | undefined,
  events: ReadonlyArray<ResolvedEvent<TData>>,
  excludeRowKey?: string,
): number {
  let n = 0
  for (const e of events) {
    if (e.rowKey === excludeRowKey) continue
    if ((e.resourceId ?? undefined) !== (resourceId ?? undefined)) continue
    if (rangesOverlap(start, end, e.start, e.end)) n++
  }
  return n
}

/** True when the minute range `[sMin,eMin)` overlaps any of the given hour bands. */
export function overlapsBands(
  sMin: number,
  eMin: number,
  bands: ReadonlyArray<{ start: number; end: number }>,
): boolean {
  for (const b of bands) {
    if (sMin < b.end * 60 && eMin > b.start * 60) return true
  }
  return false
}

/**
 * Resolve `rows` into the event instances visible in `[rangeStart, rangeEnd]`.
 * Recurring rows are expanded to one instance per matching day (keeping the base
 * event's time-of-day and duration); single rows are included when they overlap
 * the window. Result is sorted by start (all-day first within a start).
 */
export function resolveEvents<TData>(
  rows: ReadonlyArray<TData>,
  spec: EventSpec<TData>,
  rangeStart: Date,
  rangeEnd: Date,
): ResolvedEvent<TData>[] {
  const defDur = Math.max(1, spec.defaultDurationMin ?? 60)
  const out: ResolvedEvent<TData>[] = []

  for (const row of rows) {
    const start = toDate(spec.getStart(row))
    if (!start) continue
    const rawEnd = spec.getEnd ? toDate(spec.getEnd(row)) : null
    const end =
      rawEnd && rawEnd.getTime() > start.getTime()
        ? rawEnd
        : new Date(start.getTime() + defDur * MS_MIN)
    const durationMs = end.getTime() - start.getTime()

    const rowKey = spec.getKey(row)
    const title = spec.getTitle?.(row) ?? ''
    const allDay = spec.getAllDay?.(row) ?? false
    const color = spec.getColor?.(row)
    const color2 = spec.getSecondaryColor?.(row)
    const status = spec.getStatus?.(row)
    const resourceId = spec.getResource?.(row)
    const rule = spec.getRecurrence?.(row)

    if (rule) {
      // One instance per matching day, carrying the base time-of-day + duration.
      // Recurrence begins at the event's OWN start - never emit an occurrence
      // before it, so clip the expansion's lower bound to the start date (a rule
      // like "weekly on Mon-Fri" must not back-fill days before the event began).
      const from = start.getTime() > rangeStart.getTime() ? start : rangeStart
      const days = expandRecurrence(rule, from, rangeEnd)
      // Per-occurrence overrides keyed by the occurrence's canonical start time.
      const exs = spec.getExceptions?.(row)
      const exMap = exs?.length
        ? new Map(exs.map((e) => [toDate(e.occurrenceStart)?.getTime() ?? NaN, e]))
        : null
      for (const day of days) {
        const occStart = allDay ? startOfDay(day) : withTime(day, start)
        const ex = exMap?.get(occStart.getTime())
        if (ex?.deleted) continue // this occurrence was removed
        let iStart = occStart
        let iEnd = new Date(occStart.getTime() + durationMs)
        let iTitle = title
        let iAllDay = allDay
        if (ex) {
          const exS = toDate(ex.start)
          const exE = toDate(ex.end)
          if (exS) {
            iStart = exS
            iEnd = exE && exE.getTime() > exS.getTime() ? exE : new Date(exS.getTime() + durationMs)
          } else if (exE) {
            iEnd = exE
          }
          if (ex.title != null) iTitle = ex.title
          if (ex.allDay != null) iAllDay = ex.allDay
        }
        if (!rangesOverlap(iStart, iEnd, rangeStart, rangeEnd)) continue
        out.push({
          // Key on the CANONICAL occurrence start so a moved occurrence keeps its identity.
          key: `${rowKey}#${occStart.getFullYear()}-${occStart.getMonth() + 1}-${occStart.getDate()}T${occStart.getHours()}:${occStart.getMinutes()}`,
          rowKey,
          row,
          title: iTitle,
          start: iStart,
          end: iEnd,
          allDay: iAllDay,
          color,
          color2,
          status,
          resourceId,
          recurring: true,
          occurrenceStart: occStart,
          isException: !!ex,
        })
      }
    } else if (rangesOverlap(start, end, rangeStart, rangeEnd)) {
      out.push({
        key: rowKey,
        rowKey,
        row,
        title,
        start,
        end,
        allDay,
        color,
        color2,
        status,
        resourceId,
        recurring: false,
      })
    }
  }

  out.sort((a, b) => {
    const d = a.start.getTime() - b.start.getTime()
    if (d !== 0) return d
    if (a.allDay !== b.allDay) return a.allDay ? -1 : 1
    return a.end.getTime() - b.end.getTime()
  })
  return out
}

/** Events that touch `day` (any calendar day the event spans), timed + all-day. */
export function eventsOnDay<TData>(
  events: ReadonlyArray<ResolvedEvent<TData>>,
  day: Date,
): ResolvedEvent<TData>[] {
  const dayStart = startOfDay(day)
  const dayEnd = addDays(dayStart, 1)
  return events.filter((e) => rangesOverlap(e.start, e.end, dayStart, dayEnd))
}

/**
 * A continuous month-view bar for one event within one week row: the columns it
 * spans (`startCol`..`endCol`, 0-6) and the `lane` (stack row) it sits in. Events
 * that cross a week boundary are split into one segment per week (with
 * `continuesLeft`/`continuesRight` flags so the view can flatten that edge).
 */
export type MonthSegment<TData = unknown> = {
  event: ResolvedEvent<TData>
  startCol: number
  endCol: number
  lane: number
  continuesLeft: boolean
  continuesRight: boolean
}

const MS_DAY = 86_400_000

/**
 * Lay out one week row of the month grid as continuous spanning bars. `weekStart`
 * is the local-midnight first day of the 7-day row. Returns each overlapping
 * event as a {@link MonthSegment} clipped to the week, with greedy lane packing
 * so bars never overlap, plus the total `laneCount`.
 */
export function monthWeekSegments<TData>(
  events: ReadonlyArray<ResolvedEvent<TData>>,
  weekStart: Date,
): { segments: MonthSegment<TData>[]; laneCount: number } {
  const ws = startOfDay(weekStart)
  const we = addDays(ws, 7)
  const colOf = (d: Date) => Math.floor((startOfDay(d).getTime() - ws.getTime()) / MS_DAY)

  const out: MonthSegment<TData>[] = []
  for (const e of events) {
    const firstDay = startOfDay(e.start)
    // Last covered day: the day of (end - 1ms), so an end at exact midnight does
    // not spill onto the next day. Guard against zero/negative-length events.
    const lastDay = startOfDay(new Date(Math.max(e.start.getTime(), e.end.getTime() - 1)))
    if (lastDay.getTime() < ws.getTime() || firstDay.getTime() >= we.getTime()) continue
    const startCol = Math.max(0, colOf(firstDay))
    const endCol = Math.min(6, colOf(lastDay))
    if (endCol < startCol) continue
    out.push({
      event: e,
      startCol,
      endCol,
      lane: 0,
      continuesLeft: firstDay.getTime() < ws.getTime(),
      continuesRight: lastDay.getTime() >= we.getTime(),
    })
  }

  // Order: earliest start, then longest, then all-day before timed, then start time.
  out.sort(
    (a, b) =>
      a.startCol - b.startCol ||
      b.endCol - b.startCol - (a.endCol - a.startCol) ||
      (a.event.allDay === b.event.allDay
        ? a.event.start.getTime() - b.event.start.getTime()
        : a.event.allDay
          ? -1
          : 1),
  )

  // Greedy lane packing: a lane tracks the last column it is occupied through.
  const laneEnd: number[] = []
  for (const seg of out) {
    let lane = 0
    for (; lane < laneEnd.length; lane++) if (seg.startCol > (laneEnd[lane] ?? -1)) break
    laneEnd[lane] = seg.endCol
    seg.lane = lane
  }
  return { segments: out, laneCount: laneEnd.length }
}

/** A timed event positioned within a time-grid column. `topPct`/`heightPct` are
 *  0-100 of the visible day; `leftPct`/`widthPct`/`zIndex` place it horizontally
 *  among overlapping peers (already resolved for the chosen collision mode). */
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

/** A `+N more` tile emitted by `cap` mode for the events that didn't fit. */
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

/** The full time-grid layout for one day: positioned events + any overflow tiles. */
export type DayLayout<TData = unknown> = {
  events: PositionedEvent<TData>[]
  overflows: OverflowMarker<TData>[]
}

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

/**
 * Lay out the timed events of a single day for the time-grid, resolving
 * collisions per {@link SchedulerCollisionMode}. `dayStartHour`/`dayEndHour`
 * bound the visible band (e.g. 8..18); events are clamped to it. All-day events
 * are ignored here (the view renders them in a separate all-day row).
 */
export function layoutDayEvents<TData>(
  dayEvents: ReadonlyArray<ResolvedEvent<TData>>,
  day: Date,
  opts: LayoutOptions = {},
): DayLayout<TData> {
  const dayStartHour = opts.dayStartHour ?? 0
  const dayEndHour = opts.dayEndHour ?? 24
  const mode = opts.mode ?? 'split'
  const maxColumns = Math.max(2, Math.floor(opts.maxColumns ?? 3))
  const stackOffset = opts.stackOffsetPct ?? 14
  const stackMinWidth = opts.stackMinWidthPct ?? 42

  const base = startOfDay(day)
  const bandStartMin = dayStartHour * 60
  const bandEndMin = dayEndHour * 60
  const bandLen = Math.max(1, bandEndMin - bandStartMin)

  type Item = { event: ResolvedEvent<TData>; startMin: number; endMin: number; col: number }
  const items: Item[] = []
  for (const e of dayEvents) {
    if (e.allDay) continue
    const s = Math.max(bandStartMin, (e.start.getTime() - base.getTime()) / MS_MIN)
    const en = Math.min(bandEndMin, (e.end.getTime() - base.getTime()) / MS_MIN)
    if (en <= bandStartMin || s >= bandEndMin) continue
    items.push({ event: e, startMin: s, endMin: Math.max(s + 1, en), col: 0 })
  }
  items.sort((a, b) => a.startMin - b.startMin || a.endMin - b.endMin)

  const events: PositionedEvent<TData>[] = []
  const overflows: OverflowMarker<TData>[] = []
  const topOf = (min: number) => ((min - bandStartMin) / bandLen) * 100
  const heightOf = (a: number, b: number) => ((b - a) / bandLen) * 100
  const maxStackShift = Math.max(0, Math.floor((100 - stackMinWidth) / stackOffset))

  // Walk clusters of transitively-overlapping events; within each cluster assign
  // greedy columns, then resolve horizontal geometry for the chosen mode.
  let cluster: Item[] = []
  let clusterEnd = -Infinity
  const flush = () => {
    if (!cluster.length) return
    const colEnds: number[] = []
    for (const it of cluster) {
      let c = 0
      for (; c < colEnds.length; c++) if (it.startMin >= (colEnds[c] ?? Infinity)) break
      colEnds[c] = it.endMin
      it.col = c
    }
    const colCount = colEnds.length

    if (mode === 'stack' && colCount > 1) {
      for (const it of cluster) {
        const shift = Math.min(it.col, maxStackShift) * stackOffset
        events.push({
          event: it.event,
          topPct: topOf(it.startMin),
          heightPct: heightOf(it.startMin, it.endMin),
          col: it.col,
          colCount,
          leftPct: shift,
          widthPct: 100 - shift,
          zIndex: it.col + 1,
        })
      }
    } else if (mode === 'cap' && colCount > maxColumns) {
      const realCols = maxColumns - 1 // reserve the last visible slot for overflow
      const hidden: Item[] = []
      for (const it of cluster) {
        if (it.col < realCols) {
          events.push({
            event: it.event,
            topPct: topOf(it.startMin),
            heightPct: heightOf(it.startMin, it.endMin),
            col: it.col,
            colCount: maxColumns,
            leftPct: (it.col / maxColumns) * 100,
            widthPct: 100 / maxColumns,
            zIndex: 1,
          })
        } else {
          hidden.push(it)
        }
      }
      if (hidden.length) {
        const start = Math.min(...hidden.map((h) => h.startMin))
        const end = Math.max(...hidden.map((h) => h.endMin))
        overflows.push({
          topPct: topOf(start),
          heightPct: heightOf(start, end),
          leftPct: (realCols / maxColumns) * 100,
          widthPct: 100 / maxColumns,
          count: hidden.length,
          events: hidden.map((h) => h.event),
        })
      }
    } else {
      // split (and cap when the cluster fits within maxColumns): each event
      // starts in its greedy column, then EXPANDS rightward across any columns
      // that hold no event overlapping it in time - so an event with free space
      // beside it fills the gap instead of staying a narrow 1/colCount sliver.
      for (const it of cluster) {
        let span = 1
        for (let c = it.col + 1; c < colCount; c++) {
          const blocked = cluster.some(
            (o) => o !== it && o.col === c && o.startMin < it.endMin && o.endMin > it.startMin,
          )
          if (blocked) break
          span++
        }
        events.push({
          event: it.event,
          topPct: topOf(it.startMin),
          heightPct: heightOf(it.startMin, it.endMin),
          col: it.col,
          colCount,
          leftPct: (it.col / colCount) * 100,
          widthPct: (span / colCount) * 100,
          zIndex: 1,
        })
      }
    }

    cluster = []
    clusterEnd = -Infinity
  }
  for (const it of items) {
    if (cluster.length && it.startMin >= clusterEnd) flush()
    cluster.push(it)
    clusterEnd = Math.max(clusterEnd, it.endMin)
  }
  flush()
  return { events, overflows }
}

/** One day's bucket of events for the agenda (list) view. */
export type AgendaGroup<TData = unknown> = {
  day: Date
  events: ResolvedEvent<TData>[]
}

/** Group resolved events by calendar day for the agenda view (days with no
 *  events are omitted; groups and their events are in chronological order). */
export function agendaGroups<TData>(
  events: ReadonlyArray<ResolvedEvent<TData>>,
): AgendaGroup<TData>[] {
  const groups: AgendaGroup<TData>[] = []
  for (const e of [...events].sort((a, b) => a.start.getTime() - b.start.getTime())) {
    const last = groups[groups.length - 1]
    if (last && isSameDay(last.day, e.start)) last.events.push(e)
    else groups.push({ day: startOfDay(e.start), events: [e] })
  }
  return groups
}

/**
 * The visible date window for a view anchored on `anchor`. Used both to size the
 * grid and to bound event resolution (recurrence expansion clips to it).
 * `agendaDays` controls the agenda span (default 30).
 */
export function rangeForView(
  view: SchedulerView,
  anchor: Date,
  weekStartsOn = 0,
  agendaDays = 30,
): { start: Date; end: Date } {
  switch (view) {
    case 'month': {
      const start = startOfWeek(startOfMonth(anchor), weekStartsOn)
      return { start, end: addDays(start, 42) } // fixed 6-week grid
    }
    case 'week': {
      const start = startOfWeek(anchor, weekStartsOn)
      return { start, end: addDays(start, 7) }
    }
    case 'day': {
      const start = startOfDay(anchor)
      return { start, end: addDays(start, 1) }
    }
    case 'agenda': {
      const start = startOfDay(anchor)
      return { start, end: addDays(start, Math.max(1, agendaDays)) }
    }
    case 'timelineDay':
      return { start: startOfDay(anchor), end: addDays(startOfDay(anchor), 1) }
    case 'timelineWeek': {
      const start = startOfWeek(anchor, weekStartsOn)
      return { start, end: addDays(start, 7) }
    }
    case 'timelineMonth': {
      const start = startOfMonth(anchor)
      return { start, end: startOfMonth(addMonths(anchor, 1)) }
    }
    case 'timelineYear': {
      const start = new Date(anchor.getFullYear(), 0, 1)
      return { start, end: new Date(anchor.getFullYear() + 1, 0, 1) }
    }
  }
}

/** The 7 (or fewer) day columns rendered for the week / day views. */
export function daysForView(view: SchedulerView, anchor: Date, weekStartsOn = 0): Date[] {
  if (view === 'day') return [startOfDay(anchor)]
  const start = startOfWeek(anchor, weekStartsOn)
  return Array.from({ length: 7 }, (_, i) => addDays(start, i))
}

/** Move the anchor one view-unit in `dir` (-1 back, +1 forward). */
export function navigateAnchor(view: SchedulerView, anchor: Date, dir: number): Date {
  switch (view) {
    case 'month':
      return addMonths(anchor, dir)
    case 'week':
      return addDays(anchor, 7 * dir)
    case 'day':
      return addDays(anchor, dir)
    case 'agenda':
      return addDays(anchor, 30 * dir)
    case 'timelineDay':
      return addDays(anchor, dir)
    case 'timelineWeek':
      return addDays(anchor, 7 * dir)
    case 'timelineMonth':
      return addMonths(anchor, dir)
    case 'timelineYear':
      return new Date(anchor.getFullYear() + dir, anchor.getMonth(), anchor.getDate())
  }
}

// --- timeline views (horizontal: time left→right, resources as rows) ----------

const TL_WD = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const TL_MO = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const tlHourLabel = (h: number) =>
  h === 0 ? '12 AM' : h < 12 ? `${h} AM` : h === 12 ? '12 PM' : `${h - 12} PM`

/** One column of the timeline's minor (tick) header row. */
export type TimelineTick = {
  start: Date
  end: Date
  leftPct: number
  widthPct: number
  label: string
  today: boolean
}
/** One cell of the timeline's major (grouping) header row, spanning several ticks. */
export type TimelineMajor = { label: string; leftPct: number; widthPct: number }
/** The horizontal axis: its window [start, end] (the day band for `timelineDay`),
 *  the minor `ticks`, and the coarser `majors` above them. */
export type TimelineAxis = {
  start: Date
  end: Date
  totalMs: number
  ticks: TimelineTick[]
  majors: TimelineMajor[]
}

// Group consecutive ticks that share a key into a coarser major cell.
function groupMajors(
  ticks: TimelineTick[],
  keyOf: (t: TimelineTick) => string,
  labelOf: (t: TimelineTick) => string,
): TimelineMajor[] {
  const out: (TimelineMajor & { _k?: string })[] = []
  for (const t of ticks) {
    const k = keyOf(t)
    const last = out[out.length - 1]
    if (last && last._k === k) last.widthPct += t.widthPct
    else out.push({ _k: k, label: labelOf(t), leftPct: t.leftPct, widthPct: t.widthPct })
  }
  return out.map(({ _k, ...m }) => m)
}

/**
 * Build the timeline header axis for `view` over `[rangeStart, rangeEnd]`. For
 * `timelineDay` the axis is clamped to the `dayStartHour..dayEndHour` band (so
 * events outside it clip, matching the vertical day view). Ticks are hours (day),
 * days (week / month) or months (year); majors are the date, the month(s), or
 * quarters. All geometry is percentage of the axis window.
 */
export function timelineAxis(
  view: SchedulerView,
  rangeStart: Date,
  rangeEnd: Date,
  opts: { dayStartHour?: number; dayEndHour?: number; today?: Date | null } = {},
): TimelineAxis {
  const dayStartHour = opts.dayStartHour ?? 0
  const dayEndHour = opts.dayEndHour ?? 24
  const today = opts.today ? startOfDay(opts.today) : null
  const isToday = (d: Date) => (today ? isSameDay(d, today) : false)

  let start = rangeStart
  let end = rangeEnd
  if (view === 'timelineDay') {
    start = new Date(rangeStart.getFullYear(), rangeStart.getMonth(), rangeStart.getDate(), dayStartHour)
    end = new Date(rangeStart.getFullYear(), rangeStart.getMonth(), rangeStart.getDate(), 0, 0, 0, 0)
    end = new Date(end.getTime() + dayEndHour * 3_600_000)
  }
  const total = Math.max(1, end.getTime() - start.getTime())
  const base = start.getTime()
  const mk = (s: Date, e: Date, label: string): TimelineTick => ({
    start: s,
    end: e,
    leftPct: ((s.getTime() - base) / total) * 100,
    widthPct: ((e.getTime() - s.getTime()) / total) * 100,
    label,
    today: isToday(s),
  })

  const ticks: TimelineTick[] = []
  let majors: TimelineMajor[] = []

  if (view === 'timelineDay') {
    for (let h = dayStartHour; h < dayEndHour; h++) {
      const s = new Date(rangeStart.getFullYear(), rangeStart.getMonth(), rangeStart.getDate(), h)
      ticks.push(mk(s, new Date(s.getTime() + 3_600_000), tlHourLabel(h)))
    }
    majors = [
      { label: `${TL_WD[rangeStart.getDay()]}, ${TL_MO[rangeStart.getMonth()]} ${rangeStart.getDate()}`, leftPct: 0, widthPct: 100 },
    ]
  } else if (view === 'timelineWeek' || view === 'timelineMonth') {
    let cur = startOfDay(start)
    while (cur.getTime() < end.getTime()) {
      const nxt = addDays(cur, 1)
      const label = view === 'timelineWeek' ? `${TL_WD[cur.getDay()]} ${cur.getDate()}` : `${cur.getDate()}`
      ticks.push(mk(cur, nxt, label))
      cur = nxt
    }
    majors = groupMajors(
      ticks,
      (t) => `${t.start.getFullYear()}-${t.start.getMonth()}`,
      (t) => `${TL_MO[t.start.getMonth()]} ${t.start.getFullYear()}`,
    )
  } else if (view === 'timelineYear') {
    const y = rangeStart.getFullYear()
    for (let m = 0; m < 12; m++) {
      ticks.push(mk(new Date(y, m, 1), new Date(y, m + 1, 1), TL_MO[m]))
    }
    majors = groupMajors(
      ticks,
      (t) => `${Math.floor(t.start.getMonth() / 3)}`,
      (t) => `Q${Math.floor(t.start.getMonth() / 3) + 1} ${t.start.getFullYear()}`,
    )
  }

  return { start, end, totalMs: total, ticks, majors }
}

/** An event's horizontal geometry within the axis window, or `null` when it
 *  falls entirely outside it. `continuesLeft/Right` flag a clipped edge. */
export function timelineGeom(
  start: Date,
  end: Date,
  axisStart: Date,
  axisMs: number,
): { leftPct: number; widthPct: number; continuesLeft: boolean; continuesRight: boolean } | null {
  const a = axisStart.getTime()
  const b = a + axisMs
  const s = Math.max(start.getTime(), a)
  const e = Math.min(end.getTime(), b)
  if (e <= a || s >= b || e <= s) return null
  return {
    leftPct: ((s - a) / axisMs) * 100,
    widthPct: ((e - s) / axisMs) * 100,
    continuesLeft: start.getTime() < a,
    continuesRight: end.getTime() > b,
  }
}

/** One resource's timeline row: its events lane-packed so overlaps stack. */
export type TimelineRow<TData = unknown> = {
  resource: SchedulerResource | null
  laneCount: number
  items: { event: ResolvedEvent<TData>; lane: number }[]
}

/**
 * Bucket `events` by resource into rows (a single `null` row when there are no
 * resources), then greedily lane-pack each row so overlapping events stack. An
 * event whose `resourceId` matches no resource is dropped.
 */
export function timelineRows<TData>(
  resources: ReadonlyArray<SchedulerResource> | null | undefined,
  events: ReadonlyArray<ResolvedEvent<TData>>,
): TimelineRow<TData>[] {
  const hasRes = !!(resources && resources.length)
  const rows = hasRes
    ? resources!.map((r) => ({ resource: r as SchedulerResource | null, evs: [] as ResolvedEvent<TData>[] }))
    : [{ resource: null as SchedulerResource | null, evs: [] as ResolvedEvent<TData>[] }]
  const byId = new Map<string | null, (typeof rows)[number]>()
  for (const r of rows) byId.set(r.resource?.id ?? null, r)

  for (const ev of events) {
    const row = hasRes ? byId.get(ev.resourceId ?? '') : rows[0]
    if (row) row.evs.push(ev)
  }

  return rows.map((r) => {
    const sorted = [...r.evs].sort((a, b) => a.start.getTime() - b.start.getTime() || a.end.getTime() - b.end.getTime())
    const laneEnd: number[] = []
    const items = sorted.map((event) => {
      let lane = 0
      for (; lane < laneEnd.length; lane++) if (event.start.getTime() >= (laneEnd[lane] ?? -Infinity)) break
      laneEnd[lane] = event.end.getTime()
      return { event, lane }
    })
    return { resource: r.resource, laneCount: Math.max(1, laneEnd.length), items }
  })
}
