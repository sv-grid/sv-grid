import { describe, expect, it, vi, afterEach } from 'vitest'
import type { GridCommandContext } from '@svgrid/grid/shortcuts'
import {
  fillDown, fillRight, fillSelection, stampNow, stampDate, copyFromAbove,
  guessSumRange, looksNumeric, targetRect, setFillTranslator,
} from './commands'

/**
 * A fake command context over a plain matrix. `batch` records that it was
 * entered, because "every multi-cell command is one undo" is the contract the
 * grid-side seam exists to provide and is worth asserting here.
 */
function fakeCmd(
  cells: unknown[][],
  ranges: ReadonlyArray<readonly [number, number, number, number]> = [],
  active?: { row: number; col: number },
) {
  let batches = 0
  // The active cell defaults to the top-left of the first range, which is
  // where it sits after a drag-select.
  const first = ranges[0]
  const at = active ?? (first ? { row: first[0], col: first[1] } : { row: 0, col: 0 })
  const cmd = {
    api: {} as never,
    editing: false,
    activeCell: { rowIndex: at.row, colIndex: at.col, columnId: 'c' },
    rowCount: cells.length,
    colCount: cells[0]?.length ?? 0,
    ranges,
    columnIdAt: (c: number) => `c${c}`,
    getCellValue: (r: number, c: number) => cells[r]?.[c],
    setCellValue: (r: number, c: number, v: unknown) => { cells[r]![c] = v },
    setActiveCell: vi.fn(),
    setSelection: vi.fn(),
    extendSelection: vi.fn(),
    scrollIntoView: vi.fn(),
    startEditing: vi.fn(() => true),
    batch: <T,>(fn: () => T) => { batches += 1; return fn() },
  } as unknown as GridCommandContext
  return { cmd, cells, batchCount: () => batches }
}


afterEach(() => setFillTranslator(null))

describe('targetRect', () => {
  it('uses the active range when there is one', () => {
    const { cmd } = fakeCmd([[1, 2], [3, 4]], [[0, 0, 1, 1]])
    expect(targetRect(cmd)).toEqual([0, 0, 1, 1])
  })

  it('falls back to the active cell alone', () => {
    const { cmd } = fakeCmd([[1, 2], [3, 4]])
    expect(targetRect(cmd)).toEqual([0, 0, 0, 0])
  })

  it('prefers the LAST range, which is the active one', () => {
    const { cmd } = fakeCmd([[1]], [[5, 5, 5, 5], [1, 1, 2, 2]])
    expect(targetRect(cmd)).toEqual([1, 1, 2, 2])
  })
})

describe('fillDown', () => {
  it('copies the top row of the selection down', () => {
    const { cmd, cells } = fakeCmd([['a', 'b'], ['', ''], ['', '']], [[0, 0, 2, 1]])
    expect(fillDown(cmd)).toBe(true)
    expect(cells).toEqual([['a', 'b'], ['a', 'b'], ['a', 'b']])
  })

  it('pulls from the row above when only one row is selected', () => {
    const { cmd, cells } = fakeCmd([['seed'], ['']], [[1, 0, 1, 0]])
    expect(fillDown(cmd)).toBe(true)
    expect(cells[1]![0]).toBe('seed')
  })

  it('declines on the top row with nothing above to pull from', () => {
    const { cmd } = fakeCmd([['a']], [[0, 0, 0, 0]])
    expect(fillDown(cmd)).toBe(false)
  })

  it('runs as one undoable batch', () => {
    const { cmd, batchCount } = fakeCmd([['a'], [''], ['']], [[0, 0, 2, 0]])
    fillDown(cmd)
    expect(batchCount()).toBe(1)
  })

  it('passes the row delta to the translator, ready for formula fills', () => {
    const seen: Array<{ rows: number; cols: number }> = []
    setFillTranslator((v, d) => { seen.push(d); return v })
    const { cmd } = fakeCmd([['a'], [''], ['']], [[0, 0, 2, 0]])
    fillDown(cmd)
    expect(seen).toEqual([{ rows: 1, cols: 0 }, { rows: 2, cols: 0 }])
  })

  it('writes what the translator returns', () => {
    setFillTranslator((v, d) => `${String(v)}+${d.rows}`)
    const { cmd, cells } = fakeCmd([['x'], ['']], [[0, 0, 1, 0]])
    fillDown(cmd)
    expect(cells[1]![0]).toBe('x+1')
  })

  it('fills every column of a multi-column selection independently', () => {
    const { cmd, cells } = fakeCmd([['a', 'b'], ['', '']], [[0, 0, 1, 1]])
    fillDown(cmd)
    expect(cells[1]).toEqual(['a', 'b'])
  })
})

