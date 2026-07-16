/**
 * Unit tests for date-core math. These are written to be *discriminating*: each
 * asserts a value that a plausible mutation (off-by-one, wrong operator, dropped
 * clamp) would break - not just "does not throw".
 */
import { describe, expect, it } from 'vitest'
import {
  toDate,
  startOfDay,
  startOfMonth,
  endOfMonth,
  daysInMonth,
  startOfWeek,
  isSameDay,
  isSameMonth,
  compareDay,
  addDays,
  addMonths,
  addYears,
  clampDate,
  isoWeek,
  decadeRange,
  centuryRange,
  monthMatrix,
  weekdayOrder,
  withTime,
  snapMinute,
} from './date-core'

describe('toDate', () => {
  it('passes through valid Date/number/string and clones Dates', () => {
    const d = new Date(2026, 5, 15)
    const out = toDate(d)!
    expect(out.getTime()).toBe(d.getTime())
    expect(out).not.toBe(d) // clone, not same ref
    expect(toDate(d.getTime())!.getTime()).toBe(d.getTime())
    expect(toDate('2026-06-15T00:00:00')!.getFullYear()).toBe(2026)
  })
  it('returns null for null/undefined/invalid', () => {
    expect(toDate(null)).toBeNull()
    expect(toDate(undefined)).toBeNull()
    expect(toDate('not-a-date')).toBeNull()
    expect(toDate(NaN)).toBeNull()
  })
})

describe('startOfDay / month boundaries', () => {
  it('strips time to local midnight', () => {
    const d = startOfDay(new Date(2026, 2, 9, 13, 45, 30, 500))
    expect([d.getHours(), d.getMinutes(), d.getSeconds(), d.getMilliseconds()]).toEqual([0, 0, 0, 0])
    expect(d.getDate()).toBe(9)
  })
  it('startOfMonth / endOfMonth / daysInMonth', () => {
    const mid = new Date(2026, 1, 14) // Feb 2026 (28 days)
    expect(startOfMonth(mid).getDate()).toBe(1)
    expect(endOfMonth(mid).getDate()).toBe(28)
    expect(daysInMonth(mid)).toBe(28)
    expect(daysInMonth(new Date(2024, 1, 1))).toBe(29) // leap year
    expect(daysInMonth(new Date(2026, 0, 1))).toBe(31)
  })
})

describe('startOfWeek', () => {
  it('honors firstDayOfWeek=0 (Sunday)', () => {
    // 2026-06-15 is a Monday.
    const s = startOfWeek(new Date(2026, 5, 15), 0)
    expect(s.getDay()).toBe(0)
    expect(s.getDate()).toBe(14) // the Sunday before
  })
  it('honors firstDayOfWeek=1 (Monday)', () => {
    const s = startOfWeek(new Date(2026, 5, 15), 1)
    expect(s.getDay()).toBe(1)
    expect(s.getDate()).toBe(15) // Monday itself
  })
  it('wraps correctly when day < firstDayOfWeek', () => {
    // Sunday 2026-06-14 with week starting Monday -> previous Monday (Jun 8)
    const s = startOfWeek(new Date(2026, 5, 14), 1)
    expect(s.getDate()).toBe(8)
  })
})

describe('sameness + comparison', () => {
  it('isSameDay ignores time, isSameMonth ignores day', () => {
    expect(isSameDay(new Date(2026, 5, 15, 9), new Date(2026, 5, 15, 23))).toBe(true)
    expect(isSameDay(new Date(2026, 5, 15), new Date(2026, 5, 16))).toBe(false)
    expect(isSameDay(null, new Date())).toBe(false)
    expect(isSameMonth(new Date(2026, 5, 1), new Date(2026, 5, 30))).toBe(true)
    expect(isSameMonth(new Date(2026, 5, 30), new Date(2026, 6, 1))).toBe(false)
  })
  it('compareDay returns -1/0/1 by day', () => {
    expect(compareDay(new Date(2026, 5, 15, 23), new Date(2026, 5, 15, 1))).toBe(0)
    expect(compareDay(new Date(2026, 5, 14), new Date(2026, 5, 15))).toBe(-1)
    expect(compareDay(new Date(2026, 5, 16), new Date(2026, 5, 15))).toBe(1)
  })
})

describe('addDays / addMonths / addYears clamping', () => {
  it('addDays crosses month boundary', () => {
    expect(addDays(new Date(2026, 0, 31), 1).getMonth()).toBe(1) // -> Feb 1
    expect(addDays(new Date(2026, 5, 15), -20).getMonth()).toBe(4) // -> May
  })
  it('addMonths clamps day-of-month (Jan 31 + 1mo = Feb 28)', () => {
    const r = addMonths(new Date(2026, 0, 31), 1)
    expect(r.getMonth()).toBe(1)
    expect(r.getDate()).toBe(28) // NOT March 3
  })
  it('addMonths preserves time-of-day', () => {
    const r = addMonths(new Date(2026, 0, 15, 8, 30), 2)
    expect([r.getHours(), r.getMinutes()]).toEqual([8, 30])
    expect(r.getMonth()).toBe(2)
  })
  it('addYears clamps Feb 29 -> Feb 28 on non-leap target', () => {
    const r = addYears(new Date(2024, 1, 29), 1)
    expect(r.getFullYear()).toBe(2025)
    expect(r.getMonth()).toBe(1)
    expect(r.getDate()).toBe(28)
  })
})

