import { describe, expect, it, vi } from 'vitest'
import { createSelection } from './selection'

// ---------------------------------------------------------------------------
// Fake controller (`ctx`) helpers. The selection factory reads/writes plain
// state on `ctx` and calls a small set of `ctx.grid.*` methods. We build the
// minimal surface each tested path touches.
// ---------------------------------------------------------------------------

function makeGroupRow(id: string) {
  // isGroupRow() checks `typeof row.getCanExpand === 'function' && row.getCanExpand()`
  return { id, getCanExpand: () => true, toggleExpanded: vi.fn(), original: {} }
}
function makeDataRow(id: string, original: any = {}) {
  return {
    id,
    getCanExpand: () => false,
    original,
    getCellValueByColumnId: (colId: string) => original?.[colId],
  }
}
function makeColumn(id: string, columnDef: any = {}) {
  return { id, columnDef }
}

function makeCtx(overrides: any = {}) {
  let rowSelection: Record<string, boolean> = overrides.rowSelectionState ?? {}
  let activeCell: any = overrides.activeCell ?? null
  const setRowSelection = vi.fn((updater: any) => {
    rowSelection =
      typeof updater === 'function' ? updater(rowSelection) : updater
    ctx.rowSelectionState = rowSelection
  })
  const setActiveCell = vi.fn((cell: any) => {
    activeCell = cell
  })
  const ctx: any = {
    rowSelectionState: rowSelection,
    allRows: [],
    allColumns: [],
    headerSelectionState: 'none',
    userHasActivatedCell: false,
    enableCellSelectionEffective: true,
    selectionRange: { anchor: null, focus: null },
    isDraggingSelection: false,
    fillDrag: null,
    moveDrag: null,
    moveGrabHover: false,
    moveCellsEffective: false,
    activeAtPointerDown: null,
    editingEnabled: false,
    editingCell: undefined,
    scrollContainer: null,
    rowVirtualizationEnabled: false,
    rowScrollScalingActive: false,
    renderedColumnItems: [],
    columnVirtualizer: null,
    theadEl: null,
    headerHeight: 0,
    props: {},
    gridRootEl: null,
    getCellDisplayValue: vi.fn((_r: string, _c: string, base: any) => base),
    toggleBooleanCell: vi.fn(),
    onCellDoubleClick: vi.fn(),
    onFillPointerUp: vi.fn(),
    onFillPointerMove: vi.fn(),
    // Range drag-and-drop. `startMoveDrag` returning false is the "the pointer
    // was not on the border" answer, which is what every test below assumes -
    // override it to true to exercise the grab path.
    startMoveDrag: vi.fn(() => false),
    onMovePointerUp: vi.fn(),
    onMovePointerMove: vi.fn(),
    isOnMoveGrabStrip: vi.fn(() => false),
    // Edge auto-scroll: one rAF loop in the clipboard module, driven from here
    // for plain drag-select. Its own behaviour is covered in move-cells.test.ts.
    trackEdgeScroll: vi.fn(),
    stopEdgeScroll: vi.fn(),
    grid: {
      setRowSelection,
      setActiveCell,
      getState: () => ({ activeCell }),
    },
    ...overrides,
  }
  ctx.rowSelectionState = rowSelection
  return ctx
}

describe('createSelection - row selection', () => {
  it('isRowSelected reflects rowSelectionState', () => {
    const ctx = makeCtx({ rowSelectionState: { r1: true, r2: false } })
    const sel = createSelection(ctx)
    expect(sel.isRowSelected('r1')).toBe(true)
    expect(sel.isRowSelected('r2')).toBe(false)
    expect(sel.isRowSelected('missing')).toBe(false)
  })

  it('toggleRowSelectionById flips the single row', () => {
    const ctx = makeCtx({ rowSelectionState: { r1: false } })
    const sel = createSelection(ctx)
    sel.toggleRowSelectionById('r1')
    expect(ctx.rowSelectionState.r1).toBe(true)
    sel.toggleRowSelectionById('r1')
    expect(ctx.rowSelectionState.r1).toBe(false)
  })

  it('toggleSelectAllRows selects every non-group row when not all selected', () => {
    const ctx = makeCtx({
      headerSelectionState: 'none',
      allRows: [makeDataRow('r1'), makeGroupRow('g1'), makeDataRow('r2')],
    })
    const sel = createSelection(ctx)
    sel.toggleSelectAllRows()
    expect(ctx.rowSelectionState.r1).toBe(true)
    expect(ctx.rowSelectionState.r2).toBe(true)
    // group row excluded
    expect(ctx.rowSelectionState.g1).toBeUndefined()
  })

  it('toggleSelectAllRows deselects all when header state is "all"', () => {
    const ctx = makeCtx({
      headerSelectionState: 'all',
      rowSelectionState: { r1: true, r2: true },
      allRows: [makeDataRow('r1'), makeDataRow('r2')],
    })
    const sel = createSelection(ctx)
    sel.toggleSelectAllRows()
    expect(ctx.rowSelectionState.r1).toBeUndefined()
    expect(ctx.rowSelectionState.r2).toBeUndefined()
  })
})

