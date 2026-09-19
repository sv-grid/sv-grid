/**
 * gantt-model - the pure, framework-free core behind the Gantt view. No Svelte,
 * no DOM: rows in, resolved tasks / a work-breakdown tree / an axis out, so
 * every rule here is unit-tested directly (mirrors scheduler-model.ts in
 * @svgrid/grid).
 *
 * Three conventions this file owns, because getting them wrong is silent:
 *
 *  1. **Days are LOCAL.** A date-only string (`'2026-09-14'`) is parsed as
 *     local midnight, not UTC. `new Date('2026-09-14')` is UTC midnight, which
 *     in any negative-offset zone is the 13th locally - a bar a day early, on
 *     every task, visible only to people west of Greenwich.
 *  2. **`end` is exclusive, except a date-only string is inclusive of its day.**
 *     A task from the 14th to the 16th is three days long, which is what every
 *     planning tool means and what a person typing those dates expects. A
 *     value carrying a time (a `Date`, epoch-ms, or an ISO string with `T`) is
 *     taken literally.
 *  3. **Duration counts WORKING days.** A 3-day task starting Friday ends
 *     Wednesday, not Monday.
 *
 * Nothing here reads the clock: `projectRange` and `ganttAxis` take `today` as
 * an argument so their output is testable without wall-clock flakiness.
 */
import type {
  DateLike,
  GanttZoom,
  TimelineAxis,
  TimelineMajor,
  TimelineTick,
} from '@svgrid/grid'

// Pure, like every model in this package: the types above are erased at build
// time and nothing here imports a value. That is what lets the plugin-free
// `unit` vitest project run this file without compiling a Svelte component (see
// the projects split in vite.config.ts). The three date helpers and the major
// grouping below are the grid's, re-stated rather than imported, for that
// reason alone - they are a dozen lines and pinned by the tests in this folder.

const MS_DAY = 86_400_000

/** A new Date at local midnight of the same calendar day. */
export function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate())
}

/** `n` days after `d` (negative to go back), preserving the time of day. */
export function addDays(d: Date, n: number): Date {
  const out = new Date(d.getTime())
  out.setDate(out.getDate() + n)
  return out
}

/** Coerce a Date | epoch-ms | parseable string to a Date, or null if invalid. */
function toDate(value: DateLike | null | undefined): Date | null {
  if (value == null) return null
  const d = value instanceof Date ? new Date(value.getTime()) : new Date(value)
  return isNaN(d.getTime()) ? null : d
}

/** Group consecutive ticks that share a key into one coarser header cell. */
function groupMajors(
  ticks: ReadonlyArray<TimelineTick>,
  keyOf: (t: TimelineTick) => string,
  labelOf: (t: TimelineTick) => string,
): TimelineMajor[] {
  const out: Array<TimelineMajor & { _k?: string }> = []
  for (const t of ticks) {
    const k = keyOf(t)
    const last = out[out.length - 1]
    if (last && last._k === k) last.widthPct += t.widthPct
    else out.push({ _k: k, label: labelOf(t), leftPct: t.leftPct, widthPct: t.widthPct })
  }
  return out.map(({ _k, ...m }) => m)
}
/** A bare `YYYY-MM-DD`, with no time part. */
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/
const WD = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MO = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const MO_LONG = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]
/**
 * Loop ceiling for the day-walking helpers. A calendar with every weekday
 * non-working would otherwise spin forever looking for a working day; ranges
 * here are bounded in days, so this is unreachable for real input.
 */
const GUARD = 4000

/**
 * Parse a task date. A bare `YYYY-MM-DD` becomes LOCAL midnight of that day
 * (see the header); anything else goes through the grid's `toDate`.
 */
export function parseDay(value: DateLike | null | undefined): Date | null {
  if (typeof value === 'string' && DATE_ONLY.test(value)) {
    const [y, m, d] = value.split('-').map(Number) as [number, number, number]
    return new Date(y, m - 1, d)
  }
  return toDate(value ?? null)
}

