import { describe, expect, it, beforeEach, vi } from 'vitest'
import type { GridCommandContext } from '@svgrid/grid/shortcuts'
import {
  findAll, findNext, replaceOne, replaceAll, replaceInText, cellMatches,
  setFindTarget,
} from './find-replace'
import { handleSheetKey, setFindReplaceHandler } from './shortcuts'

/**
 * A sheet where raw text and displayed text differ, which is the whole reason
 * `lookIn` exists: a cell can hold `=B1*C1` and show `200`.
 */
function sheet(
  raw: string[][],
  display?: string[][],
  ranges: any[] = [],
  active = { row: 0, col: 0 },
) {
  const cmd = {
    api: {} as never,
    editing: false,
    activeCell: { rowIndex: active.row, colIndex: active.col, columnId: `c${active.col}` },
    rowCount: raw.length,
    colCount: raw[0]?.length ?? 0,
    ranges,
    columnIdAt: (c: number) => `c${c}`,
    getCellValue: (r: number, c: number) => raw[r]?.[c],
    setCellValue: (r: number, c: number, v: unknown) => { raw[r]![c] = String(v) },
    setActiveCell: vi.fn(), setSelection: vi.fn(),
    extendSelection: vi.fn(), scrollIntoView: vi.fn(),
    startEditing: vi.fn(() => true),
    batch: <T,>(fn: () => T) => fn(),
  } as unknown as GridCommandContext

  const target = {
    getRaw: (r: number, c: number) => raw[r]?.[c] ?? '',
    getDisplay: (r: number, c: number) => display?.[r]?.[c] ?? raw[r]?.[c] ?? '',
    setRaw: (r: number, c: number, text: string) => { raw[r]![c] = text },
  }
  return { cmd, raw, target }
}

const key = (init: KeyboardEventInit) =>
  new KeyboardEvent('keydown', { cancelable: true, ...init })

beforeEach(() => {
  setFindTarget(null)
  setFindReplaceHandler(null)
})

describe('cellMatches', () => {
  it('matches a substring case-insensitively by default', () => {
    expect(cellMatches('Hello world', 'WORLD')).toBe(true)
  })

  it('respects matchCase', () => {
    expect(cellMatches('Hello', 'hello', { matchCase: true })).toBe(false)
    expect(cellMatches('Hello', 'Hello', { matchCase: true })).toBe(true)
  })

  it('respects matchEntireCell', () => {
    expect(cellMatches('Hello world', 'Hello', { matchEntireCell: true })).toBe(false)
    expect(cellMatches('Hello', 'hello', { matchEntireCell: true })).toBe(true)
  })

  it('never matches an empty needle', () => {
    expect(cellMatches('anything', '')).toBe(false)
  })
})

describe('findAll', () => {
  it('returns nothing with no target attached', () => {
    const s = sheet([['a']])
    expect(findAll(s.cmd, 'a')).toEqual([])
  })

  it('finds in reading order', () => {
    const s = sheet([['x', 'y'], ['y', 'x']])
    setFindTarget(s.target)
    expect(findAll(s.cmd, 'x')).toEqual([
      { rowIndex: 0, colIndex: 0 },
      { rowIndex: 1, colIndex: 1 },
    ])
  })

  it('searches DISPLAYED values by default', () => {
    // The cell holds =B1*C1 and shows 200. Searching "200" must find it.
    const s = sheet([['=B1*C1']], [['200']])
    setFindTarget(s.target)
    expect(findAll(s.cmd, '200')).toHaveLength(1)
    expect(findAll(s.cmd, 'B1')).toHaveLength(0)
  })

  it('searches the formula source when asked', () => {
    const s = sheet([['=B1*C1']], [['200']])
    setFindTarget(s.target)
    expect(findAll(s.cmd, 'B1', { lookIn: 'formulas' })).toHaveLength(1)
    expect(findAll(s.cmd, '200', { lookIn: 'formulas' })).toHaveLength(0)
  })

  it('restricts to the selection when scoped', () => {
    const s = sheet([['x', 'x'], ['x', 'x']], undefined, [[0, 0, 0, 1]])
    setFindTarget(s.target)
    expect(findAll(s.cmd, 'x', { scope: 'selection' })).toHaveLength(2)
    expect(findAll(s.cmd, 'x')).toHaveLength(4)
  })
})

describe('findNext', () => {
  it('wraps forward past the end', () => {
    const s = sheet([['x'], ['x']], undefined, [], { row: 1, col: 0 })
    setFindTarget(s.target)
    expect(findNext(s.cmd, 'x')).toEqual({ rowIndex: 0, colIndex: 0 })
  })

  it('advances from the active cell', () => {
    const s = sheet([['x'], ['x']], undefined, [], { row: 0, col: 0 })
    setFindTarget(s.target)
    expect(findNext(s.cmd, 'x')).toEqual({ rowIndex: 1, colIndex: 0 })
  })

  it('goes backwards and wraps', () => {
    const s = sheet([['x'], ['x']], undefined, [], { row: 0, col: 0 })
    setFindTarget(s.target)
    expect(findNext(s.cmd, 'x', {}, -1)).toEqual({ rowIndex: 1, colIndex: 0 })
  })

  it('returns null when nothing matches', () => {
    const s = sheet([['a']])
    setFindTarget(s.target)
    expect(findNext(s.cmd, 'zzz')).toBeNull()
  })
})

