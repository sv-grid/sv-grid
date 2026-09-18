import { describe, expect, it } from 'vitest'
import {
  clearSparklines,
  copySparkline,
  isColumnLocation,
  shiftSparkline,
  shiftSparklines,
  sparklineAt,
  sparklineId,
  sparklineScale,
  sparklineSeries,
  sparklinesFromRange,
  type SparklineGroup,
} from './sparklines'
import type { Rect } from './format-store'
import type { CellValue } from './ast'

const rect = (r1: number, c1: number, r2: number, c2: number) => [r1, c1, r2, c2] as unknown as Rect

// A block of three rows by four quarters, with the sparklines in column E.
const grid: CellValue[][] = [
  [10, 20, 30, 40, ''],
  [5, '', -15, 25, ''],
  ['x', 2, 4, 8, ''],
]
const valueAt = (r: number, c: number) => grid[r]?.[c] ?? ''

const group = (over: Partial<SparklineGroup> = {}): SparklineGroup => ({
  id: 's1',
  location: rect(0, 4, 2, 4),
  data: rect(0, 0, 2, 3),
  type: 'line',
  ...over,
})

describe('sparklineSeries', () => {
  it('reads the row of data that lines up with the cell', () => {
    expect(sparklineSeries(group(), 0, 4, valueAt)).toEqual([10, 20, 30, 40])
    // A blank and a text cell are zeros, not a break in the line.
    expect(sparklineSeries(group(), 1, 4, valueAt)).toEqual([5, 0, -15, 25])
    expect(sparklineSeries(group(), 2, 4, valueAt)).toEqual([0, 2, 4, 8])
  })

  it('reads a column of data for a group that runs along a row', () => {
    const along = group({ location: rect(3, 0, 3, 3), data: rect(0, 0, 2, 3) })
    expect(isColumnLocation(along)).toBe(false)
    expect(sparklineSeries(along, 3, 0, valueAt)).toEqual([10, 5, 0])
    expect(sparklineSeries(along, 3, 2, valueAt)).toEqual([30, -15, 4])
  })

  it('is null outside the location, and where the data has no line for the cell', () => {
    expect(sparklineSeries(group(), 0, 3, valueAt)).toBeNull()
    const short = group({ location: rect(0, 4, 5, 4) })
    expect(sparklineSeries(short, 4, 4, valueAt)).toBeNull()
  })
})

describe('sparklineScale', () => {
  it('is the whole block when the group shares one scale, and null when it does not', () => {
    expect(sparklineScale(group({ sameScale: true }), valueAt)).toEqual({ min: -15, max: 40 })
    expect(sparklineScale(group(), valueAt)).toBeNull()
    // One value everywhere would be a flat zero-height scale, so it is opened out.
    expect(sparklineScale(group({ sameScale: true, data: rect(0, 0, 0, 0) }), valueAt)).toEqual({ min: 9, max: 11 })
    expect(sparklineScale(group({ sameScale: true, data: rect(0, 4, 2, 4) }), valueAt)).toBeNull()
  })
})

describe('sparklinesFromRange', () => {
  it('puts the sparklines in the column past the block, one per row', () => {
    const made = sparklinesFromRange(rect(0, 0, 2, 3))
    expect(made).toMatchObject({ type: 'line', markers: true, data: [0, 0, 2, 3], location: [0, 4, 2, 4] })
    expect(made.id).not.toBe(sparklinesFromRange(rect(0, 0, 2, 3)).id)
    // A single row gets a single cell beside it.
    expect(sparklinesFromRange(rect(1, 0, 1, 3), 'column')).toMatchObject({ type: 'column', markers: false, location: [1, 4, 1, 4] })
  })
})

describe('shiftSparkline', () => {
  it('moves both rectangles, and goes when either does', () => {
    const down = shiftSparkline(group(), { kind: 'insertRows', at: 0, count: 2 })!
    expect(down.location).toEqual([2, 4, 4, 4])
    expect(down.data).toEqual([2, 0, 4, 3])
    const right = shiftSparkline(group(), { kind: 'insertCols', at: 0, count: 1 })!
    expect(right.location).toEqual([0, 5, 2, 5])
    expect(right.data).toEqual([0, 1, 2, 4])
    // The column the sparklines are drawn in is deleted.
    expect(shiftSparkline(group(), { kind: 'deleteCols', at: 4, count: 1 })).toBeNull()
    // The whole data block is deleted.
    expect(shiftSparkline(group(), { kind: 'deleteCols', at: 0, count: 4 })).toBeNull()
    expect(shiftSparklines([group(), group({ id: 's2' })], { kind: 'deleteCols', at: 4, count: 1 })).toEqual([])
  })

  it('a copy is its own', () => {
    const one = group()
    const two = copySparkline(one)
    expect(two).toEqual(one)
    expect(two.location).not.toBe(one.location)
    expect(two.data).not.toBe(one.data)
    expect(sparklineId()).not.toBe(sparklineId())
  })
})

describe('sparklineAt and clearSparklines', () => {
  it('finds the group a cell belongs to and clears the ones a selection touches', () => {
    const a = group({ id: 'a' })
    const b = group({ id: 'b', location: rect(5, 4, 6, 4), data: rect(5, 0, 6, 3) })
    expect(sparklineAt([a, b], 1, 4)?.id).toBe('a')
    expect(sparklineAt([a, b], 6, 4)?.id).toBe('b')
    expect(sparklineAt([a, b], 6, 1)).toBeNull()
    expect(clearSparklines([a, b], [rect(0, 0, 0, 9)])).toEqual([b])
    expect(clearSparklines([a, b], [rect(9, 9, 9, 9)])).toEqual([a, b])
  })
})
