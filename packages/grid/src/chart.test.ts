import { describe, expect, it } from 'vitest'
import { buildChart, rowsToChartSpec, niceScale, sliceChartWindow, specToTreemap, specToCalendar, specToSankey, rowsToScatterSpec, rowsToGaugeSpec } from './chart'
import type { ChartSpec } from './chart'

describe('niceScale', () => {
  it('rounds a positive domain to nice ticks including 0', () => {
    const s = niceScale(0, 95)
    expect(s.min).toBe(0)
    expect(s.max).toBeGreaterThanOrEqual(95)
    expect(s.ticks[0]).toBe(0)
  })
  it('handles a signed domain (negatives)', () => {
    const s = niceScale(-40, 80)
    expect(s.min).toBeLessThanOrEqual(-40)
    expect(s.max).toBeGreaterThanOrEqual(80)
    expect(s.ticks).toContain(0)
  })
})

describe('buildChart', () => {
  it('bar: one rect per category per series, heights scale to max', () => {
    const g = buildChart({
      type: 'bar',
      categories: ['A', 'B'],
      series: [{ label: 's1', values: [10, 20] }],
      width: 400,
      height: 200,
    })
    expect(g.bars).toHaveLength(2)
    expect(g.bars[1]!.h).toBeGreaterThan(g.bars[0]!.h)
    expect(g.xTicks.map((t) => t.label)).toEqual(['A', 'B'])
    expect(g.bars[1]).toMatchObject({ label: 'B', series: 's1', value: 20 })
  })

  it('bar: negative values drop below the zero baseline', () => {
    const g = buildChart({ type: 'bar', categories: ['A', 'B'], series: [{ label: 's', values: [50, -50] }] })
    const baseY = g.yTicks.find((t) => t.value === 0)!.y
    // positive bar sits above the baseline, negative bar below it
    expect(g.bars[0]!.y).toBeLessThan(baseY)
    expect(g.bars[1]!.y).toBeGreaterThanOrEqual(baseY - 0.01)
    expect(g.bars[1]!.value).toBe(-50)
  })

  it('stacked bars: same x per category, segment heights stack', () => {
    const g = buildChart({
      type: 'bar',
      stacked: true,
      categories: ['A'],
      series: [
        { label: 'x', values: [10] },
        { label: 'y', values: [20] },
      ],
    })
    expect(g.bars).toHaveLength(2)
    // both segments share the same x (stacked, not grouped)
    expect(g.bars[0]!.x).toBe(g.bars[1]!.x)
  })

  it('combo + dual axis: bar on left, line on right axis', () => {
    const g = buildChart({
      type: 'bar',
      categories: ['A', 'B'],
      series: [
        { label: 'rev', values: [100, 200], type: 'bar', axis: 'left' },
        { label: 'pct', values: [0.4, 0.9], type: 'line', axis: 'right' },
      ],
    })
    expect(g.bars.length).toBe(2)
    expect(g.lines.length).toBe(1)
    expect(g.hasRightAxis).toBe(true)
    expect(g.y2Ticks.length).toBeGreaterThan(1)
  })

  it('line: a path through every point, area closes when type=area', () => {
    const line = buildChart({ type: 'line', categories: ['A', 'B', 'C'], series: [{ label: 's', values: [1, 2, 3] }] })
    expect(line.lines[0]!.path.startsWith('M')).toBe(true)
    expect(line.lines[0]!.areaPath).toBe('')
    expect(line.lines[0]!.label).toBe('s')
    expect(line.lines[0]!.points.map((p) => p.value)).toEqual([1, 2, 3])
    const area = buildChart({ type: 'area', categories: ['A', 'B'], series: [{ label: 's', values: [1, 2] }] })
    expect(area.lines[0]!.areaPath.endsWith('Z')).toBe(true)
  })

  it('line: null / NaN values break the line (gap) and drop the dot', () => {
    const g = buildChart({ type: 'line', categories: ['A', 'B', 'C', 'D'], series: [{ label: 's', values: [1, NaN, 3, 4] }] })
    const pts = g.lines[0]!.points
    expect(pts.map((p) => p.defined)).toEqual([true, false, true, true])
    // a gap => a second "move" command, so the path has two M's
    expect((g.lines[0]!.path.match(/M/g) ?? []).length).toBe(2)
  })

  it('area: a gap splits the fill into separate closed polygons', () => {
    const g = buildChart({ type: 'area', categories: ['A', 'B', 'C', 'D'], series: [{ label: 's', values: [2, NaN, 4, 5] }] })
    expect((g.lines[0]!.areaPath.match(/Z/g) ?? []).length).toBe(2)
  })

  it('axis titles reserve gutter space', () => {
    const plain = buildChart({ type: 'bar', categories: ['A'], series: [{ label: 's', values: [1] }] })
    const titled = buildChart({ type: 'bar', categories: ['A'], series: [{ label: 's', values: [1] }], yAxisTitle: 'Revenue', xAxisTitle: 'Region' })
    expect(titled.plot.x).toBeGreaterThan(plain.plot.x) // left gutter wider for the y title
    expect(titled.plot.h).toBeLessThan(plain.plot.h) // bottom gutter wider for the x title
  })

  it('pie: slice percents sum to ~100, slices have a centroid', () => {
    const g = buildChart({ type: 'pie', categories: ['A', 'B', 'C'], series: [{ label: 's', values: [1, 1, 2] }] })
    expect(g.slices).toHaveLength(3)
    expect(g.slices.reduce((a, s) => a + s.percent, 0)).toBeCloseTo(100)
    expect(g.slices[2]!.percent).toBeCloseTo(50)
    expect(Number.isFinite(g.slices[0]!.cx)).toBe(true)
    expect(g.donut).toBeNull()
  })

  it('donut: innerRadius produces a centre with the total', () => {
    const g = buildChart({ type: 'pie', innerRadius: 0.6, categories: ['A', 'B'], series: [{ label: 's', values: [3, 7] }] })
    expect(g.donut).not.toBeNull()
    expect(g.donut!.total).toBe(10)
  })

  it('rotates x labels when there are many / long categories', () => {
    const many = buildChart({ type: 'bar', categories: Array.from({ length: 12 }, (_, i) => `Cat ${i}`), series: [{ label: 's', values: Array(12).fill(1) }] })
    expect(many.xLabelRotated).toBe(true)
    const few = buildChart({ type: 'bar', categories: ['A', 'B'], series: [{ label: 's', values: [1, 2] }] })
    expect(few.xLabelRotated).toBe(false)
  })

  it('assigns palette colors when series omit color', () => {
    const g = buildChart({ type: 'bar', categories: ['A'], series: [{ label: 'x', values: [1] }, { label: 'y', values: [2] }] })
    expect(g.legend[0]!.color).not.toBe(g.legend[1]!.color)
  })

  it('reference line: a horizontal line at the value, included in the domain', () => {
    const g = buildChart({
      type: 'bar',
      categories: ['A', 'B'],
      series: [{ label: 's', values: [10, 20] }],
      referenceLines: [{ value: 25, label: 'Target' }],
    })
    expect(g.referenceLines).toHaveLength(1)
    expect(g.referenceLines[0]!.label).toBe('Target')
    // domain stretched to include the reference value above the data max
    expect(g.yTicks[g.yTicks.length - 1]!.value).toBeGreaterThanOrEqual(25)
  })

  it('stacked100: each category fills the full plot height (0..100 axis)', () => {
    const g = buildChart({
      type: 'bar',
      stacked100: true,
      categories: ['A'],
      series: [
        { label: 'x', values: [1] },
        { label: 'y', values: [3] },
      ],
    })
    expect(g.yTicks.map((t) => t.value)).toContain(100)
    // two stacked segments whose heights sum to ~ the plot height
    const sum = g.bars.reduce((a, b) => a + b.h, 0)
    expect(sum).toBeCloseTo(g.plot.h, 0)
    // values stay the originals (not the normalized %)
    expect(g.bars.map((b) => b.value).sort()).toEqual([1, 3])
  })

  it('stacked100 labels the axis as a percentage, not as the measure', () => {
    // The axis is a share of the total there, so a currency format would give
    // an axis reading 0 to 100 in currency for what are percentages.
    const g = buildChart({
      type: 'bar', stacked100: true, valueFormat: 'currency',
      categories: ['A'],
      series: [{ label: 'x', values: [1] }, { label: 'y', values: [3] }],
    })
    expect(g.yTicks.map((t) => t.label)).toContain('100%')
    expect(g.yTicks.every((t) => !t.label.includes('$'))).toBe(true)
  })

  it('stacked100 area: the top series reaches the 100% line, not the raw total', () => {
    const g = buildChart({
      type: 'area',
      stacked100: true,
      categories: ['A', 'B'],
      series: [
        { label: 'x', values: [200, 600] },
        { label: 'y', values: [600, 200] },
      ],
    })
    const y100 = g.yTicks.find((t) => t.value === 100)!.y
    const y0 = g.yTicks.find((t) => t.value === 0)!.y
    // top of the (cumulative) second area sits at the 100% gridline for every category
    const topPts = g.lines[1]!.points
    for (const p of topPts) expect(p.y).toBeCloseTo(y100, 0)
    // and the stack stays within the plot (never below the 0 baseline)
    for (const l of g.lines) for (const p of l.points) expect(p.y).toBeGreaterThanOrEqual(y100 - 0.5)
    expect(y100).toBeLessThan(y0) // 100% is above 0 on screen
  })

  it('scatter: one dot per point, bubble radius scales with r', () => {
    const g = buildChart({
      type: 'scatter',
      categories: [],
      series: [
        { label: 'pts', values: [], points: [{ x: 1, y: 1, r: 1 }, { x: 5, y: 8, r: 10 }, { x: 3, y: 4, r: 5 }] },
      ],
    })
    expect(g.scatterPoints).toHaveLength(3)
    const byR = [...g.scatterPoints].sort((a, b) => a.r - b.r)
    expect(byR[0]!.r).toBeLessThan(byR[2]!.r) // bigger r => bigger bubble
    expect(g.xTicks.length).toBeGreaterThan(1)
    expect(g.yTicks.length).toBeGreaterThan(1)
  })

  it('horizontal bars: bars grow along x, categories run down the y axis', () => {
    const g = buildChart({
      type: 'bar',
      orientation: 'horizontal',
      categories: ['A', 'B'],
      series: [{ label: 's', values: [10, 30] }],
      width: 400,
      height: 200,
    })
    expect(g.orientation).toBe('horizontal')
    expect(g.bars).toHaveLength(2)
    // bigger value => wider bar (grows along x)
    expect(g.bars[1]!.w).toBeGreaterThan(g.bars[0]!.w)
    // bars share a left baseline x (value 0), differ in y (one per category band)
    expect(g.bars[0]!.x).toBeCloseTo(g.bars[1]!.x, 1)
    expect(g.bars[0]!.y).not.toBe(g.bars[1]!.y)
    // category labels live on the left axis, value ticks along the bottom
    expect(g.catTicks.map((t) => t.label)).toEqual(['A', 'B'])
    expect(g.valueTicks.length).toBeGreaterThan(1)
  })

  it('horizontal bars: a reference line becomes a vertical line', () => {
    const g = buildChart({
      type: 'bar',
      orientation: 'horizontal',
      categories: ['A'],
      series: [{ label: 's', values: [10] }],
      referenceLines: [{ value: 20, label: 'Goal' }],
    })
    expect(g.referenceLines).toHaveLength(0)
    expect(g.referenceLinesV).toHaveLength(1)
    expect(g.referenceLinesV[0]!.label).toBe('Goal')
    expect(Number.isFinite(g.referenceLinesV[0]!.x)).toBe(true)
  })

  it('horizontal falls back to vertical when a series is not a bar (combo)', () => {
    const g = buildChart({
      type: 'bar',
      orientation: 'horizontal',
      categories: ['A', 'B'],
      series: [
        { label: 'bar', values: [1, 2] },
        { label: 'line', values: [3, 4], type: 'line' },
      ],
    })
    expect(g.orientation).toBe('vertical')
  })

  it('time axis: irregular date gaps map to proportional x positions', () => {
    const g = buildChart({
      type: 'line',
      xType: 'time',
      categories: ['2024-01-01', '2024-01-02', '2024-02-01'],
      series: [{ label: 's', values: [1, 2, 3] }],
    })
    const xs = g.lines[0]!.points.map((p) => p.x)
    // gap 1->2 (1 day) is far smaller than gap 2->3 (31 days)
    expect(xs[1]! - xs[0]!).toBeLessThan(xs[2]! - xs[1]!)
    expect(g.xLabelRotated).toBe(false)
  })
})

