/**
 * Unit tests for the column handlers produced by createColumns(ctx).
 *
 * createColumns is a factory: it closes over a mutable `ctx` handle (the
 * controller's reactive state in production) and returns imperative event
 * handlers. We drive it here with a plain fake ctx object so we can assert on
 * pinning / ordering / sizing / visibility logic without mounting the grid.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createColumns } from './columns'

type AnyCtx = Record<string, any>

/** A minimally-populated ctx covering every field the handlers read/write. */
function makeCtx(overrides: Partial<AnyCtx> = {}): AnyCtx {
  const allColumns = [
    { id: 'a', columnDef: { width: 120 } },
    { id: 'b', columnDef: {} },
    { id: 'c', columnDef: { width: 200 } },
    { id: 'd', columnDef: {} },
  ]
  const ctx: AnyCtx = {
    allColumns,
    toolPanelColumns: allColumns.map((c) => ({ id: c.id })),
    props: {},
    userColumnOrder: undefined,
    pinnedOffsets: { left: {}, right: {} },
    columnPinning: { left: [], right: [] },
    hiddenColumns: {},
    columnWidths: {},
    fittedColumnWidths: {},
    MIN_COLUMN_WIDTH: 40,
    closeMenus: vi.fn(),
    // drag state
    colDragId: null,
    colDropOnId: null,
    colDropSide: null,
    // resize state
    resizingColumnId: null,
    resizeStartX: 0,
    resizeStartWidth: 0,
    resizePendingWidth: 0,
    resizeRaf: null,
    measureCanvas: null,
    gridRootEl: null,
    grid: {
      getAllColumns: () => allColumns,
      getState: () => ({ grouping: [] }),
      setGrouping: vi.fn(),
    },
    ...overrides,
  }
  return ctx
}

describe('cellPinStyle', () => {
  it('returns a left sticky style when the column has a left offset', () => {
    const ctx = makeCtx({ pinnedOffsets: { left: { a: 0, b: 120 }, right: {} } })
    const h = createColumns(ctx)
    expect(h.cellPinStyle('a')).toBe('position: sticky; left: 0px; z-index: 30;')
    expect(h.cellPinStyle('b')).toBe('position: sticky; left: 120px; z-index: 30;')
  })

  it('returns a right sticky style when the column has a right offset', () => {
    const ctx = makeCtx({ pinnedOffsets: { left: {}, right: { d: 0 } } })
    const h = createColumns(ctx)
    expect(h.cellPinStyle('d')).toBe('position: sticky; right: 0px; z-index: 30;')
  })

  it('returns empty string for an unpinned column', () => {
    const h = createColumns(makeCtx())
    expect(h.cellPinStyle('a')).toBe('')
  })

  it('prefers the left offset when a column appears in both maps', () => {
    const ctx = makeCtx({ pinnedOffsets: { left: { a: 5 }, right: { a: 9 } } })
    const h = createColumns(ctx)
    expect(h.cellPinStyle('a')).toBe('position: sticky; left: 5px; z-index: 30;')
  })
})

describe('isColumnPinned', () => {
  it('reports left / right / null', () => {
    const ctx = makeCtx({ columnPinning: { left: ['a'], right: ['d'] } })
    const h = createColumns(ctx)
    expect(h.isColumnPinned('a')).toBe('left')
    expect(h.isColumnPinned('d')).toBe('right')
    expect(h.isColumnPinned('b')).toBeNull()
  })
})

