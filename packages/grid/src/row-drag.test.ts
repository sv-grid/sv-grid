/**
 * Unit tests for the managed row-drag handlers produced by createRowDrag(ctx).
 *
 * createRowDrag is a factory closing over a mutable `ctx` handle and a
 * module-level singleton "bus" that carries the dragged row between grids.
 * Because the bus is shared, we can create TWO fake ctxs (two grids) and drive
 * a genuine grid-to-grid move without mounting anything.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createRowDrag, rowDropZone } from './row-drag'

type AnyCtx = Record<string, any>
type Task = { id: number; title: string }

function makeCtx(rows: Task[], props: AnyCtx = {}): AnyCtx {
  return {
    props,
    internalData: rows,
    get allRows() {
      // allRows tracks internalData order; each Row wraps `.original`.
      return (this.internalData as Task[]).map((r) => ({ original: r }))
    },
    rowDragActive: false,
    rowDropIndex: null,
    rowDropSide: null,
  }
}

function fakeEvent(clientY = 0, rectTop = 0, rectHeight = 40): any {
  return {
    clientY,
    preventDefault: vi.fn(),
    stopPropagation: vi.fn(),
    dataTransfer: { setData: vi.fn(), effectAllowed: '', dropEffect: '' },
    currentTarget: {
      getBoundingClientRect: () => ({ top: rectTop, height: rectHeight, bottom: rectTop + rectHeight, left: 0 }),
    },
  }
}

const P = { rowDragManaged: true }

describe('createRowDrag - same-grid reorder', () => {
  it('moves a dragged row after the drop target', () => {
    const rows: Task[] = [
      { id: 1, title: 'a' },
      { id: 2, title: 'b' },
      { id: 3, title: 'c' },
      { id: 4, title: 'd' },
    ]
    const ctx = makeCtx(rows, { ...P })
    const h = createRowDrag(ctx)

    h.onRowDragStart(fakeEvent(), 0) // drag "a"
    ctx.rowDropSide = 'after'
    h.onRowDrop(fakeEvent(), 2) // drop after "c"

    expect((ctx.internalData as Task[]).map((r) => r.title)).toEqual(['b', 'c', 'a', 'd'])
  })

  it('drops before the target when the side is "before"', () => {
    const rows: Task[] = [
      { id: 1, title: 'a' },
      { id: 2, title: 'b' },
      { id: 3, title: 'c' },
    ]
    const ctx = makeCtx(rows, { ...P })
    const h = createRowDrag(ctx)
    h.onRowDragStart(fakeEvent(), 2) // drag "c"
    ctx.rowDropSide = 'before'
    h.onRowDrop(fakeEvent(), 0) // before "a"
    expect((ctx.internalData as Task[]).map((r) => r.title)).toEqual(['c', 'a', 'b'])
  })
})

describe('createRowDrag - grid-to-grid', () => {
  it('moves a row from source into target when groups match', () => {
    const a = makeCtx([{ id: 1, title: 'a1' }, { id: 2, title: 'a2' }], { ...P, rowDragGroup: 'g' })
    const b = makeCtx([{ id: 9, title: 'b1' }], { ...P, rowDragGroup: 'g', onRowDragEnd: vi.fn() })
    const ha = createRowDrag(a)
    const hb = createRowDrag(b)

    ha.onRowDragStart(fakeEvent(), 1) // drag "a2" out of grid A
    b.rowDropSide = 'before'
    hb.onRowDrop(fakeEvent(), 0) // drop onto grid B before "b1"

    expect((a.internalData as Task[]).map((r) => r.title)).toEqual(['a1'])
    expect((b.internalData as Task[]).map((r) => r.title)).toEqual(['a2', 'b1'])
    expect(b.props.onRowDragEnd).toHaveBeenCalledWith(
      expect.objectContaining({ sameGrid: false, toIndex: 0, row: expect.objectContaining({ title: 'a2' }) }),
    )
  })

  it('does NOT accept a drop when groups differ', () => {
    const a = makeCtx([{ id: 1, title: 'a1' }, { id: 2, title: 'a2' }], { ...P, rowDragGroup: 'g' })
    const b = makeCtx([{ id: 9, title: 'b1' }], { ...P, rowDragGroup: 'other' })
    const ha = createRowDrag(a)
    const hb = createRowDrag(b)

    ha.onRowDragStart(fakeEvent(), 0)
    const ev = fakeEvent()
    hb.onRowDragOver(ev, 0)
    expect(ev.preventDefault).not.toHaveBeenCalled() // over rejected
    hb.onRowDrop(fakeEvent(), 0)
    expect((b.internalData as Task[]).map((r) => r.title)).toEqual(['b1']) // unchanged
    expect((a.internalData as Task[]).length).toBe(2) // source untouched
  })

  it('appends to the target on an empty-space (container) drop', () => {
    const a = makeCtx([{ id: 1, title: 'a1' }, { id: 2, title: 'a2' }], { ...P, rowDragGroup: 'g' })
    const b = makeCtx([{ id: 9, title: 'b1' }], { ...P, rowDragGroup: 'g' })
    const ha = createRowDrag(a)
    const hb = createRowDrag(b)
    ha.onRowDragStart(fakeEvent(), 0) // drag "a1"
    hb.onRowsContainerDrop(fakeEvent())
    expect((b.internalData as Task[]).map((r) => r.title)).toEqual(['b1', 'a1'])
    expect((a.internalData as Task[]).map((r) => r.title)).toEqual(['a2'])
  })
})

describe('createRowDrag - disabled', () => {
  it('is inert when rowDragManaged is off', () => {
    const ctx = makeCtx([{ id: 1, title: 'a' }, { id: 2, title: 'b' }], {})
    const h = createRowDrag(ctx)
    h.onRowDragStart(fakeEvent(), 0)
    ctx.rowDropSide = 'after'
    h.onRowDrop(fakeEvent(), 1)
    expect((ctx.internalData as Task[]).map((r) => r.title)).toEqual(['a', 'b'])
  })
})

describe('rowDropZone (external drop target)', () => {
  function dropOn(el: HTMLElement) {
    const ev = new Event('drop', { bubbles: true, cancelable: true })
    el.dispatchEvent(ev)
  }

  it('removes the dragged row from its source grid and calls onDrop', () => {
    const a = makeCtx([{ id: 1, title: 'a1' }, { id: 2, title: 'a2' }], { ...P, rowDragGroup: 'g' })
    const ha = createRowDrag(a)
    ha.onRowDragStart(fakeEvent(), 0) // start dragging "a1"

    const el = document.createElement('div')
    const dropped: any[] = []
    const action = rowDropZone(el, { group: 'g', onDrop: (e) => dropped.push(e) })
    dropOn(el)

    expect(dropped.length).toBe(1)
    expect(dropped[0].row.title).toBe('a1')
    expect((a.internalData as Task[]).map((r) => r.title)).toEqual(['a2']) // removed from source
    action.destroy()
  })

  it('ignores drops when the group does not match', () => {
    const a = makeCtx([{ id: 1, title: 'a1' }], { ...P, rowDragGroup: 'g' })
    const ha = createRowDrag(a)
    ha.onRowDragStart(fakeEvent(), 0)

    const el = document.createElement('div')
    const dropped: any[] = []
    const action = rowDropZone(el, { group: 'other', onDrop: (e) => dropped.push(e) })
    dropOn(el)

    expect(dropped.length).toBe(0)
    expect((a.internalData as Task[]).length).toBe(1) // untouched
    action.destroy()
  })
})

/**
 * #69 - the drop indicator vanished mid-drag under row virtualization.
 *
 * Scrolling to the viewport edge unmounts the row the pointer is over, which
 * fires that row's `dragleave`. The replacement row does not fire `dragover`
 * until the next frame, so a synchronous clear left the user with no indicator
 * and no drop target until they moved the pointer.
 */
