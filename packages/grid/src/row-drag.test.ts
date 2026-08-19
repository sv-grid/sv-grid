/**
 * Unit tests for the managed row-drag handlers produced by createRowDrag(ctx).
 *
 * createRowDrag is a factory closing over a mutable `ctx` handle and a
 * module-level singleton "bus" that carries the dragged row between grids.
 * Because the bus is shared, we can create TWO fake ctxs (two grids) and drive
 * a genuine grid-to-grid move without mounting anything.
 */
import { describe, expect, it, vi } from 'vitest'
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
