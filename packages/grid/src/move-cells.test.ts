import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createClipboard } from './clipboard'

// ---------------------------------------------------------------------------
// Excel-style range move / copy (the `moveCells` prop): grab a selection
// border, drag it somewhere else, drop.
//
// Same hand-rolled `ctx` approach as clipboard.test.ts - the handlers talk to
// the controller only through this handle - but with the extra surface the
// move path needs: history, an editability predicate that can differ per cell,
// and a selection-rect view that can hold more than one range.
// ---------------------------------------------------------------------------

interface FakeOptions {
  columns?: Array<{ id: string; field?: string }>
  data?: Array<Record<string, unknown>>
  editableAt?: (r: number, c: number) => boolean
  moveCells?: boolean
}

function makeCtx(opts: FakeOptions = {}) {
  const columns = opts.columns ?? [
    { id: 'a', field: 'a' },
    { id: 'b', field: 'b' },
    { id: 'c', field: 'c' },
  ]
  let backing = (
    opts.data ?? [
      { a: 'a0', b: 'b0', c: 'c0' },
      { a: 'a1', b: 'b1', c: 'c1' },
      { a: 'a2', b: 'b2', c: 'c2' },
      { a: 'a3', b: 'b3', c: 'c3' },
    ]
  ).map((d) => ({ ...d }))

  const allColumns = columns.map((c) => ({
    id: c.id,
    columnDef: { field: c.field },
  }))

  const buildRows = (rows: Array<Record<string, unknown>>) =>
    rows.map((row, index) => ({
      id: String(index),
      original: row,
      getCanExpand: () => false,
      getCellValueByColumnId: (colId: string) => row[colId],
    }))

  let rows = buildRows(backing)

  const ctx: any = {
    allColumns,
    selectionRange: { anchor: null, focus: null } as any,
    selectionRanges: [] as any[],
    fillDrag: null,
    moveDrag: null,
    moveGrabHover: false,
    moveCellsEffective: opts.moveCells ?? true,
    editedCellValues: {} as Record<string, unknown>,
    userHasActivatedCell: false,
    gridRootEl: null,
    props: {} as Record<string, unknown>,
    history: [] as any[],
    historyPtr: -1,
    historyVersion: 0,
    UNDO_LIMIT: 200,
    activeCell: null as { rowIndex: number; colIndex: number } | null,
    setActiveCell(rowIndex: number, colIndex: number) {
      ctx.activeCell = { rowIndex, colIndex }
    },
    findColumnById: (id: string) => allColumns.find((c) => c.id === id),
    isCellEditableAt: opts.editableAt ?? (() => true),
    getCellDisplayValue: (_r: string, _c: string, base: unknown) => base,
    grid: { getState: () => ({ activeCell: ctx.activeCell }), store: { setState: vi.fn() } },
    getSelectionRects() {
      const norm = (r: any) =>
        r?.anchor && r?.focus
          ? {
              minRow: Math.min(r.anchor.rowIndex, r.focus.rowIndex),
              maxRow: Math.max(r.anchor.rowIndex, r.focus.rowIndex),
              minCol: Math.min(r.anchor.colIndex, r.focus.colIndex),
              maxCol: Math.max(r.anchor.colIndex, r.focus.colIndex),
            }
          : null
      const rects: any[] = []
      for (const r of ctx.selectionRanges) {
        const n = norm(r)
        if (n) rects.push(n)
      }
      const active = norm(ctx.selectionRange)
      if (active) rects.push(active)
      return rects
    },
    // Mirrors the real getCellRangeEdges: first containing rect wins.
    getCellRangeEdges(rowIndex: number, colIndex: number) {
      for (const rect of ctx.getSelectionRects()) {
        if (
          rowIndex < rect.minRow ||
          rowIndex > rect.maxRow ||
          colIndex < rect.minCol ||
          colIndex > rect.maxCol
        )
          continue
        return {
          top: rowIndex === rect.minRow,
          bottom: rowIndex === rect.maxRow,
          left: colIndex === rect.minCol,
          right: colIndex === rect.maxCol,
        }
      }
      return null
    },
  }

  Object.defineProperty(ctx, 'internalData', {
    get: () => backing,
    set: (next: Array<Record<string, unknown>>) => {
      backing = next
      rows = buildRows(next)
    },
  })
  Object.defineProperty(ctx, 'allRows', { get: () => rows })

  return ctx
}