/** True when `value` is a date-only string, so its end is inclusive of that day. */
function isDateOnly(value: unknown): boolean {
  return typeof value === 'string' && DATE_ONLY.test(value)
}

// --- working calendar -------------------------------------------------------

/** Which days are off: weekdays by number, plus specific dates. */
export type WorkingCalendar = {
  /** Weekday numbers, 0 = Sun .. 6 = Sat. */
  nonWorkingDays: ReadonlyArray<number>
  /** `startOfDay(date).getTime()` for each holiday. */
  holidays: ReadonlySet<number>
}

/** Build a {@link WorkingCalendar}. Weekends (`[0, 6]`) are the default. */
export function makeCalendar(
  nonWorkingDays: ReadonlyArray<number> = [0, 6],
  holidays: ReadonlyArray<DateLike> = [],
): WorkingCalendar {
  const set = new Set<number>()
  for (const h of holidays) {
    const d = parseDay(h)
    if (d) set.add(startOfDay(d).getTime())
  }
  return { nonWorkingDays: [...nonWorkingDays], holidays: set }
}

/** True when work happens on `d`'s calendar day. */
export function isWorkingDay(d: Date, cal: WorkingCalendar): boolean {
  if (cal.nonWorkingDays.includes(d.getDay())) return false
  return !cal.holidays.has(startOfDay(d).getTime())
}

/** Whether `cal` leaves any working day at all - the guard against looping. */
function hasWorkingDay(cal: WorkingCalendar): boolean {
  return cal.nonWorkingDays.length < 7
}

/**
 * Working days in `[start, end)`. A task from Monday to the following Monday
 * with weekends off is 5. Returns 0 when the range is empty or inverted.
 */
export function workingDays(start: Date, end: Date, cal: WorkingCalendar): number {
  let cur = startOfDay(start)
  const stop = end.getTime()
  let n = 0
  let guard = 0
  while (cur.getTime() < stop && guard++ < GUARD) {
    if (isWorkingDay(cur, cal)) n++
    cur = addDays(cur, 1)
  }
  return n
}

/**
 * The exclusive end of a task that starts on `start` and lasts `days` WORKING
 * days: the midnight after its last working day. A zero or negative length
 * gives `start` back (a milestone).
 */
export function addWorkingDays(start: Date, days: number, cal: WorkingCalendar): Date {
  const from = startOfDay(start)
  if (!(days > 0) || !hasWorkingDay(cal)) return from
  let cur = from
  let left = Math.ceil(days)
  let guard = 0
  while (left > 0 && guard++ < GUARD) {
    if (isWorkingDay(cur, cal)) left--
    cur = addDays(cur, 1)
  }
  return cur
}

/**
 * The start of a task that lasts `days` WORKING days and ends (exclusively) at
 * `end`: the inverse of {@link addWorkingDays}. Walks back from the day before
 * `end` counting working days, so a five-day task ending Saturday 00:00
 * started the Monday before. Zero days gives `end`'s own midnight.
 */
export function startForWorkingDays(end: Date, days: number, cal: WorkingCalendar): Date {
  const to = startOfDay(end)
  if (!(days > 0) || !hasWorkingDay(cal)) return to
  let cur = to
  let left = Math.ceil(days)
  let guard = 0
  while (left > 0 && guard++ < GUARD) {
    cur = addDays(cur, -1)
    if (isWorkingDay(cur, cal)) left--
  }
  return cur
}

/**
 * The span a task keeps when it is moved to `start`: its WORKING days laid
 * out from there, so a Monday-to-Friday task dragged to Wednesday ends the
 * Tuesday after, not the Sunday. A task with no working day in it (a
 * milestone, or one parked on a weekend) keeps its calendar length instead,
 * so nothing collapses to zero.
 */
