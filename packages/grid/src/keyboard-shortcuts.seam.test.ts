import { describe, expect, it, beforeEach, vi } from 'vitest'
import { createKeyboard } from './keyboard-handlers'
import { getKeyboardIntent } from './keyboard'
import { registerGridShortcuts, clearGridShortcuts } from './shortcut-registry'

// Same harness shape as keyboard-handlers.coverage.test.ts: a fake controller
// ctx that records side effects, and real jsdom KeyboardEvents so modifier
// flags and target/currentTarget behave.
function makeCtx(overrides: Partial<any> = {}) {
  const state: any = { activeCell: { rowIndex: 2, colIndex: 1, cellId: null }, sorting: [] }
  const ctx: any = {
    editingCell: null,
    findOpen: false,
    history: [],
    historyPtr: -1,
    historyVersion: 0,
    historyGroupId: undefined,
    UNDO_LIMIT: 200,
    headerHeight: 30,
    scrollContainer: { clientHeight: 330 },
    props: { rowHeight: 30 },
    allRows: [{}, {}, {}, {}],
    allColumns: [{ id: 'a' }, { id: 'b' }, { id: 'c' }],
    grid: { getState: () => state, store: { setState: vi.fn() } },
    buildApi: () => ({}),
    getSelectionRects: () => [{ minRow: 2, minCol: 1, maxRow: 2, maxCol: 1 }],
    readCellRaw: vi.fn(() => 'v'),
    writeCellRaw: vi.fn(),
    copySelectionToClipboard: vi.fn(),
    pasteFromClipboard: vi.fn(() => Promise.resolve()),
    cutSelectionToClipboard: vi.fn(() => Promise.resolve()),
    applyHistoryStep: vi.fn(),
    clearSelectedCells: vi.fn(() => false),
    clearSelectedCellValues: vi.fn(),
    onCellDoubleClick: vi.fn(),
    startEditingWithChar: vi.fn(() => true),
    toggleBooleanCell: vi.fn(),
    setActiveCell: vi.fn(),
    scrollActiveCellIntoView: vi.fn(),
    extendSelection: vi.fn(),
    setSelection: vi.fn(),
    closeMenus: vi.fn(),
    ...overrides,
  }
  return ctx
}

function rootKeyEvent(init: KeyboardEventInit) {
  const el = document.createElement('div')
  const event = new KeyboardEvent('keydown', { cancelable: true, ...init })
  Object.defineProperty(event, 'target', { value: el })
  Object.defineProperty(event, 'currentTarget', { value: el })
  return event
}

beforeEach(() => clearGridShortcuts())