describe('createSelection - setActiveCell', () => {
  it('sets active cell and flags userHasActivatedCell', () => {
    const ctx = makeCtx({ allColumns: [makeColumn('a'), makeColumn('b')] })
    const sel = createSelection(ctx)
    sel.setActiveCell(2, 1)
    expect(ctx.userHasActivatedCell).toBe(true)
    expect(ctx.grid.setActiveCell).toHaveBeenCalledWith(
      expect.objectContaining({ rowIndex: 2, colIndex: 1 }),
    )
  })

  it('fires onActiveCellChange with resolved columnId', () => {
    const onActiveCellChange = vi.fn()
    const ctx = makeCtx({
      allColumns: [makeColumn('a'), makeColumn('b')],
      props: { onActiveCellChange },
    })
    const sel = createSelection(ctx)
    sel.setActiveCell(0, 1)
    expect(onActiveCellChange).toHaveBeenCalledWith({
      rowIndex: 0,
      colIndex: 1,
      columnId: 'b',
    })
  })

  it('onActiveCellChange columnId falls back to "" when column missing', () => {
    const onActiveCellChange = vi.fn()
    const ctx = makeCtx({ allColumns: [], props: { onActiveCellChange } })
    const sel = createSelection(ctx)
    sel.setActiveCell(0, 5)
    expect(onActiveCellChange).toHaveBeenCalledWith(
      expect.objectContaining({ columnId: '' }),
    )
  })
})

describe('createSelection - range math', () => {
  it('setSelection sets anchor and focus to the same point', () => {
    const ctx = makeCtx()
    const sel = createSelection(ctx)
    sel.setSelection(3, 4)
    expect(ctx.selectionRange).toEqual({
      anchor: { rowIndex: 3, colIndex: 4 },
      focus: { rowIndex: 3, colIndex: 4 },
    })
  })

  it('setSelection is a no-op when cell selection disabled', () => {
    const ctx = makeCtx({ enableCellSelectionEffective: false })
    const before = ctx.selectionRange
    const sel = createSelection(ctx)
    sel.setSelection(1, 1)
    expect(ctx.selectionRange).toBe(before)
  })

  it('extendSelection keeps the existing anchor and moves focus', () => {
    const ctx = makeCtx({
      selectionRange: { anchor: { rowIndex: 1, colIndex: 1 }, focus: { rowIndex: 1, colIndex: 1 } },
    })
    const sel = createSelection(ctx)
    sel.extendSelection(4, 5)
    expect(ctx.selectionRange.anchor).toEqual({ rowIndex: 1, colIndex: 1 })
    expect(ctx.selectionRange.focus).toEqual({ rowIndex: 4, colIndex: 5 })
  })

  it('extendSelection uses the new point as anchor when none exists', () => {
    const ctx = makeCtx({ selectionRange: { anchor: null, focus: null } })
    const sel = createSelection(ctx)
    sel.extendSelection(2, 3)
    expect(ctx.selectionRange.anchor).toEqual({ rowIndex: 2, colIndex: 3 })
    expect(ctx.selectionRange.focus).toEqual({ rowIndex: 2, colIndex: 3 })
  })

  it('extendSelection is a no-op when cell selection disabled', () => {
    const ctx = makeCtx({ enableCellSelectionEffective: false })
    const before = ctx.selectionRange
    const sel = createSelection(ctx)
    sel.extendSelection(1, 1)
    expect(ctx.selectionRange).toBe(before)
  })

  it('isCellInSelectedRange covers normalized ranges (anchor > focus)', () => {
    const ctx = makeCtx({
      selectionRange: { anchor: { rowIndex: 4, colIndex: 4 }, focus: { rowIndex: 1, colIndex: 1 } },
    })
    const sel = createSelection(ctx)
    expect(sel.isCellInSelectedRange(2, 3)).toBe(true)
    expect(sel.isCellInSelectedRange(1, 1)).toBe(true)
    expect(sel.isCellInSelectedRange(4, 4)).toBe(true)
    expect(sel.isCellInSelectedRange(0, 0)).toBe(false)
    expect(sel.isCellInSelectedRange(5, 5)).toBe(false)
  })

  it('isCellInSelectedRange returns false when no range', () => {
    const ctx = makeCtx({ selectionRange: { anchor: null, focus: null } })
    const sel = createSelection(ctx)
    expect(sel.isCellInSelectedRange(0, 0)).toBe(false)
  })
})