describe('clampDate', () => {
  const min = new Date(2026, 0, 1)
  const max = new Date(2026, 11, 31)
  it('clamps below min and above max, passes through inside', () => {
    expect(clampDate(new Date(2025, 5, 1), min, max).getTime()).toBe(min.getTime())
    expect(clampDate(new Date(2027, 5, 1), min, max).getTime()).toBe(max.getTime())
    const inside = new Date(2026, 5, 1)
    expect(clampDate(inside, min, max).getTime()).toBe(inside.getTime())
  })
  it('treats null bounds as open', () => {
    const d = new Date(1000, 0, 1)
    expect(clampDate(d, null, null).getTime()).toBe(d.getTime())
  })
})

describe('isoWeek', () => {
  it('matches known ISO week numbers', () => {
    // 2026-01-01 is a Thursday -> ISO week 1.
    expect(isoWeek(new Date(2026, 0, 1))).toBe(1)
    // 2026-06-15 (Mon) -> ISO week 25.
    expect(isoWeek(new Date(2026, 5, 15))).toBe(25)
    // 2027-01-01 is a Friday -> belongs to ISO week 53 of 2026.
    expect(isoWeek(new Date(2027, 0, 1))).toBe(53)
    // 2024-12-30 (Mon) -> ISO week 1 of 2025.
    expect(isoWeek(new Date(2024, 11, 30))).toBe(1)
  })
})

describe('decadeRange / centuryRange', () => {
  it('decade block anchors to the base-10 start', () => {
    expect(decadeRange(2026)).toEqual({ start: 2020, end: 2029 })
    expect(decadeRange(2020)).toEqual({ start: 2020, end: 2029 })
    expect(decadeRange(2019)).toEqual({ start: 2010, end: 2019 })
  })
  it('century block anchors to the base-100 start', () => {
    expect(centuryRange(2026)).toEqual({ start: 2000, end: 2099 })
    expect(centuryRange(1999)).toEqual({ start: 1900, end: 1999 })
  })
})

describe('monthMatrix', () => {
  it('produces weeks x 7 cells starting on firstDayOfWeek', () => {
    const m = monthMatrix(new Date(2026, 5, 15), 0, 6) // June 2026, Sunday-first
    expect(m.length).toBe(6)
    expect(m.every((row) => row.length === 7)).toBe(true)
    // Every first cell of a row is the configured first weekday.
    expect(m.every((row) => row[0]!.date.getDay() === 0)).toBe(true)
    // June 1 2026 is a Monday, so the grid starts on Sunday May 31.
    expect(m[0]![0]!.date.getMonth()).toBe(4)
    expect(m[0]![0]!.date.getDate()).toBe(31)
    expect(m[0]![0]!.inMonth).toBe(false)
    expect(m[0]![1]!.inMonth).toBe(true) // June 1
    expect(m[0]![1]!.date.getDate()).toBe(1)
  })
  it('honors firstDayOfWeek=1 (Monday-first grid)', () => {
    const m = monthMatrix(new Date(2026, 5, 15), 1, 6)
    expect(m.every((row) => row[0]!.date.getDay() === 1)).toBe(true)
    // June 1 2026 is Monday, so the first cell IS June 1.
    expect(m[0]![0]!.date.getDate()).toBe(1)
    expect(m[0]![0]!.inMonth).toBe(true)
  })
  it('tags cells with an ISO week number', () => {
    const m = monthMatrix(new Date(2026, 0, 1), 1, 6)
    expect(m[0]![0]!.week).toBe(isoWeek(m[0]![0]!.date))
  })
})

describe('weekdayOrder', () => {
  it('rotates the 0-6 sequence by firstDayOfWeek', () => {
    expect(weekdayOrder(0)).toEqual([0, 1, 2, 3, 4, 5, 6])
    expect(weekdayOrder(1)).toEqual([1, 2, 3, 4, 5, 6, 0])
    expect(weekdayOrder(6)).toEqual([6, 0, 1, 2, 3, 4, 5])
  })
})

describe('withTime', () => {
  it('grafts time-of-day onto a calendar day', () => {
    const day = new Date(2026, 5, 15)
    const time = new Date(2000, 0, 1, 14, 25, 9, 123)
    const r = withTime(day, time)
    expect([r.getFullYear(), r.getMonth(), r.getDate()]).toEqual([2026, 5, 15])
    expect([r.getHours(), r.getMinutes(), r.getSeconds(), r.getMilliseconds()]).toEqual([14, 25, 9, 123])
  })
})

describe('snapMinute', () => {
  it('snaps down to the nearest interval multiple', () => {
    expect(snapMinute(0, 15)).toBe(0)
    expect(snapMinute(14, 15)).toBe(0)
    expect(snapMinute(15, 15)).toBe(15)
    expect(snapMinute(59, 15)).toBe(45)
    expect(snapMinute(37, 5)).toBe(35)
  })
  it('interval < 1 behaves as 1 (no snapping)', () => {
    expect(snapMinute(37, 0)).toBe(37)
    expect(snapMinute(37, 1)).toBe(37)
  })
})
