/**
 * scheduler-axis - the pure core behind Scheduler Pro's *non-working-time
 * collapse* and *continuous zoom*. No Svelte, no DOM.
 *
 * Instead of a single linear time<->pixel scale, the timeline axis becomes a
 * PIECEWISE map: working spans keep a full pixel width (`pxPerMinute`), while
 * non-working spans (nights / weekends) collapse to a thin fixed-width gap (or
 * are omitted). {@link buildAxis} produces the ordered segments; {@link timeToX}
 * / {@link xToTime} map across them. The renderer routes all event positioning
 * and drag snapping through these so a collapsed axis stays consistent.
 *
 * Callers supply the range + working definition; this file never reads the clock.
 */

const MS_MIN = 60_000
const MS_DAY = 86_400_000

export type AxisSegmentKind = 'working' | 'break' | 'collapsed'

/** One contiguous stretch of the axis with a resolved pixel width + offset. */
export type AxisSegment = {
  start: Date
  end: Date
  /** Left offset in px from the axis origin. */
  x: number
  /** Rendered width in px (collapsed gaps get a fixed small width). */
  px: number
  kind: AxisSegmentKind
}

export type Axis = {
  start: Date
  end: Date
  segments: AxisSegment[]
  totalPx: number
}

export type BuildAxisOptions = {
  /** Pixel width of one working minute. Default 0.5 (30px/hour). */
  pxPerMinute?: number
  /** Business-hours window in hours, e.g. `{ start: 9, end: 17 }`. Omit = 24h working. */
  businessHours?: { start: number; end: number }
  /** Weekday numbers (0 = Sun .. 6 = Sat) treated as non-working days. */
  nonWorkingDays?: ReadonlyArray<number>
  /** Collapse nights / breaks (time outside business hours) to a gap. */
  collapseNonWorking?: boolean
  /** Collapse whole non-working days (weekends) to a gap. */
  collapseWeekends?: boolean
  /** Width (px) of a collapsed gap marker. Default 12; 0 omits it entirely. */
  collapsedGapPx?: number
}

/** True when `weekday` is a non-working day. */
function isNonWorkingDay(weekday: number, days: ReadonlyArray<number> | undefined): boolean {
  return !!days && days.includes(weekday)
}

/**
 * The working `[startMs, endMs)` intervals for the local day beginning at
 * `dayStart`, from `businessHours` (or the whole day when omitted). Empty when the
 * day is a non-working day.
 */
function workingSpansForDay(
  dayStart: Date,
  bh: { start: number; end: number } | undefined,
  nonWorkingDays: ReadonlyArray<number> | undefined,
): Array<[number, number]> {
  if (isNonWorkingDay(dayStart.getDay(), nonWorkingDays)) return []
  const base = dayStart.getTime()
  if (!bh) return [[base, base + MS_DAY]]
  const s = base + bh.start * 60 * MS_MIN
  const e = base + bh.end * 60 * MS_MIN
  return e > s ? [[s, e]] : []
}

/**
 * Build the piecewise axis over `[rangeStart, rangeEnd]`. Walks day by day,
 * emitting `working` segments (full width) interleaved with `break` (outside
 * business hours) and whole non-working-day segments. A non-working segment is
 * rendered `collapsed` (fixed gap px) when the matching collapse flag is on, else
 * kept at full width with kind `break`.
 */
export function buildAxis(rangeStart: Date, rangeEnd: Date, opts: BuildAxisOptions = {}): Axis {
  const pxPerMinute = opts.pxPerMinute ?? 0.5
  const gapPx = opts.collapsedGapPx ?? 12
  const pxOfMs = (ms: number) => (ms / MS_MIN) * pxPerMinute

  // Collect all working spans across the range, clipped to it.
  const rangeS = rangeStart.getTime()
  const rangeE = rangeEnd.getTime()
  const working: Array<[number, number]> = []
  let day = new Date(rangeStart.getFullYear(), rangeStart.getMonth(), rangeStart.getDate())
  // Guard: never loop forever; ranges are bounded (days count).
  let guard = 0
  while (day.getTime() < rangeE && guard++ < 4000) {
    for (const [s, e] of workingSpansForDay(day, opts.businessHours, opts.nonWorkingDays)) {
      const cs = Math.max(s, rangeS)
      const ce = Math.min(e, rangeE)
      if (ce > cs) working.push([cs, ce])
    }
    day = new Date(day.getTime() + MS_DAY)
  }
  working.sort((a, b) => a[0] - b[0])

  // Weave working spans with the non-working gaps between them (and the edges).
  // Build raw segments (x assigned in a finalize pass so we can coalesce first).
  type Raw = { start: number; end: number; px: number; kind: AxisSegmentKind }
  const raw: Raw[] = []
  let cursor = rangeS
  const pushSegment = (s: number, e: number, kind: AxisSegmentKind) => {
    if (e <= s) return
    if (kind === 'working') {
      raw.push({ start: s, end: e, px: pxOfMs(e - s), kind })
      return
    }
    // non-working: split into per-day pieces so a whole non-working DAY (weekend)
    // collapses per `collapseWeekends` while a night / break collapses per
    // `collapseNonWorking`. Consecutive collapsed pieces are merged below.
    let a = s
    while (a < e) {
      const d = new Date(a)
      const dayStart = new Date(d.getFullYear(), d.getMonth(), d.getDate())
      const b = Math.min(e, dayStart.getTime() + MS_DAY)
      const wholeDayOff = isNonWorkingDay(dayStart.getDay(), opts.nonWorkingDays)
      const collapse = wholeDayOff ? opts.collapseWeekends : opts.collapseNonWorking
      if (collapse) raw.push({ start: a, end: b, px: gapPx > 0 ? gapPx : 0, kind: 'collapsed' })
      else raw.push({ start: a, end: b, px: pxOfMs(b - a), kind: 'break' })
      a = b
    }
  }

  for (const [ws, we] of working) {
    if (ws > cursor) pushSegment(cursor, ws, 'break') // non-working gap before this span
    pushSegment(ws, we, 'working')
    cursor = we
  }
  if (cursor < rangeE) pushSegment(cursor, rangeE, 'break') // trailing non-working tail

  // Coalesce consecutive collapsed pieces into one gap marker (a single collapsed
  // stretch renders as one "gap" of `gapPx`, not one per calendar day), then
  // assign cumulative x offsets.
  const segments: AxisSegment[] = []
  let x = 0
  for (const r of raw) {
    const prev = segments[segments.length - 1]
    if (r.kind === 'collapsed' && prev && prev.kind === 'collapsed') {
      prev.end = new Date(r.end) // extend the existing gap; px stays fixed
      continue
    }
    segments.push({ start: new Date(r.start), end: new Date(r.end), x, px: r.px, kind: r.kind })
    x += r.px
  }

  return { start: rangeStart, end: rangeEnd, segments, totalPx: x }
}

