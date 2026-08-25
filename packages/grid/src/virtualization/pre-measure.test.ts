/**
 * The pre-measurement window (`buildPreMeasureItems`).
 *
 * Both virtualizers learn their real `count` from an `$effect`, and effects do
 * not run during SSR. Before this existed the server therefore rendered an
 * empty `<tbody>`: the rows were in the row model, but the virtualizer still
 * thought there were none, so `<SvGrid>` shipped an empty shell to crawlers and
 * to no-JS clients while the docs claimed the markup arrived "already filled
 * with data".
 *
 * Nothing tested SSR, which is why that survived. These lock the window's
 * shape; `svgrid.ssr.test.ts` asserts the rendered HTML end to end.
 */
import { describe, expect, it } from 'vitest'
import { buildPreMeasureItems } from './virtualizer'

describe('buildPreMeasureItems', () => {
  it('returns a window even with no viewport measurement', () => {
    // viewportHeight 0 is what a server reports - the old behaviour was [].
    const items = buildPreMeasureItems(100, 30, 0, 8)
    expect(items.length).toBeGreaterThan(0)
    expect(items[0]!.index).toBe(0)
  })

  it('covers the viewport plus overscan, not the whole dataset', () => {
    // 400px / 40px = 10 visible, + 5 overscan = through index 15 => 16 items.
    const items = buildPreMeasureItems(1000, 40, 400, 5)
    expect(items).toHaveLength(16)
    expect(items[items.length - 1]!.index).toBe(15)
  })

  it('never runs past the end of a short dataset', () => {
    const items = buildPreMeasureItems(3, 30, 5000, 8)
    expect(items).toHaveLength(3)
    expect(items[2]!.index).toBe(2)
  })

  it('is empty for an empty dataset', () => {
    expect(buildPreMeasureItems(0, 30, 500, 8)).toEqual([])
  })

  it('is deterministic - the server and first client render must agree', () => {
    // Anchored at index 0 with no scroll offset, so both sides produce the
    // same markup and hydration does not mismatch.
    const a = buildPreMeasureItems(500, 30, 520, 8)
    const b = buildPreMeasureItems(500, 30, 520, 8)
    expect(a).toEqual(b)
    expect(a[0]!.start).toBe(0)
  })

  it('lays items out contiguously so the spacers add up', () => {
    const items = buildPreMeasureItems(10, 25, 100, 2)
    for (let i = 0; i < items.length; i += 1) {
      expect(items[i]!.start).toBe(i * 25)
      expect(items[i]!.end).toBe(i * 25 + 25)
      expect(items[i]!.size).toBe(25)
    }
  })

  it('tolerates a zero or negative size rather than dividing by zero', () => {
    const items = buildPreMeasureItems(5, 0, 100, 1)
    expect(items.length).toBeGreaterThan(0)
    expect(Number.isFinite(items[0]!.end)).toBe(true)
  })
})
