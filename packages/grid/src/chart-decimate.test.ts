import { describe, expect, it } from 'vitest'
import { buildChart, rowsToChartSpec, sliceChartWindow, type ChartSeries, type ChartSpec } from './chart'
import { decimateSpec, lttb, minMaxIndices, pickCategories, PER_CATEGORY_SERIES_KEYS, PER_CATEGORY_SPEC_KEYS } from './chart-decimate'
import { bucketStart, percentile, reduceValues } from './chart-stats'

describe('pickCategories', () => {
  it('cuts EVERY per-category array on a series, not just the ones that existed when it was written', () => {
    // A series carrying every key in the list, each of a distinct length-4
    // shape, so a key the picker forgets shows up as a wrong length.
    const full: Required<Pick<ChartSeries, (typeof PER_CATEGORY_SERIES_KEYS)[number]>> = {
      values: [1, 2, 3, 4],
      rowIds: [[1], [2], [3], [4]],
      upperValues: [2, 3, 4, 5],
      lowerValues: [0, 1, 2, 3],
      ohlc: [{ o: 1, h: 2, l: 0, c: 1 }, { o: 2, h: 3, l: 1, c: 2 }, { o: 3, h: 4, l: 2, c: 3 }, { o: 4, h: 5, l: 3, c: 4 }],
      boxes: [null, null, { min: 1, q1: 2, median: 3, q3: 4, max: 5 }, null],
      errors: [1, 2, 3, 4],
      markers: [null, { shape: 'square' }, null, { shape: 'none' }],
      colors: ['a', 'b', 'c', 'd'],
      lowValues: [0, 1, 2, 3],
      targets: [5, 6, 7, 8],
      volumes: [100, 200, 300, 400],
    }
    const spec: ChartSpec = {
      type: 'line',
      categories: ['a', 'b', 'c', 'd'],
      series: [{ label: 's', ...full }],
      waterfallTotals: [false, true, false, true],
    }
    const out = pickCategories(spec, [1, 3])
    expect(out.categories).toEqual(['b', 'd'])
    for (const key of PER_CATEGORY_SERIES_KEYS) {
      expect((out.series[0] as unknown as Record<string, unknown[]>)[key], key).toHaveLength(2)
    }
    for (const key of PER_CATEGORY_SPEC_KEYS) {
      expect((out as unknown as Record<string, unknown[]>)[key], key).toHaveLength(2)
    }
    expect(out.series[0]!.values).toEqual([2, 4])
    expect(out.series[0]!.rowIds).toEqual([[2], [4]])
    expect(out.series[0]!.colors).toEqual(['b', 'd'])
    expect(out.waterfallTotals).toEqual([true, true])
  })

  it('is what sliceChartWindow uses, with identical output for a contiguous range', () => {
    const spec: ChartSpec = {
      type: 'line',
      categories: ['a', 'b', 'c', 'd', 'e'],
      series: [{ label: 's', values: [1, 2, 3, 4, 5], upperValues: [2, 3, 4, 5, 6], lowerValues: [0, 1, 2, 3, 4], rowIds: [[1], [2], [3], [4], [5]] }],
    }
    expect(sliceChartWindow(spec, 1, 3)).toEqual(pickCategories(spec, [1, 2, 3]))
    expect(sliceChartWindow(spec, 1, 3).series[0]!.upperValues).toEqual([3, 4, 5])
    expect(sliceChartWindow(spec, -5, 99).categories).toEqual(spec.categories)
    expect(sliceChartWindow(spec, 4, 2).categories).toEqual([])
  })

  it('does not invent arrays a series never had', () => {
    const out = pickCategories({ type: 'bar', categories: ['a', 'b'], series: [{ label: 's', values: [1, 2] }] }, [0])
    expect('rowIds' in out.series[0]!).toBe(false)
    expect('waterfallTotals' in out).toBe(false)
  })
})

describe('lttb', () => {
  const n = 1000
  const wave = Array.from({ length: n }, (_, i) => Math.sin(i / 20) * 100)
  it('keeps the first and last points and returns ascending indices of the target length', () => {
    const idx = lttb(wave, 100)
    expect(idx).toHaveLength(100)
    expect(idx[0]).toBe(0)
    expect(idx[idx.length - 1]).toBe(n - 1)
    for (let i = 1; i < idx.length; i += 1) expect(idx[i]).toBeGreaterThan(idx[i - 1]!)
  })
  it('preserves a spike that would vanish under naive striding', () => {
    const flat = new Array(n).fill(10)
    flat[537] = 1000
    const idx = lttb(flat, 50)
    expect(idx).toContain(537)
  })
  it('returns everything when there is nothing to thin', () => {
    expect(lttb([1, 2, 3], 10)).toEqual([0, 1, 2])
    expect(lttb([1, 2, 3, 4, 5], 2)).toEqual([0, 4])
  })
  it('never picks a gap as a representative point', () => {
    const gappy = wave.map((v, i) => (i % 7 === 3 ? Number.NaN : v))
    const idx = lttb(gappy, 120)
    expect(idx.slice(1, -1).every((i) => Number.isFinite(gappy[i]))).toBe(true)
  })
})

