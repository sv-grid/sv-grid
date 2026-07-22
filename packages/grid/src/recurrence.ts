/**
 * recurrence - a small, pure repeat-pattern engine for SvCalendar (and anywhere
 * you need "does this date match a recurring rule"). Supports daily / weekly /
 * monthly / yearly frequencies with an interval, weekday lists, a day-of-month,
 * an anchor (`from`) and an inclusive `until`. Framework-free + pure so it is
 * unit-tested directly - no RRULE dependency.
 *
 * ```ts
 * const standup = { freq: 'weekly', weekdays: [1, 2, 3, 4, 5] } // every weekday
 * const payday  = { freq: 'monthly', day: 1 }                   // the 1st
 * const sprint  = { freq: 'weekly', weekdays: [1], interval: 2, from: '2026-01-05' } // every other Monday
 * matchesRecurrence(someDate, [standup, payday, sprint])
 * ```
 */
import { startOfDay, startOfWeek, toDate, type DateLike } from './datetime/date-core'

export type RecurrenceFreq = 'daily' | 'weekly' | 'monthly' | 'yearly'

export type RecurrenceRule = {
  freq: RecurrenceFreq
  /** Repeat every N units of `freq`. Default 1. Uses `from` as the phase anchor. */
  interval?: number
  /** weekly: the weekdays it lands on (0 = Sunday .. 6 = Saturday). */
  weekdays?: ReadonlyArray<number>
  /** monthly / yearly: day of the month (1..31). */
  day?: number
  /** yearly: the month (0 = January .. 11 = December). */
  month?: number
  /** First occurrence + the phase for `interval`. */
  from?: DateLike
  /** Last day the pattern applies (inclusive). */
  until?: DateLike | null
}

const MS_DAY = 86_400_000
/** Whole-day index, rounded so DST transitions don't shift it. */
const dayIndex = (d: Date) => Math.round(startOfDay(d).getTime() / MS_DAY)

function matchesRule(date: Date, r: RecurrenceRule): boolean {
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
      const dom = r.day ?? fromD?.getDate()
      if (dom != null && d.getDate() !== dom) return false
      if (!fromD) return dom != null
      const months = (d.getFullYear() - fromD.getFullYear()) * 12 + (d.getMonth() - fromD.getMonth())
      return months % interval === 0
    }

    case 'yearly': {
      if (r.month != null && d.getMonth() !== r.month) return false
      const dom = r.day ?? fromD?.getDate()
      if (dom != null && d.getDate() !== dom) return false
      if (!fromD) return r.month != null || dom != null
      return (d.getFullYear() - fromD.getFullYear()) % interval === 0
    }
  }
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
  const out: Date[] = []
  const last = startOfDay(end)
  let cur = startOfDay(start)
  let guard = 0
  while (cur <= last && guard++ < 4000) {
    if (matchesRecurrence(cur, rules)) out.push(cur)
    cur = new Date(cur.getFullYear(), cur.getMonth(), cur.getDate() + 1)
  }
  return out
}
