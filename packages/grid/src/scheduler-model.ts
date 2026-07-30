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

export type SchedulerView = 'month' | 'week' | 'day' | 'agenda'

/** A scheduler resource - a person / room / machine an event can be assigned to. */
export type SchedulerResource = {
  id: string
  title?: string
  color?: string
}

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
  resourceId?: string
  /** True when this instance came from expanding a recurrence rule. */
  recurring: boolean
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
  getResource?: (row: TData) => string | undefined
  getRecurrence?: (
    row: TData,
  ) => RecurrenceRule | ReadonlyArray<RecurrenceRule> | null | undefined
  /** Fallback event length (minutes) when a row has a start but no end. Default 60. */
  defaultDurationMin?: number
}

const MS_MIN = 60_000

/** True when [aStart,aEnd] and [bStart,bEnd] overlap (touching counts as overlap
 *  only for zero-length events). */
function rangesOverlap(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date): boolean {
  return aStart.getTime() < bEnd.getTime() && aEnd.getTime() > bStart.getTime()
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
    const resourceId = spec.getResource?.(row)
    const rule = spec.getRecurrence?.(row)

    if (rule) {
      // One instance per matching day, carrying the base time-of-day + duration.
      const days = expandRecurrence(rule, rangeStart, rangeEnd)
      for (const day of days) {
        const iStart = allDay ? startOfDay(day) : withTime(day, start)
        const iEnd = new Date(iStart.getTime() + durationMs)
        if (!rangesOverlap(iStart, iEnd, rangeStart, rangeEnd)) continue
        out.push({
          key: `${rowKey}#${iStart.getFullYear()}-${iStart.getMonth() + 1}-${iStart.getDate()}`,
          rowKey,
          row,
          title,
          start: iStart,
          end: iEnd,
          allDay,
          color,
          resourceId,
          recurring: true,
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

/** A timed event positioned within a time-grid column. `topPct`/`heightPct` are
 *  0-100 of the visible day; `col`/`colCount` place it among overlapping peers. */
export type PositionedEvent<TData = unknown> = {
  event: ResolvedEvent<TData>
  topPct: number
  heightPct: number
  col: number
  colCount: number
}

/**
 * Lay out the timed events of a single day into side-by-side columns so
 * overlapping events share the width. `dayStartHour`/`dayEndHour` bound the
 * visible band (e.g. 8..18); events are clamped to it. All-day events are
 * ignored here (the view renders them in a separate all-day row).
 */
export function layoutDayEvents<TData>(
  dayEvents: ReadonlyArray<ResolvedEvent<TData>>,
  day: Date,
  dayStartHour = 0,
  dayEndHour = 24,
): PositionedEvent<TData>[] {
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

  const result: PositionedEvent<TData>[] = []
  // Walk clusters of transitively-overlapping events; within each cluster assign
  // greedy columns and give every member the cluster's column count for width.
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
    for (const it of cluster) {
      result.push({
        event: it.event,
        topPct: ((it.startMin - bandStartMin) / bandLen) * 100,
        heightPct: ((it.endMin - it.startMin) / bandLen) * 100,
        col: it.col,
        colCount,
      })
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
  return result
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
  }
}
