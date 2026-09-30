import { describe, expect, it } from 'vitest'
import { createVirtualizer } from './virtualizer'

describe('virtualizer', () => {
  it('computes bounded virtual range with overscan', () => {
    const v = createVirtualizer({
      count: 100_000,
      estimateSize: 36,
      overscan: 8,
      viewportHeight: 360,
      scrollOffset: 0,
    })

    const items = v.getVirtualItems()
    expect(items.length).toBeGreaterThan(0)
    expect(items[0]?.index).toBe(0)
    expect(items[items.length - 1]?.index).toBe(18)
  })

  it('updates range when scroll offset changes', () => {
    const v = createVirtualizer({
      count: 100_000,
      estimateSize: 40,
      overscan: 5,
      viewportHeight: 400,
      scrollOffset: 0,
    })

    v.setScrollOffset(4_000)
    const state = v.getState()
    expect(state.startIndex).toBeLessThanOrEqual(100)
    expect(state.endIndex).toBeGreaterThanOrEqual(110)
  })

  it('scrollToIndex clamps target offset', () => {
    const v = createVirtualizer({
      count: 100,
      estimateSize: 30,
      overscan: 2,
      viewportHeight: 300,
      scrollOffset: 0,
    })

    v.scrollToIndex(9_999)
    expect(v.getState().scrollOffset).toBe(2_700)
  })

  it('re-measures a stable size function passed back through setOptions (#102)', () => {
    const heights = new Map<number, number>()
    const estimateSize = (i: number) => heights.get(i) ?? 20
    const v = createVirtualizer({ count: 10, estimateSize, viewportHeight: 100 })
    expect(v.getTotalSize()).toBe(200)

    heights.set(0, 120)
    v.setOptions({ estimateSize })
    expect(v.getSizeForIndex(0)).toBe(120)
    expect(v.getTotalSize()).toBe(300) // 9 x 20 + 120
    expect(v.getOffsetForIndex(5)).toBe(200) // 120 + 4 x 20
  })

  it('measure() re-reads sizes and notifies subscribers', () => {
    const heights = new Map<number, number>()
    const v = createVirtualizer({
      count: 10,
      estimateSize: (i: number) => heights.get(i) ?? 20,
      viewportHeight: 100,
    })
    let notified = 0
    v.subscribe(() => (notified += 1))

    heights.set(3, 50)
    v.measure()
    expect(v.getTotalSize()).toBe(230)
    expect(v.getOffsetForIndex(4)).toBe(110)
    expect(notified).toBe(1)
  })

  it('keeps the offset cache across scrolls', () => {
    let calls = 0
    const v = createVirtualizer({
      count: 1000,
      estimateSize: () => (calls++, 20),
      viewportHeight: 100,
    })
    const afterBuild = calls
    v.setScrollOffset(500)
    v.setScrollOffset(900)
    v.setViewportHeight(200)
    expect(calls).toBe(afterBuild)
  })
})