describe('getCurrentColumnOrder / emitColumnOrder / setColumnOrderInternal', () => {
  it('reads the order from allColumns ids', () => {
    const h = createColumns(makeCtx())
    expect(h.getCurrentColumnOrder()).toEqual(['a', 'b', 'c', 'd'])
  })

  it('emitColumnOrder invokes the callback with the current order', () => {
    const onColumnOrderChange = vi.fn()
    const h = createColumns(makeCtx({ props: { onColumnOrderChange } }))
    h.emitColumnOrder()
    expect(onColumnOrderChange).toHaveBeenCalledWith(['a', 'b', 'c', 'd'])
  })

  it('emitColumnOrder is a no-op when no callback is provided', () => {
    const h = createColumns(makeCtx())
    expect(() => h.emitColumnOrder()).not.toThrow()
  })

  it('setColumnOrderInternal writes userColumnOrder and emits', () => {
    const onColumnOrderChange = vi.fn()
    const ctx = makeCtx({ props: { onColumnOrderChange } })
    const h = createColumns(ctx)
    h.setColumnOrderInternal(['d', 'c', 'b', 'a'])
    expect(ctx.userColumnOrder).toEqual(['d', 'c', 'b', 'a'])
    expect(onColumnOrderChange).toHaveBeenCalledWith(['a', 'b', 'c', 'd'])
  })
})

describe('applyColumnDrop', () => {
  let ctx: AnyCtx
  let h: ReturnType<typeof createColumns>
  beforeEach(() => {
    ctx = makeCtx()
    h = createColumns(ctx)
  })

  it('does nothing when dragId === targetId', () => {
    h.applyColumnDrop('a', 'a', 'before')
    expect(ctx.userColumnOrder).toBeUndefined()
  })

  it('drops before the target', () => {
    h.applyColumnDrop('a', 'c', 'before')
    expect(ctx.userColumnOrder).toEqual(['b', 'a', 'c', 'd'])
  })

  it('drops after the target', () => {
    h.applyColumnDrop('a', 'c', 'after')
    expect(ctx.userColumnOrder).toEqual(['b', 'c', 'a', 'd'])
  })

  it('moving the last column to the front', () => {
    h.applyColumnDrop('d', 'a', 'before')
    expect(ctx.userColumnOrder).toEqual(['d', 'a', 'b', 'c'])
  })

  it('does nothing when the target id is unknown', () => {
    h.applyColumnDrop('a', 'zzz', 'before')
    expect(ctx.userColumnOrder).toBeUndefined()
  })
})

