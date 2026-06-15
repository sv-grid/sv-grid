import { describe, expect, it } from 'vitest'
import { buildChart, rowsToChartSpec, niceScale } from './chart'

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