/** Snapshot the grid as a plain matrix so assertions read like the screen. */
function grid(ctx: any) {
  return ctx.internalData.map((row: Record<string, unknown>) =>
    ctx.allColumns.map((col: any) => row[col.columnDef.field as string]),
  )
}

/** Select the rectangle (r0,c0)-(r1,c1) as the ACTIVE range. */
function select(ctx: any, r0: number, c0: number, r1: number, c1: number) {
  ctx.selectionRange = {
    anchor: { rowIndex: r0, colIndex: c0 },
    focus: { rowIndex: r1, colIndex: c1 },
  }
}

/** Run a whole drag: grab (grabRow,grabCol), drop on (targetRow,targetCol). */
function drop(
  cb: ReturnType<typeof createClipboard>,
  ctx: any,
  grab: [number, number],
  target: [number, number],
  copy = false,
) {
  ctx.moveDrag = {
    sourceMinRow: Math.min(ctx.selectionRange.anchor.rowIndex, ctx.selectionRange.focus.rowIndex),
    sourceMaxRow: Math.max(ctx.selectionRange.anchor.rowIndex, ctx.selectionRange.focus.rowIndex),
    sourceMinCol: Math.min(ctx.selectionRange.anchor.colIndex, ctx.selectionRange.focus.colIndex),
    sourceMaxCol: Math.max(ctx.selectionRange.anchor.colIndex, ctx.selectionRange.focus.colIndex),
    grabRow: grab[0],
    grabCol: grab[1],
    targetRow: target[0],
    targetCol: target[1],
    copy,
  }
  cb.onMovePointerUp()
}

describe('moveDestRect', () => {
  const base = {
    sourceMinRow: 1,
    sourceMaxRow: 2,
    sourceMinCol: 0,
    sourceMaxCol: 1,
    grabRow: 1,
    grabCol: 0,
  }

  it('offsets the source rectangle by how far the pointer travelled', () => {
    const cb = createClipboard(makeCtx())
    expect(cb.moveDestRect({ ...base, targetRow: 2, targetCol: 1 })).toEqual({
      minRow: 2,
      maxRow: 3,
      minCol: 1,
      maxCol: 2,
    })
  })

  it('measures the offset from the GRAB point, not the rectangle corner', () => {
    const cb = createClipboard(makeCtx())
    // Grabbed the bottom-right cell of the range and dropped it one row down:
    // the whole rectangle shifts by one, it does not jump to the pointer.
    expect(
      cb.moveDestRect({ ...base, grabRow: 2, grabCol: 1, targetRow: 3, targetCol: 1 }),
    ).toEqual({ minRow: 2, maxRow: 3, minCol: 0, maxCol: 1 })
  })

  it('is null when the drag never left the cell it started on', () => {
    const cb = createClipboard(makeCtx())
    expect(cb.moveDestRect({ ...base, targetRow: 1, targetCol: 0 })).toBeNull()
  })

  it('is null past every edge of the grid rather than clamping', () => {
    // 4 rows, 3 columns. The source is rows 1-2 x cols 0-1, so each of these
    // is a drag a user could really make - the destination just does not fit.
    const cb = createClipboard(makeCtx())
    // Grab the bottom row, drop it on the top row: the rectangle starts at -1.
    expect(cb.moveDestRect({ ...base, grabRow: 2, targetRow: 0, targetCol: 0 })).toBeNull()
    // Grab the right column, drop it on the left one: starts at column -1.
    expect(cb.moveDestRect({ ...base, grabCol: 1, targetRow: 1, targetCol: 0 })).toBeNull()
    expect(cb.moveDestRect({ ...base, targetRow: 3, targetCol: 0 })).toBeNull() // past row 3
    expect(cb.moveDestRect({ ...base, targetRow: 1, targetCol: 2 })).toBeNull() // past column 2
  })

  it('allows a shift that lands exactly on the first row', () => {
    // The guard is "outside the grid", not "close to the edge" - one row up
    // from row 1 is row 0, which is a perfectly good destination.
    const cb = createClipboard(makeCtx())
    expect(cb.moveDestRect({ ...base, targetRow: 0, targetCol: 0 })).toEqual({
      minRow: 0,
      maxRow: 1,
      minCol: 0,
      maxCol: 1,
    })
  })
})

