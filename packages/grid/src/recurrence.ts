/**
 * recurrence - a small, pure repeat-pattern engine for SvCalendar (and anywhere
 * you need "does this date match a recurring rule"). Supports daily / weekly /
 * monthly / yearly frequencies with an interval, weekday lists, a day-of-month
 * (incl. negative = counted from the end), a positional weekday-of-month
 * (`weekOfMonth`, e.g. the 2nd Tuesday / last Friday), an anchor (`from`) and two
 * end conditions - an inclusive `until` date or a `count` of occurrences.
 * Framework-free + pure so it is unit-tested directly - no RRULE dependency.
 *
 * ```ts
 * const standup = { freq: 'weekly', weekdays: [1, 2, 3, 4, 5] } // every weekday
 * const payday  = { freq: 'monthly', day: -1 }                  // the last day
 * const sprint  = { freq: 'weekly', weekdays: [1], interval: 2, from: '2026-01-05' } // every other Monday
 * const board   = { freq: 'monthly', weekdays: [2], weekOfMonth: 1 } // 1st Tuesday
 * const review  = { freq: 'weekly', weekdays: [5], count: 8 }   // 8 Fridays then stop
 * matchesRecurrence(someDate, [standup, payday, sprint, board, review])
 * ```
 */
import { startOfDay, startOfWeek, toDate, type DateLike } from './datetime/date-core'

export type RecurrenceFreq = 'daily' | 'weekly' | 'monthly' | 'yearly'

export type RecurrenceRule = {
  freq: RecurrenceFreq
  /** Repeat every N units of `freq`. Default 1. Uses `from` as the phase anchor. */
  interval?: number
  /** weekly: the weekdays it lands on (0 = Sunday .. 6 = Saturday). Also the
   *  weekday for a positional monthly / yearly rule (with `weekOfMonth`). */
  weekdays?: ReadonlyArray<number>
  /** monthly / yearly: day of the month. 1..31, or negative to count from the
   *  end (-1 = the last day, -2 = the second to last). */
  day?: number
  /** monthly / yearly: the ordinal week the `weekdays` land on within the month -
   *  1..4 (first..fourth) or -1 (last). E.g. `{ weekdays:[2], weekOfMonth:-1 }`
   *  = the last Tuesday. Takes precedence over `day` when both are set. */
  weekOfMonth?: number
  /** yearly: the month (0 = January .. 11 = December). */
  month?: number
  /** First occurrence + the phase for `interval`. */
  from?: DateLike
  /** Last day the pattern applies (inclusive). */
  until?: DateLike | null
  /** End after this many occurrences (counted from `from`). Requires `from`. */
  count?: number
}

const MS_DAY = 86_400_000
/** Whole-day index, rounded so DST transitions don't shift it. */
const dayIndex = (d: Date) => Math.round(startOfDay(d).getTime() / MS_DAY)
/** Days in the month that `d` falls in. */
const daysInMonth = (d: Date) => new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()
/** Whether `d` is the `nth` occurrence of its own weekday within its month -
 *  nth 1..4 (first..fourth) or -1 (last). */
function isNthWeekdayOfMonth(d: Date, nth: number): boolean {
  if (nth === -1) return d.getDate() + 7 > daysInMonth(d) // no same weekday later this month
  return Math.floor((d.getDate() - 1) / 7) + 1 === nth
}

