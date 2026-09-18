import { describe, expect, it } from 'vitest'
import { sortOrder, guessHeaderRow } from './sort'
import type { CellValue } from './ast'

const grid: CellValue[][] = [
  ['Region', 'Rep', 'Amount'],
  ['West', 'bo', 30],
  ['East', 'Al', 10],
  ['west', 'Cy', 20],
  ['East', 'al', 5],
  ['', 'Di', 40],
  ['North', 'Ed', 'n/a'],
]
const at = (r: number, c: number): CellValue => grid[r]?.[c] ?? ''
const rows = [1, 2, 3, 4, 5, 6]

describe('sortOrder', () => {
  it('sorts by one key: numbers first, then text, then errors, blanks last', () => {
    // 'n/a' is text, so it sorts after every number going up and before
    // them going down; there is no blank in the column.
    expect(sortOrder(rows, [{ col: 2, direction: 'asc' }], at)).toEqual([4, 2, 3, 1, 5, 6])
    expect(sortOrder(rows, [{ col: 2, direction: 'desc' }], at)).toEqual([6, 5, 1, 3, 2, 4])
  })

  it('compares text without regard to case, and keeps ties in their order', () => {
    expect(sortOrder(rows, [{ col: 0, direction: 'asc' }], at)).toEqual([2, 4, 6, 1, 3, 5])
  })

  it('consults the next key only on a tie', () => {
    expect(sortOrder(rows, [{ col: 0, direction: 'asc' }, { col: 2, direction: 'desc' }], at)).toEqual([2, 4, 6, 1, 3, 5])
    expect(sortOrder(rows, [{ col: 0, direction: 'asc' }, { col: 1, direction: 'asc' }], at)).toEqual([2, 4, 6, 1, 3, 5])
    expect(sortOrder(rows, [{ col: 0, direction: 'desc' }, { col: 2, direction: 'asc' }], at)).toEqual([3, 1, 6, 4, 2, 5])
  })

  it('blanks stay last whichever way the sort runs', () => {
    expect(sortOrder(rows, [{ col: 0, direction: 'desc' }], at).at(-1)).toBe(5)
    expect(sortOrder(rows, [{ col: 0, direction: 'asc' }], at).at(-1)).toBe(5)
  })

  it('no keys is no change', () => {
    expect(sortOrder(rows, [], at)).toEqual(rows)
  })
})

describe('guessHeaderRow', () => {
  it('sees text over a number as a header', () => {
    expect(guessHeaderRow(at, 0, 2)).toBe(true)
  })

  it('sees text over text as data', () => {
    expect(guessHeaderRow(at, 0, 0)).toBe(false)
  })

  it('sees text over a blank as data', () => {
    expect(guessHeaderRow(at, 5, 0)).toBe(false)
  })
})
