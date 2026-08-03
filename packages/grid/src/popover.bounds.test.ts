/**
 * Bounds detection for anchored popover panels: flip up/down by available room,
 * cap the panel height to the viewport, and never let an upward flip start
 * off-screen. Pairs with the drag math in panel-resize.
 */
import { describe, expect, it, beforeAll } from 'vitest'
import { anchoredRect } from './popover'

const VIEWPORT_H = 800
const VIEWPORT_W = 1200

beforeAll(() => {
  Object.defineProperty(window, 'innerHeight', { value: VIEWPORT_H, configurable: true })
  Object.defineProperty(window, 'innerWidth', { value: VIEWPORT_W, configurable: true })
})

// Minimal DOMRect stand-in - anchoredRect only reads top/bottom/left/width.
const rect = (top: number, height: number, left = 100, width = 200) =>
  ({ top, bottom: top + height, left, width, right: left + width, height, x: left, y: top, toJSON() {} }) as DOMRect

describe('anchoredRect - flip direction', () => {
  it('opens downward with room below', () => {
    const r = anchoredRect(rect(100, 32), { estimatedHeight: 280 })
    expect(r.openUpward).toBe(false)
    expect(r.top).toBe(132 + 2) // trigger bottom + gap
  })

  it('flips upward when room below is short and there is more above', () => {
    // Trigger near the bottom: 60px below, ~740px above.
    const r = anchoredRect(rect(VIEWPORT_H - 92, 32), { estimatedHeight: 280 })
    expect(r.openUpward).toBe(true)
    // Panel sits above the trigger; its top must stay on-screen.
    expect(r.top).toBeGreaterThanOrEqual(8)
    expect(r.top).toBeLessThan(VIEWPORT_H - 92)
  })
})

describe('anchoredRect - height bounds', () => {
  it('caps maxHeight to the room below (never overflows the viewport)', () => {
    // Short viewport so both sides are smaller than the 280 estimate; trigger in
    // the middle with slightly more room below keeps it opening downward.
    Object.defineProperty(window, 'innerHeight', { value: 260, configurable: true })
    try {
      const r = anchoredRect(rect(110, 32), { estimatedHeight: 280 })
      // room below = 260 - 142 - gap(2) - margin(8) = 108
      expect(r.openUpward).toBe(false)
      expect(r.maxHeight).toBeLessThanOrEqual(108)
      expect(r.maxHeight).toBeGreaterThan(0)
      // availHeight is the hard ceiling and is >= the comfortable maxHeight.
      expect(r.availHeight).toBeGreaterThanOrEqual(r.maxHeight)
    } finally {
      Object.defineProperty(window, 'innerHeight', { value: VIEWPORT_H, configurable: true })
    }
  })

  it('maxHeight is the estimate when there is ample room', () => {
    const r = anchoredRect(rect(100, 32), { estimatedHeight: 200 })
    expect(r.maxHeight).toBe(200)
    expect(r.availHeight).toBeGreaterThanOrEqual(200)
  })

  it('never returns a maxHeight below the minHeight floor', () => {
    // Trigger pinned to the very bottom: almost no room below, lots above -> flips.
    const r = anchoredRect(rect(VIEWPORT_H - 20, 20), { estimatedHeight: 300, minHeight: 96 })
    expect(r.maxHeight).toBeGreaterThanOrEqual(96)
  })
})

describe('anchoredRect - bottom anchor (natural-height upward panels)', () => {
  it('returns a bottom offset that pins the panel just above the trigger', () => {
    // Trigger top at 500, gap 2 -> panel bottom edge at 498 -> bottom offset
    // from the viewport bottom = 800 - 500 + 2 = 302. Independent of any height
    // estimate, so a bottom-anchored panel grows to its real content height.
    const r = anchoredRect(rect(500, 32), { estimatedHeight: 999 })
    expect(r.bottom).toBe(VIEWPORT_H - 500 + 2)
  })

  it('bottom offset does not depend on the (possibly wrong) height estimate', () => {
    const trigger = rect(600, 30)
    const a = anchoredRect(trigger, { estimatedHeight: 40 })
    const b = anchoredRect(trigger, { estimatedHeight: 500 })
    expect(a.bottom).toBe(b.bottom)
  })
})

describe('anchoredRect - horizontal', () => {
  it('clamps a wide panel within the viewport', () => {
    const r = anchoredRect(rect(100, 32, VIEWPORT_W - 50, 40), { estimatedHeight: 100, minWidth: 300 })
    expect(r.width).toBe(300)
    expect(r.left + r.width).toBeLessThanOrEqual(VIEWPORT_W)
    expect(r.left).toBeGreaterThanOrEqual(4)
  })
})