describe('applyMoveRange - moving', () => {
  it('moves the values and blanks the cells they came from', () => {
    const ctx = makeCtx()
    const cb = createClipboard(ctx)
    select(ctx, 0, 0, 1, 0)
    drop(cb, ctx, [0, 0], [0, 1])
    expect(grid(ctx)).toEqual([
      [null, 'a0', 'c0'],
      [null, 'a1', 'c1'],
      ['a2', 'b2', 'c2'],
      ['a3', 'b3', 'c3'],
    ])
  })

  it('leaves no ghost when the source and destination overlap', () => {
    const ctx = makeCtx()
    const cb = createClipboard(ctx)
    // Three rows of column a, nudged down by one: rows 1-3 take the old
    // 0-2 values and row 0 is emptied. If the source were read lazily instead
    // of snapshotted, row 2 would receive the value row 1 had just been given.
    select(ctx, 0, 0, 2, 0)
    drop(cb, ctx, [0, 0], [1, 0])
    expect(grid(ctx).map((r: unknown[]) => r[0])).toEqual([null, 'a0', 'a1', 'a2'])
  })

  it('carries a 2x2 block across intact', () => {
    const ctx = makeCtx()
    const cb = createClipboard(ctx)
    select(ctx, 0, 0, 1, 1)
    drop(cb, ctx, [0, 0], [2, 1])
    expect(grid(ctx)).toEqual([
      [null, null, 'c0'],
      [null, null, 'c1'],
      ['a2', 'a0', 'b0'],
      ['a3', 'a1', 'b1'],
    ])
  })

  it('moves the range whose border was grabbed, not the active one', () => {
    const ctx = makeCtx()
    const cb = createClipboard(ctx)
    // A committed range on column a, plus an active one on column c.
    ctx.selectionRanges = [
      { anchor: { rowIndex: 0, colIndex: 0 }, focus: { rowIndex: 0, colIndex: 0 } },
    ]
    select(ctx, 3, 2, 3, 2)
    // startMoveDrag resolves the source through getSelectionRects, so seed the
    // drag the same way the pointer path would for the COMMITTED rectangle.
    ctx.moveDrag = {
      sourceMinRow: 0,
      sourceMaxRow: 0,
      sourceMinCol: 0,
      sourceMaxCol: 0,
      grabRow: 0,
      grabCol: 0,
      targetRow: 1,
      targetCol: 0,
      copy: false,
    }
    cb.onMovePointerUp()
    expect(grid(ctx)[0]![0]).toBeNull()
    expect(grid(ctx)[1]![0]).toBe('a0')
    // The active range's own cell is untouched.
    expect(grid(ctx)[3]![2]).toBe('c3')
  })
})

describe('applyMoveRange - copying', () => {
  it('leaves the source in place when copy is held', () => {
    const ctx = makeCtx()
    const cb = createClipboard(ctx)
    select(ctx, 0, 0, 1, 0)
    drop(cb, ctx, [0, 0], [0, 1], true)
    expect(grid(ctx)).toEqual([
      ['a0', 'a0', 'c0'],
      ['a1', 'a1', 'c1'],
      ['a2', 'b2', 'c2'],
      ['a3', 'b3', 'c3'],
    ])
  })

  it('copies even out of read-only source cells', () => {
    // Nothing is written to the source, so its editability is irrelevant -
    // a read-only column is still copyable, which is the point of copy.
    const ctx = makeCtx({ editableAt: (_r, c) => c !== 0 })
    const cb = createClipboard(ctx)
    select(ctx, 0, 0, 0, 0)
    drop(cb, ctx, [0, 0], [0, 1], true)
    expect(grid(ctx)[0]).toEqual(['a0', 'a0', 'c0'])
  })
})

