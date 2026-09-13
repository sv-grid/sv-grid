import { describe, expect, it, vi } from 'vitest'
import type { GridCommandContext } from '@svgrid/grid/shortcuts'
import { handleSheetKey, SHEET_BINDINGS } from './shortcuts'

function fakeCmd(cells: unknown[][], active = { row: 0, col: 0 }, ranges: any[] = []) {
  const calls = {
    setActiveCell: vi.fn(),
    setSelection: vi.fn(),
    extendSelection: vi.fn(),
    scrollIntoView: vi.fn(),
  }
  const cmd = {
    api: {} as never,
    editing: false,
    activeCell: { rowIndex: active.row, colIndex: active.col, columnId: 'c' },
    rowCount: cells.length,
    colCount: cells[0]?.length ?? 0,
    ranges,
    columnIdAt: (c: number) => `c${c}`,
    getCellValue: (r: number, c: number) => cells[r]?.[c],
    setCellValue: (r: number, c: number, v: unknown) => { cells[r]![c] = v },
    startEditing: vi.fn(() => true),
    batch: <T,>(fn: () => T) => fn(),
    ...calls,
  } as unknown as GridCommandContext
  return { cmd, calls, cells }
}

const key = (init: KeyboardEventInit) => {
  const e = new KeyboardEvent('keydown', { cancelable: true, ...init })
  vi.spyOn(e, 'preventDefault')
  return e
}

// A 4x1 column: filled, filled, blank, filled.
const column = () => [['a'], ['b'], [''], ['d']]

describe('handleSheetKey dispatch', () => {
  it('declines a key nothing binds', () => {
    const { cmd } = fakeCmd(column())
    expect(handleSheetKey(key({ key: 'q' }), cmd)).toBe(false)
  })

  it('declines every key while a cell editor is open', () => {
    // Phase 1 bindings all act on the selection. Claiming Ctrl+D mid-edit
    // would swallow a keystroke meant for the editor.
    const { cmd } = fakeCmd(column())
    ;(cmd as any).editing = true
    expect(handleSheetKey(key({ key: 'd', ctrlKey: true }), cmd)).toBe(false)
  })

  it('claims Ctrl+ArrowDown and preventDefaults it', () => {
    const { cmd, calls } = fakeCmd(column())
    const e = key({ key: 'ArrowDown', ctrlKey: true })
    expect(handleSheetKey(e, cmd)).toBe(true)
    expect(calls.setActiveCell).toHaveBeenCalledWith(1, 0)
    expect(e.preventDefault).toHaveBeenCalled()
  })

  it('accepts Cmd as well as Ctrl', () => {
    const { cmd, calls } = fakeCmd(column())
    expect(handleSheetKey(key({ key: 'ArrowDown', metaKey: true }), cmd)).toBe(true)
    expect(calls.setActiveCell).toHaveBeenCalledWith(1, 0)
  })

  it('does not fire a plain arrow', () => {
    const { cmd } = fakeCmd(column())
    expect(handleSheetKey(key({ key: 'ArrowDown' }), cmd)).toBe(false)
  })

  it('matches modifiers exactly, so Ctrl+Shift is not Ctrl', () => {
    // Without exact matching, Ctrl+Shift+Arrow would match the plain
    // Ctrl+Arrow binding and the extend variant would be unreachable.
    const { cmd, calls } = fakeCmd(column())
    handleSheetKey(key({ key: 'ArrowDown', ctrlKey: true, shiftKey: true }), cmd)
    expect(calls.extendSelection).toHaveBeenCalledWith(1, 0)
    expect(calls.setSelection).not.toHaveBeenCalled()
  })

  it('replaces the selection on Ctrl+Arrow without shift', () => {
    const { cmd, calls } = fakeCmd(column())
    handleSheetKey(key({ key: 'ArrowDown', ctrlKey: true }), cmd)
    expect(calls.setSelection).toHaveBeenCalledWith(1, 0)
    expect(calls.extendSelection).not.toHaveBeenCalled()
  })

  it('does not fire an Alt combination bound without alt', () => {
    const { cmd } = fakeCmd(column())
    expect(handleSheetKey(key({ key: 'd', ctrlKey: true, altKey: true }), cmd)).toBe(false)
  })

  it('scrolls the destination into view', () => {
    const { cmd, calls } = fakeCmd(column())
    handleSheetKey(key({ key: 'ArrowDown', ctrlKey: true }), cmd)
    expect(calls.scrollIntoView).toHaveBeenCalledWith(1, 0)
  })

  it('does not claim the key when the command declines', () => {
    // Ctrl+D on row 0 with nothing above has nothing to do. Claiming it anyway
    // would swallow the key and leave the user with no feedback.
    const { cmd } = fakeCmd([['a']], { row: 0, col: 0 }, [[0, 0, 0, 0]])
    const e = key({ key: 'd', ctrlKey: true })
    expect(handleSheetKey(e, cmd)).toBe(false)
    expect(e.preventDefault).not.toHaveBeenCalled()
  })
})