export function moveWorkingSpan(
  start: Date,
  original: { start: Date; end: Date },
  cal: WorkingCalendar,
): { start: Date; end: Date } {
  const calMs = original.end.getTime() - original.start.getTime()
  const days = workingDays(original.start, original.end, cal)
  if (days <= 0 || calMs <= 0) return { start, end: new Date(start.getTime() + calMs) }
  return { start, end: addWorkingDays(start, days, cal) }
}

/**
 * The nearest working day at or after `d` (`dir` 1) or at or before it
 * (`dir` -1), at local midnight. A calendar with no working day at all returns
 * `d`'s own midnight rather than spinning.
 */
export function snapToWorkingDay(d: Date, dir: 1 | -1, cal: WorkingCalendar): Date {
  let cur = startOfDay(d)
  if (!hasWorkingDay(cal)) return cur
  let guard = 0
  while (!isWorkingDay(cur, cal) && guard++ < GUARD) cur = addDays(cur, dir)
  return cur
}

// --- resolving rows into tasks ---------------------------------------------

/**
 * Field accessors the model uses to read a task off a row. The renderer builds
 * this from `GanttConfig`, applying its drag overlay first so a dragged bar
 * resolves at its new dates without mutating the source row.
 */
export type GanttTaskSpec<TData> = {
  getKey: (row: TData) => string
  getStart: (row: TData) => DateLike | null | undefined
  getEnd?: (row: TData) => DateLike | null | undefined
  /** Length in WORKING days, used when `getEnd` yields nothing. */
  getDuration?: (row: TData) => number | null | undefined
  getTitle?: (row: TData) => string
  getProgress?: (row: TData) => number | null | undefined
  getParent?: (row: TData) => string | null | undefined
  getMilestone?: (row: TData) => boolean
  getColor?: (row: TData) => string | undefined
}

/** One row resolved to a bar: local-midnight dates, `end` exclusive. */
export type ResolvedTask<TData = unknown> = {
  key: string
  row: TData
  title: string
  start: Date
  /** Exclusive. Equal to `start` for a milestone. */
  end: Date
  /** 0-100, clamped. */
  progress: number
  milestone: boolean
  parentKey: string | null
  color?: string
}

/** Clamp anything to a sane 0-100 percent; junk reads as 0. */
function pct(value: unknown): number {
  const n = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(n)) return 0
  return Math.max(0, Math.min(100, n))
}

/**
 * Resolve `rows` into bars. A row with no readable start is SKIPPED - a
 * backlog item with no date is not a bar, and dropping it is better than
 * inventing a date for it.
 *
 * End wins over duration; duration counts working days from the start; with
 * neither the task is a milestone (`end === start`). A date-only end string is
 * inclusive of its day (see the file header).
 */
export function resolveTasks<TData>(
  rows: ReadonlyArray<TData>,
  spec: GanttTaskSpec<TData>,
  cal: WorkingCalendar,
): ResolvedTask<TData>[] {
  const out: ResolvedTask<TData>[] = []
  for (const row of rows) {
    const rawStart = spec.getStart(row)
    const start = parseDay(rawStart)
    if (!start) continue
    const from = startOfDay(start)

    const rawEnd = spec.getEnd?.(row)
    const parsedEnd = parseDay(rawEnd)
    let end: Date
    if (parsedEnd) {
      // A date-only end names its last day; a timestamped one is the instant.
      end = isDateOnly(rawEnd) ? addDays(startOfDay(parsedEnd), 1) : parsedEnd
    } else {
      const dur = spec.getDuration?.(row)
      const n = typeof dur === 'number' ? dur : Number(dur)
      end = Number.isFinite(n) && n > 0 ? addWorkingDays(from, n, cal) : from
    }
    // An end at or before the start is a milestone, not a backwards bar.
    if (end.getTime() < from.getTime()) end = from

    const parent = spec.getParent?.(row)
    const parentKey = parent == null || parent === '' ? null : String(parent)

    out.push({
      key: spec.getKey(row),
      row,
      title: spec.getTitle?.(row) ?? '',
      start: from,
      end,
      progress: pct(spec.getProgress?.(row)),
      milestone: spec.getMilestone?.(row) === true || end.getTime() === from.getTime(),
      parentKey,
      color: spec.getColor?.(row),
    })
  }
  return out
}