describe('applyMoveRange - refusals', () => {
  it('changes nothing when the destination runs off the grid', () => {
    const ctx = makeCtx()
    const cb = createClipboard(ctx)
    const before = grid(ctx)
    select(ctx, 2, 0, 3, 0)
    drop(cb, ctx, [2, 0], [3, 0]) // would need rows 3-4; there is no row 4
    expect(grid(ctx)).toEqual(before)
  })

  it('refuses the whole move when ANY destination cell is read-only', () => {
    // Half-applying would split the range across two places with nothing on
    // screen to say which half landed.
    const ctx = makeCtx({ editableAt: (r, c) => !(c === 1 && r === 1) })
    const cb = createClipboard(ctx)
    const before = grid(ctx)
    select(ctx, 0, 0, 1, 0)
    drop(cb, ctx, [0, 0], [0, 1])
    expect(grid(ctx)).toEqual(before)
  })

  it('refuses a move out of a read-only source, which would have to be blanked', () => {
    const ctx = makeCtx({ editableAt: (_r, c) => c !== 0 })
    const cb = createClipboard(ctx)
    const before = grid(ctx)
    select(ctx, 0, 0, 0, 0)
    drop(cb, ctx, [0, 0], [0, 1])
    expect(grid(ctx)).toEqual(before)
  })

  it('refuses when a column on either side has no field to write back to', () => {
    const ctx = makeCtx({
      columns: [{ id: 'a', field: 'a' }, { id: 'computed' }, { id: 'c', field: 'c' }],
    })
    const cb = createClipboard(ctx)
    const before = grid(ctx)
    select(ctx, 0, 0, 0, 0)
    drop(cb, ctx, [0, 0], [0, 1])
    expect(grid(ctx)).toEqual(before)
  })

  it('clears the drag even when it refuses, so the pointer stops being tracked', () => {
    const ctx = makeCtx()
    const cb = createClipboard(ctx)
    select(ctx, 2, 0, 3, 0)
    drop(cb, ctx, [2, 0], [3, 0])
    expect(ctx.moveDrag).toBeNull()
  })
})

describe('applyMoveRange - aftermath', () => {
  it('records one undo step per changed cell', () => {
    const ctx = makeCtx()
    const cb = createClipboard(ctx)
    select(ctx, 0, 0, 1, 0)
    drop(cb, ctx, [0, 0], [0, 1])
    // 2 source cells blanked + 2 destination cells written.
    expect(ctx.history).toHaveLength(4)
    expect(ctx.historyPtr).toBe(3)
    expect(ctx.history[0]).toMatchObject({ rowId: '0', columnId: 'a', before: 'a0', after: null })
    expect(ctx.history[2]).toMatchObject({ rowId: '0', columnId: 'b', before: 'b0', after: 'a0' })
  })

  it('truncates any redo history the way a normal edit does', () => {
    const ctx = makeCtx()
    ctx.history = [{ rowId: 'x', columnId: 'a', field: 'a', before: 1, after: 2 }]
    ctx.historyPtr = -1 // an undone step, still redoable
    const cb = createClipboard(ctx)
    select(ctx, 0, 0, 0, 0)
    drop(cb, ctx, [0, 0], [0, 1])
    expect(ctx.history.map((s: any) => s.rowId)).not.toContain('x')
  })

  it('leaves the moved range selected where it landed', () => {
    const ctx = makeCtx()
    const cb = createClipboard(ctx)
    select(ctx, 0, 0, 1, 1)
    drop(cb, ctx, [0, 0], [2, 1])
    expect(ctx.selectionRange).toEqual({
      anchor: { rowIndex: 2, colIndex: 1 },
      focus: { rowIndex: 3, colIndex: 2 },
    })
    expect(ctx.selectionRanges).toEqual([])
    expect(ctx.activeCell).toEqual({ rowIndex: 2, colIndex: 1 })
  })

  it('reports every write through onCellValueChange', () => {
    const ctx = makeCtx()
    const onCellValueChange = vi.fn()
    ctx.props.onCellValueChange = onCellValueChange
    const cb = createClipboard(ctx)
    select(ctx, 0, 0, 0, 0)
    drop(cb, ctx, [0, 0], [0, 1])
    expect(onCellValueChange).toHaveBeenCalledTimes(2)
    expect(onCellValueChange).toHaveBeenCalledWith(
      expect.objectContaining({ columnId: 'a', oldValue: 'a0', newValue: null }),
    )
    expect(onCellValueChange).toHaveBeenCalledWith(
      expect.objectContaining({ columnId: 'b', oldValue: 'b0', newValue: 'a0' }),
    )
  })
})

// ---------------------------------------------------------------------------
// The grab strip. jsdom gives every element a zero rect, so the cell's
// geometry is stubbed - these assertions are about the 4px arithmetic, not
// about layout.
// ---------------------------------------------------------------------------