function matchesRule(date: Date, rule: RecurrenceRule): boolean {
  // Fold a `count` end-condition into an equivalent `until` first (pure), so the
  // rest of the matcher stays a stateless per-date test.
  const r = rule.count && rule.count >= 1 && rule.from != null ? resolveCount(rule) : rule
  const d = startOfDay(date)
  const fromD = r.from != null ? startOfDay(toDate(r.from) ?? d) : null
  const untilD = r.until != null ? startOfDay(toDate(r.until) ?? d) : null
  if (fromD && d < fromD) return false
  if (untilD && d > untilD) return false
  const interval = Math.max(1, Math.floor(r.interval ?? 1))

  switch (r.freq) {
    case 'daily':
      if (!fromD) return true
      return (dayIndex(d) - dayIndex(fromD)) % interval === 0

    case 'weekly': {
      // The weekdays it repeats on: an explicit list, else the anchor's weekday.
      const weekdays = r.weekdays && r.weekdays.length ? r.weekdays : fromD ? [fromD.getDay()] : null
      if (!weekdays) return false
      if (!weekdays.includes(d.getDay())) return false
      if (interval > 1 && fromD) {
        const weeks = Math.round(
          (startOfWeek(d, 0).getTime() - startOfWeek(fromD, 0).getTime()) / (MS_DAY * 7),
        )
        if (weeks % interval !== 0) return false
      }
      return true
    }

    case 'monthly': {
      if (!matchesMonthDay(d, r)) return false
      if (!fromD) return true
      const months = (d.getFullYear() - fromD.getFullYear()) * 12 + (d.getMonth() - fromD.getMonth())
      return months % interval === 0
    }

    case 'yearly': {
      if (r.month != null && d.getMonth() !== r.month) return false
      if (!matchesMonthDay(d, r)) return false
      if (!fromD) return r.month != null || r.day != null || r.weekOfMonth != null
      return (d.getFullYear() - fromD.getFullYear()) % interval === 0
    }
  }
}

// The day-within-the-month test shared by monthly + yearly: a positional
// weekday (`weekOfMonth` + `weekdays`), else a day-of-month (`day`, negative =
// from the end), else - for a `from`-anchored rule - the anchor's day-of-month.
function matchesMonthDay(d: Date, r: RecurrenceRule): boolean {
  if (r.weekOfMonth != null && r.weekdays && r.weekdays.length) {
    return r.weekdays.includes(d.getDay()) && isNthWeekdayOfMonth(d, r.weekOfMonth)
  }
  const fromDom = r.from != null ? (toDate(r.from) ?? d).getDate() : null
  const dom = r.day ?? fromDom
  if (dom == null) return false
  const target = dom < 0 ? daysInMonth(d) + dom + 1 : dom
  return d.getDate() === target
}

/** Fold a `count` rule into an equivalent `until`-bounded rule by walking
 *  forward from `from` to the Nth occurrence. Pure; count is then stripped. */
function resolveCount(rule: RecurrenceRule): RecurrenceRule {
  const from = toDate(rule.from!)
  if (!from) return { ...rule, count: undefined }
  const base: RecurrenceRule = { ...rule, count: undefined }
  let cur = startOfDay(from)
  let n = 0
  let lastMatch = cur
  let guard = 0
  while (guard++ < 4000 * 12) {
    if (matchesRule(cur, base)) {
      n++
      lastMatch = cur
      if (n >= rule.count!) break
    }
    cur = new Date(cur.getFullYear(), cur.getMonth(), cur.getDate() + 1)
  }
  const untilFromCount = lastMatch
  const existingUntil = rule.until != null ? startOfDay(toDate(rule.until) ?? untilFromCount) : null
  const until = existingUntil && existingUntil < untilFromCount ? existingUntil : untilFromCount
  return { ...base, until }
}

/** Whether `date` matches any of the given recurrence rule(s). */
export function matchesRecurrence(
  date: Date,
  rules: RecurrenceRule | ReadonlyArray<RecurrenceRule> | null | undefined,
): boolean {
  if (!rules) return false
  const list = Array.isArray(rules) ? rules : [rules as RecurrenceRule]
  return list.some((r) => matchesRule(date, r))
}

/** Every matching date within [start, end] (inclusive), in order - for building
 *  event lists / agendas. Bounded to avoid runaway loops. */
export function expandRecurrence(
  rules: RecurrenceRule | ReadonlyArray<RecurrenceRule> | null | undefined,
  start: Date,
  end: Date,
): Date[] {
  if (!rules) return []
  // Pre-resolve any `count` end-condition into a plain `until` once (rather than
  // re-walking to the Nth occurrence for every day in the window).
  const list = (Array.isArray(rules) ? rules : [rules]).map((r) =>
    r.count && r.count >= 1 && r.from != null ? resolveCount(r) : r,
  )
  const out: Date[] = []
  const last = startOfDay(end)
  let cur = startOfDay(start)
  let guard = 0
  while (cur <= last && guard++ < 4000) {
    if (matchesRecurrence(cur, list)) out.push(cur)
    cur = new Date(cur.getFullYear(), cur.getMonth(), cur.getDate() + 1)
  }
  return out
}