describe('bound commands', () => {
  it('Ctrl+D fills down', () => {
    const { cmd, cells } = fakeCmd([['a'], ['']], { row: 0, col: 0 }, [[0, 0, 1, 0]])
    expect(handleSheetKey(key({ key: 'd', ctrlKey: true }), cmd)).toBe(true)
    expect(cells[1]![0]).toBe('a')
  })

  it('Ctrl+R fills right', () => {
    const { cmd, cells } = fakeCmd([['a', '']], { row: 0, col: 0 }, [[0, 0, 0, 1]])
    expect(handleSheetKey(key({ key: 'r', ctrlKey: true }), cmd)).toBe(true)
    expect(cells[0]![1]).toBe('a')
  })

  it("Ctrl+; stamps a date", () => {
    const { cmd, cells } = fakeCmd([['']], { row: 0, col: 0 }, [[0, 0, 0, 0]])
    expect(handleSheetKey(key({ key: ';', ctrlKey: true }), cmd)).toBe(true)
    expect(cells[0]![0]).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  it('Ctrl+Shift+; stamps a time', () => {
    const { cmd, cells } = fakeCmd([['']], { row: 0, col: 0 }, [[0, 0, 0, 0]])
    expect(handleSheetKey(key({ key: ';', ctrlKey: true, shiftKey: true }), cmd)).toBe(true)
    expect(cells[0]![0]).toMatch(/^\d{2}:\d{2}:\d{2}$/)
  })

  it("Ctrl+' copies the cell above", () => {
    const { cmd, cells } = fakeCmd([['=A1'], ['']], { row: 1, col: 0 })
    expect(handleSheetKey(key({ key: "'", ctrlKey: true }), cmd)).toBe(true)
    expect(cells[1]![0]).toBe('=A1')
  })

  it('Ctrl+Space selects the column', () => {
    const { cmd, calls } = fakeCmd([['a', 'b'], ['c', 'd']], { row: 0, col: 1 })
    expect(handleSheetKey(key({ key: ' ', ctrlKey: true }), cmd)).toBe(true)
    expect(calls.setSelection).toHaveBeenCalledWith(0, 1)
    expect(calls.extendSelection).toHaveBeenCalledWith(1, 1)
  })

  it('Shift+Space selects the row', () => {
    const { cmd, calls } = fakeCmd([['a', 'b'], ['c', 'd']], { row: 1, col: 0 })
    expect(handleSheetKey(key({ key: ' ', shiftKey: true }), cmd)).toBe(true)
    expect(calls.setSelection).toHaveBeenCalledWith(1, 0)
    expect(calls.extendSelection).toHaveBeenCalledWith(1, 1)
  })

  it('Ctrl+A selects the current region', () => {
    const cells = [['a', 'b', ''], ['c', 'd', ''], ['', '', '']]
    const { cmd, calls } = fakeCmd(cells, { row: 0, col: 0 })
    expect(handleSheetKey(key({ key: 'a', ctrlKey: true }), cmd)).toBe(true)
    expect(calls.setSelection).toHaveBeenCalledWith(0, 0)
    expect(calls.extendSelection).toHaveBeenCalledWith(1, 1)
  })

  it('Ctrl+A a second time widens to the whole sheet', () => {
    const cells = [['a', 'b', ''], ['c', 'd', ''], ['', '', '']]
    // The region is already selected, so the next press escalates.
    const { cmd, calls } = fakeCmd(cells, { row: 0, col: 0 }, [[0, 0, 1, 1]])
    handleSheetKey(key({ key: 'a', ctrlKey: true }), cmd)
    expect(calls.extendSelection).toHaveBeenCalledWith(2, 2)
  })

  it('Ctrl+A stays on the sheet once it already covers everything', () => {
    const cells = [['a', 'b'], ['c', 'd']]
    const { cmd, calls } = fakeCmd(cells, { row: 0, col: 0 }, [[0, 0, 1, 1]])
    handleSheetKey(key({ key: 'a', ctrlKey: true }), cmd)
    expect(calls.extendSelection).toHaveBeenCalledWith(1, 1)
  })
})

describe('the binding table', () => {
  it('gives every binding a label for the docs and cheat sheet', () => {
    for (const b of SHEET_BINDINGS) expect(b.label.length).toBeGreaterThan(0)
  })

  it('has no duplicate key + modifier combination', () => {
    const seen = new Set<string>()
    for (const b of SHEET_BINDINGS) {
      const sig = `${b.key.toLowerCase()}|${b.mod ?? false}|${b.shift ?? false}|${b.alt ?? false}`
      expect(seen.has(sig), `duplicate binding for ${sig}`).toBe(false)
      seen.add(sig)
    }
  })

  it('does not claim keys the free grid already owns', () => {
    // Copy, cut, paste, undo, redo and find stay with the grid in phase 1.
    // Paste special and find-and-replace take them over in later phases, and
    // this test is the reminder to update the docs when they do.
    const reserved = ['c', 'x', 'v', 'z', 'y', 'f', 'h']
    for (const b of SHEET_BINDINGS) {
      if (b.mod && !b.shift && !b.alt) expect(reserved).not.toContain(b.key.toLowerCase())
    }
  })
})