describe('createSelection - getCellRangeEdges', () => {
  it('returns null outside the range', () => {
    const ctx = makeCtx({
      selectionRange: { anchor: { rowIndex: 1, colIndex: 1 }, focus: { rowIndex: 3, colIndex: 3 } },
    })
    const sel = createSelection(ctx)
    expect(sel.getCellRangeEdges(0, 0)).toBeNull()
    expect(sel.getCellRangeEdges(5, 5)).toBeNull()
  })

  it('returns null when range unset', () => {
    const ctx = makeCtx()
    const sel = createSelection(ctx)
    expect(sel.getCellRangeEdges(0, 0)).toBeNull()
  })

  it('marks all four edges for a single-cell range', () => {
    const ctx = makeCtx({
      selectionRange: { anchor: { rowIndex: 2, colIndex: 2 }, focus: { rowIndex: 2, colIndex: 2 } },
    })
    const sel = createSelection(ctx)
    expect(sel.getCellRangeEdges(2, 2)).toEqual({ top: true, bottom: true, left: true, right: true })
  })

  it('flags only the corner edges for a corner cell of a wider range', () => {
    const ctx = makeCtx({
      selectionRange: { anchor: { rowIndex: 1, colIndex: 1 }, focus: { rowIndex: 3, colIndex: 3 } },
    })
    const sel = createSelection(ctx)
    expect(sel.getCellRangeEdges(1, 1)).toEqual({ top: true, bottom: false, left: true, right: false })
    expect(sel.getCellRangeEdges(2, 2)).toEqual({ top: false, bottom: false, left: false, right: false })
    expect(sel.getCellRangeEdges(3, 3)).toEqual({ top: false, bottom: true, left: false, right: true })
  })
})

describe('createSelection - isInFillPreview', () => {
  it('returns false when no fill drag active', () => {
    const ctx = makeCtx({ fillDrag: null })
    const sel = createSelection(ctx)
    expect(sel.isInFillPreview(0, 0)).toBe(false)
  })

  it('returns false for cells outside the preview rectangle', () => {
    const ctx = makeCtx({
      fillDrag: { sourceMinRow: 0, sourceMaxRow: 1, sourceMinCol: 0, sourceMaxCol: 0, targetRow: 3, targetCol: 0 },
    })
    const sel = createSelection(ctx)
    expect(sel.isInFillPreview(5, 0)).toBe(false)
    expect(sel.isInFillPreview(0, 5)).toBe(false)
  })

  it('returns true for cells in the preview but outside the source', () => {
    const ctx = makeCtx({
      fillDrag: { sourceMinRow: 0, sourceMaxRow: 1, sourceMinCol: 0, sourceMaxCol: 0, targetRow: 3, targetCol: 0 },
    })
    const sel = createSelection(ctx)
    expect(sel.isInFillPreview(2, 0)).toBe(true) // below source, within preview
    expect(sel.isInFillPreview(0, 0)).toBe(false) // inside the source range
  })
})

describe('createSelection - findColumnById', () => {
  it('finds a column by id or returns undefined', () => {
    const ctx = makeCtx({ allColumns: [makeColumn('a'), makeColumn('b')] })
    const sel = createSelection(ctx)
    expect(sel.findColumnById('b')?.id).toBe('b')
    expect(sel.findColumnById('zzz')).toBeUndefined()
  })
})

describe('createSelection - onCellPointerDown', () => {
  function baseCtx(over: any = {}) {
    return makeCtx({
      allRows: [makeDataRow('r0'), makeDataRow('r1')],
      allColumns: [makeColumn('c0', { editorType: 'text' }), makeColumn('c1', { editorType: 'text' })],
      ...over,
    })
  }

  it('ignores non-left button', () => {
    const ctx = baseCtx()
    const sel = createSelection(ctx)
    sel.onCellPointerDown(0, 0, { button: 2 } as any)
    expect(ctx.grid.setActiveCell).not.toHaveBeenCalled()
  })

  it('ignores group rows', () => {
    const ctx = baseCtx({ allRows: [makeGroupRow('g0')] })
    const sel = createSelection(ctx)
    sel.onCellPointerDown(0, 0, { button: 0, shiftKey: false } as any)
    expect(ctx.grid.setActiveCell).not.toHaveBeenCalled()
  })

  it('starts a drag on checkbox columns too (by editorType)', () => {
    // A range drag must be able to START on a checkbox cell; the plain-click
    // toggle still runs via onCellClick (same-cell click).
    const ctx = baseCtx({
      allColumns: [makeColumn('c0', { editorType: 'checkbox' })],
    })
    const sel = createSelection(ctx)
    sel.onCellPointerDown(0, 0, { button: 0, shiftKey: false } as any)
    expect(ctx.grid.setActiveCell).toHaveBeenCalled()
    expect(ctx.isDraggingSelection).toBe(true)
  })

  it('starts a drag on boolean-valued cells too', () => {
    const ctx = baseCtx({
      getCellDisplayValue: vi.fn(() => true),
    })
    const sel = createSelection(ctx)
    sel.onCellPointerDown(0, 0, { button: 0, shiftKey: false } as any)
    expect(ctx.grid.setActiveCell).toHaveBeenCalled()
    expect(ctx.isDraggingSelection).toBe(true)
  })

  it('plain click sets active + selection and starts a drag', () => {
    const ctx = baseCtx()
    const sel = createSelection(ctx)
    sel.onCellPointerDown(1, 1, { button: 0, shiftKey: false } as any)
    expect(ctx.isDraggingSelection).toBe(true)
    expect(ctx.selectionRange.anchor).toEqual({ rowIndex: 1, colIndex: 1 })
    expect(ctx.grid.setActiveCell).toHaveBeenCalled()
    expect(ctx.activeAtPointerDown).toBeNull()
  })

  it('shift click extends the existing range without starting a drag', () => {
    const ctx = baseCtx({
      selectionRange: { anchor: { rowIndex: 0, colIndex: 0 }, focus: { rowIndex: 0, colIndex: 0 } },
      activeCell: { rowIndex: 0, colIndex: 0 },
    })
    const sel = createSelection(ctx)
    sel.onCellPointerDown(1, 1, { button: 0, shiftKey: true } as any)
    expect(ctx.isDraggingSelection).toBe(false)
    expect(ctx.selectionRange.anchor).toEqual({ rowIndex: 0, colIndex: 0 })
    expect(ctx.selectionRange.focus).toEqual({ rowIndex: 1, colIndex: 1 })
    expect(ctx.activeAtPointerDown).toEqual({ rowIndex: 0, colIndex: 0 })
  })
})