describe('createRowDrag - drop indicator during virtualized scroll (#69)', () => {
  const nextFrame = () => new Promise((r) => requestAnimationFrame(() => r(null)))

  it('keeps the indicator when the hovered row unmounts and another takes over', async () => {
    const rows: Task[] = [
      { id: 1, title: 'a' },
      { id: 2, title: 'b' },
      { id: 3, title: 'c' },
    ]
    const ctx = makeCtx(rows, P)
    const d = createRowDrag(ctx)

    d.onRowDragStart(fakeEvent(), 0)
    d.onRowDragOver(fakeEvent(30, 0, 40), 1)
    expect(ctx.rowDropIndex).toBe(1)

    // Virtualization unmounts row 1 from under the pointer, firing its leave.
    d.onRowDragLeave(1)

    // THIS is the bug: the replacement row has not fired `dragover` yet, and a
    // synchronous clear leaves the user with no indicator and no drop target in
    // the meantime. The indicator must survive the gap.
    expect(ctx.rowDropIndex).toBe(1)
    expect(ctx.rowDropSide).not.toBeNull()

    // The row scrolled into its place then takes over on the next frame.
    d.onRowDragOver(fakeEvent(30, 0, 40), 2)
    await nextFrame()
    await nextFrame()
    expect(ctx.rowDropIndex).toBe(2)
    expect(ctx.rowDropSide).not.toBeNull()
  })

  it('still clears once the pointer genuinely leaves the rows', async () => {
    const ctx = makeCtx([{ id: 1, title: 'a' }, { id: 2, title: 'b' }], P)
    const d = createRowDrag(ctx)

    d.onRowDragStart(fakeEvent(), 0)
    d.onRowDragOver(fakeEvent(30, 0, 40), 1)
    expect(ctx.rowDropIndex).toBe(1)

    d.onRowDragLeave(1)
    // No dragover follows - the deferral must not turn into a stuck indicator.
    await nextFrame()
    await nextFrame()
    expect(ctx.rowDropIndex).toBeNull()
    expect(ctx.rowDropSide).toBeNull()
  })

  it('does not write indicator state after the grid is destroyed', async () => {
    const ctx = makeCtx([{ id: 1, title: 'a' }, { id: 2, title: 'b' }], P)
    const d = createRowDrag(ctx)

    d.onRowDragStart(fakeEvent(), 0)
    d.onRowDragOver(fakeEvent(30, 0, 40), 1)
    d.onRowDragLeave(1)
    d.destroyRowDrag()
    ctx.rowDropIndex = 'sentinel'

    await nextFrame()
    await nextFrame()
    // A frame that survived teardown would have nulled this.
    expect(ctx.rowDropIndex).toBe('sentinel')
  })
})