describe('rowsToChartSpec', () => {
  const rows = [
    { region: 'EMEA', product: 'A', revenue: 100, cost: 60 },
    { region: 'EMEA', product: 'B', revenue: 50, cost: 20 },
    { region: 'APAC', product: 'A', revenue: 200, cost: 90 },
  ]
  it('groups by category and sums one value field', () => {
    const spec = rowsToChartSpec(rows, { type: 'bar', category: 'region', value: 'revenue' })
    expect(spec.categories).toEqual(['EMEA', 'APAC'])
    expect(spec.series).toHaveLength(1)
    expect(spec.series[0]!.values).toEqual([150, 200])
  })
  it('multiple value fields => one series each', () => {
    const spec = rowsToChartSpec(rows, { type: 'bar', category: 'region', value: ['revenue', 'cost'] })
    expect(spec.series.map((s) => s.label)).toEqual(['revenue', 'cost'])
    expect(spec.series[1]!.values).toEqual([80, 90])
  })
  it('series field => pivot into one series per distinct value', () => {
    const spec = rowsToChartSpec(rows, { type: 'bar', category: 'region', value: 'revenue', series: 'product' })
    expect(spec.series.map((s) => s.label).sort()).toEqual(['A', 'B'])
    const a = spec.series.find((s) => s.label === 'A')!
    // EMEA/A = 100, APAC/A = 200
    expect(a.values).toEqual([100, 200])
  })
  it('supports avg and count reducers', () => {
    expect(rowsToChartSpec(rows, { type: 'bar', category: 'region', value: 'revenue', reduce: 'avg' }).series[0]!.values).toEqual([75, 200])
    expect(rowsToChartSpec(rows, { type: 'bar', category: 'region', value: 'revenue', reduce: 'count' }).series[0]!.values).toEqual([2, 1])
  })

  it('sorts categories by total value descending', () => {
    const spec = rowsToChartSpec(rows, { type: 'bar', category: 'region', value: 'revenue', sort: 'value-desc' })
    // APAC (200) outranks EMEA (150)
    expect(spec.categories).toEqual(['APAC', 'EMEA'])
    expect(spec.series[0]!.values).toEqual([200, 150])
  })

  it('topN buckets the remainder into an "Other" category', () => {
    const many = [
      { cat: 'A', v: 100 },
      { cat: 'B', v: 50 },
      { cat: 'C', v: 30 },
      { cat: 'D', v: 20 },
    ]
    const spec = rowsToChartSpec(many, { type: 'bar', category: 'cat', value: 'v', topN: 2 })
    expect(spec.categories).toEqual(['A', 'B', 'Other'])
    // Other = C + D = 50
    expect(spec.series[0]!.values).toEqual([100, 50, 50])
  })

  it('stacked100 flag passes through to the spec', () => {
    const spec = rowsToChartSpec(rows, { type: 'bar', category: 'region', value: ['revenue', 'cost'], stacked100: true })
    expect(spec.stacked100).toBe(true)
  })
})