/** Find the segment containing `t` (by time), or null when outside the axis. */
function segmentAt(axis: Axis, t: number): AxisSegment | null {
  for (const seg of axis.segments) {
    if (t >= seg.start.getTime() && t < seg.end.getTime()) return seg
  }
  // Exact end-of-axis maps to the last segment's trailing edge.
  const last = axis.segments[axis.segments.length - 1]
  if (last && t === last.end.getTime()) return last
  return null
}

/** Map a time to an x offset (px) across the piecewise axis. Clamps to [0,totalPx]. */
export function timeToX(date: Date, axis: Axis): number {
  const t = date.getTime()
  if (t <= axis.start.getTime()) return 0
  if (t >= axis.end.getTime()) return axis.totalPx
  const seg = segmentAt(axis, t)
  if (!seg) return 0
  const span = seg.end.getTime() - seg.start.getTime()
  const frac = span > 0 ? (t - seg.start.getTime()) / span : 0
  return seg.x + frac * seg.px
}

/** Map an x offset (px) back to a time across the piecewise axis. */
export function xToTime(x: number, axis: Axis): Date {
  if (x <= 0) return new Date(axis.start.getTime())
  if (x >= axis.totalPx) return new Date(axis.end.getTime())
  for (const seg of axis.segments) {
    if (x >= seg.x && x < seg.x + seg.px) {
      const span = seg.end.getTime() - seg.start.getTime()
      const frac = seg.px > 0 ? (x - seg.x) / seg.px : 0
      return new Date(seg.start.getTime() + frac * span)
    }
  }
  return new Date(axis.end.getTime())
}

// --- zoom -------------------------------------------------------------------

export type ZoomMajorUnit = 'hour' | 'day' | 'week' | 'month' | 'quarter' | 'year'

/** One zoom preset: tick size + pixel density + the coarser grouping unit. */
export type ZoomLevel = {
  id: string
  label: string
  /** Minutes per minor tick. */
  tickMinutes: number
  /** Pixel width of one minor tick. */
  pxPerTick: number
  majorUnit: ZoomMajorUnit
}

/** The built-in zoom ladder, most zoomed-in first (minute detail -> months). */
export const zoomPresets: ZoomLevel[] = [
  { id: '5min', label: '5 min', tickMinutes: 5, pxPerTick: 24, majorUnit: 'hour' },
  { id: '15min', label: '15 min', tickMinutes: 15, pxPerTick: 30, majorUnit: 'hour' },
  { id: '30min', label: '30 min', tickMinutes: 30, pxPerTick: 40, majorUnit: 'day' },
  { id: 'hour', label: 'Hourly', tickMinutes: 60, pxPerTick: 50, majorUnit: 'day' },
  { id: '3hour', label: '3 hours', tickMinutes: 180, pxPerTick: 44, majorUnit: 'day' },
  { id: 'day', label: 'Daily', tickMinutes: 1440, pxPerTick: 64, majorUnit: 'week' },
  { id: 'week', label: 'Weekly', tickMinutes: 10_080, pxPerTick: 80, majorUnit: 'month' },
  { id: 'month', label: 'Monthly', tickMinutes: 43_200, pxPerTick: 72, majorUnit: 'quarter' },
]

/**
 * Resolve `zoom` to a {@link ZoomLevel}. A `ZoomLevel` passes through; a number is
 * an index into `ladder` (clamped). Returns the pixel density too via
 * `pxPerMinute = pxPerTick / tickMinutes` (use it as `buildAxis`'s `pxPerMinute`).
 */
export function resolveZoom(
  zoom: number | ZoomLevel,
  ladder: ReadonlyArray<ZoomLevel> = zoomPresets,
): { level: ZoomLevel; pxPerMinute: number } {
  let level: ZoomLevel
  if (typeof zoom === 'number') {
    const i = Math.max(0, Math.min(ladder.length - 1, Math.round(zoom)))
    level = ladder[i]!
  } else {
    level = zoom
  }
  return { level, pxPerMinute: level.pxPerTick / level.tickMinutes }
}
