import { describe, expect, it, vi } from 'vitest'
import { createKeyboard } from './keyboard-handlers'

// createKeyboard returns imperative handlers that read/write a controller
// `ctx`. We build a fake ctx that records the side-effecting calls, plus a
// fake `grid` whose state is settable. KeyboardEvents are real DOM events
// (jsdom) so `target`/`currentTarget`/modifier flags behave correctly.

type FakeState = {
  activeCell?: { rowIndex: number; colIndex: number; cellId: string | null }
  sorting?: Array<{ id: string; desc: boolean }>
  pagination?: { pageSize: number }
}

function makeCtx(overrides: Partial<any> = {}) {
  const state: FakeState = {
    activeCell: { rowIndex: 1, colIndex: 1, cellId: null },
    sorting: [],
    ...overrides.state,
  }
  const setState = vi.fn((updater: any) => {
    Object.assign(state, typeof updater === 'function' ? updater(state) : updater)
  })

  const ctx: any = {
    editingCell: null,
    findOpen: false,
    columnMenuFor: null,
    operatorMenuFor: null,
    history: [],
    historyPtr: -1,
    historyVersion: 0,
    headerHeight: 30,
    scrollContainer: { clientHeight: 330 },
    props: { rowHeight: 30 },
    allRows: [],
    allColumns: [],
    grid: {
      getState: () => state,
      store: { setState },
    },
    // recorded side effects
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
  ctx._state = state
  ctx._setState = setState
  return ctx
}

// A keydown event whose target === currentTarget (so the grid root owns it).
function rootKeyEvent(init: KeyboardEventInit) {
  const el = document.createElement('div')
  const event = new KeyboardEvent('keydown', { cancelable: true, ...init })
  Object.defineProperty(event, 'target', { value: el })
  Object.defineProperty(event, 'currentTarget', { value: el })
  vi.spyOn(event, 'preventDefault')
  return event
}

describe('onGridKeyDown / guards', () => {
  it('ignores events that did not originate on the grid root', () => {
    const ctx = makeCtx()
    const { onGridKeyDown } = createKeyboard(ctx)
    const el = document.createElement('div')
    const other = document.createElement('div')
    const event = new KeyboardEvent('keydown', { key: 'ArrowDown' })
    Object.defineProperty(event, 'target', { value: other })
    Object.defineProperty(event, 'currentTarget', { value: el })
    onGridKeyDown(event)
    expect(ctx.setActiveCell).not.toHaveBeenCalled()
  })

  it('ignores all keys while a cell is being edited', () => {
    const ctx = makeCtx({ editingCell: { rowIndex: 0, colIndex: 0 } })
    const { onGridKeyDown } = createKeyboard(ctx)
    onGridKeyDown(rootKeyEvent({ key: 'ArrowDown' }))
    expect(ctx.setActiveCell).not.toHaveBeenCalled()
  })
})

describe('onGridKeyDown / clipboard shortcuts', () => {
  it('Ctrl+C copies the selection', () => {
    const ctx = makeCtx()
    const { onGridKeyDown } = createKeyboard(ctx)
    const e = rootKeyEvent({ key: 'c', ctrlKey: true })
    onGridKeyDown(e)
    expect(ctx.copySelectionToClipboard).toHaveBeenCalledTimes(1)
    expect(e.preventDefault).toHaveBeenCalled()
  })

  it('Cmd+C (metaKey) also copies', () => {
    const ctx = makeCtx()
    const { onGridKeyDown } = createKeyboard(ctx)
    onGridKeyDown(rootKeyEvent({ key: 'C', metaKey: true }))
    expect(ctx.copySelectionToClipboard).toHaveBeenCalledTimes(1)
  })

  it('Ctrl+V in a secure context reads via the Clipboard API', () => {
    const original = (navigator as any).clipboard
    Object.defineProperty(navigator, 'clipboard', {
      value: { readText: () => Promise.resolve('') },
      configurable: true,
    })
    const ctx = makeCtx()
    const { onGridKeyDown } = createKeyboard(ctx)
    const e = rootKeyEvent({ key: 'v', ctrlKey: true })
    onGridKeyDown(e)
    expect(ctx.pasteFromClipboard).toHaveBeenCalledTimes(1)
    expect(e.preventDefault).toHaveBeenCalled()
    Object.defineProperty(navigator, 'clipboard', { value: original, configurable: true })
  })

  it('Ctrl+V in an insecure context does NOT preventDefault (lets native paste through)', () => {
    const original = (navigator as any).clipboard
    Object.defineProperty(navigator, 'clipboard', { value: undefined, configurable: true })
    const ctx = makeCtx()
    const { onGridKeyDown } = createKeyboard(ctx)
    const e = rootKeyEvent({ key: 'v', ctrlKey: true })
    onGridKeyDown(e)
    expect(ctx.pasteFromClipboard).not.toHaveBeenCalled()
    expect(e.preventDefault).not.toHaveBeenCalled()
    Object.defineProperty(navigator, 'clipboard', { value: original, configurable: true })
  })

  it('Ctrl+X cuts the selection', () => {
    const ctx = makeCtx()
    const { onGridKeyDown } = createKeyboard(ctx)
    const e = rootKeyEvent({ key: 'x', ctrlKey: true })
    onGridKeyDown(e)
    expect(ctx.cutSelectionToClipboard).toHaveBeenCalledTimes(1)
    expect(e.preventDefault).toHaveBeenCalled()
  })

  it('does not treat Ctrl+Alt+C as a copy shortcut', () => {
    const ctx = makeCtx()
    const { onGridKeyDown } = createKeyboard(ctx)
    onGridKeyDown(rootKeyEvent({ key: 'c', ctrlKey: true, altKey: true }))
    expect(ctx.copySelectionToClipboard).not.toHaveBeenCalled()
  })
})

describe('onGridKeyDown / undo & redo', () => {
  it('Ctrl+Z undoes when there is history to undo', () => {
    const step = { kind: 'edit' }
    const ctx = makeCtx({ history: [step], historyPtr: 0 })
    const { onGridKeyDown } = createKeyboard(ctx)
    onGridKeyDown(rootKeyEvent({ key: 'z', ctrlKey: true }))
    expect(ctx.applyHistoryStep).toHaveBeenCalledWith(step, 'undo')
    expect(ctx.historyPtr).toBe(-1)
    expect(ctx.historyVersion).toBe(1)
  })

  it('Ctrl+Z is a no-op when nothing to undo', () => {
    const ctx = makeCtx({ history: [], historyPtr: -1 })
    const { onGridKeyDown } = createKeyboard(ctx)
    onGridKeyDown(rootKeyEvent({ key: 'z', ctrlKey: true }))
    expect(ctx.applyHistoryStep).not.toHaveBeenCalled()
  })

  it('Ctrl+Shift+Z redoes when there is a future step', () => {
    const step = { kind: 'edit' }
    const ctx = makeCtx({ history: [{}, step], historyPtr: 0 })
    const { onGridKeyDown } = createKeyboard(ctx)
    onGridKeyDown(rootKeyEvent({ key: 'z', ctrlKey: true, shiftKey: true }))
    expect(ctx.applyHistoryStep).toHaveBeenCalledWith(step, 'redo')
    expect(ctx.historyPtr).toBe(1)
    expect(ctx.historyVersion).toBe(1)
  })

  it('Ctrl+Y also redoes', () => {
    const step = { kind: 'edit' }
    const ctx = makeCtx({ history: [{}, step], historyPtr: 0 })
    const { onGridKeyDown } = createKeyboard(ctx)
    onGridKeyDown(rootKeyEvent({ key: 'y', ctrlKey: true }))
    expect(ctx.applyHistoryStep).toHaveBeenCalledWith(step, 'redo')
  })

  it('redo is a no-op when already at the end of history', () => {
    const ctx = makeCtx({ history: [{}], historyPtr: 0 })
    const { onGridKeyDown } = createKeyboard(ctx)
    onGridKeyDown(rootKeyEvent({ key: 'y', ctrlKey: true }))
    expect(ctx.applyHistoryStep).not.toHaveBeenCalled()
  })
})

describe('onGridKeyDown / find overlay', () => {
  it('Ctrl+F opens the find overlay', () => {
    const ctx = makeCtx()
    const { onGridKeyDown } = createKeyboard(ctx)
    onGridKeyDown(rootKeyEvent({ key: 'f', ctrlKey: true }))
    expect(ctx.findOpen).toBe(true)
  })

  it('Escape closes the find overlay when it is open', () => {
    const ctx = makeCtx({ findOpen: true })
    const { onGridKeyDown } = createKeyboard(ctx)
    const e = rootKeyEvent({ key: 'Escape' })
    onGridKeyDown(e)
    expect(ctx.findOpen).toBe(false)
    expect(e.preventDefault).toHaveBeenCalled()
  })
})

describe('onGridKeyDown / delete & backspace clearing', () => {
  it('Delete clears the selection when cells were cleared', () => {
    const ctx = makeCtx({ clearSelectedCells: vi.fn(() => true), allRows: [{}], allColumns: [{}] })
    const { onGridKeyDown } = createKeyboard(ctx)
    const e = rootKeyEvent({ key: 'Delete' })
    onGridKeyDown(e)
    expect(ctx.clearSelectedCells).toHaveBeenCalled()
    expect(e.preventDefault).toHaveBeenCalled()
  })

  it('Backspace clears the selection too', () => {
    const ctx = makeCtx({ clearSelectedCells: vi.fn(() => true), allRows: [{}], allColumns: [{}] })
    const { onGridKeyDown } = createKeyboard(ctx)
    onGridKeyDown(rootKeyEvent({ key: 'Backspace' }))
    expect(ctx.clearSelectedCells).toHaveBeenCalled()
  })

  it('Delete falls through to clearCells intent when nothing was cleared', () => {
    const ctx = makeCtx({
      clearSelectedCells: vi.fn(() => false),
      allRows: [{}, {}],
      allColumns: [{}, {}],
    })
    const { onGridKeyDown } = createKeyboard(ctx)
    onGridKeyDown(rootKeyEvent({ key: 'Delete' }))
    expect(ctx.clearSelectedCellValues).toHaveBeenCalledTimes(1)
  })
})

describe('onGridKeyDown / F2 + activation', () => {
  it('F2 starts editing the active cell', () => {
    const ctx = makeCtx({ allRows: [{}, {}], allColumns: [{}, {}] })
    const { onGridKeyDown } = createKeyboard(ctx)
    onGridKeyDown(rootKeyEvent({ key: 'F2' }))
    expect(ctx.onCellDoubleClick).toHaveBeenCalledWith(1, 1)
  })

  it('Space toggles row selection', () => {
    const toggleSelected = vi.fn()
    const ctx = makeCtx({
      allRows: [{}, { toggleSelected }],
      allColumns: [{}, {}],
    })
    const { onGridKeyDown } = createKeyboard(ctx)
    onGridKeyDown(rootKeyEvent({ key: ' ' }))
    expect(toggleSelected).toHaveBeenCalled()
  })

  it('Space on an expandable row toggles selection (space branch wins over expand)', () => {
    // getKeyboardIntent(" ") === "activate". The handler checks `event.key === " "`
    // FIRST and toggles row selection, returning before the ctrl/expand branch.
    const toggleSelected = vi.fn()
    const toggleExpanded = vi.fn()
    const row = { toggleSelected, getCanExpand: () => true, toggleExpanded }
    const ctx = makeCtx({ allRows: [{}, row], allColumns: [{}, {}] })
    const { onGridKeyDown } = createKeyboard(ctx)
    onGridKeyDown(rootKeyEvent({ key: ' ', ctrlKey: true }))
    expect(toggleSelected).toHaveBeenCalled()
    expect(toggleExpanded).not.toHaveBeenCalled()
  })

  it('F2 on a checkbox column opens editing via onCellDoubleClick', () => {
    // F2 is intercepted before intent resolution and always calls
    // onCellDoubleClick regardless of column editorType.
    const ctx = makeCtx({
      allRows: [{}, {}],
      allColumns: [{}, { columnDef: { editorType: 'checkbox' } }],
    })
    const { onGridKeyDown } = createKeyboard(ctx)
    onGridKeyDown(rootKeyEvent({ key: 'F2' }))
    expect(ctx.onCellDoubleClick).toHaveBeenCalledWith(1, 1)
    expect(ctx.toggleBooleanCell).not.toHaveBeenCalled()
  })
})

describe('onGridKeyDown / typing to edit', () => {
  it('a printable character starts editing seeded with that char', () => {
    const ctx = makeCtx({
      allRows: [{}, {}],
      allColumns: [{}, {}],
      startEditingWithChar: vi.fn(() => true),
    })
    const { onGridKeyDown } = createKeyboard(ctx)
    const e = rootKeyEvent({ key: 'a' })
    onGridKeyDown(e)
    expect(ctx.startEditingWithChar).toHaveBeenCalledWith(1, 1, 'a')
    expect(e.preventDefault).toHaveBeenCalled()
  })

  it('does not preventDefault when editing cannot start', () => {
    const ctx = makeCtx({
      allRows: [{}, {}],
      allColumns: [{}, {}],
      startEditingWithChar: vi.fn(() => false),
    })
    const { onGridKeyDown } = createKeyboard(ctx)
    const e = rootKeyEvent({ key: 'a' })
    onGridKeyDown(e)
    expect(e.preventDefault).not.toHaveBeenCalled()
  })

  it('ignores a multi-character / modified key as a noop', () => {
    const ctx = makeCtx({ allRows: [{}, {}], allColumns: [{}, {}] })
    const { onGridKeyDown } = createKeyboard(ctx)
    onGridKeyDown(rootKeyEvent({ key: 'Shift' }))
    expect(ctx.startEditingWithChar).not.toHaveBeenCalled()
  })
})

describe('onGridKeyDown / navigation', () => {
  function navCtx(extra: Partial<any> = {}) {
    return makeCtx({
      state: { activeCell: { rowIndex: 1, colIndex: 1, cellId: null } },
      allRows: [{}, {}, {}, {}, {}],
      allColumns: [{}, {}, {}, {}],
      ...extra,
    })
  }

  it('ArrowDown moves the active cell down and updates selection', () => {
    const ctx = navCtx()
    const { onGridKeyDown } = createKeyboard(ctx)
    onGridKeyDown(rootKeyEvent({ key: 'ArrowDown' }))
    expect(ctx.setActiveCell).toHaveBeenCalledWith(2, 1)
    expect(ctx.scrollActiveCellIntoView).toHaveBeenCalledWith(2, 1)
    expect(ctx.setSelection).toHaveBeenCalledWith(2, 1)
    expect(ctx.extendSelection).not.toHaveBeenCalled()
  })

  it('Shift+ArrowRight extends the selection rectangle', () => {
    const ctx = navCtx()
    const { onGridKeyDown } = createKeyboard(ctx)
    onGridKeyDown(rootKeyEvent({ key: 'ArrowRight', shiftKey: true }))
    expect(ctx.setActiveCell).toHaveBeenCalledWith(1, 2)
    expect(ctx.extendSelection).toHaveBeenCalledWith(1, 2)
    expect(ctx.setSelection).not.toHaveBeenCalled()
  })

  it('Shift+Tab changes direction without extending the range', () => {
    // tabPrev is NOT in the arrow-family extend set, so even with shiftKey the
    // selection is replaced rather than grown.
    const ctx = navCtx({ state: { activeCell: { rowIndex: 1, colIndex: 1, cellId: null } } })
    const { onGridKeyDown } = createKeyboard(ctx)
    onGridKeyDown(rootKeyEvent({ key: 'Tab', shiftKey: true }))
    expect(ctx.setActiveCell).toHaveBeenCalledWith(1, 0)
    expect(ctx.extendSelection).not.toHaveBeenCalled()
    expect(ctx.setSelection).toHaveBeenCalledWith(1, 0)
  })

  it('Shift+Enter (moveUp) DOES extend the selection (arrow-family intent)', () => {
    const ctx = navCtx()
    const { onGridKeyDown } = createKeyboard(ctx)
    onGridKeyDown(rootKeyEvent({ key: 'Enter', shiftKey: true }))
    // Enter+shift -> moveUp, which is in the extend set.
    expect(ctx.setActiveCell).toHaveBeenCalledWith(0, 1)
    expect(ctx.extendSelection).toHaveBeenCalledWith(0, 1)
  })

  it('Tab moves right and wraps using getNextActiveCell', () => {
    const ctx = navCtx({ state: { activeCell: { rowIndex: 1, colIndex: 3, cellId: null } } })
    const { onGridKeyDown } = createKeyboard(ctx)
    onGridKeyDown(rootKeyEvent({ key: 'Tab' }))
    // colIndex 3 is maxCol -> wraps to col 0 row 2
    expect(ctx.setActiveCell).toHaveBeenCalledWith(2, 0)
  })

  it('defaults the active cell to (0,0) when state has none', () => {
    const ctx = navCtx({ state: { activeCell: undefined } })
    const { onGridKeyDown } = createKeyboard(ctx)
    onGridKeyDown(rootKeyEvent({ key: 'ArrowRight' }))
    expect(ctx.setActiveCell).toHaveBeenCalledWith(0, 1)
  })

  it('PageDown uses the pagination pageSize when present', () => {
    const ctx = navCtx({
      state: {
        activeCell: { rowIndex: 0, colIndex: 0, cellId: null },
        pagination: { pageSize: 2 },
      },
    })
    const { onGridKeyDown } = createKeyboard(ctx)
    onGridKeyDown(rootKeyEvent({ key: 'PageDown' }))
    expect(ctx.setActiveCell).toHaveBeenCalledWith(2, 0)
  })

  it('PageDown derives a page step from container height when no pagination', () => {
    // clientHeight 330 - headerHeight 30 = 300 usable / 30 row - 1 = 9 step.
    const ctx = navCtx({
      state: { activeCell: { rowIndex: 0, colIndex: 0, cellId: null } },
      allRows: new Array(40).fill({}),
    })
    const { onGridKeyDown } = createKeyboard(ctx)
    onGridKeyDown(rootKeyEvent({ key: 'PageDown' }))
    expect(ctx.setActiveCell).toHaveBeenCalledWith(9, 0)
  })

  it('PageDown handles a functional rowHeight prop', () => {
    const ctx = navCtx({
      state: { activeCell: { rowIndex: 0, colIndex: 0, cellId: null } },
      allRows: new Array(40).fill({}),
      props: { rowHeight: () => 60 },
    })
    const { onGridKeyDown } = createKeyboard(ctx)
    onGridKeyDown(rootKeyEvent({ key: 'PageDown' }))
    // 300 usable / 60 - 1 = 4
    expect(ctx.setActiveCell).toHaveBeenCalledWith(4, 0)
  })

  it('Home / Ctrl+Home move to row start and grid start', () => {
    const ctx = navCtx({ state: { activeCell: { rowIndex: 2, colIndex: 3, cellId: null } } })
    const { onGridKeyDown } = createKeyboard(ctx)
    onGridKeyDown(rootKeyEvent({ key: 'Home' }))
    expect(ctx.setActiveCell).toHaveBeenLastCalledWith(2, 0)
    onGridKeyDown(rootKeyEvent({ key: 'Home', ctrlKey: true }))
    expect(ctx.setActiveCell).toHaveBeenLastCalledWith(0, 0)
  })

  it('clearCells intent (Delete with non-empty range) wipes values', () => {
    const ctx = navCtx({ clearSelectedCells: vi.fn(() => false) })
    const { onGridKeyDown } = createKeyboard(ctx)
    onGridKeyDown(rootKeyEvent({ key: 'Delete' }))
    expect(ctx.clearSelectedCellValues).toHaveBeenCalled()
    expect(ctx.setActiveCell).not.toHaveBeenCalled()
  })
})

describe('onWindowKeydown', () => {
  it('Escape closes menus when a column menu is open', () => {
    const ctx = makeCtx({ columnMenuFor: 'col1' })
    const { onWindowKeydown } = createKeyboard(ctx)
    onWindowKeydown(new KeyboardEvent('keydown', { key: 'Escape' }))
    expect(ctx.closeMenus).toHaveBeenCalled()
  })

  it('Escape closes menus when an operator menu is open', () => {
    const ctx = makeCtx({ operatorMenuFor: 'op1' })
    const { onWindowKeydown } = createKeyboard(ctx)
    onWindowKeydown(new KeyboardEvent('keydown', { key: 'Escape' }))
    expect(ctx.closeMenus).toHaveBeenCalled()
  })

  it('does nothing when no menu is open', () => {
    const ctx = makeCtx()
    const { onWindowKeydown } = createKeyboard(ctx)
    onWindowKeydown(new KeyboardEvent('keydown', { key: 'Escape' }))
    expect(ctx.closeMenus).not.toHaveBeenCalled()
  })

  it('ignores non-Escape keys', () => {
    const ctx = makeCtx({ columnMenuFor: 'col1' })
    const { onWindowKeydown } = createKeyboard(ctx)
    onWindowKeydown(new KeyboardEvent('keydown', { key: 'Enter' }))
    expect(ctx.closeMenus).not.toHaveBeenCalled()
  })
})

describe('onHeaderSortClick', () => {
  function sortCtx(sorting: Array<{ id: string; desc: boolean }> = [], canSort = true) {
    const columns = [
      { id: 'name', getCanSort: () => canSort },
      { id: 'age', getCanSort: () => true },
    ]
    return makeCtx({ allColumns: columns, state: { sorting } })
  }

  it('ignores a click on a non-sortable column', () => {
    const ctx = sortCtx([], false)
    const { onHeaderSortClick } = createKeyboard(ctx)
    onHeaderSortClick(new MouseEvent('click'), 'name')
    expect(ctx._setState).not.toHaveBeenCalled()
  })

  it('ignores a click on an unknown column id', () => {
    const ctx = sortCtx()
    const { onHeaderSortClick } = createKeyboard(ctx)
    onHeaderSortClick(new MouseEvent('click'), 'nope')
    expect(ctx._setState).not.toHaveBeenCalled()
  })

  it('single-click on an unsorted column sorts ascending', () => {
    const ctx = sortCtx([])
    const { onHeaderSortClick } = createKeyboard(ctx)
    onHeaderSortClick(new MouseEvent('click'), 'name')
    expect(ctx._state.sorting).toEqual([{ id: 'name', desc: false }])
  })

  it('single-click cycles asc -> desc', () => {
    const ctx = sortCtx([{ id: 'name', desc: false }])
    const { onHeaderSortClick } = createKeyboard(ctx)
    onHeaderSortClick(new MouseEvent('click'), 'name')
    expect(ctx._state.sorting).toEqual([{ id: 'name', desc: true }])
  })

  it('single-click cycles desc -> none', () => {
    const ctx = sortCtx([{ id: 'name', desc: true }])
    const { onHeaderSortClick } = createKeyboard(ctx)
    onHeaderSortClick(new MouseEvent('click'), 'name')
    expect(ctx._state.sorting).toEqual([])
  })

  it('shift-click appends a new column to a multi-sort', () => {
    const ctx = sortCtx([{ id: 'age', desc: false }])
    const { onHeaderSortClick } = createKeyboard(ctx)
    onHeaderSortClick(new MouseEvent('click', { shiftKey: true }), 'name')
    expect(ctx._state.sorting).toEqual([
      { id: 'age', desc: false },
      { id: 'name', desc: false },
    ])
  })

  it('shift-click toggles an existing asc clause to desc', () => {
    const ctx = sortCtx([
      { id: 'age', desc: false },
      { id: 'name', desc: false },
    ])
    const { onHeaderSortClick } = createKeyboard(ctx)
    onHeaderSortClick(new MouseEvent('click', { shiftKey: true }), 'name')
    expect(ctx._state.sorting).toEqual([
      { id: 'age', desc: false },
      { id: 'name', desc: true },
    ])
  })

  it('shift-click removes a desc clause from the multi-sort', () => {
    const ctx = sortCtx([
      { id: 'age', desc: false },
      { id: 'name', desc: true },
    ])
    const { onHeaderSortClick } = createKeyboard(ctx)
    onHeaderSortClick(new MouseEvent('click', { shiftKey: true }), 'name')
    expect(ctx._state.sorting).toEqual([{ id: 'age', desc: false }])
  })

  it('handles a missing sorting array (defaults to [])', () => {
    const ctx = makeCtx({
      allColumns: [{ id: 'name', getCanSort: () => true }],
      state: { sorting: undefined },
    })
    const { onHeaderSortClick } = createKeyboard(ctx)
    onHeaderSortClick(new MouseEvent('click'), 'name')
    expect(ctx._state.sorting).toEqual([{ id: 'name', desc: false }])
  })
})
