import { describe, expect, it } from 'vitest'
import { appendPoints } from './chart-stream'
import { PER_CATEGORY_SERIES_KEYS } from './chart-decimate'
import type { ChartSpec } from './chart-types'

const base = (): ChartSpec => ({
  type: 'line',
  categories: ['t1', 't2'],
  series: [
    { label: 'a', values: [1, 2] },
    { label: 'b', values: [10, 20] },
  ],
})

describe('appendPoints', () => {
  it('appends one category and one value per series, by index or by label', () => {
    const next = appendPoints(base(), { category: 't3', values: [3, 30] })
    expect(next.categories).toEqual(['t1', 't2', 't3'])
    expect(next.series.map((s) => s.values)).toEqual([[1, 2, 3], [10, 20, 30]])
    const byLabel = appendPoints(base(), { category: 't3', values: { b: 33 } })
    expect(byLabel.series[0]!.values[2]).toBeNaN()
    expect(byLabel.series[1]!.values[2]).toBe(33)
    const many = appendPoints(base(), [{ category: 't3', values: [3, 30] }, { category: 't4', values: [4, 40] }])
    expect(many.categories).toHaveLength(4)
    expect(many.series[1]!.values).toEqual([10, 20, 30, 40])
  })

  it('keeps every per-category array parallel: bands, row ids, candles, volumes, errors, colours', () => {
    const spec: ChartSpec = {
      type: 'candlestick',
      categories: ['d1'],
      series: [
        { label: 'px', values: [10], ohlc: [{ o: 9, h: 11, l: 8, c: 10 }], volumes: [100], rowIds: [[1]], colors: ['#f00'], errors: [1], upperValues: [11], lowerValues: [9] },
        { label: 'sig', values: [5] },
      ],
      waterfallTotals: [false],
    }
    const next = appendPoints(spec, { category: 'd2', values: [12, 6], ohlc: { o: 10, h: 13, l: 10, c: 12 }, volume: 120, rowIds: [[2], [9]], upper: [13], lower: [11] })
    const px = next.series[0]!
    for (const key of PER_CATEGORY_SERIES_KEYS) {
      const arr = px[key] as unknown[] | undefined
      if (arr) expect(arr.length, key).toBe(2)
    }
    expect(px.ohlc![1]).toEqual({ o: 10, h: 13, l: 10, c: 12 })
    expect(px.volumes).toEqual([100, 120])
    expect(px.rowIds).toEqual([[1], [2]])
    expect(px.upperValues).toEqual([11, 13])
    expect(px.lowerValues).toEqual([9, 11])
    // Not given for this point: a gap, not a shorter array.
    expect(px.colors).toEqual(['#f00', null])
    expect(px.errors![1]).toBeNull()
    // A series without row ids grows them only because the point brings one.
    expect(next.series[1]!.rowIds).toEqual([[], [9]])
    expect(next.series[1]!.ohlc).toBeUndefined()
    expect(next.waterfallTotals).toEqual([false, false])
  })

  it('trims to the window from the right and leaves a short spec alone', () => {
    const s = appendPoints(base(), [{ category: 't3', values: [3, 30] }, { category: 't4', values: [4, 40] }], { window: 3 })
    expect(s.categories).toEqual(['t2', 't3', 't4'])
    expect(s.series[0]!.values).toEqual([2, 3, 4])
    const short = appendPoints(base(), { category: 't3', values: [3, 30] }, { window: 10 })
    expect(short.categories).toHaveLength(3)
    expect(appendPoints(base(), [], { window: 1 }).categories).toEqual(['t2'])
  })

  it('does not mutate the input spec or its arrays', () => {
    const spec = base()
    const before = JSON.stringify(spec)
    const next = appendPoints(spec, { category: 't3', values: [3, 30] }, { window: 2 })
    expect(JSON.stringify(spec)).toBe(before)
    expect(next.series[0]!.values).not.toBe(spec.series[0]!.values)
    expect(next.categories).not.toBe(spec.categories)
  })
})