describe('the shortcut chain inside onGridKeyDown', () => {
  it('lets a handler claim a key the grid would otherwise interpret', () => {
    registerGridShortcuts((e) => e.key === 'ArrowDown' && e.ctrlKey)
    const ctx = makeCtx()
    const { onGridKeyDown } = createKeyboard(ctx)
    onGridKeyDown(rootKeyEvent({ key: 'ArrowDown', ctrlKey: true }))
    expect(ctx.setActiveCell).not.toHaveBeenCalled()
  })

  it('claims a key the grid DOES implement, so enterprise can reclaim it', () => {
    // Ctrl+C is copy in the free grid. A registered handler taking it first is
    // what lets a sheet put formulas and formats on the clipboard instead.
    registerGridShortcuts(() => true)
    const ctx = makeCtx()
    const { onGridKeyDown } = createKeyboard(ctx)
    onGridKeyDown(rootKeyEvent({ key: 'c', ctrlKey: true }))
    expect(ctx.copySelectionToClipboard).not.toHaveBeenCalled()
  })

  it('falls through to normal navigation when the handler declines', () => {
    registerGridShortcuts(() => false)
    const ctx = makeCtx()
    const { onGridKeyDown } = createKeyboard(ctx)
    onGridKeyDown(rootKeyEvent({ key: 'ArrowDown' }))
    expect(ctx.setActiveCell).toHaveBeenCalledWith(3, 1)
  })

  it('does NOT run for a key typed into a child element', () => {
    // The chain used to run before the grid-root guard, so a Ctrl+A or Ctrl+D
    // typed into a filter-row input reached the sheet commands and mutated
    // grid cells.
    const handler = vi.fn(() => true)
    registerGridShortcuts(handler)
    const ctx = makeCtx()
    const root = document.createElement('div')
    const input = document.createElement('input')
    const event = new KeyboardEvent('keydown', { key: 'd', ctrlKey: true, cancelable: true })
    Object.defineProperty(event, 'target', { value: input })
    Object.defineProperty(event, 'currentTarget', { value: root })
    createKeyboard(ctx).onGridKeyDown(event)
    expect(handler).not.toHaveBeenCalled()
  })

  it('runs before the editing bail, so a mid-edit key still reaches a handler', () => {
    const handler = vi.fn(() => true)
    registerGridShortcuts(handler)
    const ctx = makeCtx({ editingCell: { rowId: 'r1', columnId: 'a' } })
    const { onGridKeyDown } = createKeyboard(ctx)
    onGridKeyDown(rootKeyEvent({ key: 'Enter', altKey: true }))
    expect(handler).toHaveBeenCalledOnce()
  })

  it('hands the handler a context describing the active cell and selection', () => {
    let seen: any = null
    registerGridShortcuts((_e, cmd) => {
      seen = {
        active: cmd.activeCell,
        ranges: cmd.ranges,
        rowCount: cmd.rowCount,
        colCount: cmd.colCount,
        editing: cmd.editing,
      }
      return true
    })
    const ctx = makeCtx()
    createKeyboard(ctx).onGridKeyDown(rootKeyEvent({ key: 'd', ctrlKey: true }))
    expect(seen.active).toEqual({ rowIndex: 2, colIndex: 1, columnId: 'b' })
    expect(seen.ranges).toEqual([[2, 1, 2, 1]])
    expect(seen.rowCount).toBe(4)
    expect(seen.colCount).toBe(3)
    expect(seen.editing).toBe(false)
  })

  it('reads and writes cells by display index through the context', () => {
    registerGridShortcuts((_e, cmd) => {
      cmd.setCellValue(0, 2, cmd.getCellValue(1, 0))
      return true
    })
    const ctx = makeCtx()
    createKeyboard(ctx).onGridKeyDown(rootKeyEvent({ key: 'd', ctrlKey: true }))
    expect(ctx.readCellRaw).toHaveBeenCalledWith(1, 'a')
    expect(ctx.writeCellRaw).toHaveBeenCalledWith(0, 'c', 'v')
  })

  it('does not build a context when nothing is registered', () => {
    const ctx = makeCtx()
    // getSelectionRects is only reached through the command context.
    ctx.getSelectionRects = vi.fn(() => [])
    createKeyboard(ctx).onGridKeyDown(rootKeyEvent({ key: 'ArrowDown' }))
    expect(ctx.getSelectionRects).not.toHaveBeenCalled()
  })
})

describe('Ctrl / Cmd + arrow', () => {
  it('is a noop intent rather than a single-cell move', () => {
    for (const key of ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']) {
      expect(getKeyboardIntent(new KeyboardEvent('keydown', { key, ctrlKey: true }))).toBe('noop')
      expect(getKeyboardIntent(new KeyboardEvent('keydown', { key, metaKey: true }))).toBe('noop')
    }
  })

  it('leaves a plain arrow alone', () => {
    expect(getKeyboardIntent(new KeyboardEvent('keydown', { key: 'ArrowDown' }))).toBe('moveDown')
  })

  it('leaves Alt combinations to the browser', () => {
    expect(
      getKeyboardIntent(new KeyboardEvent('keydown', { key: 'ArrowLeft', ctrlKey: true, altKey: true })),
    ).toBe('moveLeft')
  })

  it('does not move the active cell when unclaimed', () => {
    const ctx = makeCtx()
    createKeyboard(ctx).onGridKeyDown(rootKeyEvent({ key: 'ArrowDown', ctrlKey: true }))
    expect(ctx.setActiveCell).not.toHaveBeenCalled()
  })

  it('still does not start an edit, since the key is not printable', () => {
    const ctx = makeCtx()
    createKeyboard(ctx).onGridKeyDown(rootKeyEvent({ key: 'ArrowDown', ctrlKey: true }))
    expect(ctx.startEditingWithChar).not.toHaveBeenCalled()
  })
})

describe('grouped undo through the keyboard', () => {
  it('walks a whole grouped action back on one Ctrl+Z', () => {
    const g = 'g1'
    const ctx = makeCtx({
      history: [
        { rowId: 'r1', columnId: 'a', field: 'a', before: 1, after: 2, groupId: g },
        { rowId: 'r2', columnId: 'a', field: 'a', before: 3, after: 4, groupId: g },
      ],
      historyPtr: 1,
    })
    createKeyboard(ctx).onGridKeyDown(rootKeyEvent({ key: 'z', ctrlKey: true }))
    expect(ctx.applyHistoryStep).toHaveBeenCalledTimes(2)
    expect(ctx.historyPtr).toBe(-1)
  })
})