describe('createSelection - onCellPointerEnter / drag', () => {
  it('does nothing when not dragging', () => {
    const ctx = makeCtx({ isDraggingSelection: false, allRows: [makeDataRow('r0')] })
    const sel = createSelection(ctx)
    sel.onCellPointerEnter(0, 0)
    expect(ctx.grid.setActiveCell).not.toHaveBeenCalled()
  })

  it('extends selection and moves active cell while dragging', () => {
    const ctx = makeCtx({
      isDraggingSelection: true,
      selectionRange: { anchor: { rowIndex: 0, colIndex: 0 }, focus: { rowIndex: 0, colIndex: 0 } },
      allRows: [makeDataRow('r0'), makeDataRow('r1')],
      allColumns: [makeColumn('c0'), makeColumn('c1')],
    })
    const sel = createSelection(ctx)
    sel.onCellPointerEnter(1, 1)
    expect(ctx.selectionRange.focus).toEqual({ rowIndex: 1, colIndex: 1 })
    expect(ctx.grid.setActiveCell).toHaveBeenCalled()
  })

  it('ignores group rows while dragging', () => {
    const ctx = makeCtx({ isDraggingSelection: true, allRows: [makeGroupRow('g0')] })
    const sel = createSelection(ctx)
    sel.onCellPointerEnter(0, 0)
    expect(ctx.grid.setActiveCell).not.toHaveBeenCalled()
  })
})

describe('createSelection - endDragSelection / window move', () => {
  it('endDragSelection clears the drag flag', () => {
    const ctx = makeCtx({ isDraggingSelection: true })
    const sel = createSelection(ctx)
    sel.endDragSelection()
    expect(ctx.isDraggingSelection).toBe(false)
  })

  it('endDragSelection commits a pending fill drag', () => {
    const ctx = makeCtx({ isDraggingSelection: true, fillDrag: { x: 1 } })
    const sel = createSelection(ctx)
    sel.endDragSelection()
    expect(ctx.onFillPointerUp).toHaveBeenCalled()
  })

  it('onWindowPointerMove delegates to fill move when fill active', () => {
    const ctx = makeCtx({ fillDrag: { x: 1 } })
    const sel = createSelection(ctx)
    const ev = { buttons: 1 } as any
    sel.onWindowPointerMove(ev)
    expect(ctx.onFillPointerMove).toHaveBeenCalledWith(ev)
  })

  it('onWindowPointerMove ignores when not dragging and no fill', () => {
    const ctx = makeCtx({ fillDrag: null, isDraggingSelection: false })
    const sel = createSelection(ctx)
    sel.onWindowPointerMove({ buttons: 0 } as any)
    expect(ctx.onFillPointerUp).not.toHaveBeenCalled()
  })

  it('onWindowPointerMove ends the drag when no buttons held', () => {
    const ctx = makeCtx({ fillDrag: null, isDraggingSelection: true })
    const sel = createSelection(ctx)
    sel.onWindowPointerMove({ buttons: 0 } as any)
    expect(ctx.isDraggingSelection).toBe(false)
  })

  it('onWindowPointerMove keeps the drag while a button is held', () => {
    const ctx = makeCtx({ fillDrag: null, isDraggingSelection: true })
    const sel = createSelection(ctx)
    sel.onWindowPointerMove({ buttons: 1 } as any)
    expect(ctx.isDraggingSelection).toBe(true)
  })

  it('endDragSelection cancels the edge-scroll loop', () => {
    // The loop exits on its own once no drag is live, but cancelling the
    // pending frame here stops one more from firing after the gesture ended.
    const ctx = makeCtx({ isDraggingSelection: true })
    const sel = createSelection(ctx)
    sel.endDragSelection()
    expect(ctx.stopEdgeScroll).toHaveBeenCalled()
  })

  it('feeds the edge-scroll loop while drag-selecting', () => {
    // Drag-select had the same ceiling as the other two drags: a range could
    // only ever cover cells that were on screen when it started.
    const ctx = makeCtx({ isDraggingSelection: true })
    const sel = createSelection(ctx)
    const ev = { buttons: 1, clientX: 10, clientY: 10 } as any
    sel.onWindowPointerMove(ev)
    expect(ctx.trackEdgeScroll).toHaveBeenCalledWith(ev)
  })

  it('does not feed the loop once the button is released', () => {
    const ctx = makeCtx({ isDraggingSelection: true })
    const sel = createSelection(ctx)
    sel.onWindowPointerMove({ buttons: 0 } as any)
    expect(ctx.trackEdgeScroll).not.toHaveBeenCalled()
  })

  it('endDragSelection commits a pending range move', () => {
    const ctx = makeCtx({ moveDrag: { x: 1 } })
    const sel = createSelection(ctx)
    sel.endDragSelection()
    expect(ctx.onMovePointerUp).toHaveBeenCalled()
  })

  it('onWindowPointerMove delegates to the range move when one is in flight', () => {
    // A move outranks a fill: they can never both be active, and checking it
    // first keeps the fill path from swallowing the event.
    const ctx = makeCtx({ moveDrag: { x: 1 }, fillDrag: { x: 1 } })
    const sel = createSelection(ctx)
    const ev = { buttons: 1 } as any
    sel.onWindowPointerMove(ev)
    expect(ctx.onMovePointerMove).toHaveBeenCalledWith(ev)
    expect(ctx.onFillPointerMove).not.toHaveBeenCalled()
  })
})