// --- the work-breakdown tree ------------------------------------------------

/** One row of the Gantt, in display order. */
export type GanttNode<TData = unknown> = {
  task: ResolvedTask<TData>
  /** 0 for a root. */
  depth: number
  hasChildren: boolean
  collapsed: boolean
  /**
   * Present only on a parent: the span and percent rolled up from EVERY
   * descendant, collapsed ones included.
   */
  summary?: { start: Date; end: Date; progress: number }
}

/**
 * Order tasks as a work-breakdown tree: roots in input order, each parent's
 * children directly under it in input order. Rows whose parent id matches no
 * task become roots rather than vanishing - the same rule the grid's tree data
 * uses for a missing parent, and the one that keeps a filtered-out phase from
 * hiding its tasks.
 *
 * Descendants of a collapsed node are left out of the returned list but still
 * feed that node's summary, which is why this walks the full task set rather
 * than the visible rows.
 *
 * A cycle in the parent links (a -> b -> a) is broken at the first repeat and
 * the rows involved are treated as roots, so bad data cannot hang the render.
 *
 * Summary progress is the duration-weighted mean of the LEAF descendants: a
 * two-day task at 100% beside a six-day task at 0% is 25% done, not 50%. A
 * milestone weighs nothing (it has no duration), so a parent holding only
 * milestones falls back to their plain mean.
 */
export function ganttTree<TData>(
  tasks: ReadonlyArray<ResolvedTask<TData>>,
  collapsed: ReadonlySet<string> = new Set(),
): GanttNode<TData>[] {
  const byKey = new Map<string, ResolvedTask<TData>>()
  for (const t of tasks) if (!byKey.has(t.key)) byKey.set(t.key, t)

  // Resolve each task's EFFECTIVE parent: null for a root, an unknown parent,
  // a self-link, or a link that would close a cycle.
  const parentOf = new Map<string, string | null>()
  for (const t of tasks) {
    const p = t.parentKey
    if (p == null || p === t.key || !byKey.has(p)) {
      parentOf.set(t.key, null)
      continue
    }
    // Walk up; if we come back to this task, the link is part of a cycle.
    const seen = new Set<string>([t.key])
    let cur: string | null = p
    let cyclic = false
    let guard = 0
    while (cur != null && guard++ < GUARD) {
      if (seen.has(cur)) {
        cyclic = true
        break
      }
      seen.add(cur)
      const next: string | null | undefined = byKey.get(cur)?.parentKey
      cur = next == null || !byKey.has(next) ? null : next
    }
    parentOf.set(t.key, cyclic ? null : p)
  }

  const childrenOf = new Map<string, ResolvedTask<TData>[]>()
  const roots: ResolvedTask<TData>[] = []
  for (const t of tasks) {
    const p = parentOf.get(t.key) ?? null
    if (p == null) roots.push(t)
    else (childrenOf.get(p) ?? childrenOf.set(p, []).get(p)!).push(t)
  }

  // Roll up every descendant, bottom-up, memoised per key.
  type Roll = { start: Date; end: Date; weighted: number; days: number; leaves: number; pctSum: number }
  const rollOf = new Map<string, Roll>()
  function roll(t: ResolvedTask<TData>): Roll {
    const hit = rollOf.get(t.key)
    if (hit) return hit
    const kids = childrenOf.get(t.key) ?? []
    let acc: Roll
    if (!kids.length) {
      const days = Math.max(0, (t.end.getTime() - t.start.getTime()) / MS_DAY)
      acc = {
        start: t.start,
        end: t.end,
        weighted: t.progress * days,
        days,
        leaves: 1,
        pctSum: t.progress,
      }
    } else {
      // The descendants alone. A phase row has a start of its own only
      // because `startField` is required; folding it in anchored the summary
      // to wherever the phase was first typed in, so when its tasks moved the
      // bar stretched back to that date instead of following them.
      let start: Date | null = null
      let end: Date | null = null
      let weighted = 0
      let days = 0
      let leaves = 0
      let pctSum = 0
      for (const k of kids) {
        const r = roll(k)
        if (!start || r.start.getTime() < start.getTime()) start = r.start
        if (!end || r.end.getTime() > end.getTime()) end = r.end
        weighted += r.weighted
        days += r.days
        leaves += r.leaves
        pctSum += r.pctSum
      }
      acc = { start: start ?? t.start, end: end ?? t.end, weighted, days, leaves, pctSum }
    }
    rollOf.set(t.key, acc)
    return acc
  }

  const out: GanttNode<TData>[] = []
  const walk = (list: ReadonlyArray<ResolvedTask<TData>>, depth: number) => {
    for (const t of list) {
      const kids = childrenOf.get(t.key) ?? []
      const isCollapsed = kids.length > 0 && collapsed.has(t.key)
      const node: GanttNode<TData> = {
        task: t,
        depth,
        hasChildren: kids.length > 0,
        collapsed: isCollapsed,
      }
      if (kids.length) {
        const r = roll(t)
        node.summary = {
          start: r.start,
          end: r.end,
          // Weight by duration; with only zero-length descendants there is
          // nothing to weight by, so average them plainly.
          progress: r.days > 0 ? r.weighted / r.days : r.leaves > 0 ? r.pctSum / r.leaves : 0,
        }
      }
      out.push(node)
      if (kids.length && !isCollapsed) walk(kids, depth + 1)
    }
  }
  walk(roots, 0)
  return out
}