describe('sliceChartWindow (the zoom / brush window)', () => {
  const banded = (): ChartSpec => ({
    type: 'line',
    categories: ['a', 'b', 'c', 'd', 'e'],
    series: [
      {
        label: 'forecast',
        values: [1, 2, 3, 4, 5],
        upperValues: [2, 3, 4, 5, 6],
        lowerValues: [0, 1, 2, 3, 4],
        rowIds: [['r1'], ['r2'], ['r3'], ['r4'], ['r5']],
      },
    ],
  })

  it('keeps every category-parallel array the same length', () => {
    const w = sliceChartWindow(banded(), 1, 3)
    const s = w.series[0]!
    expect(w.categories).toEqual(['b', 'c', 'd'])
    expect(s.values).toEqual([2, 3, 4])
    expect(s.upperValues).toEqual([3, 4, 5])
    expect(s.lowerValues).toEqual([1, 2, 3])
    expect(s.rowIds).toEqual([['r2'], ['r3'], ['r4']])
  })

  it('still draws the confidence band after zooming', () => {
    // The regression this function exists for. The window used to slice
    // `values` but not the envelopes, so their lengths stopped matching and
    // buildChart's equality guard dropped the band without a word.
    const full = buildChart(banded())
    expect(full.lines[0]!.bandPath).not.toBe('')

    const zoomed = buildChart(sliceChartWindow(banded(), 1, 3))
    expect(zoomed.lines[0]!.bandPath, 'band vanished inside the zoom window').not.toBe('')
  })

  it('carries waterfall totals with the window', () => {
    const w = sliceChartWindow(
      { type: 'waterfall', categories: ['a', 'b', 'c'], series: [{ label: 's', values: [1, 2, 3] }], waterfallTotals: [false, false, true] },
      1,
      2,
    )
    expect(w.waterfallTotals).toEqual([false, true])
  })

  it('clamps a window that runs past either end', () => {
    const w = sliceChartWindow(banded(), -5, 99)
    expect(w.categories).toHaveLength(5)
    expect(w.series[0]!.values).toHaveLength(5)
  })

  it('leaves a series without envelopes undisturbed', () => {
    const w = sliceChartWindow(
      { type: 'bar', categories: ['a', 'b'], series: [{ label: 's', values: [1, 2] }] },
      0,
      1,
    )
    expect(w.series[0]!.upperValues).toBeUndefined()
    expect(w.series[0]!.rowIds).toBeUndefined()
  })
})

