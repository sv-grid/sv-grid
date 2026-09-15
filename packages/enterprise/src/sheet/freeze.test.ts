import { describe, expect, it, vi } from 'vitest'
import type { GridCommandContext } from '@svgrid/grid/shortcuts'
import {
  splitFrozenRows, frozenColumnIds, applyFreeze,
  freezeAtActiveCell, freezeTopRow, freezeFirstColumn, unfreeze,
} from './freeze'

function fakeCmd(cols: number, active = { row: 0, col: 0 }) {
  const setColumnPinning = vi.fn()
  const cmd = {
    api: { setColumnPinning },
    editing: false,
    activeCell: { rowIndex: active.row, colIndex: active.col, columnId: `c${active.col}` },
    rowCount: 10,
    colCount: cols,
    ranges: [],
    columnIdAt: (c: number) => (c >= 0 && c < cols ? `c${c}` : null),
    getCellValue: () => '',
    setCellValue: () => {},
    setActiveCell: vi.fn(), setSelection: vi.fn(),
    extendSelection: vi.fn(), scrollIntoView: vi.fn(),
    startEditing: vi.fn(() => true),
    batch: <T,>(fn: () => T) => fn(),
  } as unknown as GridCommandContext
  return { cmd, setColumnPinning }
}

describe('splitFrozenRows', () => {
  const rows = ['a', 'b', 'c', 'd']

  it('splits so nothing renders twice', () => {
    // The point: pinnedTopRows renders a separate tbody while the body still
    // renders every row, so the pinned rows must come OUT of the body.
    const split = splitFrozenRows(rows, 2)
    expect(split.pinnedTopRows).toEqual(['a', 'b'])
    expect(split.bodyRows).toEqual(['c', 'd'])
  })

  it('pins nothing for a count of zero', () => {
    const split = splitFrozenRows(rows, 0)
    expect(split.pinnedTopRows).toEqual([])
    expect(split.bodyRows).toBe(rows)
  })

  it('clamps a count past the end', () => {
    const split = splitFrozenRows(rows, 99)
    expect(split.pinnedTopRows).toHaveLength(4)
    expect(split.bodyRows).toEqual([])
  })

  it('clamps a negative or fractional count', () => {
    expect(splitFrozenRows(rows, -3).pinnedTopRows).toEqual([])
    expect(splitFrozenRows(rows, 1.8).pinnedTopRows).toEqual(['a'])
  })

  it('handles an empty row array', () => {
    expect(splitFrozenRows([], 3)).toEqual({ pinnedTopRows: [], bodyRows: [] })
  })
})

describe('frozenColumnIds', () => {
  it('names the leading columns', () => {
    const { cmd } = fakeCmd(5)
    expect(frozenColumnIds(cmd, 2)).toEqual(['c0', 'c1'])
  })

  it('returns nothing for zero', () => {
    const { cmd } = fakeCmd(5)
    expect(frozenColumnIds(cmd, 0)).toEqual([])
  })

  it('clamps past the last column', () => {
    const { cmd } = fakeCmd(2)
    expect(frozenColumnIds(cmd, 9)).toEqual(['c0', 'c1'])
  })
})

describe('applyFreeze', () => {
  it('pins the columns through the api', () => {
    const { cmd, setColumnPinning } = fakeCmd(4)
    applyFreeze(cmd, { rows: 1, cols: 2 })
    expect(setColumnPinning).toHaveBeenCalledWith({ left: ['c0', 'c1'] })
  })

  it('reports the state, and freezes the rows through the api as well', () => {
    const { cmd } = fakeCmd(4)
    const setOption = vi.fn()
    ;(cmd as any).api.setOption = setOption
    expect(applyFreeze(cmd, { rows: 3, cols: 1 })).toEqual({ rows: 3, cols: 1 })
    expect(setOption).toHaveBeenCalledWith('frozenRows', 3)
    applyFreeze(cmd, { rows: 0, cols: 0 })
    expect(setOption).toHaveBeenLastCalledWith('frozenRows', undefined)
  })

  it('survives an api without pinning rather than throwing', () => {
    const { cmd } = fakeCmd(4)
    ;(cmd as any).api = {}
    expect(() => applyFreeze(cmd, { rows: 1, cols: 1 })).not.toThrow()
  })
})

describe('the Excel gestures', () => {
  it('freezes everything above and left of the active cell', () => {
    // Cursor on B3 means two frozen rows and one frozen column.
    const { cmd, setColumnPinning } = fakeCmd(4, { row: 2, col: 1 })
    expect(freezeAtActiveCell(cmd)).toEqual({ rows: 2, cols: 1 })
    expect(setColumnPinning).toHaveBeenCalledWith({ left: ['c0'] })
  })

  it('freezes nothing from the top-left corner', () => {
    const { cmd } = fakeCmd(4, { row: 0, col: 0 })
    expect(freezeAtActiveCell(cmd)).toEqual({ rows: 0, cols: 0 })
  })

  it('does Freeze Top Row and Freeze First Column', () => {
    const { cmd, setColumnPinning } = fakeCmd(4)
    expect(freezeTopRow(cmd)).toEqual({ rows: 1, cols: 0 })
    expect(setColumnPinning).toHaveBeenLastCalledWith({ left: [] })
    expect(freezeFirstColumn(cmd)).toEqual({ rows: 0, cols: 1 })
    expect(setColumnPinning).toHaveBeenLastCalledWith({ left: ['c0'] })
  })

  it('unfreezes', () => {
    const { cmd, setColumnPinning } = fakeCmd(4)
    expect(unfreeze(cmd)).toEqual({ rows: 0, cols: 0 })
    expect(setColumnPinning).toHaveBeenCalledWith({ left: [] })
  })
})
