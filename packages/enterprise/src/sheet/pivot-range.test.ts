import { describe, expect, it } from 'vitest'
import {
  copyPivot, pivotBlock, pivotFields, pivotFromRange, pivotId, pivotRecords,
  pivotWrittenRect, shiftPivot, shiftPivots, type SheetPivot,
} from './pivot-range'
import type { Rect } from './format-store'
import type { CellValue } from './ast'

const rect = (r1: number, c1: number, r2: number, c2: number) => [r1, c1, r2, c2] as unknown as Rect

// Region / Quarter / Rep / Amount, the shape a pivot is made for.
const grid: CellValue[][] = [
  ['Region', 'Quarter', 'Amount'],
  ['North', 'Q1', 100],
  ['North', 'Q2', 150],
  ['South', 'Q1', 80],
  ['South', 'Q2', 120],
  ['South', 'Q2', 20],
]
const valueAt = (r: number, c: number) => grid[r]?.[c] ?? ''
const textAt = (r: number, c: number) => String(grid[r]?.[c] ?? '')

const pivot = (over: Partial<SheetPivot> = {}): SheetPivot => ({
  id: 'p1',
  source: rect(0, 0, 5, 2),
  target: { row: 0, col: 4 },
  rows: ['Region'],
  cols: [],
  values: [{ field: 'Amount', agg: 'sum' }],
  ...over,
})

describe('pivotFields and pivotRecords', () => {
  it('reads the header row and the body, naming a blank header after its column', () => {
    expect(pivotFields(rect(0, 0, 5, 2), textAt)).toEqual(['Region', 'Quarter', 'Amount'])
    expect(pivotFields(rect(0, 0, 5, 3), textAt)).toEqual(['Region', 'Quarter', 'Amount', 'Column D'])
    const records = pivotRecords(rect(0, 0, 5, 2), valueAt, textAt)
    expect(records).toHaveLength(5)
    expect(records[0]).toEqual({ Region: 'North', Quarter: 'Q1', Amount: 100 })
  })

  it('leaves a wholly empty row out', () => {
    const holes: CellValue[][] = [['A', 'B'], ['x', 1], ['', ''], ['y', 2]]
    expect(pivotRecords(rect(0, 0, 3, 1), (r, c) => holes[r]?.[c] ?? '', (r, c) => String(holes[r]?.[c] ?? ''))).toEqual([
      { A: 'x', B: 1 },
      { A: 'y', B: 2 },
    ])
  })
})

describe('pivotBlock', () => {
  it('writes a header row, a line per group and a grand total', () => {
    expect(pivotBlock(pivot(), valueAt, textAt)).toEqual([
      ['Region', 'Amount (sum)'],
      ['North', '250'],
      ['South', '220'],
      ['Grand total', '470'],
    ])
  })

  it('a column field becomes header rows, and the grand total column comes last', () => {
    const block = pivotBlock(pivot({ cols: ['Quarter'] }), valueAt, textAt)
    // One measure, so its name is not repeated under every column: the
    // column values carry the corner label instead.
    expect(block[0]).toEqual(['Region', 'Q1', 'Q2', 'Total'])
    expect(block.slice(1)).toEqual([
      ['North', '100', '150', '250'],
      ['South', '80', '140', '220'],
      ['Grand total', '180', '290', '470'],
    ])
  })

  it('the totals can be turned off, and a second measure is a second column', () => {
    const block = pivotBlock(
      pivot({ values: [{ field: 'Amount', agg: 'sum' }, { field: 'Amount', agg: 'count', label: 'Deals' }], grandTotalRow: false }),
      valueAt,
      textAt,
    )
    expect(block).toEqual([
      ['Region', 'Amount (sum)', 'Deals'],
      ['North', '250', '2'],
      ['South', '220', '3'],
    ])
    expect(pivotBlock(pivot({ values: [] }), valueAt, textAt)).toEqual([])
  })
})

describe('pivotFromRange, pivotWrittenRect and shifting', () => {
  it('opens on the first field down the rows and the last as the measure, clear of the source', () => {
    const made = pivotFromRange(rect(0, 0, 5, 2), ['Region', 'Quarter', 'Amount'])
    expect(made).toMatchObject({ rows: ['Region'], cols: [], values: [{ field: 'Amount', agg: 'sum' }] })
    expect(made.target).toEqual({ row: 0, col: 4 })
    expect(made.id).not.toBe(pivotId())
  })

  it('the written rectangle covers the block', () => {
    expect(pivotWrittenRect(pivot(), [['a', 'b'], ['c', 'd'], ['e', 'f']])).toEqual([0, 4, 2, 5])
  })

  it('moves the source and the target, and goes when either does', () => {
    const down = shiftPivot(pivot({ written: rect(0, 4, 3, 5) }), { kind: 'insertRows', at: 0, count: 2 })!
    expect(down.source).toEqual([2, 0, 7, 2])
    expect(down.target).toEqual({ row: 2, col: 4 })
    expect(down.written).toEqual([2, 4, 5, 5])
    expect(shiftPivot(pivot(), { kind: 'deleteCols', at: 0, count: 3 })).toBeNull()
    expect(shiftPivot(pivot(), { kind: 'deleteCols', at: 4, count: 1 })).toBeNull()
    expect(shiftPivots([pivot()], { kind: 'deleteCols', at: 4, count: 1 })).toEqual([])
  })

  it('a copy is its own', () => {
    const one = pivot()
    const two = copyPivot(one)
    expect(two).toEqual(one)
    expect(two.source).not.toBe(one.source)
    expect(two.values[0]).not.toBe(one.values[0])
  })
})