describe('column header drag handlers', () => {
  function dragEvent(): any {
    return {
      preventDefault: vi.fn(),
      dataTransfer: { setData: vi.fn(), effectAllowed: '', dropEffect: '' },
      clientX: 0,
      currentTarget: {
        getBoundingClientRect: () => ({ left: 0, width: 100 }),
      },
    }
  }

  it('dragStart is gated off unless enableColumnReorder', () => {
    const ctx = makeCtx()
    const h = createColumns(ctx)
    const e = dragEvent()
    h.onColumnHeaderDragStart(e, 'a')
    expect(ctx.colDragId).toBeNull()
    expect(e.dataTransfer.setData).not.toHaveBeenCalled()
  })

  it('dragStart records the drag id when reorder is enabled', () => {
    const ctx = makeCtx({ props: { enableColumnReorder: true } })
    const h = createColumns(ctx)
    const e = dragEvent()
    h.onColumnHeaderDragStart(e, 'a')
    expect(ctx.colDragId).toBe('a')
    expect(e.dataTransfer.setData).toHaveBeenCalledWith('text/plain', 'a')
    expect(e.dataTransfer.effectAllowed).toBe('move')
  })

  it('dragOver does nothing when no drag is active or over self', () => {
    const ctx = makeCtx()
    const h = createColumns(ctx)
    const e = dragEvent()
    h.onColumnHeaderDragOver(e, 'b')
    expect(e.preventDefault).not.toHaveBeenCalled()

    ctx.colDragId = 'b'
    h.onColumnHeaderDragOver(e, 'b') // over the dragged column itself
    expect(e.preventDefault).not.toHaveBeenCalled()
  })

  it('dragOver sets side=before on the left half', () => {
    const ctx = makeCtx({ colDragId: 'a' })
    const h = createColumns(ctx)
    const e = dragEvent()
    e.clientX = 10 // < left + width/2 (50)
    h.onColumnHeaderDragOver(e, 'b')
    expect(e.preventDefault).toHaveBeenCalled()
    expect(ctx.colDropSide).toBe('before')
    expect(ctx.colDropOnId).toBe('b')
  })

  it('dragOver sets side=after on the right half', () => {
    const ctx = makeCtx({ colDragId: 'a' })
    const h = createColumns(ctx)
    const e = dragEvent()
    e.clientX = 80 // > 50
    h.onColumnHeaderDragOver(e, 'b')
    expect(ctx.colDropSide).toBe('after')
  })

  it('dragLeave clears state only for the matching column', () => {
    const ctx = makeCtx({ colDropOnId: 'b', colDropSide: 'after' })
    const h = createColumns(ctx)
    h.onColumnHeaderDragLeave('a') // different column - no change
    expect(ctx.colDropOnId).toBe('b')
    h.onColumnHeaderDragLeave('b')
    expect(ctx.colDropOnId).toBeNull()
    expect(ctx.colDropSide).toBeNull()
  })

  it('drop applies the pending reorder then clears drag state', () => {
    const ctx = makeCtx({ colDragId: 'a', colDropSide: 'after' })
    const h = createColumns(ctx)
    const e = dragEvent()
    h.onColumnHeaderDrop(e, 'c')
    expect(e.preventDefault).toHaveBeenCalled()
    expect(ctx.userColumnOrder).toEqual(['b', 'c', 'a', 'd'])
    expect(ctx.colDragId).toBeNull()
    expect(ctx.colDropOnId).toBeNull()
    expect(ctx.colDropSide).toBeNull()
  })

  it('drop without an active drag just clears state', () => {
    const ctx = makeCtx()
    const h = createColumns(ctx)
    const e = dragEvent()
    h.onColumnHeaderDrop(e, 'c')
    expect(ctx.userColumnOrder).toBeUndefined()
    expect(ctx.colDragId).toBeNull()
  })

  it('dragEnd clears all drag state', () => {
    const ctx = makeCtx({ colDragId: 'a', colDropOnId: 'b', colDropSide: 'after' })
    const h = createColumns(ctx)
    h.onColumnHeaderDragEnd()
    expect(ctx.colDragId).toBeNull()
    expect(ctx.colDropOnId).toBeNull()
    expect(ctx.colDropSide).toBeNull()
  })
})

describe('pinning handlers', () => {
  it('pinColumnLeft appends to left, removes from right, closes menus', () => {
    const ctx = makeCtx({ columnPinning: { left: ['a'], right: ['b'] } })
    const h = createColumns(ctx)
    h.pinColumnLeft('b')
    expect(ctx.columnPinning).toEqual({ left: ['a', 'b'], right: [] })
    expect(ctx.closeMenus).toHaveBeenCalled()
  })

  it('pinColumnLeft de-duplicates a column already pinned left', () => {
    const ctx = makeCtx({ columnPinning: { left: ['a', 'b'], right: [] } })
    const h = createColumns(ctx)
    h.pinColumnLeft('a')
    expect(ctx.columnPinning).toEqual({ left: ['b', 'a'], right: [] })
  })

  it('pinColumnRight prepends to right, removes from left', () => {
    const ctx = makeCtx({ columnPinning: { left: ['a'], right: ['c'] } })
    const h = createColumns(ctx)
    h.pinColumnRight('a')
    expect(ctx.columnPinning).toEqual({ left: [], right: ['a', 'c'] })
    expect(ctx.closeMenus).toHaveBeenCalled()
  })

  it('unpinColumn removes from both sides', () => {
    const ctx = makeCtx({ columnPinning: { left: ['a'], right: ['a'] } })
    const h = createColumns(ctx)
    h.unpinColumn('a')
    expect(ctx.columnPinning).toEqual({ left: [], right: [] })
    expect(ctx.closeMenus).toHaveBeenCalled()
  })
})

