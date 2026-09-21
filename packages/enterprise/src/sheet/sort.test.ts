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

describe('sorting on a colour', () => {
  // Four rows, two of them filled yellow, one with red text.
  const fills: Record<number, string | undefined> = { 0: '#ffff00', 2: '#ffff00' }
  const fonts: Record<number, string | undefined> = { 1: '#ff0000' }
  const colourAt = (row: number, _col: number, on: 'fill' | 'color') =>
    (on === 'fill' ? fills[row] : fonts[row]) ?? null
  const rows = [0, 1, 2, 3]
  const valueAt = () => ''

  it('lifts the chosen fill to the top and leaves the rest as they were', () => {
    expect(sortOrder(rows, [{ col: 0, direction: 'asc', on: 'fill', colour: '#FFFF00' }], valueAt, colourAt))
      .toEqual([0, 2, 1, 3])
  })

  it('sinks it instead when the key runs the other way', () => {
    expect(sortOrder(rows, [{ col: 0, direction: 'desc', on: 'fill', colour: '#ffff00' }], valueAt, colourAt))
      .toEqual([1, 3, 0, 2])
  })

  it('reads the font colour when that is what the key is on', () => {
    expect(sortOrder(rows, [{ col: 0, direction: 'asc', on: 'color', colour: '#ff0000' }], valueAt, colourAt))
      .toEqual([1, 0, 2, 3])
  })

  it('does nothing without a colour, or without a reader', () => {
    expect(sortOrder(rows, [{ col: 0, direction: 'asc', on: 'fill' }], valueAt, colourAt)).toEqual(rows)
    expect(sortOrder(rows, [{ col: 0, direction: 'asc', on: 'fill', colour: '#ffff00' }], valueAt)).toEqual(rows)
  })

  it('breaks a colour tie with the next key', () => {
    const text = ['pear', 'apple', 'fig', 'date']
    const order = sortOrder(
      rows,
      [{ col: 0, direction: 'asc', on: 'fill', colour: '#ffff00' }, { col: 1, direction: 'asc' }],
      (row, col) => (col === 1 ? text[row]! : ''),
      colourAt,
    )
    // The two yellow rows first, alphabetically, then the rest alphabetically.
    expect(order).toEqual([2, 0, 1, 3])
  })
})

describe('guessHeaderRow over a block', () => {
  const grid: CellValue[][] = [
    ['Name', 'Dept', 'Pay'],
    ['Zed', 'Ops', 50],
    ['Amy', 'Eng', 70],
  ]
  const at = (r: number, c: number): CellValue => grid[r]?.[c] ?? ''

  it('sees the header from any column of the block, not just the key', () => {
    // Sorting by Name: text over text in that column, but Pay says header.
    expect(guessHeaderRow(at, 0, 0, { left: 0, right: 2 })).toBe(true)
    expect(guessHeaderRow(at, 0, 0)).toBe(false)
  })

  it('a number in the first row means the block starts with data', () => {
    const numbers: CellValue[][] = [['Zed', 5, 50], ['Amy', 'x', 70]]
    expect(guessHeaderRow((r, c) => numbers[r]?.[c] ?? '', 0, 2, { left: 0, right: 2 })).toBe(false)
  })
})