describe('buildChart: candlestick / OHLC', () => {
  const bars = [
    { o: 100, h: 110, l: 95, c: 105 },
    { o: 105, h: 108, l: 99, c: 101 },
    { o: 101, h: 120, l: 100, c: 118 },
  ]
  const priced = (extra: Partial<ChartSpec> = {}): ChartSpec => ({
    type: 'candlestick',
    categories: ['2026-03-02', '2026-03-03', '2026-03-04'],
    series: [{ label: 'ACME', values: bars.map((b) => b.c), ohlc: bars }],
    ...extra,
  })

  it('draws one candle per bar, body spanning open to close', () => {
    const g = buildChart(priced())
    expect(g.candles).toHaveLength(3)
    const first = g.candles[0]!
    // SVG y grows downward, so a rising candle opens BELOW its close on screen.
    expect(first.up).toBe(true)
    expect(first.bodyY).toBe(Math.min(first.yOpen, first.yClose))
    expect(first.bodyH).toBeCloseTo(Math.abs(first.yClose - first.yOpen), 5)
    // Wick brackets the body.
    expect(first.yHigh).toBeLessThanOrEqual(first.bodyY)
    expect(first.yLow).toBeGreaterThanOrEqual(first.bodyY + first.bodyH)
  })

  it('colours by direction, not by series', () => {
    const g = buildChart(priced({ candleColors: { up: '#00f', down: '#f00' } }))
    expect(g.candles.map((k) => k.color)).toEqual(['#00f', '#f00', '#00f'])
  })

  it('does not drag the price axis down to zero', () => {
    // Candles are not stackable, so the bar chart's "always include 0" rule
    // must not fire. A 95..120 price series pinned to a zero baseline wastes
    // four fifths of the plot and is the whole reason `kind` is its own value.
    const g = buildChart(priced())
    expect(g.yTicks[0]!.value).toBeGreaterThan(0)
  })

  it('does not also draw the closes as a line over the candles', () => {
    // `values` carries the closes so tooltips, CSV and overlays keep working.
    // That is only safe while the line loop skips candle series.
    const g = buildChart(priced())
    expect(g.lines).toEqual([])
  })

  it('still draws a moving-average overlay from those same closes', () => {
    const withMa = priced()
    withMa.series[0]!.overlay = 'sma:2'
    const g = buildChart(withMa)
    expect(g.overlays.length).toBe(1)
    expect(g.lines).toEqual([])
  })

  it('ohlc renders the same geometry as candlestick', () => {
    const a = buildChart(priced())
    const b = buildChart(priced({ type: 'ohlc' }))
    expect(b.candles).toEqual(a.candles)
  })

  it('skips a null bar without shifting the rest', () => {
    const withGap = priced()
    withGap.series[0]!.ohlc = [bars[0]!, null, bars[2]!]
    const g = buildChart(withGap)
    expect(g.candles).toHaveLength(2)
    expect(g.candles.map((k) => k.label)).toEqual(['2026-03-02', '2026-03-04'])
  })

  it('keeps a doji visible', () => {
    const flat = priced()
    flat.series[0]!.ohlc = [{ o: 100, h: 104, l: 96, c: 100 }]
    flat.categories = ['2026-03-02']
    flat.series[0]!.values = [100]
    expect(buildChart(flat).candles[0]!.bodyH).toBeGreaterThanOrEqual(1)
  })

  it('returns empty geometry when no series carries ohlc', () => {
    const g = buildChart({ type: 'candlestick', categories: ['a'], series: [{ label: 's', values: [1] }] })
    expect(g.candles).toEqual([])
  })

  it('carries a volume series on the right axis alongside the prices', () => {
    const g = buildChart(
      priced({
        series: [
          { label: 'ACME', values: bars.map((b) => b.c), ohlc: bars },
          { label: 'Volume', values: [12, 30, 21], type: 'bar', axis: 'right' },
        ],
      }),
    )
    expect(g.candles).toHaveLength(3)
    expect(g.bars).toHaveLength(3)
    expect(g.hasRightAxis).toBe(true)
  })

  it('drops a non-positive price on a log axis instead of emitting NaN', () => {
    const bad = priced({ yScale: 'log' })
    bad.series[0]!.ohlc = [{ o: 0, h: 10, l: -5, c: 8 }, bars[1]!, bars[2]!]
    const g = buildChart(bad)
    expect(g.candles).toHaveLength(2)
    for (const k of g.candles) {
      for (const v of [k.yOpen, k.yClose, k.yHigh, k.yLow]) expect(Number.isFinite(v)).toBe(true)
    }
  })
})

