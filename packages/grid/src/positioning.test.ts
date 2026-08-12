import { describe, it, expect } from 'vitest'
import { computePosition, parsePlacement, type Rect, type Viewport } from './positioning'

const VP: Viewport = { width: 1000, height: 800 }
// A reference in the middle of the viewport, 100x40.
const mid: Rect = { x: 450, y: 380, width: 100, height: 40 }
const floating: Viewport = { width: 200, height: 120 }

describe('parsePlacement', () => {
  it('defaults the bare side to center alignment', () => {
    expect(parsePlacement('bottom')).toEqual({ side: 'bottom', align: 'center' })
    expect(parsePlacement('top-start')).toEqual({ side: 'top', align: 'start' })
    expect(parsePlacement('right-end')).toEqual({ side: 'right', align: 'end' })
  })
})

describe('computePosition - placements', () => {
  it('bottom-start sits below, left-aligned to the reference', () => {
    const r = computePosition(mid, floating, { placement: 'bottom-start', offset: 6, viewport: VP })
    expect(r.side).toBe('bottom')
    expect(r.y).toBe(mid.y + mid.height + 6) // 426
    expect(r.x).toBe(mid.x) // 450
  })

  it('bottom (center) centers the floating over the reference', () => {
    const r = computePosition(mid, floating, { placement: 'bottom', offset: 6, viewport: VP, shift: false })
    expect(r.x).toBe(mid.x + mid.width / 2 - floating.width / 2) // 500 - 100 = 400
  })

  it('bottom-end right-aligns the floating to the reference', () => {
    const r = computePosition(mid, floating, { placement: 'bottom-end', offset: 6, viewport: VP })
    expect(r.x).toBe(mid.x + mid.width - floating.width) // 550 - 200 = 350
  })

  it('top places above the reference', () => {
    const r = computePosition(mid, floating, { placement: 'top-start', offset: 6, viewport: VP })
    expect(r.side).toBe('top')
    expect(r.y).toBe(mid.y - floating.height - 6) // 380 - 126 = 254
  })

  it('right places to the right, vertically centered', () => {
    const r = computePosition(mid, floating, { placement: 'right', offset: 6, viewport: VP, shift: false })
    expect(r.side).toBe('right')
    expect(r.x).toBe(mid.x + mid.width + 6) // 556
    expect(r.y).toBe(mid.y + mid.height / 2 - floating.height / 2) // 400 - 60 = 340
  })

  it('left places to the left of the reference', () => {
    const r = computePosition(mid, floating, { placement: 'left', offset: 6, viewport: VP, shift: false })
    expect(r.x).toBe(mid.x - floating.width - 6) // 450 - 206 = 244
  })
})

describe('computePosition - flip', () => {
  it('flips bottom -> top when there is no room below', () => {
    const nearBottom: Rect = { x: 450, y: 760, width: 100, height: 30 } // 30px below to viewport edge
    const r = computePosition(nearBottom, floating, { placement: 'bottom-start', viewport: VP })
    expect(r.side).toBe('top')
    expect(r.y).toBe(nearBottom.y - floating.height - 6)
  })

  it('does NOT flip when the preferred side fits', () => {
    const r = computePosition(mid, floating, { placement: 'bottom-start', viewport: VP })
    expect(r.side).toBe('bottom')
  })

  it('keeps the preferred side when flip is disabled even if it overflows', () => {
    const nearBottom: Rect = { x: 450, y: 760, width: 100, height: 30 }
    const r = computePosition(nearBottom, floating, { placement: 'bottom-start', flip: false, viewport: VP })
    expect(r.side).toBe('bottom')
  })

  it('flips right -> left when there is no room on the right', () => {
    const nearRight: Rect = { x: 940, y: 380, width: 50, height: 40 } // 10px to right edge
    const r = computePosition(nearRight, floating, { placement: 'right', viewport: VP })
    expect(r.side).toBe('left')
  })
})

describe('computePosition - shift', () => {
  it('clamps a start-aligned floating back inside the right edge', () => {
    const nearRight: Rect = { x: 950, y: 380, width: 40, height: 40 }
    const r = computePosition(nearRight, floating, { placement: 'bottom-start', padding: 8, viewport: VP })
    // Would be x=950, but must fit: max x = 1000 - 8 - 200 = 792
    expect(r.x).toBe(792)
  })

  it('clamps to the left padding when the floating is wider than the room', () => {
    const nearLeft: Rect = { x: 4, y: 380, width: 40, height: 40 }
    const r = computePosition(nearLeft, floating, { placement: 'bottom-start', padding: 8, viewport: VP })
    expect(r.x).toBe(8) // left padding
  })

  it('does not shift when disabled', () => {
    const nearRight: Rect = { x: 950, y: 380, width: 40, height: 40 }
    const r = computePosition(nearRight, floating, { placement: 'bottom-start', shift: false, viewport: VP })
    expect(r.x).toBe(950)
  })
})

describe('computePosition - size', () => {
  it('reports the room below for a bottom placement', () => {
    const r = computePosition(mid, floating, { placement: 'bottom-start', offset: 6, padding: 8, viewport: VP })
    // 800 - 8 - (380 + 40 + 6) = 366
    expect(r.maxHeight).toBe(366)
    expect(r.maxWidth).toBe(VP.width - 16)
  })

  it('reports the room above for a top placement', () => {
    const r = computePosition(mid, floating, { placement: 'top-start', offset: 6, padding: 8, viewport: VP })
    // 380 - 6 - 8 = 366
    expect(r.maxHeight).toBe(366)
  })

  it('honors the minMainAxis floor when the side is cramped', () => {
    const nearBottom: Rect = { x: 450, y: 790, width: 100, height: 8 }
    const r = computePosition(nearBottom, floating, { placement: 'bottom-start', flip: false, minMainAxis: 96, viewport: VP })
    expect(r.maxHeight).toBe(96)
  })
})

describe('computePosition - arrow', () => {
  it('points the arrow at the reference center for a bottom placement', () => {
    const r = computePosition(mid, floating, { placement: 'bottom-start', arrow: { size: 10 }, viewport: VP })
    // reference center x = 500; floating x = 450; arrow = 500 - 450 - 5 = 45
    expect(r.arrow?.x).toBe(45)
  })

  it('clamps the arrow inside the floating (minus padding)', () => {
    // end-aligned so the reference center is near the floating's leading edge
    const r = computePosition(mid, floating, { placement: 'bottom-end', arrow: { size: 10 }, padding: 8, viewport: VP })
    // floating x = 350; center 500; raw arrow = 500 - 350 - 5 = 145; max = 200 - 10 - 8 = 182 -> stays 145
    expect(r.arrow?.x).toBe(145)
  })

  it('produces a y arrow offset for side placements', () => {
    const r = computePosition(mid, floating, { placement: 'right', arrow: { size: 10 }, shift: false, viewport: VP })
    // reference center y = 400; floating y = 340; arrow y = 400 - 340 - 5 = 55
    expect(r.arrow?.y).toBe(55)
  })
})
