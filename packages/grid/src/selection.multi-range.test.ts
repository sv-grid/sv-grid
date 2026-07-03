/**
 * Unit tests for multiple-range (Ctrl+drag) cell selection, driven through the
 * pure range helpers of createSelection(ctx) with a minimal fake ctx.
 */
import { describe, expect, it } from 'vitest'
import { createSelection } from './selection'

function makeCtx() {
  return {
    enableCellSelectionEffective: true,
    selectionRange: { anchor: null, focus: null },
    selectionRanges: [],
  } as Record<string, any>
}

describe('multiple range selection', () => {
  it('a plain selection replaces any committed ranges', () => {
    const ctx = makeCtx()
    const s = createSelection(ctx)
    s.setSelection(0, 0)
    s.extendSelection(1, 1) // active range 0,0..1,1
    s.setSelection(5, 5, true) // additive: commit prior, start new
    expect(ctx.selectionRanges.length).toBe(1)
    s.setSelection(9, 9, false) // plain: clears committed
    expect(ctx.selectionRanges.length).toBe(0)
  })

  it('Ctrl+drag commits the prior range and keeps both highlighted', () => {
    const ctx = makeCtx()
    const s = createSelection(ctx)
    s.setSelection(0, 0)
    s.extendSelection(1, 1) // range A: rows 0-1, cols 0-1
    s.setSelection(3, 3, true) // start range B additively
    s.extendSelection(4, 4) // range B: rows 3-4, cols 3-4

    const rects = s.getSelectionRects()
    expect(rects.length).toBe(2)
    // both ranges report cells as selected
    expect(s.isCellInSelectedRange(0, 0)).toBe(true)
    expect(s.isCellInSelectedRange(1, 1)).toBe(true)
    expect(s.isCellInSelectedRange(4, 4)).toBe(true)
    // a cell in neither is not selected
    expect(s.isCellInSelectedRange(2, 2)).toBe(false)
  })

  it('getCellRangeEdges outlines each range independently', () => {
    const ctx = makeCtx()
    const s = createSelection(ctx)
    s.setSelection(0, 0)
    s.extendSelection(1, 1)
    s.setSelection(3, 3, true)
    s.extendSelection(4, 4)

    // top-left corner of range A
    expect(s.getCellRangeEdges(0, 0)).toEqual({ top: true, bottom: false, left: true, right: false })
    // bottom-right corner of range B
    expect(s.getCellRangeEdges(4, 4)).toEqual({ top: false, bottom: true, left: false, right: true })
    // outside every range
    expect(s.getCellRangeEdges(2, 2)).toBeNull()
  })
})