describe('minMaxIndices', () => {
  it('keeps the extreme of every bucket', () => {
    const v = Array.from({ length: 400 }, (_, i) => (i % 50 === 25 ? 500 : i % 50 === 10 ? -500 : 0))
    const idx = minMaxIndices(v, 8)
    for (let b = 0; b < 8; b += 1) {
      expect(idx).toContain(b * 50 + 25)
      expect(idx).toContain(b * 50 + 10)
    }
    expect(idx[0]).toBe(0)
    expect(idx[idx.length - 1]).toBe(399)
  })
})

describe('decimateSpec', () => {
  const long = (type: ChartSpec['type'] = 'line', extra: Partial<ChartSpec> = {}): ChartSpec => ({
    type,
    categories: Array.from({ length: 5000 }, (_, i) => `c${i}`),
    series: [
      { label: 'a', values: Array.from({ length: 5000 }, (_, i) => Math.sin(i / 90) * 50), rowIds: Array.from({ length: 5000 }, (_, i) => [i]) },
      { label: 'b', values: Array.from({ length: 5000 }, (_, i) => (i === 4321 ? 900 : Math.cos(i / 70) * 30)) },
    ],
    ...extra,
  })
  it('thins a long line to about the plot width and keeps rowIds aligned', () => {
    const out = decimateSpec(long(), 400)
    expect(out.categories.length).toBeLessThan(5000)
    expect(out.categories.length).toBeGreaterThanOrEqual(400)
    out.categories.forEach((c, k) => {
      const i = Number(c.slice(1))
      expect(out.series[0]!.rowIds![k]).toEqual([i])
      expect(out.series[0]!.values[k]).toBe(Math.sin(i / 90) * 50)
    })
  })
  it('keeps a spike that only one series has', () => {
    const out = decimateSpec(long(), 300)
    expect(out.categories).toContain('c4321')
  })
  it('does nothing below the threshold, when off, or when bars are involved', () => {
    const short = { ...long(), categories: long().categories.slice(0, 100), series: long().series.map((s) => ({ ...s, values: s.values.slice(0, 100), rowIds: s.rowIds?.slice(0, 100) })) }
    expect(decimateSpec(short, 400)).toBe(short)
    const off = long('line', { decimate: false })
    expect(decimateSpec(off, 400)).toBe(off)
    const bars = long('bar')
    expect(decimateSpec(bars, 400)).toBe(bars)
    const combo = long('line', { series: [{ label: 'v', values: long().series[0]!.values, type: 'bar' }, long().series[1]!] })
    expect(decimateSpec(combo, 400)).toBe(combo)
  })
  it('honours an explicit target and method', () => {
    const a = decimateSpec(long(), 400, { target: 100 })
    expect(a.categories.length).toBeLessThan(220)
    const b = decimateSpec(long(), 400, { method: 'minmax', target: 100 })
    expect(b.categories).toContain('c4321')
  })
  it('lays out through buildChart with the decimated categories', () => {
    const geo = buildChart({ ...decimateSpec(long(), 500), width: 600, height: 300 })
    expect(geo.lines[0]!.points.length).toBeLessThan(5000)
    expect(geo.lines[0]!.points.length).toBeGreaterThan(100)
  })
})

describe('reducers', () => {
  const s = [5, 1, 4, 2, 3, 3]
  it('computes every reducer', () => {
    expect(reduceValues(s, 'sum')).toBe(18)
    expect(reduceValues(s, 'avg')).toBe(3)
    expect(reduceValues(s, 'count')).toBe(6)
    expect(reduceValues(s, 'min')).toBe(1)
    expect(reduceValues(s, 'max')).toBe(5)
    expect(reduceValues(s, 'first')).toBe(5)
    expect(reduceValues(s, 'last')).toBe(3)
    expect(reduceValues(s, 'countDistinct')).toBe(5)
    expect(reduceValues(s, 'median')).toBe(3)
    expect(reduceValues(s, 'p90')).toBeCloseTo(4.5, 6)
    expect(reduceValues(s, 'p100')).toBe(5)
  })
  it('an empty group is 0 for sum / count and a gap for the rest', () => {
    expect(reduceValues([], 'sum')).toBe(0)
    expect(reduceValues([], 'count')).toBe(0)
    expect(reduceValues([], 'avg')).toBe(0)
    expect(Number.isNaN(reduceValues([], 'median'))).toBe(true)
    expect(Number.isNaN(reduceValues([], 'min'))).toBe(true)
  })
  it('percentile interpolates between order statistics', () => {
    expect(percentile([10, 20, 30, 40], 50)).toBe(25)
    expect(percentile([10, 20, 30, 40], 0)).toBe(10)
    expect(percentile([10, 20, 30, 40], 100)).toBe(40)
  })
  it('rowsToChartSpec takes the new reducers', () => {
    const rows = [
      { region: 'N', v: 10 }, { region: 'N', v: 30 }, { region: 'N', v: 20 },
      { region: 'S', v: 7 }, { region: 'S', v: 7 },
    ]
    expect(rowsToChartSpec(rows, { type: 'bar', category: 'region', value: 'v', reduce: 'median' }).series[0]!.values).toEqual([20, 7])
    expect(rowsToChartSpec(rows, { type: 'bar', category: 'region', value: 'v', reduce: 'max' }).series[0]!.values).toEqual([30, 7])
    expect(rowsToChartSpec(rows, { type: 'bar', category: 'region', value: 'v', reduce: 'countDistinct' }).series[0]!.values).toEqual([3, 1])
    expect(rowsToChartSpec(rows, { type: 'bar', category: 'region', value: 'v', reduce: 'last' }).series[0]!.values).toEqual([20, 7])
    // and the original three are untouched
    expect(rowsToChartSpec(rows, { type: 'bar', category: 'region', value: 'v', reduce: 'avg' }).series[0]!.values).toEqual([20, 7])
  })
})