function cellEl(width = 100, height = 24, left = 0, top = 0) {
  return {
    getBoundingClientRect: () => ({ left, top, width, height, right: left + width, bottom: top + height }),
  } as unknown as HTMLElement
}

describe('isOnMoveGrabStrip', () => {
  it('hits the outer 4px of each edge the cell sits on', () => {
    const ctx = makeCtx()
    const cb = createClipboard(ctx)
    select(ctx, 1, 1, 2, 2) // the cell at (1,1) is on the top and left edges
    const el = cellEl()
    expect(cb.isOnMoveGrabStrip(el, 1, 1, 50, 2)).toBe(true) // top strip
    expect(cb.isOnMoveGrabStrip(el, 1, 1, 3, 12)).toBe(true) // left strip
    expect(cb.isOnMoveGrabStrip(el, 2, 2, 50, 22)).toBe(true) // bottom strip
    expect(cb.isOnMoveGrabStrip(el, 2, 2, 98, 12)).toBe(true) // right strip
  })

  it('misses the interior, so a plain click still starts a new selection', () => {
    const ctx = makeCtx()
    const cb = createClipboard(ctx)
    select(ctx, 1, 1, 2, 2)
    expect(cb.isOnMoveGrabStrip(cellEl(), 1, 1, 50, 12)).toBe(false)
  })

  it('misses the edge a cell is NOT on', () => {
    const ctx = makeCtx()
    const cb = createClipboard(ctx)
    select(ctx, 1, 1, 2, 2)
    // (1,1) is the top-LEFT corner: its bottom and right sides are interior.
    expect(cb.isOnMoveGrabStrip(cellEl(), 1, 1, 50, 22)).toBe(false)
    expect(cb.isOnMoveGrabStrip(cellEl(), 1, 1, 98, 12)).toBe(false)
  })

  it('misses every cell outside the selection', () => {
    const ctx = makeCtx()
    const cb = createClipboard(ctx)
    select(ctx, 1, 1, 2, 2)
    expect(cb.isOnMoveGrabStrip(cellEl(), 0, 0, 1, 1)).toBe(false)
  })

  it('is off entirely when moveCells is disabled', () => {
    const ctx = makeCtx({ moveCells: false })
    const cb = createClipboard(ctx)
    select(ctx, 1, 1, 2, 2)
    expect(cb.isOnMoveGrabStrip(cellEl(), 1, 1, 50, 2)).toBe(false)
  })

  it('accounts for the cell offset, not just its size', () => {
    const ctx = makeCtx()
    const cb = createClipboard(ctx)
    select(ctx, 1, 1, 1, 1)
    const el = cellEl(100, 24, 300, 500)
    expect(cb.isOnMoveGrabStrip(el, 1, 1, 350, 502)).toBe(true)
    expect(cb.isOnMoveGrabStrip(el, 1, 1, 350, 512)).toBe(false)
  })
})

