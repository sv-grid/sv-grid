import { describe, expect, it, beforeEach, vi } from 'vitest'
import type { GridCommandContext } from '@svgrid/grid/shortcuts'
import { handleSheetKey, setFormatTarget, setFormatDialogHandler, SHEET_BINDINGS } from './shortcuts'
import { createFormatStore, type CellAddressLookup } from './format-store'

const at: CellAddressLookup = {
  rowIdAt: (i) => (i >= 0 && i < 4 ? `r${i}` : null),
  columnIdAt: (i) => (i >= 0 && i < 4 ? `c${i}` : null),
}

function fakeCmd(cells: unknown[][], active = { row: 0, col: 0 }, ranges: any[] = []) {
  return {
    api: {} as never,
    editing: false,
    activeCell: { rowIndex: active.row, colIndex: active.col, columnId: `c${active.col}` },
    rowCount: cells.length,
    colCount: cells[0]?.length ?? 0,
    ranges,
    columnIdAt: (c: number) => `c${c}`,
    getCellValue: (r: number, c: number) => cells[r]?.[c],
    setCellValue: (r: number, c: number, v: unknown) => { cells[r]![c] = v },
    setActiveCell: vi.fn(), setSelection: vi.fn(),
    extendSelection: vi.fn(), scrollIntoView: vi.fn(),
    startEditing: vi.fn(() => true),
    batch: <T,>(fn: () => T) => fn(),
  } as unknown as GridCommandContext
}

const key = (init: KeyboardEventInit) =>
  new KeyboardEvent('keydown', { cancelable: true, ...init })

beforeEach(() => {
  setFormatTarget(null)
  setFormatDialogHandler(null)
})

describe('AutoSum', () => {
  it('inserts SUM over the run above', () => {
    const cells: unknown[][] = [[1], [2], [3], ['']]
    const cmd = fakeCmd(cells, { row: 3, col: 0 })
    expect(handleSheetKey(key({ key: '=', altKey: true }), cmd)).toBe(true)
    expect(cells[3]![0]).toBe('=SUM(A1:A3)')
  })

  it('falls back to the run on the left', () => {
    const cells: unknown[][] = [[1, 2, 3, '']]
    const cmd = fakeCmd(cells, { row: 0, col: 3 })
    handleSheetKey(key({ key: '=', altKey: true }), cmd)
    expect(cells[0]![3]).toBe('=SUM(A1:C1)')
  })

  it('declines when there is nothing to sum', () => {
    const cells: unknown[][] = [['a', 'b']]
    const cmd = fakeCmd(cells, { row: 0, col: 1 })
    expect(handleSheetKey(key({ key: '=', altKey: true }), cmd)).toBe(false)
  })

  it('stops at a gap rather than reaching past it', () => {
    const cells: unknown[][] = [[1], [''], [3], ['']]
    const cmd = fakeCmd(cells, { row: 3, col: 0 })
    handleSheetKey(key({ key: '=', altKey: true }), cmd)
    expect(cells[3]![0]).toBe('=SUM(A3:A3)')
  })
})

describe('formatting shortcuts without a store', () => {
  it('declines rather than looking broken', () => {
    // No store attached: the key must fall through to the grid, not be
    // swallowed by a command that cannot do anything.
    const cmd = fakeCmd([[1]])
    expect(handleSheetKey(key({ key: 'b', ctrlKey: true }), cmd)).toBe(false)
    expect(handleSheetKey(key({ key: '1', ctrlKey: true, shiftKey: true }), cmd)).toBe(false)
  })
})