describe('replaceInText', () => {
  it('replaces every occurrence', () => {
    expect(replaceInText('a-b-a', 'a', 'X')).toBe('X-b-X')
  })

  it('replaces case-insensitively while keeping surrounding case', () => {
    expect(replaceInText('Cat cAt', 'cat', 'dog')).toBe('dog dog')
  })

  it('respects matchCase', () => {
    expect(replaceInText('Cat cat', 'cat', 'dog', { matchCase: true })).toBe('Cat dog')
  })

  it('swaps the whole cell for matchEntireCell', () => {
    expect(replaceInText('cat', 'cat', 'dog', { matchEntireCell: true })).toBe('dog')
    expect(replaceInText('cats', 'cat', 'dog', { matchEntireCell: true })).toBe('cats')
  })

  it('treats the needle as literal text, not a pattern', () => {
    // The needle is user input; a regex implementation would need escaping.
    expect(replaceInText('a.b', '.', '-')).toBe('a-b')
    expect(replaceInText('a$1b', '$1', 'X')).toBe('aXb')
  })

  it('leaves text alone for an empty needle', () => {
    expect(replaceInText('abc', '', 'X')).toBe('abc')
  })
})

describe('replaceAll', () => {
  it('writes through the RAW text, not the displayed value', () => {
    // Replacing inside a displayed value would overwrite the formula with its
    // own result. Searching values but writing raw is the correct pairing.
    const s = sheet([['=B1*C1']], [['200 units']])
    setFindTarget(s.target)
    replaceAll(s.cmd, 'units', 'items')
    // The formula has no "units" in it, so nothing is written and the formula
    // survives.
    expect(s.raw[0]![0]).toBe('=B1*C1')
  })

  it('replaces across the sheet and reports the count', () => {
    const s = sheet([['cat'], ['cat'], ['dog']])
    setFindTarget(s.target)
    expect(replaceAll(s.cmd, 'cat', 'bird')).toBe(2)
    expect(s.raw.flat()).toEqual(['bird', 'bird', 'dog'])
  })

  it('runs as ONE undoable batch', () => {
    // The command most likely to overflow a 200-step history.
    const s = sheet(Array.from({ length: 50 }, () => ['x']))
    let batches = 0
    ;(s.cmd as any).batch = <T,>(fn: () => T) => { batches += 1; return fn() }
    setFindTarget(s.target)
    replaceAll(s.cmd, 'x', 'y')
    expect(batches).toBe(1)
  })

  it('skips read-only cells', () => {
    const s = sheet([['x'], ['x']])
    setFindTarget({ ...s.target, isEditable: (r) => r !== 0 })
    expect(replaceAll(s.cmd, 'x', 'y')).toBe(1)
    expect(s.raw[0]![0]).toBe('x')
    expect(s.raw[1]![0]).toBe('y')
  })

  it('rewrites formula text when looking in formulas', () => {
    const s = sheet([['=OLDNAME*2']], [['4']])
    setFindTarget(s.target)
    replaceAll(s.cmd, 'OLDNAME', 'NEWNAME', { lookIn: 'formulas' })
    expect(s.raw[0]![0]).toBe('=NEWNAME*2')
  })

  it('does nothing for an empty needle', () => {
    const s = sheet([['x']])
    setFindTarget(s.target)
    expect(replaceAll(s.cmd, '', 'y')).toBe(0)
  })

  it('notifies once, not per cell', () => {
    const onChange = vi.fn()
    const s = sheet([['x'], ['x']])
    setFindTarget({ ...s.target, onChange })
    replaceAll(s.cmd, 'x', 'y')
    expect(onChange).toHaveBeenCalledOnce()
  })
})

describe('replaceOne', () => {
  it('replaces the active cell and advances', () => {
    const s = sheet([['x'], ['x']], undefined, [], { row: 0, col: 0 })
    setFindTarget(s.target)
    expect(replaceOne(s.cmd, 'x', 'y')).toBe(true)
    expect(s.raw[0]![0]).toBe('y')
    expect(s.cmd.setActiveCell).toHaveBeenCalledWith(1, 0)
  })

  it('advances without writing when the active cell does not match', () => {
    const s = sheet([['a'], ['x']], undefined, [], { row: 0, col: 0 })
    setFindTarget(s.target)
    expect(replaceOne(s.cmd, 'x', 'y')).toBe(false)
    expect(s.cmd.setActiveCell).toHaveBeenCalledWith(1, 0)
  })
})

describe('Ctrl+H', () => {
  it('declines with no handler or no target', () => {
    const s = sheet([['x']])
    expect(handleSheetKey(key({ key: 'h', ctrlKey: true }), s.cmd)).toBe(false)
    setFindTarget(s.target)
    expect(handleSheetKey(key({ key: 'h', ctrlKey: true }), s.cmd)).toBe(false)
  })

  it('calls the registered handler', () => {
    const open = vi.fn()
    const s = sheet([['x']])
    setFindTarget(s.target)
    setFindReplaceHandler(open)
    expect(handleSheetKey(key({ key: 'h', ctrlKey: true }), s.cmd)).toBe(true)
    expect(open).toHaveBeenCalledWith(s.cmd)
  })
})