describe('startMoveDrag', () => {
  function pointerEvent(x: number, y: number, target: unknown, extra: Record<string, unknown> = {}) {
    return {
      button: 0,
      clientX: x,
      clientY: y,
      target,
      ctrlKey: false,
      metaKey: false,
      stopPropagation: vi.fn(),
      preventDefault: vi.fn(),
      ...extra,
    } as unknown as PointerEvent
  }

  /** A stub `td` that answers `closest()` with itself, as the real one would. */
  function td(width = 100, height = 24) {
    const el: any = cellEl(width, height)
    el.closest = () => el
    return el as HTMLElement
  }

  it('starts a drag on the border and reports that it claimed the event', () => {
    const ctx = makeCtx()
    const cb = createClipboard(ctx)
    select(ctx, 1, 0, 2, 1)
    const el = td()
    expect(cb.startMoveDrag(pointerEvent(50, 2, el), 1, 0)).toBe(true)
    expect(ctx.moveDrag).toMatchObject({
      sourceMinRow: 1,
      sourceMaxRow: 2,
      sourceMinCol: 0,
      sourceMaxCol: 1,
      grabRow: 1,
      grabCol: 0,
      targetRow: 1,
      targetCol: 0,
      copy: false,
    })
  })

  it('declines an interior pointerdown and leaves the selection path alone', () => {
    const ctx = makeCtx()
    const cb = createClipboard(ctx)
    select(ctx, 1, 0, 2, 1)
    const event = pointerEvent(50, 12, td())
    expect(cb.startMoveDrag(event, 1, 0)).toBe(false)
    expect(ctx.moveDrag).toBeNull()
    expect(event.preventDefault).not.toHaveBeenCalled()
  })

  it('declines touch, which would otherwise block the page from scrolling', () => {
    // This path calls preventDefault, so a finger landing within 4px of a
    // selection border would start a move AND kill native scroll for that
    // gesture. Drag-select already refuses touch for a milder version of the
    // same problem (issue #23).
    const ctx = makeCtx()
    const cb = createClipboard(ctx)
    select(ctx, 1, 0, 2, 1)
    const event = pointerEvent(50, 2, td(), { pointerType: 'touch' })
    expect(cb.startMoveDrag(event, 1, 0)).toBe(false)
    expect(ctx.moveDrag).toBeNull()
    expect(event.preventDefault).not.toHaveBeenCalled()
  })

  it('still accepts a pen, which has hover and does not scroll the page', () => {
    const ctx = makeCtx()
    const cb = createClipboard(ctx)
    select(ctx, 1, 0, 2, 1)
    expect(cb.startMoveDrag(pointerEvent(50, 2, td(), { pointerType: 'pen' }), 1, 0)).toBe(true)
  })

  it('declines anything but the primary button', () => {
    const ctx = makeCtx()
    const cb = createClipboard(ctx)
    select(ctx, 1, 0, 2, 1)
    expect(cb.startMoveDrag(pointerEvent(50, 2, td(), { button: 2 }), 1, 0)).toBe(false)
  })

  it('reads Ctrl (and Cmd) as copy', () => {
    const ctx = makeCtx()
    const cb = createClipboard(ctx)
    select(ctx, 1, 0, 1, 0)
    cb.startMoveDrag(pointerEvent(50, 2, td(), { ctrlKey: true }), 1, 0)
    expect(ctx.moveDrag.copy).toBe(true)
    ctx.moveDrag = null
    cb.startMoveDrag(pointerEvent(50, 2, td(), { metaKey: true }), 1, 0)
    expect(ctx.moveDrag.copy).toBe(true)
  })
})