describe('createSelection - range move grab', () => {
  /** A pointer event over a td that reports itself from `closest()`. */
  function overCell() {
    const cell: any = { dataset: { svgridRow: '1', svgridCol: '1' } }
    cell.closest = () => cell
    return { button: 0, clientX: 10, clientY: 10, target: cell, pointerType: 'mouse' } as any
  }

  it('hands the pointerdown to the move grab before touching the selection', () => {
    const ctx = makeCtx({
      allRows: [{ id: 'r0' }, { id: 'r1' }],
      allColumns: [{ id: 'a' }, { id: 'b' }],
      startMoveDrag: vi.fn(() => true),
    })
    const sel = createSelection(ctx)
    sel.onCellPointerDown(1, 1, overCell())
    expect(ctx.startMoveDrag).toHaveBeenCalled()
    // The selection the user grabbed is still intact, and no drag-select began.
    expect(ctx.selectionRange).toEqual({ anchor: null, focus: null })
    expect(ctx.isDraggingSelection).toBe(false)
  })

  it('swallows the click that follows a grab, so the range survives', () => {
    const onCellClick = vi.fn()
    const ctx = makeCtx({
      allRows: [makeDataRow('r0', { id: 0 }), makeDataRow('r1', { id: 1 })],
      allColumns: [makeColumn('c0', { editorType: 'text' }), makeColumn('c1', { editorType: 'text' })],
      gridRootEl: { focus: vi.fn() },
      props: { onCellClick },
      startMoveDrag: vi.fn(() => true),
    })
    const sel = createSelection(ctx)
    sel.onCellPointerDown(1, 1, overCell())
    sel.onCellClick(1, 1)
    expect(onCellClick).not.toHaveBeenCalled()
    // Only the one click is swallowed - the next behaves normally.
    sel.onCellClick(1, 1)
    expect(onCellClick).toHaveBeenCalledTimes(1)
  })

  it('falls through to normal selection when the pointer misses the border', () => {
    const ctx = makeCtx({
      allRows: [{ id: 'r0' }, { id: 'r1' }],
      allColumns: [{ id: 'a' }, { id: 'b' }],
    })
    const sel = createSelection(ctx)
    sel.onCellPointerDown(1, 1, overCell())
    expect(ctx.selectionRange.anchor).toEqual({ rowIndex: 1, colIndex: 1 })
    expect(ctx.isDraggingSelection).toBe(true)
  })

  it('updateMoveGrabHover leaves the flag alone while moveCells is off', () => {
    const ctx = makeCtx({ moveCellsEffective: false })
    const sel = createSelection(ctx)
    sel.onWindowPointerMove(overCell())
    expect(ctx.isOnMoveGrabStrip).not.toHaveBeenCalled()
    expect(ctx.moveGrabHover).toBe(false)
  })

  it('raises the hover flag on the border and drops it off it', () => {
    const ctx = makeCtx({
      moveCellsEffective: true,
      // Without an anchored range the hover check bails before touching the
      // DOM - correctly, since there is then no border to grab.
      selectionRange: { anchor: { rowIndex: 1, colIndex: 1 }, focus: { rowIndex: 2, colIndex: 2 } },
      isOnMoveGrabStrip: vi.fn(() => true),
    })
    const sel = createSelection(ctx)
    sel.onWindowPointerMove(overCell())
    expect(ctx.moveGrabHover).toBe(true)
    ctx.isOnMoveGrabStrip = vi.fn(() => false)
    sel.onWindowPointerMove(overCell())
    expect(ctx.moveGrabHover).toBe(false)
  })

  it('never walks the DOM while nothing is selected', () => {
    // This runs on every window pointermove, so the guard order matters:
    // two property reads must come before any closest() call.
    const closest = vi.fn(() => null)
    const ctx = makeCtx({ moveCellsEffective: true, isOnMoveGrabStrip: vi.fn(() => true) })
    const sel = createSelection(ctx)
    sel.onWindowPointerMove({ target: { closest }, buttons: 0 } as any)
    expect(closest).not.toHaveBeenCalled()
    expect(ctx.isOnMoveGrabStrip).not.toHaveBeenCalled()
  })

  it('drops the hover flag when the pointer leaves the grid entirely', () => {
    const ctx = makeCtx({
      moveCellsEffective: true,
      moveGrabHover: true,
      selectionRange: { anchor: { rowIndex: 1, colIndex: 1 }, focus: { rowIndex: 2, colIndex: 2 } },
      isOnMoveGrabStrip: vi.fn(() => true),
    })
    const sel = createSelection(ctx)
    sel.onWindowPointerMove({ target: { closest: () => null }, buttons: 0 } as any)
    expect(ctx.moveGrabHover).toBe(false)
  })
})