describe('toggleColumnVisibleInPanel', () => {
  it('hides a visible column', () => {
    const ctx = makeCtx()
    const h = createColumns(ctx)
    h.toggleColumnVisibleInPanel('a')
    expect(ctx.hiddenColumns).toEqual({ a: true })
  })

  it('shows a hidden column (removes the key)', () => {
    const ctx = makeCtx({ hiddenColumns: { a: true, b: true } })
    const h = createColumns(ctx)
    h.toggleColumnVisibleInPanel('a')
    expect(ctx.hiddenColumns).toEqual({ b: true })
  })
})

describe('moveColumnInPanel', () => {
  it('moves a column down (dir +1)', () => {
    const ctx = makeCtx()
    const h = createColumns(ctx)
    h.moveColumnInPanel('a', 1)
    expect(ctx.userColumnOrder).toEqual(['b', 'a', 'c', 'd'])
  })

  it('moves a column up (dir -1)', () => {
    const ctx = makeCtx()
    const h = createColumns(ctx)
    h.moveColumnInPanel('c', -1)
    expect(ctx.userColumnOrder).toEqual(['a', 'c', 'b', 'd'])
  })

  it('refuses to move the first column up (out of bounds)', () => {
    const ctx = makeCtx()
    const h = createColumns(ctx)
    h.moveColumnInPanel('a', -1)
    expect(ctx.userColumnOrder).toBeUndefined()
  })

  it('refuses to move the last column down (out of bounds)', () => {
    const ctx = makeCtx()
    const h = createColumns(ctx)
    h.moveColumnInPanel('d', 1)
    expect(ctx.userColumnOrder).toBeUndefined()
  })

  it('does nothing for an unknown column id', () => {
    const ctx = makeCtx()
    const h = createColumns(ctx)
    h.moveColumnInPanel('zzz', 1)
    expect(ctx.userColumnOrder).toBeUndefined()
  })
})

describe('toggleGroupInPanel', () => {
  it('adds a column to grouping when absent', () => {
    const setGrouping = vi.fn()
    const ctx = makeCtx()
    ctx.grid.getState = () => ({ grouping: ['x'] })
    ctx.grid.setGrouping = setGrouping
    const h = createColumns(ctx)
    h.toggleGroupInPanel('a')
    expect(setGrouping).toHaveBeenCalledWith(['x', 'a'])
  })

  it('removes a column from grouping when present', () => {
    const setGrouping = vi.fn()
    const ctx = makeCtx()
    ctx.grid.getState = () => ({ grouping: ['x', 'a'] })
    ctx.grid.setGrouping = setGrouping
    const h = createColumns(ctx)
    h.toggleGroupInPanel('a')
    expect(setGrouping).toHaveBeenCalledWith(['x'])
  })

  it('handles a missing grouping array (defaults to empty)', () => {
    const setGrouping = vi.fn()
    const ctx = makeCtx()
    ctx.grid.getState = () => ({})
    ctx.grid.setGrouping = setGrouping
    const h = createColumns(ctx)
    h.toggleGroupInPanel('a')
    expect(setGrouping).toHaveBeenCalledWith(['a'])
  })
})

describe('getColumnBaseWidth', () => {
  it('returns an explicit override from columnWidths', () => {
    const ctx = makeCtx({ columnWidths: { a: 333 } })
    const h = createColumns(ctx)
    expect(h.getColumnBaseWidth('a')).toBe(333)
  })

  it('falls back to the columnDef width', () => {
    const h = createColumns(makeCtx())
    expect(h.getColumnBaseWidth('c')).toBe(200)
  })

  it('falls back to props.columnWidth when neither override nor def width set', () => {
    const ctx = makeCtx({ props: { columnWidth: 99 } })
    const h = createColumns(ctx)
    expect(h.getColumnBaseWidth('b')).toBe(99)
  })

  it('falls back to the hard default 140 with no config', () => {
    const h = createColumns(makeCtx())
    expect(h.getColumnBaseWidth('b')).toBe(140)
  })

  it('returns the default for an unknown column id', () => {
    const h = createColumns(makeCtx())
    expect(h.getColumnBaseWidth('zzz')).toBe(140)
  })
})