/** Each visible node's row index, for arrow geometry. */
export function nodeIndex<TData>(nodes: ReadonlyArray<GanttNode<TData>>): Map<string, number> {
  const m = new Map<string, number>()
  nodes.forEach((n, i) => m.set(n.task.key, i))
  return m
}

/**
 * Map every task key to the key of the visible row that stands for it: itself
 * when it is on screen, else its nearest visible ancestor. A dependency
 * pointing into a collapsed phase draws to that phase's summary bar instead of
 * vanishing. Keys with no visible ancestor are left out.
 */
export function visibleAnchor<TData>(
  nodes: ReadonlyArray<GanttNode<TData>>,
  tasks: ReadonlyArray<ResolvedTask<TData>>,
): Map<string, string> {
  const visible = new Set(nodes.map((n) => n.task.key))
  const parentOf = new Map<string, string | null>()
  for (const t of tasks) parentOf.set(t.key, t.parentKey)

  const anchor = new Map<string, string>()
  for (const t of tasks) {
    let cur: string | null = t.key
    let guard = 0
    while (cur != null && !visible.has(cur) && guard++ < GUARD) {
      cur = parentOf.get(cur) ?? null
    }
    if (cur != null && visible.has(cur)) anchor.set(t.key, cur)
  }
  return anchor
}

// --- the project window -----------------------------------------------------

/**
 * The date window the chart spans: the earliest start to the latest end, plus
 * `paddingDays` of slack each side, clamped to `minDate` / `maxDate`.
 *
 * Never returns an empty window: with no tasks it centres on `today`, so an
 * empty plan still renders an axis rather than dividing by zero.
 */
