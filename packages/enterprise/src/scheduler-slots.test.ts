import { describe, expect, it } from 'vitest'
import { availableSlots, mergeIntervals, subtractIntervals, type Interval } from './scheduler-slots'

const D = (h: number, m = 0) => new Date(2026, 0, 5, h, m, 0, 0)
const iv = (sh: number, sm: number, eh: number, em: number): Interval => ({ start: D(sh, sm), end: D(eh, em) })
const hhmm = (d: Date) => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
const show = (slots: { start: Date; end: Date }[]) => slots.map((s) => `${hhmm(s.start)}-${hhmm(s.end)}`)

describe('mergeIntervals', () => {
  it('merges overlapping and touching intervals', () => {
    expect(show(mergeIntervals([iv(9, 0, 10, 0), iv(9, 30, 11, 0), iv(11, 0, 12, 0)]))).toEqual(['09:00-12:00'])
  })
})

describe('subtractIntervals', () => {
  it('cuts occupied blocks out of a base window', () => {
    const free = subtractIntervals(iv(9, 0, 17, 0), [iv(12, 0, 13, 0)])
    expect(show(free)).toEqual(['09:00-12:00', '13:00-17:00'])
  })
})

describe('availableSlots', () => {
  it('fills an empty working window with back-to-back slots', () => {
    const slots = availableSlots({ working: [iv(9, 0, 12, 0)], busy: [], durationMin: 60 })
    expect(show(slots)).toEqual(['09:00-10:00', '10:00-11:00', '11:00-12:00'])
  })

  it('removes slots that hit a busy booking', () => {
    const slots = availableSlots({ working: [iv(9, 0, 12, 0)], busy: [iv(10, 0, 11, 0)], durationMin: 60 })
    expect(show(slots)).toEqual(['09:00-10:00', '11:00-12:00'])
  })

  it('buffers widen what a booking blocks', () => {
    // busy 10:00-11:00 with a 15-min buffer blocks 09:45-11:15, so the 09:00 slot
    // (ends 10:00 > 09:45) is gone and only 11:15+ is free (no 60-min slot fits before 12:00).
    const slots = availableSlots({ working: [iv(9, 0, 12, 0)], busy: [iv(10, 0, 11, 0)], durationMin: 60, bufferBeforeMin: 15, bufferAfterMin: 15 })
    expect(show(slots)).toEqual([]) // 09:00-09:45 too short for 60m; 11:15-12:00 too short
  })

  it('honours a smaller step (overlapping start times)', () => {
    const slots = availableSlots({ working: [iv(9, 0, 10, 30)], busy: [], durationMin: 60, stepMin: 30 })
    expect(show(slots)).toEqual(['09:00-10:00', '09:30-10:30'])
  })

  it('drops slots before minStart (lead time)', () => {
    const slots = availableSlots({ working: [iv(9, 0, 12, 0)], busy: [], durationMin: 60, minStart: D(10, 0) })
    expect(show(slots)).toEqual(['10:00-11:00', '11:00-12:00'])
  })

  it('returns nothing when the duration cannot fit', () => {
    expect(availableSlots({ working: [iv(9, 0, 9, 45)], busy: [], durationMin: 60 })).toEqual([])
  })
})
