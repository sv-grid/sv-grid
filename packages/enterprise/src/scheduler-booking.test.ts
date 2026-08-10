import { describe, expect, it } from 'vitest'
import { afterLead, respectsBuffer, withinDurationBounds, type BusyEvent } from './scheduler-booking'

const D = (h: number, m = 0) => new Date(2026, 0, 5, h, m, 0, 0)
const ev = (key: string, sh: number, eh: number, data?: unknown): BusyEvent => ({ key, start: D(sh), end: D(eh), data })

describe('respectsBuffer', () => {
  const others = [ev('a', 9, 10), ev('b', 13, 14)]

  it('passes when the gap before and after is large enough', () => {
    // book 11:00-12:00: 60 min after a(ends 10), 60 min before b(starts 13) -> ok for 30/30 buffers
    expect(respectsBuffer(D(11), D(12), others, 30, 30)).toBe(true)
  })
  it('rejects a direct overlap', () => {
    expect(respectsBuffer(D(9, 30), D(10, 30), others, 0, 0)).toBe(false)
  })
  it('rejects when the gap before is too small', () => {
    // book 10:15-11:00: only 15 min after a(ends 10); need 30 -> reject
    expect(respectsBuffer(D(10, 15), D(11), others, 30, 30)).toBe(false)
  })
  it('rejects when the gap after is too small', () => {
    // book 12:00-12:45: only 15 min before b(starts 13); need 30 -> reject
    expect(respectsBuffer(D(12), D(12, 45), others, 30, 30)).toBe(false)
  })
  it('excludes the moving booking by key', () => {
    const set = [ev('self', 11, 12), ev('a', 9, 10)]
    // moving self to 10:00-10:30 would clash with its own old slot unless excluded
    expect(respectsBuffer(D(10), D(10, 30), set, 0, 0, 'self')).toBe(true)
  })
  it('supports a per-neighbour gap (travel time by location)', () => {
    const jobs = [ev('a', 9, 10, 'north'), ev('b', 13, 14, 'south')]
    const travel = (n: BusyEvent) => (n.data === 'south' ? 90 : 20) // 90 min to/from south
    // book 11:00-12:00: 60 min before b(south) but travel needs 90 -> reject
    expect(respectsBuffer(D(11), D(12), jobs, travel, travel)).toBe(false)
    // 11:00-11:30 leaves 90 before b -> ok
    expect(respectsBuffer(D(11), D(11, 30), jobs, travel, travel)).toBe(true)
  })
})

describe('withinDurationBounds', () => {
  it('enforces min and max minutes', () => {
    expect(withinDurationBounds(D(9), D(9, 30), 30, 90)).toBe(true)
    expect(withinDurationBounds(D(9), D(9, 15), 30, 90)).toBe(false) // too short
    expect(withinDurationBounds(D(9), D(11), 30, 90)).toBe(false) // too long
  })
  it('treats undefined bounds as unbounded', () => {
    expect(withinDurationBounds(D(9), D(15), undefined, undefined)).toBe(true)
  })
})

describe('afterLead', () => {
  it('requires the start to be at least leadMin after now', () => {
    const now = D(10)
    expect(afterLead(D(12), now, 120)).toBe(true) // exactly 120 min ahead
    expect(afterLead(D(11), now, 120)).toBe(false) // only 60 min ahead
  })
})