export function projectRange(
  tasks: ReadonlyArray<ResolvedTask<unknown>>,
  opts: {
    paddingDays: number
    today: Date
    minDate?: DateLike | null
    maxDate?: DateLike | null
  },
): { start: Date; end: Date } {
  const pad = Math.max(0, opts.paddingDays)
  let start: Date | null = null
  let end: Date | null = null
  for (const t of tasks) {
    if (!start || t.start.getTime() < start.getTime()) start = t.start
    if (!end || t.end.getTime() > end.getTime()) end = t.end
  }
  const today = startOfDay(opts.today)
  let from = addDays(start ? startOfDay(start) : today, -pad)
  let to = addDays(end ? startOfDay(end) : today, pad)

  const min = parseDay(opts.minDate ?? null)
  const max = parseDay(opts.maxDate ?? null)
  if (min && from.getTime() < startOfDay(min).getTime()) from = startOfDay(min)
  if (max && to.getTime() > startOfDay(max).getTime()) to = startOfDay(max)
  // A clamp (or a zero-length plan with no padding) can collapse the window.
  if (to.getTime() <= from.getTime()) to = addDays(from, 1)
  return { start: from, end: to }
}

// --- the header axis --------------------------------------------------------

/**
 * Target pixel width of ONE tick per preset. The chart's total width is
 * `ticks.length * ganttTickWidth[zoom]`; individual ticks keep their true
 * proportion of the window (February is narrower than March), so bars and
 * header cells always line up.
 */
export const ganttTickWidth: Record<GanttZoom, number> = {
  day: 48,
  week: 28,
  month: 40,
  quarter: 96,
  year: 72,
}

/** Local midnight of the `weekStartsOn` day at or before `d`. */
function startOfWeekOn(d: Date, weekStartsOn: number): Date {
  const s = startOfDay(d)
  const shift = (s.getDay() - weekStartsOn + 7) % 7
  return addDays(s, -shift)
}

/** The tick unit each preset uses. */
function tickUnit(zoom: GanttZoom): 'day' | 'week' | 'month' {
  if (zoom === 'day' || zoom === 'week') return 'day'
  if (zoom === 'month') return 'week'
  return 'month'
}

/** Snap `d` back to the start of the tick it falls in. */
function snapBack(d: Date, zoom: GanttZoom, weekStartsOn: number): Date {
  const unit = tickUnit(zoom)
  if (unit === 'day') return startOfDay(d)
  if (unit === 'week') return startOfWeekOn(d, weekStartsOn)
  return new Date(d.getFullYear(), d.getMonth(), 1)
}

/** The start of the tick after the one `d` falls in. */
function nextTick(d: Date, zoom: GanttZoom): Date {
  const unit = tickUnit(zoom)
  if (unit === 'day') return addDays(d, 1)
  if (unit === 'week') return addDays(d, 7)
  return new Date(d.getFullYear(), d.getMonth() + 1, 1)
}

/**
 * Build the Gantt's two-row header over `[start, end)` for a zoom preset. The
 * window is snapped OUT to whole tick boundaries so the ticks tile it exactly -
 * a half-drawn first column is where a header and its bars start disagreeing.
 *
 * Returns the scheduler's {@link TimelineAxis} shape (percentages, not pixels)
 * so the Gantt and the scheduler timeline share `timelineGeom` and the same
 * header markup:
 *
 * ```
 * day     ticks: days    majors: weeks     ("14 - 20 Sep")
 * week    ticks: days    majors: months    ("September 2026")   <- the default
 * month   ticks: weeks   majors: months
 * quarter ticks: months  majors: quarters  ("Q3 2026")
 * year    ticks: months  majors: years     ("2026")
 * ```
 */
