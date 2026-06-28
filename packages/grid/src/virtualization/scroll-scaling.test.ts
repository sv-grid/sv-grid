import { describe, it, expect } from 'vitest'
import { createRowScrollScaling } from './scroll-scaling'

const VIEWPORT = 600

describe('createRowScrollScaling - inert (content fits under the cap)', () => {
  // 1M rows * 18px = 18M, under a 33.5M (Chrome) cap -> no scaling.
  const s = createRowScrollScaling(18_000_000, 33_554_400, VIEWPORT)

  it('is inactive and exposes the true height as the DOM height', () => {
    expect(s.active).toBe(false)
    expect(s.domTotal).toBe(18_000_000)
  })

  it('both maps are the identity', () => {
    for (const v of [0, 1, 1234, 9_000_000, 17_999_400]) {
      expect(s.domToLogical(v)).toBe(v)
      expect(s.logicalToDom(v)).toBe(v)
    }
  })
})

describe('createRowScrollScaling - active (content exceeds the cap)', () => {
  // 1M rows * 32px = 32M, over Firefox's ~17.9M cap -> scaling engages.
  const trueTotal = 32_000_000
  const maxDom = 17_895_697
  const s = createRowScrollScaling(trueTotal, maxDom, VIEWPORT)
  const domMax = s.domTotal - VIEWPORT
  const logicalMax = trueTotal - VIEWPORT

  it('caps the DOM height at the browser limit', () => {
    expect(s.active).toBe(true)
    expect(s.domTotal).toBe(maxDom)
    expect(s.domTotal).toBeLessThanOrEqual(maxDom)
  })

  it('maps the endpoints exactly so the first and last rows are reachable', () => {
    expect(s.domToLogical(0)).toBe(0)
    // The bottom of the DOM scroll range reaches the bottom of the logical range.
    expect(s.domToLogical(domMax)).toBeCloseTo(logicalMax, 3)
    expect(s.logicalToDom(0)).toBe(0)
    expect(s.logicalToDom(logicalMax)).toBeCloseTo(domMax, 3)
  })

  it('clamps out-of-range inputs instead of overshooting', () => {
    expect(s.domToLogical(-100)).toBe(0)
    expect(s.domToLogical(domMax + 10_000)).toBeCloseTo(logicalMax, 3)
    expect(s.logicalToDom(-100)).toBe(0)
    expect(s.logicalToDom(logicalMax + 10_000)).toBeCloseTo(domMax, 3)
  })

  it('logicalToDom is the inverse of domToLogical across the range', () => {
    for (let i = 0; i <= 10; i += 1) {
      const domTop = (domMax * i) / 10
      const roundTrip = s.logicalToDom(s.domToLogical(domTop))
      expect(roundTrip).toBeCloseTo(domTop, 2)
    }
  })

  it('both maps are monotonic non-decreasing', () => {
    let prevL = -1
    let prevD = -1
    for (let i = 0; i <= 20; i += 1) {
      const domTop = (domMax * i) / 20
      const logical = s.domToLogical(domTop)
      expect(logical).toBeGreaterThanOrEqual(prevL)
      prevL = logical

      const logIn = (logicalMax * i) / 20
      const dom = s.logicalToDom(logIn)
      expect(dom).toBeGreaterThanOrEqual(prevD)
      prevD = dom
    }
  })
})

describe('createRowScrollScaling - edge cases', () => {
  it('handles an empty grid without dividing by zero', () => {
    const s = createRowScrollScaling(0, 17_895_697, VIEWPORT)
    expect(s.active).toBe(false)
    expect(s.domTotal).toBe(0)
    expect(s.domToLogical(0)).toBe(0)
    expect(s.logicalToDom(0)).toBe(0)
  })

  it('handles content shorter than the viewport', () => {
    const s = createRowScrollScaling(200, 17_895_697, VIEWPORT)
    expect(s.active).toBe(false)
    expect(s.domToLogical(0)).toBe(0)
  })

  it('extreme scale (100M rows) keeps the last row reachable', () => {
    const trueTotal = 100_000_000 * 32 // 3.2 billion px
    const s = createRowScrollScaling(trueTotal, 33_554_400, VIEWPORT)
    expect(s.active).toBe(true)
    expect(s.domTotal).toBe(33_554_400)
    const domMax = s.domTotal - VIEWPORT
    expect(s.domToLogical(domMax)).toBeCloseTo(trueTotal - VIEWPORT, 0)
  })
})