describe('formatting shortcuts with a store', () => {
  it('toggles bold across the selection', () => {
    const store = createFormatStore()
    setFormatTarget({ store, lookup: at })
    const cmd = fakeCmd([[1], [2]], { row: 0, col: 0 }, [[0, 0, 1, 0]])
    expect(handleSheetKey(key({ key: 'b', ctrlKey: true }), cmd)).toBe(true)
    expect(store.get('r0', 'c0')?.bold).toBe(true)
    expect(store.get('r1', 'c0')?.bold).toBe(true)
  })

  it('toggles back off on a second press', () => {
    const store = createFormatStore()
    setFormatTarget({ store, lookup: at })
    const cmd = fakeCmd([[1]], { row: 0, col: 0 }, [[0, 0, 0, 0]])
    handleSheetKey(key({ key: 'b', ctrlKey: true }), cmd)
    handleSheetKey(key({ key: 'b', ctrlKey: true }), cmd)
    expect(store.get('r0', 'c0')).toBeUndefined()
  })

  it('applies italic, underline and strike', () => {
    const store = createFormatStore()
    setFormatTarget({ store, lookup: at })
    const cmd = fakeCmd([[1]], { row: 0, col: 0 }, [[0, 0, 0, 0]])
    handleSheetKey(key({ key: 'i', ctrlKey: true }), cmd)
    handleSheetKey(key({ key: 'u', ctrlKey: true }), cmd)
    handleSheetKey(key({ key: '5', ctrlKey: true }), cmd)
    expect(store.get('r0', 'c0')).toEqual({ italic: true, underline: true, strike: true })
  })

  it('applies each number-format preset', () => {
    const store = createFormatStore()
    setFormatTarget({ store, lookup: at })
    const cmd = fakeCmd([[1]], { row: 0, col: 0 }, [[0, 0, 0, 0]])
    const cases: Array<[string, string]> = [
      ['1', '#,##0.00'],
      ['2', 'h:mm AM/PM'],
      ['3', 'yyyy-mm-dd'],
      ['4', '$#,##0.00;($#,##0.00)'],
      ['5', '0.00%'],
      ['6', '0.00E+00'],
    ]
    for (const [k, expected] of cases) {
      handleSheetKey(key({ key: k, ctrlKey: true, shiftKey: true }), cmd)
      expect(store.get('r0', 'c0')?.numFmt).toBe(expected)
    }
  })

  it('falls back to the active cell when nothing is selected', () => {
    const store = createFormatStore()
    setFormatTarget({ store, lookup: at })
    const cmd = fakeCmd([[1], [2]], { row: 1, col: 0 })
    handleSheetKey(key({ key: 'b', ctrlKey: true }), cmd)
    expect(store.get('r1', 'c0')?.bold).toBe(true)
  })

  it('notifies the consumer so it can re-render', () => {
    const onChange = vi.fn()
    setFormatTarget({ store: createFormatStore(), lookup: at, onChange })
    const cmd = fakeCmd([[1]], { row: 0, col: 0 }, [[0, 0, 0, 0]])
    handleSheetKey(key({ key: 'b', ctrlKey: true }), cmd)
    expect(onChange).toHaveBeenCalledOnce()
  })

  it('does not confuse Ctrl+5 with Ctrl+Shift+5', () => {
    // Strikethrough vs percent format. Exact modifier matching is what keeps
    // these apart.
    const store = createFormatStore()
    setFormatTarget({ store, lookup: at })
    const cmd = fakeCmd([[1]], { row: 0, col: 0 }, [[0, 0, 0, 0]])
    handleSheetKey(key({ key: '5', ctrlKey: true }), cmd)
    expect(store.get('r0', 'c0')).toEqual({ strike: true })
    handleSheetKey(key({ key: '5', ctrlKey: true, shiftKey: true }), cmd)
    expect(store.get('r0', 'c0')?.numFmt).toBe('0.00%')
  })
})

describe('Ctrl+1', () => {
  it('declines when no dialog handler is registered', () => {
    // The shortcut layer ships no dialog: what one looks like is a design
    // decision, not a keyboard one.
    const cmd = fakeCmd([[1]])
    expect(handleSheetKey(key({ key: '1', ctrlKey: true }), cmd)).toBe(false)
  })

  it('calls the registered handler', () => {
    const open = vi.fn()
    setFormatDialogHandler(open)
    const cmd = fakeCmd([[1]])
    expect(handleSheetKey(key({ key: '1', ctrlKey: true }), cmd)).toBe(true)
    expect(open).toHaveBeenCalledWith(cmd)
  })
})

describe('the extended binding table', () => {
  it('still has no duplicate key and modifier combination', () => {
    const seen = new Set<string>()
    for (const b of SHEET_BINDINGS) {
      const sig = `${b.key.toLowerCase()}|${b.mod ?? false}|${b.shift ?? false}|${b.alt ?? false}`
      expect(seen.has(sig), `duplicate binding for ${sig}`).toBe(false)
      seen.add(sig)
    }
  })

  it('still leaves the grid its own keys', () => {
    const reserved = ['c', 'x', 'v', 'z', 'y', 'f']
    for (const b of SHEET_BINDINGS) {
      if (b.mod && !b.shift && !b.alt) expect(reserved).not.toContain(b.key.toLowerCase())
    }
  })

  it('labels every binding', () => {
    for (const b of SHEET_BINDINGS) expect(b.label.length).toBeGreaterThan(0)
  })
})