export function ganttAxis(
  start: Date,
  end: Date,
  zoom: GanttZoom,
  opts: { weekStartsOn?: number; today?: Date | null } = {},
): TimelineAxis {
  const weekStartsOn = opts.weekStartsOn ?? 0
  const today = opts.today ? startOfDay(opts.today) : null

  const from = snapBack(start, zoom, weekStartsOn)
  // The end snaps OUT: an end already on a tick boundary stays put, anything
  // inside a tick grows to that tick's far edge, so the last column is whole.
  const endBack = snapBack(end, zoom, weekStartsOn)
  let to = endBack.getTime() === end.getTime() ? endBack : nextTick(endBack, zoom)
  if (to.getTime() <= from.getTime()) to = nextTick(from, zoom)

  const total = Math.max(1, to.getTime() - from.getTime())
  const base = from.getTime()
  const mk = (s: Date, e: Date, label: string): TimelineTick => ({
    start: s,
    end: e,
    leftPct: ((s.getTime() - base) / total) * 100,
    widthPct: ((e.getTime() - s.getTime()) / total) * 100,
    label,
    today: today ? s.getTime() <= today.getTime() && today.getTime() < e.getTime() : false,
  })

  const ticks: TimelineTick[] = []
  let cur = from
  let guard = 0
  while (cur.getTime() < to.getTime() && guard++ < GUARD) {
    const next = nextTick(cur, zoom)
    const clipped = next.getTime() > to.getTime() ? to : next
    ticks.push(mk(cur, clipped, tickLabel(cur, zoom)))
    cur = next
  }

  let majors: TimelineMajor[]
  if (zoom === 'day') {
    majors = groupMajors(
      ticks,
      (t) => String(startOfWeekOn(t.start, weekStartsOn).getTime()),
      (t) => weekLabel(startOfWeekOn(t.start, weekStartsOn)),
    )
  } else if (zoom === 'week' || zoom === 'month') {
    majors = groupMajors(
      ticks,
      (t) => `${t.start.getFullYear()}-${t.start.getMonth()}`,
      (t) => `${MO_LONG[t.start.getMonth()]} ${t.start.getFullYear()}`,
    )
  } else if (zoom === 'quarter') {
    majors = groupMajors(
      ticks,
      (t) => `${t.start.getFullYear()}-${Math.floor(t.start.getMonth() / 3)}`,
      (t) => `Q${Math.floor(t.start.getMonth() / 3) + 1} ${t.start.getFullYear()}`,
    )
  } else {
    majors = groupMajors(
      ticks,
      (t) => String(t.start.getFullYear()),
      (t) => String(t.start.getFullYear()),
    )
  }

  return { start: from, end: to, totalMs: total, ticks, majors }
}

/** A tick's own caption - short enough for the width its preset gives it. */
function tickLabel(d: Date, zoom: GanttZoom): string {
  switch (zoom) {
    case 'day':
      return `${WD[d.getDay()]} ${d.getDate()}`
    case 'week':
      return String(d.getDate())
    case 'month':
      return String(d.getDate())
    default:
      return MO[d.getMonth()]!
  }
}

/** "14 - 20 Sep", or "28 Sep - 4 Oct" across a month boundary. */
function weekLabel(weekStart: Date): string {
  const last = addDays(weekStart, 6)
  const a = weekStart.getDate()
  const b = last.getDate()
  if (weekStart.getMonth() === last.getMonth()) {
    return `${a} - ${b} ${MO[weekStart.getMonth()]}`
  }
  return `${a} ${MO[weekStart.getMonth()]} - ${b} ${MO[last.getMonth()]}`
}

// --- the horizontal scale ---------------------------------------------------

/**
 * One run of the axis at a single density: either drawn at the chart's normal
 * rate, or folded down to a fixed-width gap.
 */
export type GanttSegment = {
  start: Date
  /** Exclusive, like every end in this file. */
  end: Date
  /** Left edge of this run, in px from the chart's left. */
  x: number
  /** How wide the run is drawn. */
  px: number
  collapsed: boolean
}

/**
 * The chart's date <-> pixel mapping, and the one place either direction is
 * computed. Uniform by default; piecewise once whole days are folded out.
 */
export type GanttScale = {
  totalPx: number
  segments: GanttSegment[]
  /** A date's x offset (px) in the chart body. */
  xOf: (d: Date) => number
  /** The inverse: which date an x offset lands on. */
  dateAt: (x: number) => Date
}

