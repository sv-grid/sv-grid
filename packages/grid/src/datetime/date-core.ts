/**
 * date-core - framework-free date math shared by SvCalendar, SvTimePicker and
 * SvDateTimePicker. No Svelte, no DOM: pure functions over the native `Date`
 * so it is trivially unit- and mutation-testable and reusable standalone.
 *
 * Conventions:
 * - A "day" is compared by local calendar date (year/month/date), ignoring the
 *   time-of-day, unless a helper says otherwise.
 * - `firstDayOfWeek` is 0-6 (0 = Sunday), matching `Date.getDay()` and Smart's
 *   `firstDayOfWeek`.
 */

export type DateLike = Date | number | string

/** Coerce a Date | epoch-ms | parseable string to a Date, or null if invalid. */
export function toDate(value: DateLike | null | undefined): Date | null {
  if (value == null) return null
  const d = value instanceof Date ? new Date(value.getTime()) : new Date(value)
  return isNaN(d.getTime()) ? null : d
}

/** A new Date at local midnight of the same calendar day (time stripped). */
export function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate())
}

/** First day (midnight) of the month `d` falls in. */
export function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1)
}

/** Last day (midnight) of the month `d` falls in. */
export function endOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0)
}

/** Number of days in the month `d` falls in. */
export function daysInMonth(d: Date): number {
  return endOfMonth(d).getDate()
}

/**
 * Start of the week containing `d`, honoring `firstDayOfWeek` (0-6). Returns a
 * local-midnight Date on or before `d`.
 */
export function startOfWeek(d: Date, firstDayOfWeek = 0): Date {
  const start = startOfDay(d)
  const diff = (start.getDay() - firstDayOfWeek + 7) % 7
  start.setDate(start.getDate() - diff)
  return start
}

/** True when both dates are the same local calendar day. */
export function isSameDay(a: Date | null, b: Date | null): boolean {
  if (!a || !b) return false
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  )
}

/** True when both dates are in the same year+month. */
export function isSameMonth(a: Date | null, b: Date | null): boolean {
  if (!a || !b) return false
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth()
}

/** -1 / 0 / 1 comparison by calendar day (time-of-day ignored). */
export function compareDay(a: Date, b: Date): number {
  const av = startOfDay(a).getTime()
  const bv = startOfDay(b).getTime()
  return av < bv ? -1 : av > bv ? 1 : 0
}

/** Add `n` days (can be negative), returning a new Date. */
export function addDays(d: Date, n: number): Date {
  const r = new Date(d.getTime())
  r.setDate(r.getDate() + n)
  return r
}

/**
 * Add `n` calendar months, clamping the day-of-month so 31 Jan + 1 month = 28/29
 * Feb rather than spilling into March (matches how calendars paginate).
 */
export function addMonths(d: Date, n: number): Date {
  const day = d.getDate()
  const r = new Date(d.getFullYear(), d.getMonth() + n, 1, d.getHours(), d.getMinutes(), d.getSeconds(), d.getMilliseconds())
  r.setDate(Math.min(day, daysInMonth(r)))
  return r
}

/** Add `n` years, clamping Feb-29 to Feb-28 on non-leap targets. */
export function addYears(d: Date, n: number): Date {
  return addMonths(d, n * 12)
}

/** Clamp `d` to the inclusive [min, max] range (either bound may be null). */
export function clampDate(d: Date, min: Date | null, max: Date | null): Date {
  if (min && d.getTime() < min.getTime()) return new Date(min.getTime())
  if (max && d.getTime() > max.getTime()) return new Date(max.getTime())
  return d
}

/**
 * ISO 8601 week number (1-53) for `d`. Week 1 is the week containing the first
 * Thursday of the year; weeks start Monday. Independent of `firstDayOfWeek`,
 * matching Smart's `weekNumbers` column which is always ISO.
 */
export function isoWeek(d: Date): number {
  // Shift to the Thursday of this week, then count weeks from Jan 1.
  const date = startOfDay(d)
  const day = (date.getDay() + 6) % 7 // Mon=0..Sun=6
  date.setDate(date.getDate() - day + 3) // Thursday of this week
  const firstThursday = new Date(date.getFullYear(), 0, 4)
  const firstDay = (firstThursday.getDay() + 6) % 7
  firstThursday.setDate(firstThursday.getDate() - firstDay + 3)
  const diffMs = date.getTime() - firstThursday.getTime()
  return 1 + Math.round(diffMs / (7 * 24 * 3600 * 1000))
}

/**
 * The [start, end] years of the decade block that `year` belongs to, as Smart
 * renders it: a 12-cell page running from the decade start minus 1 to plus 10
 * (one leading + one trailing year for context). We expose the canonical
 * decade [Y0, Y0+9] and let the view pad.
 */
export function decadeRange(year: number): { start: number; end: number } {
  const start = Math.floor(year / 10) * 10
  return { start, end: start + 9 }
}

/** The [start, end] years of the century block (100-year) `year` belongs to. */
export function centuryRange(year: number): { start: number; end: number } {
  const start = Math.floor(year / 100) * 100
  return { start, end: start + 99 }
}

export type MonthMatrixCell = {
  date: Date
  /** In the displayed month (vs. leading/trailing days of adjacent months). */
  inMonth: boolean
  /** ISO week number of the row this cell sits in. */
  week: number
}

/**
 * Build a month grid of `weeks` rows x 7 columns starting at `firstDayOfWeek`,
 * padded with the trailing days of the previous month and leading days of the
 * next so every row is full. `weeks` defaults to 6 (the max any month needs),
 * matching Smart's fixed-height calendar.
 */
export function monthMatrix(
  monthDate: Date,
  firstDayOfWeek = 0,
  weeks = 6,
): MonthMatrixCell[][] {
  const first = startOfMonth(monthDate)
  const gridStart = startOfWeek(first, firstDayOfWeek)
  const rows: MonthMatrixCell[][] = []
  let cursor = gridStart
  for (let r = 0; r < weeks; r++) {
    const row: MonthMatrixCell[] = []
    const weekNo = isoWeek(cursor)
    for (let c = 0; c < 7; c++) {
      row.push({
        date: cursor,
        inMonth: cursor.getMonth() === first.getMonth() && cursor.getFullYear() === first.getFullYear(),
        week: weekNo,
      })
      cursor = addDays(cursor, 1)
    }
    rows.push(row)
  }
  return rows
}

/**
 * Ordered weekday indexes (0-6) for a header row starting at `firstDayOfWeek`.
 * e.g. firstDayOfWeek=1 -> [1,2,3,4,5,6,0].
 */
export function weekdayOrder(firstDayOfWeek = 0): number[] {
  return Array.from({ length: 7 }, (_, i) => (firstDayOfWeek + i) % 7)
}

/** Merge a calendar day with a time-of-day taken from `time`, returning a new Date. */
export function withTime(day: Date, time: Date): Date {
  return new Date(
    day.getFullYear(),
    day.getMonth(),
    day.getDate(),
    time.getHours(),
    time.getMinutes(),
    time.getSeconds(),
    time.getMilliseconds(),
  )
}

/** Snap a minute value to the nearest lower multiple of `interval` (>=1). */
export function snapMinute(minute: number, interval: number): number {
  const step = Math.max(1, Math.floor(interval))
  return Math.floor(minute / step) * step
}