describe('getColumnWidth', () => {
  it('uses the fitted width when no explicit override exists', () => {
    const ctx = makeCtx({ fittedColumnWidths: { a: 77 } })
    const h = createColumns(ctx)
    expect(h.getColumnWidth('a')).toBe(77)
  })

  it('prefers an explicit override over the fitted width', () => {
    const ctx = makeCtx({
      fittedColumnWidths: { a: 77 },
      columnWidths: { a: 300 },
    })
    const h = createColumns(ctx)
    expect(h.getColumnWidth('a')).toBe(300)
  })

  it('falls through to base width when there is no fitted width', () => {
    const h = createColumns(makeCtx())
    expect(h.getColumnWidth('c')).toBe(200)
  })
})

describe('column resize lifecycle', () => {
  let rafCb: FrameRequestCallback | null
  beforeEach(() => {
    rafCb = null
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      rafCb = cb
      return 1
    })
    vi.stubGlobal('cancelAnimationFrame', vi.fn())
  })

  it('startColumnResize seeds the resize state and registers listeners', () => {
    const ctx = makeCtx({ columnWidths: { a: 150 } })
    const h = createColumns(ctx)
    const addSpy = vi.spyOn(document, 'addEventListener')
    const e: any = {
      stopPropagation: vi.fn(),
      preventDefault: vi.fn(),
      clientX: 500,
    }
    h.startColumnResize(e, 'a')
    expect(ctx.resizingColumnId).toBe('a')
    expect(ctx.resizeStartX).toBe(500)
    expect(ctx.resizeStartWidth).toBe(150)
    expect(addSpy).toHaveBeenCalledWith('pointermove', expect.any(Function))
    addSpy.mockRestore()
  })

  it('onColumnResizeMove bails when no column is resizing', () => {
    const ctx = makeCtx({ resizingColumnId: null })
    const h = createColumns(ctx)
    h.onColumnResizeMove({ clientX: 100 } as any)
    expect(ctx.resizePendingWidth).toBe(0)
  })

  it('onColumnResizeMove clamps to MIN_COLUMN_WIDTH and commits on the frame', () => {
    const ctx = makeCtx({
      resizingColumnId: 'a',
      resizeStartX: 100,
      resizeStartWidth: 120,
    })
    const h = createColumns(ctx)
    // moving far left should clamp at MIN_COLUMN_WIDTH (40)
    h.onColumnResizeMove({ clientX: -1000 } as any)
    expect(ctx.resizePendingWidth).toBe(40)
    expect(rafCb).not.toBeNull()
    rafCb!(0)
    expect(ctx.columnWidths.a).toBe(40)
  })

  it('onColumnResizeMove grows the column and coalesces multiple moves into one frame', () => {
    const ctx = makeCtx({
      resizingColumnId: 'a',
      resizeStartX: 100,
      resizeStartWidth: 120,
    })
    const h = createColumns(ctx)
    h.onColumnResizeMove({ clientX: 150 } as any) // +50 -> 170, schedules raf
    const firstCb = rafCb
    h.onColumnResizeMove({ clientX: 200 } as any) // +100 -> 220, raf already pending
    expect(ctx.resizePendingWidth).toBe(220)
    expect(rafCb).toBe(firstCb) // not rescheduled
    rafCb!(0)
    expect(ctx.columnWidths.a).toBe(220)
  })

  it('onColumnResizeMove skips the commit if the column stopped resizing mid-frame', () => {
    const ctx = makeCtx({
      resizingColumnId: 'a',
      resizeStartX: 100,
      resizeStartWidth: 120,
    })
    const h = createColumns(ctx)
    h.onColumnResizeMove({ clientX: 150 } as any)
    ctx.resizingColumnId = null // resize ended before the frame ran
    rafCb!(0)
    expect(ctx.columnWidths.a).toBeUndefined()
  })

  it('endColumnResize commits the final pending width and tears down listeners', () => {
    const ctx = makeCtx({
      resizingColumnId: 'a',
      resizePendingWidth: 222,
      resizeRaf: 9,
    })
    const h = createColumns(ctx)
    const removeSpy = vi.spyOn(document, 'removeEventListener')
    h.endColumnResize()
    expect(ctx.columnWidths.a).toBe(222)
    expect(ctx.resizingColumnId).toBeNull()
    expect(ctx.resizeRaf).toBeNull()
    expect(removeSpy).toHaveBeenCalledWith('pointermove', expect.any(Function))
    removeSpy.mockRestore()
  })

  it('endColumnResize is safe when nothing was resizing', () => {
    const ctx = makeCtx()
    const h = createColumns(ctx)
    expect(() => h.endColumnResize()).not.toThrow()
    expect(ctx.columnWidths).toEqual({})
  })
})

