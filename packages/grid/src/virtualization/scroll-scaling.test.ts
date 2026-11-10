import { describe, it, expect } from 'vitest'
import { createRowScrollScaling, resolveMaxDomHeight } from './scroll-scaling'

const VIEWPORT = 600
const FALLBACK = 8_000_000

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

describe('resolveMaxDomHeight - picks the smaller, real scrollable cap', () => {
  it('keeps the desktop cap when both signals agree', () => {
    // Chrome ~33.5M; offsetHeight and scrollHeight match. 0.5% safety shave.
    const cap = resolveMaxDomHeight(33_554_400, 33_554_400, FALLBACK)
    expect(cap).toBeLessThan(33_554_400)
    expect(cap).toBeGreaterThan(33_000_000)
  })

  it('uses the SCROLL cap when a phone over-reports offsetHeight', () => {
    // High-DPR mobile: layout says 24M, but the container only scrolls ~6M.
    // Trusting offsetHeight is exactly what stranded the last rows.
    const cap = resolveMaxDomHeight(24_000_000, 6_000_000, FALLBACK)
    expect(cap).toBeLessThanOrEqual(6_000_000)
    expect(cap).toBeGreaterThan(5_900_000)
  })

  it('shaves a safety margin so the spacer never sits at the exact edge', () => {
    const cap = resolveMaxDomHeight(10_000_000, 10_000_000, FALLBACK)
    expect(cap).toBeLessThan(10_000_000)
  })

  it('falls back when both readings are junk (jsdom returns 0)', () => {
    expect(resolveMaxDomHeight(0, 0, FALLBACK)).toBe(FALLBACK)
  })

  it('falls back when the browser did not clamp (returned ~1e9)', () => {
    expect(resolveMaxDomHeight(1_000_000_000, 1_000_000_000, FALLBACK)).toBe(FALLBACK)
  })

  it('ignores a junk signal but trusts the valid one', () => {
    // offsetHeight unclamped/garbage, scrollHeight is the real cap.
    const cap = resolveMaxDomHeight(1_000_000_000, 5_000_000, FALLBACK)
    expect(cap).toBeLessThanOrEqual(5_000_000)
    expect(cap).toBeGreaterThan(4_900_000)
  })

  it('feeds straight into the scaler so the last row stays reachable', () => {
    const maxDom = resolveMaxDomHeight(24_000_000, 6_000_000, FALLBACK)
    const trueTotal = 500_000 * 32 // 16M px of rows, over the phone cap
    const s = createRowScrollScaling(trueTotal, maxDom, VIEWPORT)
    expect(s.active).toBe(true)
    expect(s.domTotal).toBeLessThanOrEqual(maxDom)
    const domMax = s.domTotal - VIEWPORT
    expect(s.domToLogical(domMax)).toBeCloseTo(trueTotal - VIEWPORT, 0)
  })
})

describe('createRowScrollScaling - near the ends', () => {
  // A million 30px rows under the height that still paints straight.
  const trueTotal = 30_000_000
  const s = createRowScrollScaling(trueTotal, 16_000_000, VIEWPORT)
  const domMax = s.domTotal - VIEWPORT
  const logicalMax = trueTotal - VIEWPORT

  it('a pixel is a pixel at the top: the rows around the view stay inside the spacer', () => {
    for (const d of [1, 30, 300, 3000]) {
      expect(s.domToLogical(d)).toBe(d)
      expect(s.logicalToDom(d)).toBe(d)
    }
  })

  it('a pixel is a pixel at the end: the list ends where the scrollbar does', () => {
    for (const d of [1, 30, 300, 3000]) {
      expect(s.domToLogical(domMax - d)).toBeCloseTo(logicalMax - d, 3)
      expect(s.logicalToDom(logicalMax - d)).toBeCloseTo(domMax - d, 3)
    }
  })

  it('has no jump where the ends meet the middle', () => {
    let last = s.domToLogical(0)
    const ratio = logicalMax / domMax
    for (let d = 8000; d <= 8400; d += 1) {
      const now = s.domToLogical(d)
      expect(now - s.domToLogical(d - 1)).toBeLessThan(ratio + 0.1)
      last = now
    }
    expect(last).toBeGreaterThan(8000)
  })

  it('goes back and forth in the middle', () => {
    for (const d of [100_000, 8_000_000, 15_000_000]) expect(s.logicalToDom(s.domToLogical(d))).toBeCloseTo(d, 3)
  })

  it('keeps the ends inside a small range', () => {
    const small = createRowScrollScaling(1_000_000, 100_000, VIEWPORT)
    expect(small.domToLogical(small.domTotal - VIEWPORT)).toBeCloseTo(1_000_000 - VIEWPORT, 3)
    expect(small.domToLogical(50_000)).toBeGreaterThan(50_000)
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

describe('scaling across the seam', () => {
  it('Z1 monotonic, inverse, and the ends meet, either side of the seam', () => {
    const bad: string[] = []
    let seed = 7
    const rnd = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff
    for (let c = 0; c < 400; c += 1) {
      const max = 100_000 + Math.floor(rnd() * 33_000_000)
      const viewport = 100 + Math.floor(rnd() * 2000)
      const offsets = [-1, 0, 1, 2, 30, viewport, 8192, 16_384, 20_000, Math.floor(max * 0.5), max * 3]
      const total = max + offsets[c % offsets.length]!
      const s = createRowScrollScaling(total, max, viewport)
      const domMax = s.domTotal - viewport
      const logMax = total - viewport
      if (s.domToLogical(0) !== 0 || Math.abs(s.domToLogical(domMax) - logMax) > 1e-6) bad.push(`ends ${total}/${max}/${viewport}`)
      let last = -1
      for (let i = 0; i <= 2000; i += 1) {
        const d = (domMax * i) / 2000
        const l = s.domToLogical(d)
        if (l + 1e-6 < last) { bad.push(`down at ${d} ${total}/${max}/${viewport}`); break }
        last = l
        if (Math.abs(s.logicalToDom(l) - d) > 1e-3) { bad.push(`inverse at ${d}: ${s.logicalToDom(l)} ${total}/${max}/${viewport}`); break }
      }
    }
    expect(bad).toEqual([])
  })
  it('Z2 the seam itself: one row across the cap keeps every row reachable', () => {
    const s = createRowScrollScaling(1_000_030, 1_000_000, 500)
    const row = 30
    const reach = new Set<number>()
    for (let d = 0; d <= s.domTotal - 500; d += 1) reach.add(Math.floor(s.domToLogical(d) / row))
    expect(reach.size).toBe(Math.floor((1_000_030 - 500) / row) + 1)
  })
})
