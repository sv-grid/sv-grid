import { describe, expect, it, vi } from 'vitest'
import type { GridCommandContext } from '@svgrid/grid/shortcuts'
import { handleSheetKey, SHEET_BINDINGS, setRibbonActionHandler } from './shortcuts'

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
    recordUndo: () => {},
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

  it('declines a selection key while a cell editor is open', () => {
    // The selection bindings stay out of the editor: claiming Ctrl+D
    // mid-edit would swallow a keystroke meant for the text.
    const { cmd } = fakeCmd(column())
    ;(cmd as any).editing = true
    expect(handleSheetKey(key({ key: 'd', ctrlKey: true }), cmd)).toBe(false)
  })

  it('F4 pins the reference at the caret of the open editor, and only there', () => {
    const { cmd } = fakeCmd(column())
    const input = document.createElement('input')
    input.value = '=A1+B1'
    input.setSelectionRange(6, 6)
    ;(cmd as any).editing = true
    ;(cmd as any).editor = input
    const seen: string[] = []
    input.addEventListener('input', () => seen.push(input.value))
    const e = key({ key: 'F4' })
    expect(handleSheetKey(e, cmd)).toBe(true)
    expect(input.value).toBe('=A1+$B$1')
    expect(input.selectionStart).toBe(8)
    // The grid learns the new draft the way it learns typing.
    expect(seen).toEqual(['=A1+$B$1'])
    expect(e.preventDefault).toHaveBeenCalled()

    ;(cmd as any).editing = false
    expect(handleSheetKey(key({ key: 'F4' }), cmd)).toBe(false)
  })

  it('raises the actions the ribbon tooltips promise, and falls through when nothing answers', () => {
    const seen: string[] = []
    setRibbonActionHandler((action) => { seen.push(action); return action !== 'insert-table' })
    try {
      const { cmd } = fakeCmd(column())
      expect(handleSheetKey(key({ key: 'F9' }), cmd)).toBe(true)
      expect(handleSheetKey(key({ key: '`', code: 'Backquote', ctrlKey: true }), cmd)).toBe(true)
      expect(handleSheetKey(key({ key: 'L', ctrlKey: true, shiftKey: true }), cmd)).toBe(true)
      expect(handleSheetKey(key({ key: 'F3', shiftKey: true }), cmd)).toBe(true)
      expect(handleSheetKey(key({ key: 'F3', ctrlKey: true }), cmd)).toBe(true)
      expect(handleSheetKey(key({ key: 't', ctrlKey: true }), cmd)).toBe(false)
      expect(handleSheetKey(key({ key: 'o', ctrlKey: true }), cmd)).toBe(true)
      expect(handleSheetKey(key({ key: 's', ctrlKey: true }), cmd)).toBe(true)
      expect(seen).toEqual(['recalculate', 'toggle-formulas', 'toggle-filter', 'insert-function', 'name-manager', 'insert-table', 'file-open', 'file-save-xlsx'])
    } finally {
      setRibbonActionHandler(null)
    }
    const { cmd } = fakeCmd(column())
    expect(handleSheetKey(key({ key: 'F9' }), cmd)).toBe(false)
  })

  it('a jump never rests on a hidden line: the last of the run that shows, or the first of the next', () => {
    // One row, a..f, with C and F hidden.
    const hidden = new Set(['c2', 'c5'])
    const make = (col: number) => {
      const { cmd, calls } = fakeCmd([['a', 'b', 'c', 'd', 'e', 'f', '', '', 'x']], { row: 0, col })
      ;(cmd as any).api = { isColumnCollapsed: (id: string) => hidden.has(id), isRowCollapsed: () => false }
      return { cmd, calls }
    }
    // From A1 the run ends at F1, which is hidden: E1, the last that shows.
    let t = make(0)
    handleSheetKey(key({ key: 'ArrowRight', ctrlKey: true }), t.cmd)
    expect(t.calls.setActiveCell).toHaveBeenCalledWith(0, 4)
    // From E1 the next run begins at I1 (x), not hidden: as before.
    t = make(4)
    handleSheetKey(key({ key: 'ArrowRight', ctrlKey: true }), t.cmd)
    expect(t.calls.setActiveCell).toHaveBeenCalledWith(0, 8)
    // Back from I1: the run a..f ends at F1 from this side, hidden: E1 again.
    t = make(8)
    handleSheetKey(key({ key: 'ArrowLeft', ctrlKey: true }), t.cmd)
    expect(t.calls.setActiveCell).toHaveBeenCalledWith(0, 4)
    // A run that begins on a hidden column: from a blank cell the jump
    // lands on the first of it that shows.
    hidden.clear(); hidden.add('c8')
    const { cmd, calls } = fakeCmd([['', '', '', '', '', '', '', '', 'x', 'y']], { row: 0, col: 0 })
    ;(cmd as any).api = { isColumnCollapsed: (id: string) => hidden.has(id), isRowCollapsed: () => false }
    handleSheetKey(key({ key: 'ArrowRight', ctrlKey: true }), cmd)
    expect(calls.setActiveCell).toHaveBeenCalledWith(0, 9)
  })

  it('binds Ctrl+Shift+& and Ctrl+Shift+_ to the outline and no-border presets', () => {
    const outline = SHEET_BINDINGS.find((b) => b.code === 'Digit7' && b.shift)
    const none = SHEET_BINDINGS.find((b) => b.code === 'Minus' && b.shift)
    expect(outline?.label).toBe('Outline border')
    expect(none?.label).toBe('Remove borders')
    // Without a format store attached they decline, like every format key.
    const { cmd } = fakeCmd(column())
    expect(handleSheetKey(key({ key: '&', code: 'Digit7', ctrlKey: true, shiftKey: true }), cmd)).toBe(false)
    expect(handleSheetKey(key({ key: '_', code: 'Minus', ctrlKey: true, shiftKey: true }), cmd)).toBe(false)
  })

  it('Ctrl+9 / Ctrl+0 raise hide, Ctrl+Shift+9 / Ctrl+Shift+0 raise unhide', () => {
    const seen: string[] = []
    setRibbonActionHandler((action) => { seen.push(action); return true })
    try {
      const { cmd } = fakeCmd(column())
      expect(handleSheetKey(key({ key: '9', code: 'Digit9', ctrlKey: true }), cmd)).toBe(true)
      expect(handleSheetKey(key({ key: '0', code: 'Digit0', ctrlKey: true }), cmd)).toBe(true)
      // Shift changes the key name on a US layout; the code carries it.
      expect(handleSheetKey(key({ key: '(', code: 'Digit9', ctrlKey: true, shiftKey: true }), cmd)).toBe(true)
      expect(handleSheetKey(key({ key: ')', code: 'Digit0', ctrlKey: true, shiftKey: true }), cmd)).toBe(true)
      expect(seen).toEqual(['hide-rows', 'hide-columns', 'unhide-rows', 'unhide-columns'])
    } finally {
      setRibbonActionHandler(null)
    }
  })

  it('Shift+F2 raises edit-comment, Alt+Down raises open-list and Ctrl+F1 raises toggle-ribbon for the shell', () => {
    const seen: string[] = []
    setRibbonActionHandler((action) => { seen.push(action); return true })
    try {
      const { cmd } = fakeCmd(column())
      expect(handleSheetKey(key({ key: 'F2', shiftKey: true }), cmd)).toBe(true)
      expect(handleSheetKey(key({ key: 'ArrowDown', altKey: true }), cmd)).toBe(true)
      expect(handleSheetKey(key({ key: 'F1', ctrlKey: true }), cmd)).toBe(true)
      expect(seen).toEqual(['edit-comment', 'open-list', 'toggle-ribbon'])
    } finally {
      setRibbonActionHandler(null)
    }
  })

  it('Ctrl+Shift+End extends the selection to the last used cell, Ctrl+Shift+Home to A1', () => {
    const { cmd, calls } = fakeCmd([['a', ''], ['', 'b'], ['', '']], { row: 0, col: 0 })
    expect(handleSheetKey(key({ key: 'End', ctrlKey: true, shiftKey: true }), cmd)).toBe(true)
    expect(calls.extendSelection).toHaveBeenCalledWith(1, 1)
    expect(calls.setActiveCell).not.toHaveBeenCalled()
    expect(handleSheetKey(key({ key: 'Home', ctrlKey: true, shiftKey: true }), cmd)).toBe(true)
    expect(calls.extendSelection).toHaveBeenLastCalledWith(0, 0)
  })

  it('Ctrl+End lands on the last used cell, not the last cell of the grid', () => {
    const { cmd, calls } = fakeCmd([['a', ''], ['', 'b'], ['', ''], ['', '']], { row: 0, col: 0 })
    expect(handleSheetKey(key({ key: 'End', ctrlKey: true }), cmd)).toBe(true)
    expect(calls.setActiveCell).toHaveBeenCalledWith(1, 1)
    expect(calls.setSelection).toHaveBeenCalledWith(1, 1)
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

  it('Ctrl+Shift+Arrow grows from the far corner and leaves the active cell', () => {
    const { cmd, calls } = fakeCmd(column())
    ;(cmd as any).selectionFocus = { rowIndex: 1, colIndex: 0 }
    handleSheetKey(key({ key: 'ArrowDown', ctrlKey: true, shiftKey: true }), cmd)
    // From row 1 (filled, next blank) the edge is the next filled cell, row 3.
    expect(calls.extendSelection).toHaveBeenCalledWith(3, 0)
    expect(calls.setActiveCell).not.toHaveBeenCalled()
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

  it('Shift+Space on a block selects every row it touches, Ctrl+Space every column', () => {
    const { cmd, calls } = fakeCmd([['a', 'b', 'c'], ['d', 'e', 'f'], ['g', 'h', 'i']], { row: 0, col: 1 }, [[0, 1, 1, 2]])
    expect(handleSheetKey(key({ key: ' ', shiftKey: true }), cmd)).toBe(true)
    expect(calls.setSelection).toHaveBeenLastCalledWith(0, 0)
    expect(calls.extendSelection).toHaveBeenLastCalledWith(1, 2)
    expect(handleSheetKey(key({ key: ' ', ctrlKey: true }), cmd)).toBe(true)
    expect(calls.setSelection).toHaveBeenLastCalledWith(0, 1)
    expect(calls.extendSelection).toHaveBeenLastCalledWith(2, 2)
  })

  it('Ctrl+Shift+8 selects the current region and nothing more; Ctrl+Shift+Space is Ctrl+A', () => {
    const cells = [['a', 'b', ''], ['c', 'd', ''], ['', '', '']]
    const { cmd, calls } = fakeCmd(cells, { row: 0, col: 0 }, [[0, 0, 1, 1]])
    // The region is already selected: Ctrl+* stays on it, Ctrl+A would widen.
    expect(handleSheetKey(key({ key: '*', code: 'Digit8', ctrlKey: true, shiftKey: true }), cmd)).toBe(true)
    expect(calls.extendSelection).toHaveBeenLastCalledWith(1, 1)
    expect(handleSheetKey(key({ key: ' ', ctrlKey: true, shiftKey: true }), cmd)).toBe(true)
    expect(calls.extendSelection).toHaveBeenLastCalledWith(2, 2)
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
      const sig = `${b.key.toLowerCase()}|${b.mod ?? false}|${b.shift ?? false}|${b.alt ?? false}|${b.editing ?? false}`
      expect(seen.has(sig), `duplicate binding for ${sig}`).toBe(false)
      seen.add(sig)
    }
  })

  it('does not claim keys the free grid already owns', () => {
    // Copy, cut, paste, undo, redo and find stay with the grid. Ctrl+H left
    // this list when Find and Replace shipped; paste special will take
    // Ctrl+C / X / V next, and this test is the reminder to update the docs
    // when it does.
    const reserved = ['c', 'x', 'v', 'z', 'y', 'f']
    for (const b of SHEET_BINDINGS) {
      if (b.mod && !b.shift && !b.alt) expect(reserved).not.toContain(b.key.toLowerCase())
    }
  })
})