describe('measureText', () => {
  it('returns 0 for empty text', () => {
    const h = createColumns(makeCtx())
    expect(h.measureText('', '16px sans-serif')).toBe(0)
  })

  it('measures via a lazily-created canvas and caches it', () => {
    const fakeCtx2d = { font: '', measureText: vi.fn(() => ({ width: 42 })) }
    const fakeCanvas = { getContext: vi.fn(() => fakeCtx2d) }
    const createElement = vi
      .spyOn(document, 'createElement')
      .mockReturnValue(fakeCanvas as any)
    const ctx = makeCtx()
    const h = createColumns(ctx)
    expect(h.measureText('hello', '16px sans-serif')).toBe(42)
    expect(ctx.measureCanvas).toBe(fakeCanvas)
    // second call reuses the cached canvas
    h.measureText('again', '16px sans-serif')
    expect(createElement).toHaveBeenCalledTimes(1)
    createElement.mockRestore()
  })

  it('returns 0 when the 2d context is unavailable', () => {
    const fakeCanvas = { getContext: vi.fn(() => null) }
    const createElement = vi
      .spyOn(document, 'createElement')
      .mockReturnValue(fakeCanvas as any)
    const h = createColumns(makeCtx())
    expect(h.measureText('hello', '16px sans-serif')).toBe(0)
    createElement.mockRestore()
  })
})