describe('createSelection - onCellClick', () => {
  function clickCtx(over: any = {}) {
    return makeCtx({
      allRows: [makeDataRow('r0', { id: 0 }), makeDataRow('r1', { id: 1 })],
      allColumns: [makeColumn('c0', { editorType: 'text' }), makeColumn('c1', { editorType: 'text' })],
      gridRootEl: { focus: vi.fn() },
      ...over,
    })
  }

  it('returns early when row or column missing', () => {
    const ctx = clickCtx({ allRows: [] })
    const sel = createSelection(ctx)
    sel.onCellClick(0, 0)
    expect(ctx.gridRootEl.focus).not.toHaveBeenCalled()
  })

  it('toggles expansion for a group row', () => {
    const group = makeGroupRow('g0')
    const ctx = clickCtx({ allRows: [group] })
    const sel = createSelection(ctx)
    sel.onCellClick(0, 0)
    expect(group.toggleExpanded).toHaveBeenCalled()
    expect(ctx.grid.setActiveCell).toHaveBeenCalled()
  })

  it('emits onCellClick and onRowClick for data cells', () => {
    const onCellClick = vi.fn()
    const onRowClick = vi.fn()
    const ctx = clickCtx({ props: { onCellClick, onRowClick } })
    const sel = createSelection(ctx)
    sel.onCellClick(1, 0)
    expect(onCellClick).toHaveBeenCalledWith(
      expect.objectContaining({ rowIndex: 1, colIndex: 0, columnId: 'c0' }),
    )
    expect(onRowClick).toHaveBeenCalledWith(
      expect.objectContaining({ rowIndex: 1, columnId: 'c0' }),
    )
  })

  it('toggles a checkbox cell and clears editing', () => {
    const ctx = clickCtx({
      allColumns: [makeColumn('c0', { editorType: 'checkbox' })],
      editingCell: { rowIndex: 0, colIndex: 0 },
    })
    const sel = createSelection(ctx)
    sel.onCellClick(0, 0)
    expect(ctx.toggleBooleanCell).toHaveBeenCalledWith(0, 0)
    expect(ctx.editingCell).toBeNull()
    expect(ctx.selectionRange.anchor).toEqual({ rowIndex: 0, colIndex: 0 })
  })

  it('enters edit mode when clicking the previously-active editable cell', () => {
    const ctx = clickCtx({
      editingEnabled: true,
      activeAtPointerDown: { rowIndex: 0, colIndex: 0 },
    })
    const sel = createSelection(ctx)
    sel.onCellClick(0, 0)
    expect(ctx.onCellDoubleClick).toHaveBeenCalledWith(0, 0)
  })

  it('clears editing when not re-clicking the active cell', () => {
    const ctx = clickCtx({
      editingEnabled: true,
      activeAtPointerDown: { rowIndex: 1, colIndex: 1 },
      editingCell: { rowIndex: 0, colIndex: 0 },
    })
    const sel = createSelection(ctx)
    sel.onCellClick(0, 0)
    expect(ctx.onCellDoubleClick).not.toHaveBeenCalled()
    expect(ctx.editingCell).toBeNull()
  })
})

describe('createSelection - emitCellDoubleClick', () => {
  it('emits the public double-click events and runs edit entry', () => {
    const onCellDoubleClick = vi.fn()
    const onRowDoubleClick = vi.fn()
    const ctx = makeCtx({
      allRows: [makeDataRow('r0', { id: 0 })],
      allColumns: [makeColumn('c0', { editorType: 'text' })],
      props: { onCellDoubleClick, onRowDoubleClick },
    })
    const sel = createSelection(ctx)
    sel.emitCellDoubleClick(0, 0)
    expect(onCellDoubleClick).toHaveBeenCalledWith(
      expect.objectContaining({ rowIndex: 0, colIndex: 0, columnId: 'c0' }),
    )
    expect(onRowDoubleClick).toHaveBeenCalled()
    expect(ctx.onCellDoubleClick).toHaveBeenCalledWith(0, 0)
  })

  it('skips the public events for group rows but still runs edit entry', () => {
    const onCellDoubleClick = vi.fn()
    const ctx = makeCtx({
      allRows: [makeGroupRow('g0')],
      allColumns: [makeColumn('c0')],
      props: { onCellDoubleClick },
    })
    const sel = createSelection(ctx)
    sel.emitCellDoubleClick(0, 0)
    expect(onCellDoubleClick).not.toHaveBeenCalled()
    expect(ctx.onCellDoubleClick).toHaveBeenCalledWith(0, 0)
  })
})