describe("xType: 'ordinal-time'", () => {
  // Fri, Mon, Tue: a real weekend sits between the first two.
  const sessions = ['2026-03-06', '2026-03-09', '2026-03-10']
  const spec = (xType: ChartSpec['xType']): ChartSpec => ({
    type: 'line',
    categories: sessions,
    series: [{ label: 'p', values: [1, 2, 3] }],
    xType,
  })

  it('spaces sessions evenly across a weekend', () => {
    const g = buildChart(spec('ordinal-time'))
    const xs = g.lines[0]!.points.map((p) => p.x)
    expect(xs[1]! - xs[0]!).toBeCloseTo(xs[2]! - xs[1]!, 5)
  })

  it("differs from 'time', which leaves the weekend as a gap", () => {
    const g = buildChart(spec('time'))
    const xs = g.lines[0]!.points.map((p) => p.x)
    // Three calendar days versus one, so the first gap is the wider one.
    expect(xs[1]! - xs[0]!).toBeGreaterThan(xs[2]! - xs[1]!)
  })

  it('labels ticks from the dates and puts them on real points', () => {
    const g = buildChart(spec('ordinal-time'))
    expect(g.xTicks.length).toBeGreaterThan(0)
    const pointXs = g.lines[0]!.points.map((p) => p.x)
    for (const t of g.xTicks) {
      expect(t.label).not.toBe('')
      expect(pointXs).toContain(t.x)
    }
  })

  it('falls back to the raw labels when nothing parses as a date', () => {
    const g = buildChart({
      type: 'line',
      categories: ['north', 'south'],
      series: [{ label: 'p', values: [1, 2] }],
      xType: 'ordinal-time',
    })
    expect(g.xTicks.map((t) => t.label)).toEqual(['north', 'south'])
  })
})

