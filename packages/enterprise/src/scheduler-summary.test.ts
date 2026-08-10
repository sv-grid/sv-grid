import { describe, expect, it } from 'vitest'
import { busyMinutesReducer, columnSummaries, sumReducer } from './scheduler-summary'

type Row = { id: string; amount: number }
type Ev = { row: Row; start: Date; end: Date }
const D = (h: number) => new Date(2026, 0, 5, h, 0, 0, 0)
const ev = (id: string, s: number, e: number, amount: number): Ev => ({ row: { id, amount }, start: D(s), end: D(e) })

const opts = { startOf: (e: Ev) => e.start, endOf: (e: Ev) => e.end, rowOf: (e: Ev) => e.row }
const cols = [
  { start: D(9), end: D(10) },
  { start: D(10), end: D(11) },
  { start: D(11), end: D(12) },
]

describe('columnSummaries', () => {
  it('counts events overlapping each column', () => {
    const events = [ev('a', 9, 11, 5), ev('b', 10, 12, 3)] // a in cols 0,1; b in cols 1,2
    expect(columnSummaries(events, cols, 'count', opts)).toEqual([1, 2, 1])
  })

  it('sums a numeric field per column', () => {
    const events = [ev('a', 9, 11, 5), ev('b', 10, 12, 3)]
    expect(columnSummaries(events, cols, sumReducer<Row>('amount'), opts)).toEqual([5, 8, 3])
  })

  it('yields 0 for empty columns', () => {
    expect(columnSummaries([], cols, 'count', opts)).toEqual([0, 0, 0])
    expect(columnSummaries([], cols, sumReducer<Row>('amount'), opts)).toEqual([0, 0, 0])
  })

  it('clips events to the column for a busy-minutes reducer', () => {
    const events = [ev('a', 9, 12, 0)] // spans all three hours
    // Each column is 1h; the event contributes 60 clipped minutes to each.
    expect(columnSummaries(events, cols, busyMinutesReducer<Row>(), opts)).toEqual([60, 60, 60])
  })

  it('passes column-clipped items to a custom reducer', () => {
    const events = [ev('a', 9, 12, 0)]
    const seen: number[] = []
    columnSummaries(events, cols, (items) => {
      seen.push(items.length ? (items[0]!.end.getTime() - items[0]!.start.getTime()) / 60000 : 0)
      return items.length
    }, opts)
    expect(seen).toEqual([60, 60, 60]) // clipped to each 1h column
  })
})