describe('fillRight', () => {
  it('copies the left column of the selection across', () => {
    const { cmd, cells } = fakeCmd([['a', '', '']], [[0, 0, 0, 2]])
    expect(fillRight(cmd)).toBe(true)
    expect(cells[0]).toEqual(['a', 'a', 'a'])
  })

  it('pulls from the column to the left when one column is selected', () => {
    const { cmd, cells } = fakeCmd([['seed', '']], [[0, 1, 0, 1]])
    expect(fillRight(cmd)).toBe(true)
    expect(cells[0]![1]).toBe('seed')
  })

  it('declines in column 0 with nothing to the left', () => {
    const { cmd } = fakeCmd([['a']], [[0, 0, 0, 0]])
    expect(fillRight(cmd)).toBe(false)
  })

  it('passes the column delta to the translator', () => {
    const seen: Array<{ rows: number; cols: number }> = []
    setFillTranslator((v, d) => { seen.push(d); return v })
    const { cmd } = fakeCmd([['a', '', '']], [[0, 0, 0, 2]])
    fillRight(cmd)
    expect(seen).toEqual([{ rows: 0, cols: 1 }, { rows: 0, cols: 2 }])
  })
})

describe('fillSelection', () => {
  it('writes one value into every cell of the range', () => {
    const { cmd, cells } = fakeCmd([['', ''], ['', '']], [[0, 0, 1, 1]])
    expect(fillSelection(cmd, 7)).toBe(true)
    expect(cells).toEqual([[7, 7], [7, 7]])
  })

  it('runs as one undoable batch', () => {
    const { cmd, batchCount } = fakeCmd([['', ''], ['', '']], [[0, 0, 1, 1]])
    fillSelection(cmd, 1)
    expect(batchCount()).toBe(1)
  })
})

describe('stampNow', () => {
  const when = new Date(2026, 8, 13, 14, 5, 9)

  it('stamps an ISO date, not a localised one', () => {
    // The value goes into the data; a column's own `format` decides how it
    // reads. Stamping a localised string would put display text in the model.
    expect(stampNow('date', when)).toBe('2026-09-13')
  })

  it('zero-pads the time', () => {
    expect(stampNow('time', when)).toBe('14:05:09')
  })

  it('joins both for datetime', () => {
    expect(stampNow('datetime', when)).toBe('2026-09-13 14:05:09')
  })

  it('fills the whole selection with the stamp', () => {
    const { cmd, cells } = fakeCmd([[''], ['']], [[0, 0, 1, 0]])
    stampDate(cmd, 'date', when)
    expect(cells).toEqual([['2026-09-13'], ['2026-09-13']])
  })
})

describe('copyFromAbove', () => {
  it('copies the cell above verbatim', () => {
    // Verbatim is the point: this is how you get an unshifted copy of the
    // formula above to edit. A translator must NOT run here.
    setFillTranslator(() => 'TRANSLATED')
    const { cmd, cells } = fakeCmd([['=A1*2'], ['']], [], { row: 1, col: 0 })
    expect(copyFromAbove(cmd)).toBe(true)
    expect(cells[1]![0]).toBe('=A1*2')
  })

  it('declines on the top row', () => {
    const { cmd } = fakeCmd([['a']])
    expect(copyFromAbove(cmd)).toBe(false)
  })
})

describe('looksNumeric', () => {
  it('accepts numbers and numeric strings', () => {
    expect(looksNumeric(0)).toBe(true)
    expect(looksNumeric(-1.5)).toBe(true)
    expect(looksNumeric('42')).toBe(true)
    expect(looksNumeric(' 42 ')).toBe(true)
  })

  it('rejects blanks, whitespace and text', () => {
    expect(looksNumeric('')).toBe(false)
    expect(looksNumeric('   ')).toBe(false)
    expect(looksNumeric('abc')).toBe(false)
    expect(looksNumeric(null)).toBe(false)
    expect(looksNumeric(Infinity)).toBe(false)
  })
})

describe('guessSumRange', () => {
  it('takes the run of numbers directly above', () => {
    const { cmd } = fakeCmd([[1], [2], [3], ['']], [], { row: 3, col: 0 })
    expect(guessSumRange(cmd, looksNumeric)).toEqual([0, 0, 2, 0])
  })

  it('stops at a gap rather than reaching past it', () => {
    const { cmd } = fakeCmd([[1], [''], [3], ['']], [], { row: 3, col: 0 })
    expect(guessSumRange(cmd, looksNumeric)).toEqual([2, 0, 2, 0])
  })

  it('falls back to the run on the left when nothing is above', () => {
    const { cmd } = fakeCmd([[1, 2, 3, '']], [], { row: 0, col: 3 })
    expect(guessSumRange(cmd, looksNumeric)).toEqual([0, 0, 0, 2])
  })

  it('returns null when neither direction has numbers', () => {
    const { cmd } = fakeCmd([['a', 'b']], [], { row: 0, col: 1 })
    expect(guessSumRange(cmd, looksNumeric)).toBeNull()
  })

  it('counts a zero above as part of the run', () => {
    const { cmd } = fakeCmd([[0], [0], ['']], [], { row: 2, col: 0 })
    expect(guessSumRange(cmd, looksNumeric)).toEqual([0, 0, 1, 0])
  })
})
