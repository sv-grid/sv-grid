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

describe('virtualizer: overscanBehind', () => {
  // 1,000 items of 10px in a 100px viewport: items 0-9 visible at offset 0.
  const make = () =>
    createVirtualizer({ count: 1000, estimateSize: 10, viewportHeight: 100, overscan: 3, overscanBehind: 1 })

  it('keeps the full overscan on both sides before any scroll', () => {
    // Created at offset 500: no movement yet, so no direction.
    const fresh = createVirtualizer({ count: 1000, estimateSize: 10, viewportHeight: 100, overscan: 3, overscanBehind: 1, scrollOffset: 500 })
    const items = fresh.getVirtualItems()
    expect(items[0]!.index).toBe(47)
    expect(items.at(-1)!.index).toBe(50 + 10 + 3)
  })

  it('puts the overscan ahead of a forward scroll and one item behind it', () => {
    const v = make()
    v.setScrollOffset(500)
    const items = v.getVirtualItems()
    expect(items[0]!.index).toBe(50 - 1)
    expect(items.at(-1)!.index).toBe(60 + 3)
  })

  it('flips when the scroll turns around', () => {
    const v = make()
    v.setScrollOffset(500)
    v.setScrollOffset(400)
    const items = v.getVirtualItems()
    expect(items[0]!.index).toBe(40 - 3)
    expect(items.at(-1)!.index).toBe(50 + 1)
  })

  it('defaults to a symmetric window', () => {
    const v = createVirtualizer({ count: 1000, estimateSize: 10, viewportHeight: 100, overscan: 3 })
    v.setScrollOffset(500)
    const items = v.getVirtualItems()
    expect(items[0]!.index).toBe(47)
    expect(items.at(-1)!.index).toBe(63)
  })
})

describe('virtualizer: overscanMin', () => {
  // 1,000 items of 10px in a 100px viewport; at offset o the visible items
  // are o/10 .. o/10 + 10.
  const make = (estimateSize: number | ((i: number) => number) = 10) =>
    createVirtualizer({ count: 1000, estimateSize, viewportHeight: 100, overscan: 3, overscanBehind: 1, overscanMin: 1 })

  const range = (v: ReturnType<typeof make>) => {
    const items = v.getVirtualItems()
    return [items[0]!.index, items.at(-1)!.index]
  }

  it('renders overscanMin around the visible items at rest and after a jump', () => {
    // At rest: one item on each side of visible 0..10.
    const v = make()
    expect(range(v)).toEqual([0, 11])
    // Visible 50..60 shares nothing with the window: a jump, so one item
    // ahead and one behind, as a thumb drag lands.
    v.setScrollOffset(500)
    expect(range(v)).toEqual([49, 61])
    const fresh = createVirtualizer({ count: 1000, estimateSize: 10, viewportHeight: 100, overscan: 3, overscanBehind: 1, overscanMin: 1, scrollOffset: 500 })
    expect(range(fresh)).toEqual([49, 61])
  })

  it('keeps the window while one item is left ahead, then moves it three at a time', () => {
    const v = make()
    let emits = 0
    v.subscribe(() => (emits += 1))
    // Visible end 11 leaves nothing ahead of [0, 11]: the window moves on
    // with the full overscan ahead.
    v.setScrollOffset(10)
    const moved = v.getVirtualItems()
    expect(range(v)).toEqual([0, 14])
    expect(emits).toBe(1)

    // Visible ends 12 and 13: item 14 is still rendered ahead of them.
    v.setScrollOffset(20)
    v.setScrollOffset(30)
    expect(v.getVirtualItems()).toBe(moved)
    expect(emits).toBe(1)

    // Visible end 14 leaves nothing ahead: the window moves by three.
    v.setScrollOffset(40)
    expect(range(v)).toEqual([3, 17])
    expect(emits).toBe(2)
    v.setScrollOffset(50)
    v.setScrollOffset(60)
    expect(emits).toBe(2)
    v.setScrollOffset(70)
    expect(range(v)).toEqual([6, 20])
    expect(emits).toBe(3)
  })

  it('works the same with per-item sizes', () => {
    // The per-item path counts visible 0..9 at offset 0, not 0..10: an item
    // starting exactly at the viewport's end is not in it.
    const v = make(() => 10)
    expect(range(v)).toEqual([0, 10])
    v.setScrollOffset(10)
    const moved = v.getVirtualItems()
    expect(range(v)).toEqual([0, 13])
    v.setScrollOffset(30)
    expect(v.getVirtualItems()).toBe(moved)
    v.setScrollOffset(40)
    expect(range(v)).toEqual([3, 16])
  })

  it('keeps the window through a turn while it still covers the way back', () => {
    const v = make()
    v.setScrollOffset(500)
    v.setScrollOffset(510)
    const moved = v.getVirtualItems()
    expect(range(v)).toEqual([50, 64])
    v.setScrollOffset(530)
    // Back up to visible 52..62 and 51..61: items 51 and 50 are one ahead.
    v.setScrollOffset(520)
    v.setScrollOffset(510)
    expect(v.getVirtualItems()).toBe(moved)
    // Visible start 50 with item 49 missing: the window moves with the full
    // overscan before it and one item after.
    v.setScrollOffset(500)
    expect(range(v)).toEqual([47, 61])
  })

  it('always renders every visible item', () => {
    const v = make((i) => 5 + (i % 7) * 3)
    let seed = 7
    const random = () => ((seed = (seed * 16807) % 2147483647) / 2147483647)
    let offset = 0
    for (let step = 0; step < 2000; step += 1) {
      // Mostly small steps either way, now and then a jump.
      offset = random() < 0.05 ? Math.floor(random() * 12_000) : Math.max(0, offset + Math.floor((random() - 0.4) * 60))
      v.setScrollOffset(offset)
      const state = v.getState()
      const items = v.getVirtualItems()
      const top = Math.min(offset, Math.max(state.totalSize - 100, 0))
      const visible = items.filter((it) => it.end > top && it.start < top + 100)
      expect(visible.length).toBeGreaterThan(0)
      expect(items[0]!.start).toBeLessThanOrEqual(top)
      expect(items.at(-1)!.end).toBeGreaterThanOrEqual(Math.min(top + 100, state.totalSize))
    }
  })

  it('re-windows at once when the viewport or the sizes change', () => {
    const v = make()
    v.setScrollOffset(500)
    v.setScrollOffset(510)
    v.setViewportHeight(200)
    expect(range(v)).toEqual([50, 51 + 20 + 1])
    v.setOptions({ estimateSize: 20 })
    expect(v.getVirtualItems()[0]!.start).toBe(v.getVirtualItems()[0]!.index * 20)
  })
})
