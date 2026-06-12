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
})
