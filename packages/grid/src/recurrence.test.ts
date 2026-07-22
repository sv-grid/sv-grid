import { describe, expect, it } from 'vitest'
import { matchesRecurrence, expandRecurrence, type RecurrenceRule } from './recurrence'

// Fixed reference dates (local time). 2026-07-01 is a Wednesday.
const D = (s: string) => new Date(`${s}T00:00:00`)

describe('matchesRecurrence - weekly', () => {
  const weekdays: RecurrenceRule = { freq: 'weekly', weekdays: [1, 2, 3, 4, 5] } // Mon..Fri
  it('matches weekdays, not weekends', () => {
    expect(matchesRecurrence(D('2026-07-06'), weekdays)).toBe(true) // Monday
    expect(matchesRecurrence(D('2026-07-10'), weekdays)).toBe(true) // Friday
    expect(matchesRecurrence(D('2026-07-11'), weekdays)).toBe(false) // Saturday
    expect(matchesRecurrence(D('2026-07-12'), weekdays)).toBe(false) // Sunday
  })

  it('every other Monday with an interval + anchor', () => {
    const r: RecurrenceRule = { freq: 'weekly', weekdays: [1], interval: 2, from: D('2026-07-06') }
    expect(matchesRecurrence(D('2026-07-06'), r)).toBe(true) // anchor Monday
    expect(matchesRecurrence(D('2026-07-13'), r)).toBe(false) // next Monday (odd week)
    expect(matchesRecurrence(D('2026-07-20'), r)).toBe(true) // +2 weeks
    expect(matchesRecurrence(D('2026-07-07'), r)).toBe(false) // Tuesday
  })

  it("falls back to the anchor's weekday when no weekdays given", () => {
    const r: RecurrenceRule = { freq: 'weekly', from: D('2026-07-01') } // Wednesday
    expect(matchesRecurrence(D('2026-07-08'), r)).toBe(true) // Wednesday
    expect(matchesRecurrence(D('2026-07-09'), r)).toBe(false) // Thursday
  })
})

describe('matchesRecurrence - monthly / yearly / daily', () => {
  it('monthly on a day-of-month', () => {
    const r: RecurrenceRule = { freq: 'monthly', day: 1 }
    expect(matchesRecurrence(D('2026-07-01'), r)).toBe(true)
    expect(matchesRecurrence(D('2026-08-01'), r)).toBe(true)
    expect(matchesRecurrence(D('2026-08-02'), r)).toBe(false)
  })

  it('monthly with an interval + anchor (every 3 months, the 15th)', () => {
    const r: RecurrenceRule = { freq: 'monthly', day: 15, interval: 3, from: D('2026-01-15') }
    expect(matchesRecurrence(D('2026-01-15'), r)).toBe(true)
    expect(matchesRecurrence(D('2026-02-15'), r)).toBe(false)
    expect(matchesRecurrence(D('2026-04-15'), r)).toBe(true)
  })

  it('yearly on a month + day', () => {
    const r: RecurrenceRule = { freq: 'yearly', month: 11, day: 25 } // Dec 25
    expect(matchesRecurrence(D('2026-12-25'), r)).toBe(true)
    expect(matchesRecurrence(D('2027-12-25'), r)).toBe(true)
    expect(matchesRecurrence(D('2026-12-24'), r)).toBe(false)
  })

  it('daily every N days from an anchor', () => {
    const r: RecurrenceRule = { freq: 'daily', interval: 3, from: D('2026-07-01') }
    expect(matchesRecurrence(D('2026-07-01'), r)).toBe(true)
    expect(matchesRecurrence(D('2026-07-02'), r)).toBe(false)
    expect(matchesRecurrence(D('2026-07-04'), r)).toBe(true)
  })
})

describe('matchesRecurrence - bounds + combining', () => {
  it('respects from / until', () => {
    const r: RecurrenceRule = { freq: 'daily', from: D('2026-07-05'), until: D('2026-07-08') }
    expect(matchesRecurrence(D('2026-07-04'), r)).toBe(false) // before
    expect(matchesRecurrence(D('2026-07-06'), r)).toBe(true) // inside
    expect(matchesRecurrence(D('2026-07-09'), r)).toBe(false) // after until
  })

  it('matches if ANY rule in a list matches', () => {
    const rules: RecurrenceRule[] = [
      { freq: 'weekly', weekdays: [1] }, // Mondays
      { freq: 'monthly', day: 1 }, // the 1st
    ]
    expect(matchesRecurrence(D('2026-07-06'), rules)).toBe(true) // Monday
    expect(matchesRecurrence(D('2026-07-01'), rules)).toBe(true) // the 1st (a Wednesday)
    expect(matchesRecurrence(D('2026-07-02'), rules)).toBe(false)
  })

  it('returns false for empty / nullish rules', () => {
    expect(matchesRecurrence(D('2026-07-01'), null)).toBe(false)
    expect(matchesRecurrence(D('2026-07-01'), [])).toBe(false)
  })
})

describe('expandRecurrence', () => {
  it('lists the matching dates in a range', () => {
    const r: RecurrenceRule = { freq: 'weekly', weekdays: [1] } // Mondays
    const dates = expandRecurrence(r, D('2026-07-01'), D('2026-07-31')).map((d) => d.getDate())
    expect(dates).toEqual([6, 13, 20, 27])
  })
})