describe('createSelection - scrollActiveCellIntoView', () => {
  it('returns early without a scroll container', () => {
    const ctx = makeCtx({ scrollContainer: null })
    const sel = createSelection(ctx)
    expect(() => sel.scrollActiveCellIntoView(0, 0)).not.toThrow()
  })

  it('returns early for out-of-bounds indices', () => {
    const container = document.createElement('div')
    const ctx = makeCtx({
      scrollContainer: container,
      allRows: [makeDataRow('r0')],
      allColumns: [makeColumn('c0')],
    })
    const sel = createSelection(ctx)
    // rowIndex out of range -> early return, no throw
    expect(() => sel.scrollActiveCellIntoView(5, 0)).not.toThrow()
    expect(() => sel.scrollActiveCellIntoView(0, 5)).not.toThrow()
  })

  it('adjusts scrollLeft in non-virtualized mode using column virtualizer offsets', () => {
    const container = document.createElement('div')
    Object.defineProperty(container, 'clientWidth', { value: 100, configurable: true })
    Object.defineProperty(container, 'clientHeight', { value: 100, configurable: true })
    container.scrollLeft = 500
    const ctx = makeCtx({
      scrollContainer: container,
      rowVirtualizationEnabled: false,
      allRows: [makeDataRow('r0'), makeDataRow('r1')],
      allColumns: [makeColumn('c0'), makeColumn('c1'), makeColumn('c2')],
      renderedColumnItems: [],
      columnVirtualizer: {
        getOffsetForIndex: (i: number) => i * 140,
        getSizeForIndex: () => 140,
      },
      theadEl: { offsetHeight: 0 },
    })
    const sel = createSelection(ctx)
    // target column 0 is left of the current scrollLeft -> scroll left to it
    sel.scrollActiveCellIntoView(0, 0)
    expect(container.scrollLeft).toBe(0)
  })

  it('virtualized: uses native scrollIntoView when the row is mounted', () => {
    const container = document.createElement('div')
    Object.defineProperty(container, 'clientWidth', { value: 100, configurable: true })
    Object.defineProperty(container, 'clientHeight', { value: 100, configurable: true })
    const tr = document.createElement('tr')
    tr.className = 'sv-grid-row'
    const cell = document.createElement('td')
    cell.setAttribute('data-svgrid-row', '0')
    tr.appendChild(cell)
    container.appendChild(tr)
    const scrollIntoView = vi.fn()
    tr.scrollIntoView = scrollIntoView
    const ctx = makeCtx({
      scrollContainer: container,
      rowVirtualizationEnabled: true,
      allRows: [makeDataRow('r0')],
      allColumns: [makeColumn('c0')],
      renderedColumnItems: [{ index: 0, start: 0, size: 140 }],
    })
    const sel = createSelection(ctx)
    sel.scrollActiveCellIntoView(0, 0)
    expect(scrollIntoView).toHaveBeenCalledWith(
      expect.objectContaining({ block: 'nearest' }),
    )
  })

  it('virtualized + scroll scaling: maps the logical offset into DOM space', () => {
    const container = document.createElement('div')
    Object.defineProperty(container, 'clientHeight', { value: 100, configurable: true })
    container.scrollTop = 0
    const ctx = makeCtx({
      scrollContainer: container,
      rowVirtualizationEnabled: true,
      rowScrollScalingActive: true,
      allRows: [makeDataRow('r0')],
      allColumns: [makeColumn('c0')],
      theadEl: { offsetHeight: 10 },
      virtualizer: { getOffsetForIndex: () => 1000, getSizeForIndex: () => 20 },
      logicalToDomRowOffset: (n: number) => n / 2, // 1000 -> 500
      columnVirtualizer: { getOffsetForIndex: () => 0, getSizeForIndex: () => 140 },
    })
    const sel = createSelection(ctx)
    sel.scrollActiveCellIntoView(0, 0)
    // nextTop = max(500 - 10, 0) = 490
    expect(container.scrollTop).toBe(490)
  })

  it('virtualized: computes scrollTop manually when the row is offscreen', () => {
    const container = document.createElement('div')
    Object.defineProperty(container, 'clientHeight', { value: 100, configurable: true })
    container.scrollTop = 0
    const ctx = makeCtx({
      scrollContainer: container,
      rowVirtualizationEnabled: true,
      rowScrollScalingActive: false,
      allRows: [makeDataRow('r0')],
      allColumns: [makeColumn('c0')],
      theadEl: { offsetHeight: 10 },
      virtualizer: { getOffsetForIndex: () => 500, getSizeForIndex: () => 30 },
      columnVirtualizer: { getOffsetForIndex: () => 0, getSizeForIndex: () => 140 },
    })
    const sel = createSelection(ctx)
    sel.scrollActiveCellIntoView(0, 0)
    // rowBottom = 10 + 500 + 30 = 540 > 0 + 100 -> nextTop = 540 - 100 = 440
    expect(container.scrollTop).toBe(440)
  })

  it('non-virtualized: scrolls up when the cell overlaps the sticky header', () => {
    const container = document.createElement('div')
    Object.defineProperty(container, 'clientHeight', { value: 200, configurable: true })
    Object.defineProperty(container, 'clientWidth', { value: 500, configurable: true })
    container.scrollTop = 100
    container.scrollLeft = 0
    container.getBoundingClientRect = () =>
      ({ top: 0, left: 0, bottom: 200, right: 500 } as DOMRect)
    const td = document.createElement('td')
    td.setAttribute('data-svgrid-row', '0')
    td.setAttribute('data-svgrid-col', '0')
    td.getBoundingClientRect = () =>
      ({ top: 5, bottom: 35, left: 0, right: 140 } as DOMRect)
    container.appendChild(td)
    const ctx = makeCtx({
      scrollContainer: container,
      rowVirtualizationEnabled: false,
      allRows: [makeDataRow('r0')],
      allColumns: [makeColumn('c0')],
      headerHeight: 30,
      theadEl: { offsetHeight: 30 },
      renderedColumnItems: [{ index: 0, start: 0, size: 140 }],
    })
    const sel = createSelection(ctx)
    sel.scrollActiveCellIntoView(0, 0)
    // cellTopInView (5) < headerHeight (30) -> nextTop = 100 + 5 - 30 = 75
    expect(container.scrollTop).toBe(75)
  })

  it('non-virtualized: scrolls down when the cell is past the bottom', () => {
    const container = document.createElement('div')
    Object.defineProperty(container, 'clientHeight', { value: 200, configurable: true })
    Object.defineProperty(container, 'clientWidth', { value: 500, configurable: true })
    container.scrollTop = 0
    container.scrollLeft = 0
    container.getBoundingClientRect = () =>
      ({ top: 0, left: 0, bottom: 200, right: 500 } as DOMRect)
    const td = document.createElement('td')
    td.setAttribute('data-svgrid-row', '0')
    td.setAttribute('data-svgrid-col', '0')
    td.getBoundingClientRect = () =>
      ({ top: 250, bottom: 290, left: 0, right: 140 } as DOMRect)
    container.appendChild(td)
    const ctx = makeCtx({
      scrollContainer: container,
      rowVirtualizationEnabled: false,
      allRows: [makeDataRow('r0')],
      allColumns: [makeColumn('c0')],
      headerHeight: 30,
      theadEl: { offsetHeight: 30 },
      renderedColumnItems: [{ index: 0, start: 0, size: 140 }],
    })
    const sel = createSelection(ctx)
    sel.scrollActiveCellIntoView(0, 0)
    // cellBotInView (290) > clientHeight (200) -> nextTop = 0 + 290 - 200 = 90
    expect(container.scrollTop).toBe(90)
  })

  it('scrolls right when the target column is past the viewport', () => {
    const container = document.createElement('div')
    Object.defineProperty(container, 'clientWidth', { value: 100, configurable: true })
    Object.defineProperty(container, 'clientHeight', { value: 100, configurable: true })
    container.scrollLeft = 0
    const ctx = makeCtx({
      scrollContainer: container,
      rowVirtualizationEnabled: false,
      allRows: [makeDataRow('r0')],
      allColumns: [makeColumn('c0'), makeColumn('c1'), makeColumn('c2')],
      renderedColumnItems: [{ index: 2, start: 280, size: 140 }],
      theadEl: { offsetHeight: 0 },
    })
    const sel = createSelection(ctx)
    sel.scrollActiveCellIntoView(0, 2)
    // cellEnd (420) - clientWidth (100) = 320
    expect(container.scrollLeft).toBe(320)
  })
})

