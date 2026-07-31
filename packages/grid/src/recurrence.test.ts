import { describe, expect, it } from 'vitest'
import { matchesRecurrence, expandRecurrence, describeRecurrence, type RecurrenceRule } from './recurrence'

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

describe('matchesRecurrence - positional weekday-of-month', () => {
  it('the 1st Tuesday of the month', () => {
    const r: RecurrenceRule = { freq: 'monthly', weekdays: [2], weekOfMonth: 1 }
    expect(matchesRecurrence(D('2026-07-07'), r)).toBe(true) // 1st Tue of Jul
    expect(matchesRecurrence(D('2026-07-14'), r)).toBe(false) // 2nd Tue
    expect(matchesRecurrence(D('2026-08-04'), r)).toBe(true) // 1st Tue of Aug
  })

  it('the last Friday of the month', () => {
    const r: RecurrenceRule = { freq: 'monthly', weekdays: [5], weekOfMonth: -1 }
    expect(matchesRecurrence(D('2026-07-31'), r)).toBe(true) // last Fri of Jul
    expect(matchesRecurrence(D('2026-07-24'), r)).toBe(false) // 4th but not last
    expect(matchesRecurrence(D('2026-08-28'), r)).toBe(true) // last Fri of Aug
  })

  it('yearly positional: the 2nd Monday of November', () => {
    const r: RecurrenceRule = { freq: 'yearly', month: 10, weekdays: [1], weekOfMonth: 2 }
    expect(matchesRecurrence(D('2026-11-09'), r)).toBe(true) // 2nd Mon of Nov 2026
    expect(matchesRecurrence(D('2026-11-16'), r)).toBe(false) // 3rd Mon
    expect(matchesRecurrence(D('2026-10-12'), r)).toBe(false) // wrong month
  })
})

describe('matchesRecurrence - last day of month + count', () => {
  it('the last day of the month (day: -1) across month lengths', () => {
    const r: RecurrenceRule = { freq: 'monthly', day: -1 }
    expect(matchesRecurrence(D('2026-07-31'), r)).toBe(true) // 31-day month
    expect(matchesRecurrence(D('2026-02-28'), r)).toBe(true) // 28-day Feb
    expect(matchesRecurrence(D('2026-02-27'), r)).toBe(false)
    expect(matchesRecurrence(D('2026-06-30'), r)).toBe(true) // 30-day month
  })

  it('ends after N occurrences (count)', () => {
    // 3 weekly Mondays from Jul 6: Jul 6, 13, 20 - then stop.
    const r: RecurrenceRule = { freq: 'weekly', weekdays: [1], from: D('2026-07-06'), count: 3 }
    expect(matchesRecurrence(D('2026-07-06'), r)).toBe(true)
    expect(matchesRecurrence(D('2026-07-20'), r)).toBe(true) // 3rd
    expect(matchesRecurrence(D('2026-07-27'), r)).toBe(false) // 4th - past the count
  })
})

describe('expandRecurrence', () => {
  it('lists the matching dates in a range', () => {
    const r: RecurrenceRule = { freq: 'weekly', weekdays: [1] } // Mondays
    const dates = expandRecurrence(r, D('2026-07-01'), D('2026-07-31')).map((d) => d.getDate())
    expect(dates).toEqual([6, 13, 20, 27])
  })

  it('stops after `count` occurrences even in a wider window', () => {
    const r: RecurrenceRule = { freq: 'weekly', weekdays: [1], from: D('2026-07-06'), count: 3 }
    const dates = expandRecurrence(r, D('2026-07-01'), D('2026-08-31')).map((d) => d.getDate())
    expect(dates).toEqual([6, 13, 20]) // exactly 3, not every Monday
  })
})

describe('describeRecurrence - human-readable summaries', () => {
  it('empty / falsy rules read as the never label (default blank)', () => {
    expect(describeRecurrence(null)).toBe('')
    expect(describeRecurrence([])).toBe('')
    expect(describeRecurrence(undefined, { never: 'Does not repeat' })).toBe('Does not repeat')
  })

  it('daily + weekly', () => {
    expect(describeRecurrence({ freq: 'daily' })).toBe('Daily')
    expect(describeRecurrence({ freq: 'daily', interval: 2 })).toBe('Every 2 days')
    expect(describeRecurrence({ freq: 'weekly', weekdays: [1, 2, 3, 4, 5] })).toBe('Weekly on weekdays')
    expect(describeRecurrence({ freq: 'weekly', weekdays: [0, 6] })).toBe('Weekly on weekends')
    expect(describeRecurrence({ freq: 'weekly', weekdays: [1, 3] })).toBe('Weekly on Mon, Wed')
    expect(describeRecurrence({ freq: 'weekly', weekdays: [5], interval: 2 })).toBe('Every 2 weeks on Fri')
  })

  it('monthly + yearly, positional + last day', () => {
    expect(describeRecurrence({ freq: 'monthly', day: 1 })).toBe('Monthly on day 1')
    expect(describeRecurrence({ freq: 'monthly', day: -1 })).toBe('Monthly on the last day')
    expect(describeRecurrence({ freq: 'monthly', weekdays: [5], weekOfMonth: -1 })).toBe('Monthly on the last Fri')
    expect(describeRecurrence({ freq: 'yearly', month: 10, weekdays: [4], weekOfMonth: 4 })).toBe(
      'Yearly on the fourth Thu of Nov',
    )
    expect(describeRecurrence({ freq: 'yearly', month: 11, day: 25 })).toBe('Yearly on day 25 of Dec')
  })

  it('appends the end condition (count / until)', () => {
    expect(describeRecurrence({ freq: 'weekly', weekdays: [1], count: 8 })).toBe('Weekly on Mon, 8 times')
    expect(describeRecurrence({ freq: 'daily', until: D('2026-12-31') })).toBe('Daily until Dec 31, 2026')
  })

  it('joins a list of rules', () => {
    const rules: RecurrenceRule[] = [
      { freq: 'weekly', weekdays: [1] },
      { freq: 'monthly', day: 1 },
    ]
    expect(describeRecurrence(rules)).toBe('Weekly on Mon; Monthly on day 1')
  })
})
