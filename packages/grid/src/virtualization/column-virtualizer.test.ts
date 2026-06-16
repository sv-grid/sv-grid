import { describe, expect, it } from 'vitest'
import { createColumnVirtualizer } from './column-virtualizer'

describe('column virtualizer', () => {
  it('computes horizontal window', () => {
    const v = createColumnVirtualizer({
      count: 1000,
      viewportWidth: 700,
      overscan: 3,
      estimateSize: () => 140,
    })
    const items = v.getVirtualItems()
    expect(items[0]?.index).toBe(0)
    expect(items.length).toBeGreaterThan(0)
  })

  it('updates indices on horizontal scroll', () => {
    const v = createColumnVirtualizer({
      count: 1000,
      viewportWidth: 700,
      estimateSize: () => 140,
    })
    v.setHorizontalOffset(2800)
    const state = v.getState()
    expect(state.startIndex).toBeGreaterThan(0)
  })
})
