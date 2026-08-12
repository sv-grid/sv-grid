import { describe, expect, it } from 'vitest'
import { commonFree, mergeBusy } from './scheduler-freebusy'
import type { Interval } from './scheduler-slots'

const D = (h: number, m = 0) => new Date(2026, 0, 5, h, m, 0, 0)
const iv = (sh: number, sm: number, eh: number, em: number): Interval => ({ start: D(sh, sm), end: D(eh, em) })
const hhmm = (d: Date) => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
const show = (list: Interval[]) => list.map((s) => `${hhmm(s.start)}-${hhmm(s.end)}`)

describe('mergeBusy', () => {
  it('unions overlapping busy blocks', () => {
    expect(show(mergeBusy([iv(9, 0, 10, 0), iv(9, 30, 11, 0)]))).toEqual(['09:00-11:00'])
  })
})

describe('commonFree', () => {
  const day = [D(9, 0), D(17, 0)] as const

  it('finds windows when everyone is free', () => {
    // A busy 9-10 and 14-15; B busy 11-12. Common free: 10-11, 12-14, 15-17.
    const busy = [[iv(9, 0, 10, 0), iv(14, 0, 15, 0)], [iv(11, 0, 12, 0)]]
    expect(show(commonFree(busy, day[0], day[1], 30))).toEqual(['10:00-11:00', '12:00-14:00', '15:00-17:00'])
  })

  it('drops windows too short for the meeting', () => {
    // Leaves only 10:00-10:30 free between busy blocks -> a 60-min meeting has none.
    const busy = [[iv(9, 0, 10, 0)], [iv(10, 30, 17, 0)]]
    expect(commonFree(busy, day[0], day[1], 60)).toEqual([])
    expect(show(commonFree(busy, day[0], day[1], 30))).toEqual(['10:00-10:30'])
  })

  it('treats an attendee with no busy list as fully free', () => {
    const busy = [[iv(12, 0, 13, 0)], []]
    expect(show(commonFree(busy, day[0], day[1], 60))).toEqual(['09:00-12:00', '13:00-17:00'])
  })

  it('returns nothing when the union covers the whole day', () => {
    const busy = [[iv(9, 0, 13, 0)], [iv(13, 0, 17, 0)]]
    expect(commonFree(busy, day[0], day[1], 15)).toEqual([])
  })
})