describe('shape adapters (the types the panel could not reach)', () => {
  const rows = [
    { region: 'EMEA', channel: 'web', date: '2026-03-02', revenue: 100, deals: 4, id: 'r1' },
    { region: 'EMEA', channel: 'shop', date: '2026-03-03', revenue: 50, deals: 2, id: 'r2' },
    { region: 'APAC', channel: 'web', date: '2026-03-04', revenue: 70, deals: 9, id: 'r3' },
  ]

  it('specToTreemap: one level from a single series', () => {
    const t = specToTreemap(rowsToChartSpec(rows, { type: 'treemap', category: 'region', value: 'revenue' }))
    expect(t.children!.map((c) => c.name).sort()).toEqual(['APAC', 'EMEA'])
    expect(t.children!.find((c) => c.name === 'EMEA')!.value).toBe(150)
  })

  it('specToTreemap: two levels when a split-by produced several series', () => {
    const t = specToTreemap(
      rowsToChartSpec(rows, { type: 'treemap', category: 'region', value: 'revenue', series: 'channel' }),
    )
    const emea = t.children!.find((c) => c.name === 'EMEA')!
    expect(emea.children!.map((c) => c.name).sort()).toEqual(['shop', 'web'])
  })

  it('specToTreemap: drops non-positive leaves, which have no area', () => {
    const t = specToTreemap({ type: 'treemap', categories: ['a', 'b'], series: [{ label: 's', values: [5, -3] }] })
    expect(t.children!.map((c) => c.name)).toEqual(['a'])
  })

  it('specToCalendar: normalises categories to YYYY-MM-DD', () => {
    const c = specToCalendar(rowsToChartSpec(rows, { type: 'calendar', category: 'date', value: 'deals' }))
    expect(c).toEqual([
      { date: '2026-03-02', value: 4 },
      { date: '2026-03-03', value: 2 },
      { date: '2026-03-04', value: 9 },
    ])
  })

  it('specToCalendar: drops a category that is not a date rather than placing it at epoch 0', () => {
    const c = specToCalendar({ type: 'calendar', categories: ['north', '2026-03-02'], series: [{ label: 's', values: [1, 2] }] })
    expect(c).toEqual([{ date: '2026-03-02', value: 2 }])
  })

  it('specToSankey: a pivot becomes an edge list', () => {
    const { nodes, links } = specToSankey(
      rowsToChartSpec(rows, { type: 'sankey', category: 'region', value: 'revenue', series: 'channel' }),
    )
    expect(links).toHaveLength(3)
    expect(links.every((l) => l.value > 0)).toBe(true)
    // Sources and targets are namespaced, so a name on both sides is two nodes
    // rather than one node with a loop through it.
    expect(nodes.every((n) => n.id.startsWith('from:') || n.id.startsWith('to:'))).toBe(true)
    expect(new Set(nodes.map((n) => n.id)).size).toBe(nodes.length)
  })

  it('rowsToScatterSpec: one point per row, grouped into series', () => {
    const s = rowsToScatterSpec(rows, { x: 'revenue', y: 'deals', series: 'channel' })
    expect(s.type).toBe('scatter')
    expect(s.series.map((x) => x.label).sort()).toEqual(['shop', 'web'])
    expect(s.series.find((x) => x.label === 'web')!.points).toHaveLength(2)
    expect(buildChart(s).scatterPoints).toHaveLength(3)
  })

  it('rowsToScatterSpec: skips rows whose x or y is not numeric', () => {
    const s = rowsToScatterSpec([{ a: 1, b: 2 }, { a: 'x', b: 3 }], { x: 'a', y: 'b' })
    expect(s.series[0]!.points).toHaveLength(1)
  })

  it('rowsToGaugeSpec: reduces to one number and rounds the dial end up', () => {
    const g = rowsToGaugeSpec(rows, { value: 'revenue' })
    expect(g.gaugeValue).toBe(220)
    // The needle must not sit pinned at the very end of the arc.
    expect(g.gaugeMax!).toBeGreaterThanOrEqual(220)
    expect(buildChart(g).gauge).not.toBeNull()
  })

  it('rowsToGaugeSpec: honours avg and count', () => {
    expect(rowsToGaugeSpec(rows, { value: 'deals', reduce: 'count' }).gaugeValue).toBe(3)
    expect(rowsToGaugeSpec(rows, { value: 'deals', reduce: 'avg' }).gaugeValue).toBeCloseTo(5, 5)
  })

  it('every adapter survives an empty row set', () => {
    const empty = rowsToChartSpec([] as Array<{ a: string; b: number }>, { type: 'bar', category: 'a', value: 'b' })
    expect(specToTreemap(empty).children).toEqual([])
    expect(specToCalendar(empty)).toEqual([])
    expect(specToSankey(empty).links).toEqual([])
    expect(rowsToScatterSpec([] as Array<{ a: number; b: number }>, { x: 'a', y: 'b' }).series).toEqual([])
    expect(rowsToGaugeSpec([] as Array<{ a: number }>, { value: 'a' }).gaugeValue).toBe(0)
  })
})