describe('time bucketing', () => {
  it('bucketStart lands on the calendar boundary, in UTC', () => {
    expect(bucketStart('2026-03-18T15:00:00Z', 'day')).toBe('2026-03-18')
    expect(bucketStart('2026-03-18', 'week')).toBe('2026-03-16') // a Wednesday -> its Monday
    expect(bucketStart('2026-03-22', 'week')).toBe('2026-03-16') // Sunday belongs to the week before
    expect(bucketStart('2026-03-18', 'month')).toBe('2026-03-01')
    expect(bucketStart('2026-05-18', 'quarter')).toBe('2026-04-01')
    expect(bucketStart('2026-12-31', 'quarter')).toBe('2026-10-01')
    expect(bucketStart('2026-03-18', 'year')).toBe('2026-01-01')
    expect(bucketStart(Date.UTC(2026, 0, 1), 'year')).toBe('2026-01-01')
    expect(bucketStart('not a date', 'month')).toBe('')
  })
  it('rowsToChartSpec buckets a date category and sorts it chronologically', () => {
    const rows = [
      { day: '2026-03-20', v: 1 },
      { day: '2026-01-05', v: 2 },
      { day: '2026-03-02', v: 3 },
      { day: '2026-01-30', v: 4 },
      { day: 'garbage', v: 99 },
    ]
    const spec = rowsToChartSpec(rows, { type: 'line', category: 'day', value: 'v', bucket: 'month' })
    expect(spec.categories).toEqual(['2026-01-01', '2026-03-01'])
    expect(spec.series[0]!.values).toEqual([6, 4])
    expect(spec.xType).toBe('ordinal-time')
    const weeks = rowsToChartSpec(rows, { type: 'line', category: 'day', value: 'v', bucket: 'week', reduce: 'count' })
    expect(weeks.categories).toEqual(['2026-01-05', '2026-01-26', '2026-03-02', '2026-03-16'])
    expect(weeks.series[0]!.values).toEqual([1, 1, 1, 1])
  })
})

describe('lttb with explicit x positions', () => {
  it('measures the triangles in the given positions rather than by index', () => {
    // Points crowd together in x except the last two, which are far apart. A
    // spike at index 3 is small in area when x is the index, but with the
    // real spacing the wide final segment matters more than the spike.
    const values = [0, 0, 0, 5, 0, 0, 0, 10]
    const xs = [0, 1, 2, 3, 4, 5, 6, 1000]
    const byIndex = lttb(values, 4)
    const byX = lttb(values, 4, xs)
    expect(byIndex[0]).toBe(0)
    expect(byIndex[byIndex.length - 1]).toBe(7)
    expect(byX[0]).toBe(0)
    expect(byX[byX.length - 1]).toBe(7)
    expect(byX).toHaveLength(4)
    // Both keep the first and last point and stay strictly increasing.
    for (let k = 1; k < byX.length; k += 1) expect(byX[k]!).toBeGreaterThan(byX[k - 1]!)
  })

  it('decimateSpec passes log10 positions for a log number axis', () => {
    const n = 2000
    const categories = Array.from({ length: n }, (_, i) => String(Math.pow(10, (i / (n - 1)) * 4)))
    const values = categories.map((c) => Math.log10(Number(c)) * 10 + (Number(c) > 5000 && Number(c) < 5100 ? 50 : 0))
    const spec: ChartSpec = { type: 'line', categories, series: [{ label: 'v', values }], xAxis: { type: 'number', scale: 'log' } }
    const thin = decimateSpec(spec, 300)
    expect(thin.categories.length).toBeLessThan(n)
    // The spike (a band of points 50 above the trend) survives.
    expect(Math.max(...thin.series[0]!.values)).toBeGreaterThan(80)
  })
})