/**
 * Build the scale over `[start, end)`.
 *
 * With no `collapsed` predicate this is the plain linear mapping - one segment,
 * `totalPx` exactly as asked - which is what every chart without the Pro axis
 * uses. Pass one and each run of days it answers true for folds to `gapPx`
 * instead of its real width, so a year of weekends stops eating two sevenths of
 * the chart. Within a gap the mapping stays proportional, so a task that does
 * run over a folded weekend still draws across it rather than collapsing to a
 * line.
 *
 * `gapPx` of 0 removes the folded days outright: Friday's finish and Monday's
 * start land on the same pixel.
 */
export function ganttScale(
  start: Date,
  end: Date,
  totalPx: number,
  opts: { collapsed?: ((day: Date) => boolean) | null; gapPx?: number } = {},
): GanttScale {
  const startMs = start.getTime()
  const totalMs = Math.max(1, end.getTime() - startMs)
  const pxPerMs = totalPx / totalMs
  const collapsedDay = opts.collapsed

  let segments: GanttSegment[]
  let widthPx = totalPx
  if (!collapsedDay) {
    segments = [{ start, end, x: 0, px: totalPx, collapsed: false }]
  } else {
    const gapPx = Math.max(0, opts.gapPx ?? 12)
    segments = []
    let x = 0
    let runStart = start
    let runCollapsed = collapsedDay(startOfDay(start))
    const push = (from: Date, to: Date, isCollapsed: boolean) => {
      if (to.getTime() <= from.getTime()) return
      const px = isCollapsed ? gapPx : (to.getTime() - from.getTime()) * pxPerMs
      segments.push({ start: from, end: to, x, px, collapsed: isCollapsed })
      x += px
    }
    // Walk whole days: the fold is a calendar decision, so a partial first or
    // last day belongs to whatever its own day is.
    let day = addDays(startOfDay(start), 1)
    while (day.getTime() < end.getTime()) {
      const isCollapsed = collapsedDay(day)
      if (isCollapsed !== runCollapsed) {
        push(runStart, day, runCollapsed)
        runStart = day
        runCollapsed = isCollapsed
      }
      day = addDays(day, 1)
    }
    push(runStart, end, runCollapsed)
    if (segments.length === 0) segments = [{ start, end, x: 0, px: totalPx, collapsed: false }]
    const tail = segments[segments.length - 1]!
    widthPx = tail.x + tail.px
  }

  /** The segment `ms` falls in, by binary search; the ends clamp. */
  const segmentAt = (ms: number): GanttSegment => {
    let lo = 0
    let hi = segments.length - 1
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1
      if (segments[mid]!.start.getTime() <= ms) lo = mid
      else hi = mid - 1
    }
    return segments[lo]!
  }

  const xOf = (d: Date): number => {
    const ms = d.getTime()
    if (ms <= startMs) return (ms - startMs) * pxPerMs
    const last = segments[segments.length - 1]!
    if (ms >= last.end.getTime()) {
      return last.x + last.px + (ms - last.end.getTime()) * pxPerMs
    }
    const seg = segmentAt(ms)
    const span = Math.max(1, seg.end.getTime() - seg.start.getTime())
    return seg.x + ((ms - seg.start.getTime()) / span) * seg.px
  }

  const dateAt = (x: number): Date => {
    if (x <= 0) return new Date(startMs + x / pxPerMs)
    const last = segments[segments.length - 1]!
    const endPx = last.x + last.px
    if (x >= endPx) return new Date(last.end.getTime() + (x - endPx) / pxPerMs)
    let lo = 0
    let hi = segments.length - 1
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1
      if (segments[mid]!.x <= x) lo = mid
      else hi = mid - 1
    }
    const seg = segments[lo]!
    const span = seg.end.getTime() - seg.start.getTime()
    if (seg.px <= 0) return new Date(seg.start.getTime())
    return new Date(seg.start.getTime() + ((x - seg.x) / seg.px) * span)
  }

  return { totalPx: widthPx, segments, xOf, dateAt }
}
