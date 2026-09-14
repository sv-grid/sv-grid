import { describe, expect, it } from 'vitest'
import {
  edgeOfRegion, currentRegion, isWholeSheet, wholeSheet, isBlankValue,
  type Grid, type Direction,
} from './navigate'

/** Build a Grid from a picture. '.' is blank, anything else is content. */
function grid(rows: string[]): Grid {
  const cells = rows.map((r) => r.split(''))
  return {
    rowCount: cells.length,
    colCount: cells[0]?.length ?? 0,
    isBlank: (r, c) => (cells[r]?.[c] ?? '.') === '.',
  }
}

const jump = (g: Grid, r: number, c: number, dir: Direction) =>
  edgeOfRegion(g, { row: r, col: c }, dir)

describe('isBlankValue', () => {
  it('treats null, undefined and the empty string as blank', () => {
    expect(isBlankValue(null)).toBe(true)
    expect(isBlankValue(undefined)).toBe(true)
    expect(isBlankValue('')).toBe(true)
  })

  it('treats zero, false and whitespace as content', () => {
    // A column of zeroes is data. Skipping past it would be wrong, and this is
    // the classic falsy-check bug in this exact function.
    expect(isBlankValue(0)).toBe(false)
    expect(isBlankValue(false)).toBe(false)
    expect(isBlankValue(' ')).toBe(false)
  })
})

describe('edgeOfRegion', () => {
  it('runs to the last filled cell of a contiguous block', () => {
    const g = grid(['x', 'x', 'x', '.', 'x'])
    expect(jump(g, 0, 0, 'down')).toEqual({ row: 2, col: 0 })
  })

  it('hops the gap when the next cell is blank', () => {
    const g = grid(['x', '.', '.', 'x', 'x'])
    expect(jump(g, 0, 0, 'down')).toEqual({ row: 3, col: 0 })
  })

  it('skips to the next filled cell when starting on a blank', () => {
    const g = grid(['.', '.', 'x', 'x'])
    expect(jump(g, 0, 0, 'down')).toEqual({ row: 2, col: 0 })
  })

  it('parks on the last row when nothing is filled ahead', () => {
    const g = grid(['x', '.', '.', '.'])
    expect(jump(g, 0, 0, 'down')).toEqual({ row: 3, col: 0 })
  })

  it('parks on the last row from an entirely empty column', () => {
    const g = grid(['.', '.', '.'])
    expect(jump(g, 0, 0, 'down')).toEqual({ row: 2, col: 0 })
  })

  it('stays put at the edge of the sheet', () => {
    const g = grid(['x', 'x'])
    expect(jump(g, 0, 0, 'up')).toEqual({ row: 0, col: 0 })
    expect(jump(g, 1, 0, 'down')).toEqual({ row: 1, col: 0 })
  })

  it('works upward, mirroring the downward rules', () => {
    const g = grid(['x', 'x', '.', 'x', 'x'])
    expect(jump(g, 4, 0, 'up')).toEqual({ row: 3, col: 0 })
    expect(jump(g, 3, 0, 'up')).toEqual({ row: 1, col: 0 })
  })

  it('works left and right across a row', () => {
    const g = grid(['xx.xx'])
    expect(jump(g, 0, 0, 'right')).toEqual({ row: 0, col: 1 })
    expect(jump(g, 0, 1, 'right')).toEqual({ row: 0, col: 3 })
    expect(jump(g, 0, 4, 'left')).toEqual({ row: 0, col: 3 })
  })

  it('stops one short of the next blank, not on it', () => {
    const g = grid(['x', 'x', 'x', '.'])
    expect(jump(g, 0, 0, 'down')).toEqual({ row: 2, col: 0 })
  })

  it('runs to the bottom of a fully filled column', () => {
    const g = grid(['x', 'x', 'x', 'x', 'x'])
    expect(jump(g, 0, 0, 'down')).toEqual({ row: 4, col: 0 })
  })

  it('moves one cell when the block is a pair', () => {
    const g = grid(['x', 'x', '.'])
    expect(jump(g, 0, 0, 'down')).toEqual({ row: 1, col: 0 })
  })

  it('returns the cell unchanged on an empty sheet', () => {
    const g: Grid = { rowCount: 0, colCount: 0, isBlank: () => true }
    expect(jump(g, 0, 0, 'down')).toEqual({ row: 0, col: 0 })
  })

  it('stays in its own column when neighbouring columns differ', () => {
    const g = grid(['x.', 'xx', '.x', '.x'])
    expect(jump(g, 0, 0, 'down')).toEqual({ row: 1, col: 0 })
    expect(jump(g, 0, 1, 'down')).toEqual({ row: 1, col: 1 })
  })
})

describe('currentRegion', () => {
  it('grows to the block around the cell', () => {
    const g = grid([
      '.....',
      '.xxx.',
      '.xxx.',
      '.....',
    ])
    expect(currentRegion(g, { row: 2, col: 2 })).toEqual([1, 1, 2, 3])
  })

  it('returns the single cell when it stands alone', () => {
    const g = grid(['...', '.x.', '...'])
    expect(currentRegion(g, { row: 1, col: 1 })).toEqual([1, 1, 1, 1])
  })

  it('encloses an L shape as its bounding rectangle', () => {
    // Excel selects the rectangle, notch included.
    const g = grid([
      'xx.',
      'x..',
      'x..',
    ])
    expect(currentRegion(g, { row: 0, col: 0 })).toEqual([0, 0, 2, 1])
  })

  it('keeps growing when one side exposes content on another', () => {
    // Growing down reaches row 2, which then exposes column 0 content that a
    // single non-repeating pass would miss.
    const g = grid([
      '.x.',
      '.x.',
      'xx.',
    ])
    expect(currentRegion(g, { row: 0, col: 1 })).toEqual([0, 0, 2, 1])
  })

  it('covers the sheet when everything is filled', () => {
    const g = grid(['xx', 'xx'])
    expect(currentRegion(g, { row: 0, col: 0 })).toEqual([0, 0, 1, 1])
  })

  it('starts from a blank cell without crashing', () => {
    const g = grid(['...', '...'])
    expect(currentRegion(g, { row: 0, col: 0 })).toEqual([0, 0, 0, 0])
  })
})

describe('isWholeSheet / wholeSheet', () => {
  it('recognises full coverage', () => {
    const g = grid(['xx', 'xx'])
    expect(isWholeSheet(g, [0, 0, 1, 1])).toBe(true)
    expect(isWholeSheet(g, [0, 0, 0, 1])).toBe(false)
  })

  it('describes the sheet as a rectangle', () => {
    expect(wholeSheet(grid(['xxx', 'xxx']))).toEqual([0, 0, 1, 2])
  })

  it('does not go negative on an empty sheet', () => {
    const g: Grid = { rowCount: 0, colCount: 0, isBlank: () => true }
    expect(wholeSheet(g)).toEqual([0, 0, 0, 0])
  })
})