// --- human-readable summaries (for a table cell, a chip, a tooltip) ----------

/** Optional English strings a caller can override for i18n. */
export type RecurrenceLabels = {
  weekdays?: ReadonlyArray<string> // Sun..Sat
  months?: ReadonlyArray<string> // Jan..Dec
  ordinals?: Record<number, string> // 1..5 + -1
  never?: string
}
const WD = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MO = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const ORD: Record<number, string> = { 1: 'first', 2: 'second', 3: 'third', 4: 'fourth', 5: 'fifth', [-1]: 'last' }

// Where in the month a monthly / yearly rule lands, as a phrase.
function whereInMonth(r: RecurrenceRule, wd: ReadonlyArray<string>, ord: Record<number, string>): string {
  const firstWeekday = r.weekdays?.[0]
  if (r.weekOfMonth != null && firstWeekday != null) {
    return `the ${ord[r.weekOfMonth] ?? r.weekOfMonth} ${wd[firstWeekday]}`
  }
  if (r.day === -1) return 'the last day'
  if (r.day != null && r.day < 0) return `the ${-r.day} day(s) from the end`
  if (r.day != null) return `day ${r.day}`
  return ''
}

function describeRule(r: RecurrenceRule, L: Required<RecurrenceLabels>): string {
  const n = Math.max(1, Math.floor(r.interval ?? 1))
  let s = ''
  switch (r.freq) {
    case 'daily':
      s = n === 1 ? 'Daily' : `Every ${n} days`
      break
    case 'weekly': {
      s = n === 1 ? 'Weekly' : `Every ${n} weeks`
      const wds = r.weekdays && r.weekdays.length ? [...r.weekdays].sort((a, b) => a - b) : []
      if (wds.length) {
        const isWeekdays = wds.length === 5 && [1, 2, 3, 4, 5].every((d) => wds.includes(d))
        const isWeekend = wds.length === 2 && wds.includes(0) && wds.includes(6)
        s += isWeekdays ? ' on weekdays' : isWeekend ? ' on weekends' : ` on ${wds.map((d) => L.weekdays[d]).join(', ')}`
      }
      break
    }
    case 'monthly': {
      s = n === 1 ? 'Monthly' : `Every ${n} months`
      const where = whereInMonth(r, L.weekdays, L.ordinals)
      if (where) s += ` on ${where}`
      break
    }
    case 'yearly': {
      s = n === 1 ? 'Yearly' : `Every ${n} years`
      const where = whereInMonth(r, L.weekdays, L.ordinals)
      if (r.month != null && where) s += ` on ${where} of ${L.months[r.month]}`
      else if (r.month != null) s += ` in ${L.months[r.month]}`
      else if (where) s += ` on ${where}`
      break
    }
  }
  // End condition.
  if (r.count && r.count >= 1) s += `, ${r.count} time${r.count === 1 ? '' : 's'}`
  else if (r.until) {
    const u = toDate(r.until)
    if (u) s += ` until ${L.months[u.getMonth()]} ${u.getDate()}, ${u.getFullYear()}`
  }
  return s
}

/**
 * A short, human-readable summary of a recurrence rule (or list) - e.g.
 * "Weekly on weekdays", "Every 2 weeks on Fri, 8 times", "Monthly on the last
 * Friday", "Yearly on the fourth Thursday of Nov". Returns the `never` label
 * (default "") for an empty / falsy rule, so it drops cleanly into a table cell.
 */
export function describeRecurrence(
  rules: RecurrenceRule | ReadonlyArray<RecurrenceRule> | null | undefined,
  labels?: RecurrenceLabels,
): string {
  const L: Required<RecurrenceLabels> = {
    weekdays: labels?.weekdays ?? WD,
    months: labels?.months ?? MO,
    ordinals: labels?.ordinals ?? ORD,
    never: labels?.never ?? '',
  }
  if (!rules) return L.never
  const list = (Array.isArray(rules) ? rules : [rules]).filter((r) => r && r.freq)
  if (!list.length) return L.never
  return list.map((r) => describeRule(r, L)).join('; ')
}