describe('createSelection - fillMarqueeEdges (Excel fill marquee)', () => {
  // Union rectangle spans rows 1..4, cols 0..2 (source cols 0..1 extended to col 2,
  // source rows 1..2 extended to row 4).
  const fillDrag = {
    sourceMinRow: 1, sourceMaxRow: 2, sourceMinCol: 0, sourceMaxCol: 1,
    targetRow: 4, targetCol: 2,
  }

  it('returns null when there is no fill drag', () => {
    const sel = createSelection(makeCtx())
    expect(sel.fillMarqueeEdges(1, 0)).toBeNull()
  })

  it('flags the outer edges of the whole target rectangle', () => {
    const sel = createSelection(makeCtx({ fillDrag }))
    expect(sel.fillMarqueeEdges(1, 0)).toEqual({ top: true, bottom: false, left: true, right: false })
    expect(sel.fillMarqueeEdges(4, 2)).toEqual({ top: false, bottom: true, left: false, right: true })
    expect(sel.fillMarqueeEdges(1, 1)).toEqual({ top: true, bottom: false, left: false, right: false })
  })

  it('returns null for interior cells and cells outside the rectangle', () => {
    const sel = createSelection(makeCtx({ fillDrag }))
    expect(sel.fillMarqueeEdges(2, 1)).toBeNull() // interior
    expect(sel.fillMarqueeEdges(0, 0)).toBeNull() // above
    expect(sel.fillMarqueeEdges(5, 2)).toBeNull() // below
  })
})