describe('onMovePointerMove', () => {
  function moveEvent(extra: Record<string, unknown> = {}) {
    return { clientX: 10, clientY: 10, ctrlKey: false, metaKey: false, ...extra } as PointerEvent
  }

  /** jsdom does not implement `document.elementFromPoint` at all - it is not
   *  a stub returning null, the property is absent - so `vi.spyOn` has
   *  nothing to wrap. Install it for the duration of one test. */
  function stubElementFromPoint(result: Element | null) {
    const calls = { count: 0 }
    Object.defineProperty(document, 'elementFromPoint', {
      configurable: true,
      writable: true,
      value: () => {
        calls.count += 1
        return result
      },
    })
    return calls
  }

  afterEach(() => {
    delete (document as unknown as Record<string, unknown>).elementFromPoint
  })

  function seed(ctx: any) {
    ctx.moveDrag = {
      sourceMinRow: 0,
      sourceMaxRow: 0,
      sourceMinCol: 0,
      sourceMaxCol: 0,
      grabRow: 0,
      grabCol: 0,
      targetRow: 0,
      targetCol: 0,
      copy: false,
    }
  }

  it('follows the cell under the pointer', () => {
    const ctx = makeCtx()
    const cb = createClipboard(ctx)
    seed(ctx)
    const cell: any = { dataset: { svgridRow: '2', svgridCol: '1' } }
    cell.closest = () => cell
    stubElementFromPoint(cell)
    cb.onMovePointerMove(moveEvent())
    expect(ctx.moveDrag).toMatchObject({ targetRow: 2, targetCol: 1 })
  })

  it('picks up the copy modifier mid-drag, even between cells', () => {
    const ctx = makeCtx()
    const cb = createClipboard(ctx)
    seed(ctx)
    stubElementFromPoint(null)
    cb.onMovePointerMove(moveEvent({ ctrlKey: true }))
    expect(ctx.moveDrag.copy).toBe(true)
    cb.onMovePointerMove(moveEvent({ ctrlKey: false }))
    expect(ctx.moveDrag.copy).toBe(false)
  })

  it('takes the copy modifier from the release, not just the last move', () => {
    // 'drag, then press Ctrl, then let go' is the natural way to do it, and
    // pointermove has stopped firing by then.
    const ctx = makeCtx()
    const cb = createClipboard(ctx)
    select(ctx, 0, 0, 0, 0)
    ctx.moveDrag = {
      sourceMinRow: 0, sourceMaxRow: 0, sourceMinCol: 0, sourceMaxCol: 0,
      grabRow: 0, grabCol: 0, targetRow: 0, targetCol: 1, copy: false,
    }
    cb.onMovePointerUp({ ctrlKey: true, metaKey: false } as PointerEvent)
    expect(grid(ctx)[0]).toEqual(['a0', 'a0', 'c0'])
  })

  it('does nothing at all when no move is in flight', () => {
    const ctx = makeCtx()
    const cb = createClipboard(ctx)
    const calls = stubElementFromPoint(null)
    cb.onMovePointerMove(moveEvent())
    expect(calls.count).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// Edge auto-scroll. Shared by the fill drag, the range move and plain
// drag-select: without it a drag can only ever reach cells that were already
// on screen when it started.
// ---------------------------------------------------------------------------

describe('edge auto-scroll', () => {
  const HOVERED = { row: 3, col: 2 }

  beforeEach(() => {
    const cell: any = { dataset: { svgridRow: String(HOVERED.row), svgridCol: String(HOVERED.col) } }
    cell.closest = () => cell
    Object.defineProperty(document, 'elementFromPoint', {
      configurable: true,
      writable: true,
      value: () => cell,
    })
  })
  afterEach(() => {
    delete (document as unknown as Record<string, unknown>).elementFromPoint
  })

  /** A stand-in scroll container with a real rect and settable scroll offsets. */
  function scroller(over: Record<string, unknown> = {}): any {
    return {
      scrollTop: 100,
      scrollLeft: 100,
      getBoundingClientRect: () => ({ left: 0, top: 0, right: 500, bottom: 300, width: 500, height: 300 }),
      ...over,
    }
  }

  /** Drive N animation frames synchronously. */
  type Flush = (n?: number) => void
  function withFrames<T>(run: (flush: Flush, queue: Array<FrameRequestCallback | null>) => T): T {
    const queue: Array<FrameRequestCallback | null> = []
    const raf = globalThis.requestAnimationFrame
    const caf = globalThis.cancelAnimationFrame
    globalThis.requestAnimationFrame = (cb: FrameRequestCallback) => { queue.push(cb); return queue.length }
    globalThis.cancelAnimationFrame = (id: number) => { queue[id - 1] = null }
    const flush: Flush = (n = 1) => {
      for (let i = 0; i < n; i += 1) {
        const cb = queue.shift()
        if (cb) cb(0)
      }
    }
    try { return run(flush, queue) } finally {
      globalThis.requestAnimationFrame = raf
      globalThis.cancelAnimationFrame = caf
    }
  }

  function movingCtx(over: Record<string, unknown> = {}) {
    const ctx = makeCtx()
    ctx.scrollContainer = scroller(over)
    ctx.isDraggingSelection = false
    ctx.extendSelection = vi.fn()
    ctx.moveDrag = {
      sourceMinRow: 0, sourceMaxRow: 0, sourceMinCol: 0, sourceMaxCol: 0,
      grabRow: 0, grabCol: 0, targetRow: 0, targetCol: 0, copy: false,
    }
    return ctx
  }

  it('scrolls down while the pointer sits near the bottom edge', () => {
    const ctx = movingCtx()
    const cb = createClipboard(ctx)
    withFrames((flush) => {
      // Container bottom is 300; 295 is well inside the 40px band.
      cb.trackEdgeScroll({ clientX: 250, clientY: 295 } as PointerEvent)
      flush()
      expect(ctx.scrollContainer.scrollTop).toBeGreaterThan(100)
    })
  })

  it('scrolls up, left and right from the matching edges', () => {
    const cases: Array<[number, number, 'scrollTop' | 'scrollLeft', number]> = [
      [250, 5, 'scrollTop', -1],
      [5, 150, 'scrollLeft', -1],
      [495, 150, 'scrollLeft', 1],
    ]
    for (const [x, y, axis, dir] of cases) {
      const ctx = movingCtx()
      const cb = createClipboard(ctx)
      withFrames((flush) => {
        cb.trackEdgeScroll({ clientX: x, clientY: y } as PointerEvent)
        flush()
        const moved = ctx.scrollContainer[axis] - 100
        expect(Math.sign(moved), `${axis} at (${x},${y})`).toBe(dir)
      })
    }
  })

  it('does nothing while the pointer is in the middle', () => {
    const ctx = movingCtx()
    const cb = createClipboard(ctx)
    withFrames((flush) => {
      cb.trackEdgeScroll({ clientX: 250, clientY: 150 } as PointerEvent)
      flush()
      expect(ctx.scrollContainer.scrollTop).toBe(100)
      expect(ctx.scrollContainer.scrollLeft).toBe(100)
    })
  })

  it('ramps: deeper into the band scrolls faster', () => {
    const at = (y: number) => {
      const ctx = movingCtx()
      const cb = createClipboard(ctx)
      return withFrames((flush) => {
        cb.trackEdgeScroll({ clientX: 250, clientY: y } as PointerEvent)
        flush()
        return ctx.scrollContainer.scrollTop - 100
      })
    }
    // 270 is 10px into the 40px band, 299 is at the very edge.
    expect(at(299)).toBeGreaterThan(at(270))
  })

  it('keeps scrolling frame after frame with the pointer parked still', () => {
    const ctx = movingCtx()
    const cb = createClipboard(ctx)
    withFrames((flush) => {
      cb.trackEdgeScroll({ clientX: 250, clientY: 295 } as PointerEvent)
      flush()
      const after1 = ctx.scrollContainer.scrollTop
      flush()
      expect(ctx.scrollContainer.scrollTop).toBeGreaterThan(after1)
    })
  })

  it('stops as soon as the drag ends', () => {
    const ctx = movingCtx()
    const cb = createClipboard(ctx)
    withFrames((flush) => {
      cb.trackEdgeScroll({ clientX: 250, clientY: 295 } as PointerEvent)
      flush()
      const parked = ctx.scrollContainer.scrollTop
      ctx.moveDrag = null
      flush()
      flush()
      expect(ctx.scrollContainer.scrollTop).toBe(parked)
    })
  })

  it('re-targets the drag at whatever cell the scroll brought under the pointer', () => {
    const ctx = movingCtx()
    const cb = createClipboard(ctx)
    withFrames((flush) => {
      cb.trackEdgeScroll({ clientX: 250, clientY: 295 } as PointerEvent)
      flush()
    })
    expect(ctx.moveDrag).toMatchObject({ targetRow: HOVERED.row, targetCol: HOVERED.col })
  })

  it('does not re-target when the scroll is already clamped at the end', () => {
    // scrollTop never moves, so the pointer is parked over one cell and
    // re-targeting every frame would flicker the selection.
    const stuck = scroller()
    Object.defineProperty(stuck, 'scrollTop', { get: () => 0, set: () => {} })
    const ctx = movingCtx()
    ctx.scrollContainer = stuck
    const cb = createClipboard(ctx)
    const before = { ...ctx.moveDrag }
    withFrames((flush) => {
      cb.trackEdgeScroll({ clientX: 250, clientY: 295 } as PointerEvent)
      flush()
      flush()
    })
    expect(ctx.moveDrag).toEqual(before)
  })

  it('drives a plain drag-select too, not just fill and move', () => {
    const ctx = movingCtx()
    ctx.moveDrag = null
    ctx.isDraggingSelection = true
    const cb = createClipboard(ctx)
    withFrames((flush) => {
      cb.trackEdgeScroll({ clientX: 250, clientY: 295 } as PointerEvent)
      flush()
      expect(ctx.scrollContainer.scrollTop).toBeGreaterThan(100)
    })
  })

  it('never starts when nothing is being dragged', () => {
    const ctx = movingCtx()
    ctx.moveDrag = null
    const cb = createClipboard(ctx)
    withFrames((flush) => {
      cb.trackEdgeScroll({ clientX: 250, clientY: 295 } as PointerEvent)
      flush()
      expect(ctx.scrollContainer.scrollTop).toBe(100)
    })
  })
})