/**
 * #66 - row drag was dead on touch: the whole feature rode on HTML5 DragEvent,
 * which iOS Safari and Android Chrome never fire for touch input.
 *
 * The pointer path is a second INPUT onto the same model, so these tests drive
 * the real handlers and assert on the same `bus` / indicator state the mouse
 * path uses, then check the reorder actually happened.
 */
describe('createRowDrag - touch (#66)', () => {
  const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))

  // `stubRowAt` replaces a global. Without restoring it, every later test in
  // the worker inherits a fake elementFromPoint - which showed up as an
  // intermittent failure elsewhere in the suite, not here.
  const realElementFromPoint = document.elementFromPoint
  afterEach(() => {
    ;(document as any).elementFromPoint = realElementFromPoint
  })

  function pointer(type: string, clientY: number, extra: AnyCtx = {}): any {
    return {
      pointerId: 1,
      pointerType: type,
      clientX: 10,
      clientY,
      preventDefault: vi.fn(),
      currentTarget: { setPointerCapture: vi.fn(), closest: () => null },
      ...extra,
    }
  }

  /** Put row `index` under the pointer, the way elementFromPoint would. */
  function stubRowAt(index: number, top: number, height = 40) {
    const marker = { dataset: { svgridRow: String(index) } }
    const tr = {
      querySelector: () => marker,
      getBoundingClientRect: () => ({ top, height, bottom: top + height }),
    }
    ;(document as any).elementFromPoint = () => ({ closest: (s: string) => (s === 'tr.sv-grid-row' ? tr : null) })
  }

  it('ignores mouse and pen so the HTML5 path keeps owning them', () => {
    const ctx = makeCtx([{ id: 1, title: 'a' }, { id: 2, title: 'b' }], P)
    const d = createRowDrag(ctx)
    d.onRowPointerDown(pointer('mouse', 10), 0)
    d.onRowPointerDown(pointer('pen', 10), 0)
    expect(ctx.rowDragActive).toBe(false)
  })

  it('does not start until the long press elapses', async () => {
    const ctx = makeCtx([{ id: 1, title: 'a' }, { id: 2, title: 'b' }], P)
    const d = createRowDrag(ctx)
    d.onRowPointerDown(pointer('touch', 10), 0)
    expect(ctx.rowDragActive).toBe(false)
    await wait(400)
    expect(ctx.rowDragActive).toBe(true)
    d.destroyRowDrag()
  })

  it('treats an early move as a scroll and never starts the drag', async () => {
    const ctx = makeCtx([{ id: 1, title: 'a' }, { id: 2, title: 'b' }], P)
    const d = createRowDrag(ctx)
    d.onRowPointerDown(pointer('touch', 10), 0)
    window.dispatchEvent(Object.assign(new Event('pointermove'), {
      pointerId: 1, clientX: 10, clientY: 60, preventDefault() {},
    }))
    await wait(400)
    expect(ctx.rowDragActive).toBe(false)
    d.destroyRowDrag()
  })

  it('reorders on lift, through the same commit as the mouse path', async () => {
    const rows: Task[] = [
      { id: 1, title: 'a' },
      { id: 2, title: 'b' },
      { id: 3, title: 'c' },
    ]
    const onRowDragEnd = vi.fn()
    const ctx = makeCtx(rows, { ...P, onRowDragEnd })
    const d = createRowDrag(ctx)

    d.onRowPointerDown(pointer('touch', 10), 0)
    await wait(400)
    expect(ctx.rowDragActive).toBe(true)

    // Finger moves over the lower half of row 2.
    stubRowAt(2, 80, 40)
    window.dispatchEvent(Object.assign(new Event('pointermove'), {
      pointerId: 1, clientX: 10, clientY: 115, preventDefault() {},
    }))
    expect(ctx.rowDropIndex).toBe(2)
    expect(ctx.rowDropSide).toBe('after')

    window.dispatchEvent(Object.assign(new Event('pointerup'), { pointerId: 1, clientY: 115 }))
    expect((ctx.internalData as Task[]).map((r) => r.id)).toEqual([2, 3, 1])
    expect(onRowDragEnd).toHaveBeenCalledTimes(1)
    expect(ctx.rowDragActive).toBe(false)
  })

  it('cancels without reordering on pointercancel', async () => {
    const rows: Task[] = [{ id: 1, title: 'a' }, { id: 2, title: 'b' }]
    const ctx = makeCtx(rows, P)
    const d = createRowDrag(ctx)
    d.onRowPointerDown(pointer('touch', 10), 0)
    await wait(400)
    window.dispatchEvent(Object.assign(new Event('pointercancel'), { pointerId: 1 }))
    expect((ctx.internalData as Task[]).map((r) => r.id)).toEqual([1, 2])
    expect(ctx.rowDragActive).toBe(false)
  })
})