describe('gauge bands', () => {
  // Bands normally share endpoints, so which side of a boundary a value falls
  // on decides its colour. Half-open [from, to), first match wins.
  const bands = [
    { from: 0, to: 0.3, color: 'green' },
    { from: 0.3, to: 0.45, color: 'amber' },
    { from: 0.45, to: 5, color: 'red' },
  ]
  const dial = (gaugeValue: number): ChartSpec => ({
    type: 'gauge',
    categories: [],
    series: [],
    gaugeValue,
    gaugeMin: 0,
    gaugeMax: 5,
    gaugeRanges: bands,
  })

  it('a value inside a band takes that band', () => {
    expect(buildChart(dial(0.4)).gauge!.valueColor).toBe('amber')
    expect(buildChart(dial(0.1)).gauge!.valueColor).toBe('green')
    expect(buildChart(dial(3)).gauge!.valueColor).toBe('red')
  })

  it('a value exactly on a boundary belongs to the band it opens', () => {
    // This is the one that was wrong: an inclusive `to` plus last-match-wins
    // gave 0.45 the colour of the band ABOVE it.
    expect(buildChart(dial(0.3)).gauge!.valueColor).toBe('amber')
    expect(buildChart(dial(0.45)).gauge!.valueColor).toBe('red')
  })

  it('the top of the scale still lands in the last band', () => {
    expect(buildChart(dial(5)).gauge!.valueColor).toBe('red')
  })

  it('keeps the bands clear of the value arc', () => {
    // Bands are context on their own inner ring; the value arc is the reading.
    // Drawn at the same radius, a band spanning most of the scale swamps it.
    const g = buildChart(dial(0.45)).gauge!
    const bandR = Number(/A([\d.]+),/.exec(g.rangePaths[0]!.path)![1])
    expect(bandR).toBeLessThan(g.r - 8)
  })
})