describe('autosizeColumn / autosizeAllColumns', () => {
  // jsdom doesn't provide the global CSS object; autosizeColumn uses
  // CSS.escape to build attribute selectors. Provide a minimal stub.
  beforeEach(() => {
    if (typeof (globalThis as any).CSS === 'undefined') {
      ;(globalThis as any).CSS = { escape: (s: string) => s }
    } else if (typeof (globalThis as any).CSS.escape !== 'function') {
      ;(globalThis as any).CSS.escape = (s: string) => s
    }
  })

  function fakeRoot(opts: {
    sampleCell?: any
    header?: any
    cells?: any[]
  }): any {
    const { sampleCell, header, cells = [] } = opts
    return {
      querySelector: (sel: string) => {
        if (sel.startsWith('[data-col-id=')) return sampleCell ?? null
        if (sel.startsWith('[data-svgrid-header-col=')) return header ?? null
        return null
      },
      querySelectorAll: () => cells,
    }
  }

  it('bails when there is no grid root element', () => {
    const ctx = makeCtx({ gridRootEl: null })
    const h = createColumns(ctx)
    expect(() => h.autosizeColumn('a')).not.toThrow()
    expect(ctx.columnWidths).toEqual({})
  })

  it('bails when no sample cell is found', () => {
    const ctx = makeCtx({ gridRootEl: fakeRoot({ sampleCell: null }) })
    const h = createColumns(ctx)
    h.autosizeColumn('a')
    expect(ctx.columnWidths).toEqual({})
  })

  it('snaps the width to the widest measured content', () => {
    // header label is 100px wide, one body cell is 200px wide.
    const labelEl = { textContent: 'Header' }
    const header = {
      querySelector: () => labelEl,
    }
    const sampleCell = { textContent: 'cell' }
    const bodyCell = { textContent: 'a very wide cell value' }
    const ctx = makeCtx({
      gridRootEl: fakeRoot({ sampleCell, header, cells: [bodyCell] }),
    })
    const h = createColumns(ctx)

    // stub getComputedStyle so .font is defined for measureText calls
    const gcs = vi
      .spyOn(window, 'getComputedStyle')
      .mockReturnValue({ font: '16px sans-serif' } as any)

    // Make measureText deterministic: header label -> 100, body cell -> 200.
    const fakeCtx2d = {
      font: '',
      measureText: (t: string) => ({ width: t === 'Header' ? 100 : 200 }),
    }
    const createElement = vi
      .spyOn(document, 'createElement')
      .mockReturnValue({ getContext: () => fakeCtx2d } as any)

    h.autosizeColumn('a')
    // widest is the 200px body cell -> 200 + 24 padding
    expect(ctx.columnWidths.a).toBe(224)

    gcs.mockRestore()
    createElement.mockRestore()
  })

  it('floors at MIN_COLUMN_WIDTH (+24 padding) when content measures zero', () => {
    // No label element -> the header itself is used as the measure target
    // (covering the `labelEl ?? header` fallback branch). Every measureText
    // returns 0, so max stays at MIN_COLUMN_WIDTH and the +24 padding is added.
    const header = { querySelector: () => null }
    const sampleCell = { textContent: '' }
    const ctx = makeCtx({
      MIN_COLUMN_WIDTH: 80,
      gridRootEl: fakeRoot({ sampleCell, header, cells: [] }),
    })
    const h = createColumns(ctx)
    const gcs = vi
      .spyOn(window, 'getComputedStyle')
      .mockReturnValue({ font: '16px sans-serif' } as any)
    const createElement = vi.spyOn(document, 'createElement').mockReturnValue({
      getContext: () => ({ font: '', measureText: () => ({ width: 0 }) }),
    } as any)

    h.autosizeColumn('a')
    // max = MIN(80); width = max(80, ceil(80) + 24) = 104
    expect(ctx.columnWidths.a).toBe(104)

    gcs.mockRestore()
    createElement.mockRestore()
  })

  it('autosizeAllColumns iterates every column and writes each width', () => {
    // Every querySelector returns a cell, every measured width is 50.
    const cell = { textContent: 'cell' }
    const header = { querySelector: () => ({ textContent: 'H' }) }
    const ctx = makeCtx({
      gridRootEl: fakeRoot({ sampleCell: cell, header, cells: [cell] }),
    })
    const h = createColumns(ctx)
    const gcs = vi
      .spyOn(window, 'getComputedStyle')
      .mockReturnValue({ font: '16px sans-serif' } as any)
    const createElement = vi.spyOn(document, 'createElement').mockReturnValue({
      getContext: () => ({ font: '', measureText: () => ({ width: 50 }) }),
    } as any)

    h.autosizeAllColumns()
    // a width was computed and stored for every column id
    expect(Object.keys(ctx.columnWidths).sort()).toEqual(['a', 'b', 'c', 'd'])

    gcs.mockRestore()
    createElement.mockRestore()
  })
})

describe('resetColumns', () => {
  it('clears widths, hidden columns and pinning', () => {
    const ctx = makeCtx({
      columnWidths: { a: 10 },
      hiddenColumns: { b: true },
      columnPinning: { left: ['a'], right: ['d'] },
    })
    const h = createColumns(ctx)
    h.resetColumns()
    expect(ctx.columnWidths).toEqual({})
    expect(ctx.hiddenColumns).toEqual({})
    expect(ctx.columnPinning).toEqual({ left: [], right: [] })
  })
})
