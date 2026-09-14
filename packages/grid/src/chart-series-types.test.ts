import { describe, expect, it } from 'vitest'
import {
  arcPath,
  binValues,
  buildChart,
  heikinAshi,
  paretoSpec,
  rowsToDirectSpec,
  rowsToHistogramSpec,
  rowsToRangeSpec,
  resolveResponsive,
  matchResponsiveRules,
  sliceChartWindow,
  streamBaseline,
  type ChartSpec,
  type ChartType,
} from './chart'
import { chartSpecToCsv } from './chart-export'

const W = 400
const H = 240

describe('histogram', () => {
  const sample = Array.from({ length: 200 }, (_, i) => ((i * 7919) % 100) + (i % 3) * 0.5)
  it('binValues splits the sample into touching bins with rounded edges', () => {
    const b = binValues(sample, { bins: 10 })
    expect(b.counts).toHaveLength(10)
    expect(b.edges).toHaveLength(11)
    expect(b.counts.reduce((a, c) => a + c, 0)).toBe(200)
    expect(b.edges[0]).toBe(Math.min(...sample))
    expect(b.categories[0]).toBe(String((b.edges[0]! + b.edges[1]!) / 2))
    // Sturges by default: log2(200) + 1 = 8.6 -> 9 bins.
    expect(binValues(sample).counts).toHaveLength(9)
    expect(binValues(sample, { method: 'sqrt' }).counts).toHaveLength(15)
    expect(binValues(sample, { binWidth: 25 }).edges).toEqual([0, 25, 50, 75, 100])
    expect(binValues([]).counts).toEqual([])
  })
  it('lays out as touching bars on a numeric axis labelled at the edges', () => {
    const spec = { ...rowsToHistogramSpec(sample.map((v) => ({ v })), { value: 'v', bins: 10 }), width: W, height: H }
    const geo = buildChart(spec)
    expect(geo.bars).toHaveLength(10)
    // Touching: each bar starts where the previous one ends (within a px).
    for (let i = 1; i < geo.bars.length; i += 1) {
      expect(Math.abs(geo.bars[i]!.x - (geo.bars[i - 1]!.x + geo.bars[i - 1]!.w))).toBeLessThanOrEqual(1)
    }
    // The ticks are the edges, and the first tick sits at the first bar's left.
    expect(geo.xTicks[0]!.label).toBe(String(spec.binEdges![0]))
    expect(Math.abs(geo.xTicks[0]!.x - geo.bars[0]!.x)).toBeLessThanOrEqual(1)
    expect(geo.axes!.x!.type).toBe('number')
  })
  it('labels its edges at the precision the bin width needs, never two edges alike', () => {
    // 1170 latencies from 26 to 1320 in 30 bins: 44ms wide, so the edges are
    // whole numbers with separators rather than "1.3k, 1.3k".
    const geo = buildChart({ ...rowsToHistogramSpec([26, 1320, 400, 800, 1000, 1256].map((v) => ({ v })), { value: 'v', bins: 30 }), width: 900, height: 240 })
    const labels = geo.xTicks.map((t) => t.label)
    expect(new Set(labels).size).toBe(labels.length)
    expect(labels[0]).toBe('26')
    expect(labels.at(-1)).toBe('1,320')
    // Sub-unit bins keep the decimals their width needs.
    const g2 = buildChart({ ...rowsToHistogramSpec([0.1, 0.9, 0.5, 0.3].map((v) => ({ v })), { value: 'v', bins: 4 }), width: 400, height: 240 })
    expect(g2.xTicks.map((t) => t.label)).toEqual(['0.10', '0.30', '0.50', '0.70', '0.90'])
  })
  it('a split histogram shares one set of edges across its series', () => {
    const rows = sample.map((v, i) => ({ v, g: i % 2 ? 'a' : 'b' }))
    const spec = rowsToHistogramSpec(rows, { value: 'v', series: 'g', bins: 8 })
    expect(spec.series).toHaveLength(2)
    expect(spec.series[0]!.values.length).toBe(8)
    expect(spec.series[0]!.values.reduce((a, c) => a + c, 0) + spec.series[1]!.values.reduce((a, c) => a + c, 0)).toBe(200)
  })
  it('is reachable from rowsToDirectSpec', () => {
    const spec = rowsToDirectSpec('histogram', sample.map((v) => ({ v })), { value: 'v', bins: 5 })
    expect(spec?.type).toBe('histogram')
    expect(spec?.binEdges).toHaveLength(6)
  })
})

describe('range bar, range area, dumbbell', () => {
  const temps: ChartSpec = {
    type: 'range-bar',
    categories: ['Mon', 'Tue', 'Wed'],
    series: [{ label: 'Temp', values: [18, 22, 15], lowValues: [8, 11, 4] }],
    width: W,
    height: H,
  }
  it('a range bar floats between lowValues and values, with no zero baseline', () => {
    const geo = buildChart(temps)
    expect(geo.bars).toHaveLength(3)
    expect(geo.bars[0]!.lo).toBe(8)
    expect(geo.bars[0]!.value).toBe(18)
    // Domain starts near the lowest low, not at 0.
    expect(geo.axes!.y.min).toBeGreaterThanOrEqual(0)
    expect(geo.axes!.y.min).toBeLessThanOrEqual(8)
    const b = geo.bars[0]!
    // The bar spans exactly from y(18) to y(8).
    const sc = (v: number) => geo.plot.y + geo.plot.h - ((v - geo.axes!.y.min) / (geo.axes!.y.max - geo.axes!.y.min)) * geo.plot.h
    expect(b.y).toBeCloseTo(sc(18), 0)
    expect(b.y + b.h).toBeCloseTo(sc(8), 0)
  })
  it('a range area fills between the two envelopes and strokes both edges', () => {
    const geo = buildChart({ ...temps, type: 'range-area' })
    expect(geo.lines).toHaveLength(1)
    expect(geo.lines[0]!.areaPath).toContain('Z')
    expect((geo.lines[0]!.path.match(/M/g) ?? []).length).toBe(2)
    expect(geo.bars).toHaveLength(0)
    // The renderer draws the band as the mark (a stronger fill, thin edges) on this flag.
    expect(geo.lines[0]!.range).toBe(true)
    expect(buildChart({ ...temps, type: 'area' }).lines[0]!.range).toBeUndefined()
  })
  it('a dumbbell draws a stem with two dots', () => {
    const geo = buildChart({ ...temps, type: 'dumbbell' })
    expect(geo.stems).toHaveLength(3)
    expect(geo.stems[0]!.dumbbell).toBe(true)
    expect(geo.stems[0]!.value2).toBe(8)
    expect(geo.stems[0]!.y0).toBeGreaterThan(geo.stems[0]!.y1)
  })
  it('rowsToRangeSpec pairs a low and a high field per category, and the direct dispatcher reduces two measures', () => {
    const rows = [
      { day: 'Mon', lo: 8, hi: 18 },
      { day: 'Tue', lo: 11, hi: 22 },
      { day: 'Wed', hi: 4, lo: 15 }, // swapped on purpose
    ]
    const spec = rowsToRangeSpec(rows, { category: 'day', low: 'lo', high: 'hi' })
    expect(spec.type).toBe('range-bar')
    expect(spec.series[0]!.lowValues).toEqual([8, 11, 4])
    expect(spec.series[0]!.values).toEqual([18, 22, 15])
    const direct = rowsToDirectSpec('range-bar', rows, { category: 'day', value: 'lo', value2: 'hi' })
    expect(direct?.series[0]!.lowValues).toEqual([8, 11, 4])
    expect(direct?.series[0]!.values).toEqual([18, 22, 15])
  })
  it('lowValues slice with the zoom window and export to CSV', () => {
    const cut = sliceChartWindow(temps, 1, 2)
    expect(cut.series[0]!.lowValues).toEqual([11, 4])
    const csv = chartSpecToCsv(temps)
    expect(csv.split('\n')[0]).toContain('Temp low')
    expect(csv.split('\n')[1]).toContain('8')
  })
})

describe('lollipop, category scatter, pareto', () => {
  const base: ChartSpec = {
    type: 'lollipop',
    categories: ['a', 'b', 'c', 'd'],
    series: [{ label: 's', values: [3, 1, 4, 2] }],
    width: W,
    height: H,
  }
  it('a lollipop is one stem per value from the axis, with no bar', () => {
    const geo = buildChart(base)
    expect(geo.stems).toHaveLength(4)
    expect(geo.stems.every((s) => !s.dumbbell)).toBe(true)
    expect(geo.bars).toHaveLength(0)
    // The stem grows from the zero baseline, like a bar does.
    expect(geo.axes!.y.min).toBe(0)
    expect(geo.stems[0]!.y0).toBeCloseTo(geo.plot.y + geo.plot.h, 0)
  })
  it('a scatter series on a category axis draws markers and no path', () => {
    const geo = buildChart({ ...base, type: 'bar', series: [{ label: 'bars', values: [3, 1, 4, 2] }, { label: 'dots', values: [2, 2, 3, 3], type: 'scatter' }] })
    expect(geo.bars).toHaveLength(4)
    expect(geo.lines).toHaveLength(1)
    expect(geo.lines[0]!.path).toBe('')
    expect(geo.lines[0]!.points.filter((p) => p.defined)).toHaveLength(4)
  })
  it('a pareto sorts the bars and adds a cumulative line on a 0..100 right axis with a threshold line', () => {
    const spec = paretoSpec({ ...base, type: 'pareto', series: [{ label: 'defects', values: [3, 1, 4, 2] }] })
    expect(spec.categories).toEqual(['c', 'a', 'd', 'b'])
    expect(spec.series[1]!.values).toEqual([40, 70, 90, 100])
    expect(spec.series[1]!.axis).toBe('right')
    const geo = buildChart({ ...base, type: 'pareto', series: [{ label: 'defects', values: [3, 1, 4, 2] }] })
    expect(geo.axes!.y2).toMatchObject({ min: 0, max: 100 })
    expect(geo.bars).toHaveLength(4)
    expect(geo.lines).toHaveLength(1)
    expect(geo.referenceLines.some((r) => r.label === '80%')).toBe(true)
  })
})

describe('stream graph', () => {
  const layers = [
    [1, 3, 2, 4],
    [2, 2, 3, 1],
    [1, 1, 2, 2],
  ]
  it('streamBaseline: zero is flat, silhouette centres the total, wiggle stays finite', () => {
    expect(streamBaseline(layers, 'zero')).toEqual([0, 0, 0, 0])
    expect(streamBaseline(layers, 'silhouette')).toEqual([-2, -3, -3.5, -3.5])
    const w = streamBaseline(layers, 'wiggle')
    expect(w).toHaveLength(4)
    expect(w.every(Number.isFinite)).toBe(true)
    expect(w[0]).toBe(0)
  })
  it('lays out stacked areas on the baseline and stretches the domain below zero', () => {
    const spec: ChartSpec = {
      type: 'stream',
      stacked: true,
      stackOffset: 'silhouette',
      categories: ['a', 'b', 'c', 'd'],
      series: layers.map((v, i) => ({ label: `L${i}`, values: v })),
      width: W,
      height: H,
    }
    const geo = buildChart(spec)
    expect(geo.lines).toHaveLength(3)
    expect(geo.lines.every((l) => l.areaPath.includes('Z'))).toBe(true)
    expect(geo.axes!.y.min).toBeLessThan(0)
    // The bottom layer's first point sits at the baseline plus its value.
    const sc = (v: number) => geo.plot.y + geo.plot.h - ((v - geo.axes!.y.min) / (geo.axes!.y.max - geo.axes!.y.min)) * geo.plot.h
    expect(geo.lines[0]!.points[0]!.y).toBeCloseTo(sc(-2 + 1), 0)
  })
})

describe('candle styles', () => {
  const ohlc = [
    { o: 10, h: 12, l: 9, c: 11 },
    { o: 11, h: 13, l: 10, c: 10.5 },
    { o: 10.5, h: 11, l: 9.5, c: 10.8 },
  ]
  const spec = (candleStyle?: ChartSpec['candleStyle']): ChartSpec => ({
    type: 'candlestick',
    categories: ['d1', 'd2', 'd3'],
    series: [{ label: 'px', values: ohlc.map((k) => k.c), ohlc }],
    candleStyle,
    width: W,
    height: H,
  })
  it('classic: hollow means up', () => {
    const geo = buildChart(spec())
    expect(geo.candles.map((k) => [k.up, k.hollow])).toEqual([[true, true], [false, false], [true, true]])
  })
  it('hollow: colour follows the previous close, fill follows the body', () => {
    const geo = buildChart(spec('hollow'))
    // d2 closes below d1 (10.5 < 11): down colour; body closes below open: filled.
    // d3 closes above d2 (10.8 > 10.5): up colour; body up: hollow.
    expect(geo.candles.map((k) => [k.up, k.hollow])).toEqual([[true, true], [false, false], [true, true]])
    const alt = buildChart({ ...spec('hollow'), series: [{ label: 'px', values: [11, 12, 11.5], ohlc: [ohlc[0]!, { o: 11, h: 13, l: 10, c: 12 }, { o: 12, h: 12.5, l: 11, c: 11.5 }] }] })
    // d3: closes below the previous close (down colour) but... open 12 > close 11.5: filled.
    expect(alt.candles[2]).toMatchObject({ up: false, hollow: false })
    const alt2 = buildChart({ ...spec('hollow'), series: [{ label: 'px', values: [11, 9, 9.5], ohlc: [ohlc[0]!, { o: 11, h: 11, l: 8, c: 9 }, { o: 9, h: 10, l: 8.5, c: 9.5 }] }] })
    // d3: up vs previous close, and body up: up + hollow.
    expect(alt2.candles[2]).toMatchObject({ up: true, hollow: true })
  })
  it('heikin-ashi smooths the bars before layout', () => {
    const ha = heikinAshi(ohlc)
    expect(ha[0]).toEqual({ o: 10.5, c: 10.5, h: 12, l: 9 })
    expect(ha[1]!.o).toBeCloseTo(10.5, 6)
    expect(ha[1]!.c).toBeCloseTo((11 + 13 + 10 + 10.5) / 4, 6)
    expect(heikinAshi([ohlc[0]!, null, ohlc[2]!])[1]).toBeNull()
    const geo = buildChart(spec('heikin-ashi'))
    expect(geo.candles[0]!.o).toBeCloseTo(10.5, 6)
  })
})

describe('polar family', () => {
  it('arcPath draws wedges, sectors and full rings', () => {
    expect(arcPath(0, 0, 0, 10, -Math.PI / 2, 0)).toMatch(/^M0,0 L/)
    expect(arcPath(0, 0, 5, 10, -Math.PI / 2, 0)).toContain('A5,5')
    expect((arcPath(0, 0, 5, 10, 0, Math.PI * 2).match(/A/g) ?? []).length).toBe(4)
    expect(arcPath(0, 0, 5, 10, 0, 0)).toBe('')
  })
  const tree = { name: 'root', children: [
    { name: 'A', children: [{ name: 'A1', value: 3 }, { name: 'A2', value: 1 }] },
    { name: 'B', value: 4 },
  ] }
  it('a sunburst gives every node an arc, level 1 summing to a full turn, tinted by depth', () => {
    const geo = buildChart({ type: 'sunburst', categories: [], series: [], tree, width: W, height: H })
    expect(geo.arcs).toHaveLength(4)
    const level1 = geo.arcs.filter((a) => a.depth === 0)
    expect(level1.reduce((s, a) => s + (a.a1 - a.a0), 0)).toBeCloseTo(Math.PI * 2, 6)
    const a = level1.find((x) => x.label === 'A')!
    expect(a.a1 - a.a0).toBeCloseTo(Math.PI, 6)
    const a1 = geo.arcs.find((x) => x.label === 'A1')!
    expect(a1.depth).toBe(1)
    expect(a1.nodePath).toEqual(['A', 'A1'])
    expect(a1.r0).toBeGreaterThanOrEqual(a.r1 - 1)
    expect(a1.color).not.toBe(a.color)
    expect(geo.legend.map((l) => l.label)).toEqual(['A', 'B'])
    // The alias: treemap feeds a sunburst too.
    expect(buildChart({ type: 'sunburst', categories: [], series: [], treemap: tree, width: W, height: H }).arcs).toHaveLength(4)
  })
  it('a radial bar sweeps each category in proportion to the largest value', () => {
    const geo = buildChart({ type: 'radial-bar', categories: ['a', 'b'], series: [{ label: 's', values: [50, 100] }], width: W, height: H })
    expect(geo.arcs).toHaveLength(2)
    expect(geo.arcs[0]!.a1 - geo.arcs[0]!.a0).toBeCloseTo(Math.PI, 3)
    expect(geo.arcs[1]!.a1 - geo.arcs[1]!.a0).toBeCloseTo(Math.PI * 2 * 0.9999, 3)
    expect(geo.arcs[0]!.trackPath).toBeTruthy()
    expect(geo.arcs[0]!.r1).toBeLessThanOrEqual(geo.arcs[1]!.r0 + 1)
  })
  it('radial columns take an angular slot each with radius from the value; a nightingale uses sqrt', () => {
    const spec: ChartSpec = { type: 'radial-column', categories: ['a', 'b', 'c', 'd'], series: [{ label: 's', values: [1, 4, 2, 4] }], width: W, height: H }
    const col = buildChart(spec)
    expect(col.arcs).toHaveLength(4)
    expect(col.arcs[0]!.a1 - col.arcs[0]!.a0).toBeCloseTo((Math.PI * 2) / 4 * 0.85, 3)
    expect(col.polarAxes).toHaveLength(4)
    expect(col.polarRings.length).toBeGreaterThan(0)
    const rose = buildChart({ ...spec, type: 'nightingale' })
    const R = rose.radarCenter!.r
    const rc = col.radarCenter!.r
    // value 1 of max 4: linear radius is a quarter of the way, sqrt is half.
    const colT = (col.arcs[0]!.r1 - col.arcs[0]!.r0) / (rc - col.arcs[0]!.r0)
    const roseT = (rose.arcs[0]!.r1 - rose.arcs[0]!.r0) / (R - rose.arcs[0]!.r0)
    expect(colT).toBeCloseTo(0.25, 2)
    expect(roseT).toBeCloseTo(0.5, 2)
    // Petals touch: no gap.
    expect(rose.arcs[0]!.a1).toBeCloseTo(rose.arcs[1]!.a0, 6)
  })
  it('stacked radial columns stack radially', () => {
    const geo = buildChart({ type: 'radial-column', stacked: true, categories: ['a'], series: [{ label: 'x', values: [2] }, { label: 'y', values: [3] }], width: W, height: H })
    expect(geo.arcs).toHaveLength(2)
    expect(geo.arcs[1]!.r0).toBeCloseTo(geo.arcs[0]!.r1, 6)
    expect(geo.arcs[0]!.a0).toBeCloseTo(geo.arcs[1]!.a0, 6)
  })
  it('a chord gives each group an arc proportional to its flow and a ribbon per link', () => {
    const geo = buildChart({
      type: 'chord',
      categories: [],
      series: [],
      sankeyNodes: [{ id: 'a' }, { id: 'b' }, { id: 'c' }],
      sankeyLinks: [{ source: 'a', target: 'b', value: 3 }, { source: 'b', target: 'c', value: 1 }, { source: 'a', target: 'c', value: 2 }],
      width: W,
      height: H,
    })
    expect(geo.arcs).toHaveLength(3)
    expect(geo.chordRibbons).toHaveLength(3)
    const spanOf = (id: string) => { const a = geo.arcs.find((x) => x.label === id)!; return a.a1 - a.a0 }
    // a flows 5, b 4, c 3: spans in that ratio.
    expect(spanOf('a') / spanOf('c')).toBeCloseTo(5 / 3, 2)
    expect(geo.chordRibbons[0]!.path).toContain('Q')
    expect(geo.legend).toHaveLength(3)
  })
})

describe('bullet', () => {
  it('draws one row per category with ranges, a measure bar and a target tick', () => {
    const geo = buildChart({
      type: 'bullet',
      categories: ['Revenue', 'Profit'],
      series: [{ label: 'Actual', values: [270, 23], targets: [250, 26] }],
      bulletRanges: [{ from: 0, to: 150, color: '#eee' }, { from: 150, to: 225, color: '#ddd' }, { from: 225, to: 300, color: '#ccc' }],
      width: W,
      height: H,
    })
    expect(geo.bullets).toHaveLength(2)
    const b = geo.bullets[0]!
    expect(b.ranges).toHaveLength(3)
    expect(b.targetX).not.toBeNull()
    expect(b.targetX!).toBeGreaterThan(b.x)
    expect(b.targetX!).toBeLessThan(b.x + b.w)
    expect(b.measureW).toBeGreaterThan(b.targetX! - b.x)
    expect(geo.orientation).toBe('horizontal')
    expect(geo.catTicks).toHaveLength(2)
    expect(geo.valueTicks.length).toBeGreaterThan(1)
  })
  it('a second series supplies the targets when the first has none', () => {
    const geo = buildChart({ type: 'bullet', categories: ['a'], series: [{ label: 'v', values: [5] }, { label: 't', values: [8] }], width: W, height: H })
    expect(geo.bullets[0]!.target).toBe(8)
    const direct = rowsToDirectSpec('bullet', [{ k: 'a', v: 5, t: 8 }], { category: 'k', value: 'v', value2: 't' })
    expect(direct?.series[0]!.targets).toEqual([8])
  })
})

describe('funnel shapes', () => {
  const spec = (funnelShape?: ChartSpec['funnelShape']): ChartSpec => ({
    type: 'funnel', categories: ['visit', 'signup', 'pay'], series: [{ label: 's', values: [100, 40, 10] }], funnelShape, width: W, height: H,
  })
  it('a cone tapers to a point and a pyramid widens to the base', () => {
    const cone = buildChart(spec('cone'))
    const last = cone.funnelSegments[2]!.path
    // The bottom edge of the last cone segment has zero width: both corners at cx.
    const nums = last.match(/[\d.]+,[\d.]+/g)!.map((p) => p.split(',').map(Number))
    expect(Math.abs(nums[2]![0]! - nums[3]![0]!)).toBeLessThan(0.01)
    const pyr = buildChart(spec('pyramid'))
    const first = pyr.funnelSegments[0]!.path.match(/[\d.]+,[\d.]+/g)!.map((p) => p.split(',').map(Number))
    expect(Math.abs(first[0]![0]! - first[1]![0]!)).toBeLessThan(0.01)
    expect(buildChart(spec()).funnelSegments).toHaveLength(3)
  })
})

describe('every new type survives an empty spec', () => {
  const TYPES: ChartType[] = ['histogram', 'range-bar', 'range-area', 'lollipop', 'dumbbell', 'pareto', 'stream', 'sunburst', 'radial-bar', 'radial-column', 'nightingale', 'bullet', 'chord']
  it('returns the empty geometry rather than throwing', () => {
    for (const type of TYPES) {
      const geo = buildChart({ type, categories: [], series: [], width: W, height: H })
      expect(geo.width, type).toBe(W)
      expect(geo.bars.length + geo.arcs.length + geo.stems.length + geo.bullets.length + geo.lines.length, type).toBe(0)
    }
  })
})

describe('stack groups', () => {
  const spec = (extra: Partial<ChartSpec> = {}): ChartSpec => ({
    type: 'bar',
    categories: ['a', 'b'],
    series: [
      { label: 'plan-x', values: [10, 20], stack: 'plan' },
      { label: 'plan-y', values: [20, 10], stack: 'plan' },
      { label: 'actual-x', values: [25, 5], stack: 'actual' },
      { label: 'actual-y', values: [5, 25], stack: 'actual' },
      { label: 'lone', values: [40, 8] },
    ],
    width: W,
    height: H,
    ...extra,
  })

  it('draws one slot per named stack plus one per lone series, side by side', () => {
    const geo = buildChart(spec())
    const at = (label: string) => geo.bars.filter((b) => b.label === 'a' && b.series === label)
    const x = (label: string) => at(label)[0]!.x
    // The two series of a stack share an x; the stacks and the lone bar differ.
    expect(x('plan-x')).toBe(x('plan-y'))
    expect(x('actual-x')).toBe(x('actual-y'))
    expect(new Set([x('plan-x'), x('actual-x'), x('lone')]).size).toBe(3)
    expect(x('plan-x')).toBeLessThan(x('actual-x'))
    expect(x('actual-x')).toBeLessThan(x('lone'))
    // Three slots of equal width.
    const widths = new Set(geo.bars.filter((b) => b.label === 'a').map((b) => b.w))
    expect(widths.size).toBe(1)
    // The second series of a stack sits on the first.
    const px = at('plan-x')[0]!
    const py = at('plan-y')[0]!
    expect(Math.abs(py.y + py.h - px.y)).toBeLessThanOrEqual(1)
  })

  it('sizes the axis to the tallest stack, not to the sum of every series', () => {
    const geo = buildChart(spec())
    // Stacks total 30 each, the lone bar 40: the axis tops out near 40, not 100.
    expect(geo.axes!.y.max).toBeGreaterThanOrEqual(40)
    expect(geo.axes!.y.max).toBeLessThan(60)
  })

  it('with `stacked` on, unnamed series join the default stack and the named ones keep theirs', () => {
    const geo = buildChart(spec({ stacked: true, series: [
      { label: 'plan-x', values: [10, 20], stack: 'plan' },
      { label: 'plan-y', values: [20, 10], stack: 'plan' },
      { label: 'u1', values: [5, 5] },
      { label: 'u2', values: [5, 5] },
    ] }))
    const xs = new Set(geo.bars.filter((b) => b.label === 'a').map((b) => b.x))
    expect(xs.size).toBe(2)
    const u1 = geo.bars.find((b) => b.label === 'a' && b.series === 'u1')!
    const u2 = geo.bars.find((b) => b.label === 'a' && b.series === 'u2')!
    expect(u1.x).toBe(u2.x)
    expect(Math.abs(u2.y + u2.h - u1.y)).toBeLessThanOrEqual(1)
  })

  it('a plain stacked chart and a plain grouped chart are unchanged', () => {
    const plain = buildChart({ type: 'bar', categories: ['a'], series: [{ label: 's1', values: [1] }, { label: 's2', values: [2] }], width: W, height: H })
    expect(new Set(plain.bars.map((b) => b.x)).size).toBe(2)
    const stacked = buildChart({ type: 'bar', categories: ['a'], series: [{ label: 's1', values: [1] }, { label: 's2', values: [2] }], stacked: true, width: W, height: H })
    expect(new Set(stacked.bars.map((b) => b.x)).size).toBe(1)
    expect(stacked.axes!.y.max).toBeGreaterThanOrEqual(3)
  })

  const areas = (extra: Partial<ChartSpec> = {}): ChartSpec => ({
    type: 'area',
    categories: ['a', 'b', 'c'],
    series: [
      { label: 'a1', values: [10, 20, 30], stack: 'one' },
      { label: 'a2', values: [10, 10, 10], stack: 'one' },
      { label: 'b1', values: [5, 5, 5], stack: 'two' },
      { label: 'lone', values: [40, 40, 40] },
    ],
    width: W,
    height: H,
    ...extra,
  })
  const yOf = (geo: ReturnType<typeof buildChart>) => {
    const { min, max } = geo.axes!.y
    return (v: number) => geo.plot.y + geo.plot.h - ((v - min) / (max - min)) * geo.plot.h
  }
  const lineOf = (geo: ReturnType<typeof buildChart>, label: string) => geo.lines.find((l) => l.label === label)!

  it('areas naming a stack accumulate within it and independently of another stack', () => {
    const geo = buildChart(areas())
    const y = yOf(geo)
    // a2 sits on a1 (10 + 10 = 20 at a), b1 and the lone area sit on the axis.
    expect(lineOf(geo, 'a2').points[0]!.y).toBeCloseTo(y(20), 0)
    expect(lineOf(geo, 'a1').points[0]!.y).toBeCloseTo(y(10), 0)
    expect(lineOf(geo, 'b1').points[0]!.y).toBeCloseTo(y(5), 0)
    expect(lineOf(geo, 'lone').points[0]!.y).toBeCloseTo(y(40), 0)
    // The pile's second layer closes back onto the first, not the axis.
    expect(lineOf(geo, 'a2').areaPath).not.toContain(`L${geo.plot.x + geo.plot.w},${geo.plot.y + geo.plot.h}`)
  })

  it('the domain covers the tallest area pile, not the sum of every area', () => {
    const geo = buildChart(areas())
    // Piles: one = 40 at c, two = 5, lone = 40; a naive sum would be 85.
    expect(geo.axes!.y.max).toBeGreaterThanOrEqual(40)
    expect(geo.axes!.y.max).toBeLessThan(60)
  })

  it('stacked100 normalises each area pile to its own total', () => {
    const geo = buildChart(areas({ stacked100: true, series: [
      { label: 'a1', values: [10, 20, 30], stack: 'one' },
      { label: 'a2', values: [10, 10, 10], stack: 'one' },
      { label: 'b1', values: [5, 5, 5], stack: 'two' },
    ] }))
    const y = yOf(geo)
    expect(geo.axes!.y.max).toBe(100)
    // a1 is half of pile one at 'a'; a2 tops the pile at 100; b1 alone is 100.
    expect(lineOf(geo, 'a1').points[0]!.y).toBeCloseTo(y(50), 0)
    expect(lineOf(geo, 'a2').points[0]!.y).toBeCloseTo(y(100), 0)
    expect(lineOf(geo, 'b1').points[0]!.y).toBeCloseTo(y(100), 0)
  })

  it('stackOffset wiggle runs per pile, and a named pile streams without spec.stacked', () => {
    const geo = buildChart(areas({ stackOffset: 'silhouette', series: [
      { label: 'a1', values: [10, 20, 30], stack: 'one' },
      { label: 'a2', values: [10, 10, 10], stack: 'one' },
      { label: 'b1', values: [5, 5, 5], stack: 'two' },
    ] }))
    const y = yOf(geo)
    // A silhouette centres each pile on zero: pile one's first layer starts
    // at -total/2 (-10 at a), pile two's at -2.5.
    expect(geo.axes!.y.min).toBeLessThan(0)
    const a1Base = lineOf(geo, 'a1').areaPath
    expect(a1Base.length).toBeGreaterThan(0)
    expect(lineOf(geo, 'a2').points[0]!.y).toBeCloseTo(y(10), 0)
    expect(lineOf(geo, 'b1').points[0]!.y).toBeCloseTo(y(2.5), 0)
  })
})

describe('pie callouts', () => {
  const pie = (extra: Partial<ChartSpec> = {}): ChartSpec => ({
    type: 'pie',
    categories: ['Alpha', 'Beta', 'Gamma', 'Delta', 'Sliver'],
    series: [{ label: 'share', values: [40, 30, 20, 9.5, 0.5] }],
    width: W,
    height: H,
    ...extra,
  })

  it('outside labels shrink the pie and give every slice over 1.5% a leader and a text anchor', () => {
    const plain = buildChart(pie())
    const out = buildChart(pie({ dataLabels: { placement: 'outside' } }))
    expect(plain.slices.every((sl) => !sl.callout)).toBe(true)
    expect(out.slices[0]!.arc!.r).toBeLessThan(plain.slices[0]!.arc!.r)
    const withCallout = out.slices.filter((sl) => sl.callout)
    expect(withCallout.map((sl) => sl.label)).toEqual(['Alpha', 'Beta', 'Gamma', 'Delta'])
    for (const sl of withCallout) {
      const c = sl.callout!
      // The leader starts just outside the arc and the text sits beyond the run.
      const cx = sl.arc!.cx
      const cy = sl.arc!.cy
      expect(Math.hypot(c.x1 - cx, c.y1 - cy)).toBeGreaterThan(sl.arc!.r)
      expect(c.anchor).toBe(c.x3 >= cx ? 'start' : 'end')
      expect(c.ty).toBe(c.y2)
      expect(Math.abs(c.tx - c.x3)).toBe(4)
    }
  })

  it('labels on one side never overlap: neighbours are pushed at least 13px apart', () => {
    // Eight thin slices on the right half crowd one side.
    const geo = buildChart(pie({
      categories: ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'rest'],
      series: [{ label: 's', values: [3, 3, 3, 3, 3, 3, 3, 3, 76] }],
      dataLabels: { placement: 'outside' },
    }))
    const right = geo.slices.filter((sl) => sl.callout?.anchor === 'start').map((sl) => sl.callout!.ty).sort((a, b) => a - b)
    expect(right.length).toBeGreaterThanOrEqual(6)
    for (let k = 1; k < right.length; k += 1) expect(right[k]! - right[k - 1]!).toBeGreaterThanOrEqual(13)
    // And they stay inside the frame.
    expect(right[0]!).toBeGreaterThanOrEqual(0)
    expect(right[right.length - 1]!).toBeLessThanOrEqual(H)
  })

  it('the callout text stays inside the chart on a narrow pane: the radius makes room for the widest label', () => {
    // 300px wide with long names: "Samsung Internet 3%" is about 120px of
    // text, and the pie used to keep a 34px margin and push it off the SVG.
    const geo = buildChart(pie({
      width: 300, height: 260,
      categories: ['Samsung Internet', 'DuckDuckGo Browser', 'Chrome', 'Safari'],
      series: [{ label: 's', values: [3, 4, 60, 33] }],
      dataLabels: { placement: 'outside' },
    }))
    const est = (label: string, max: number) => (Math.min(label.length, 18, max) + 4) * 6.3
    for (const sl of geo.slices) {
      const c = sl.callout!
      expect(c).toBeTruthy()
      expect(c.maxChars).toBeGreaterThanOrEqual(4)
      const textEnd = c.anchor === 'start' ? c.tx + est(sl.label, c.maxChars) : c.tx - est(sl.label, c.maxChars)
      expect(textEnd).toBeGreaterThanOrEqual(0)
      expect(textEnd).toBeLessThanOrEqual(300)
    }
    // The pie itself keeps a quarter of the short side however long the names.
    expect(geo.slices[0]!.arc!.r).toBeGreaterThanOrEqual(65)
    // Short names cost less radius than long ones.
    const short = buildChart(pie({ width: 300, height: 260, categories: ['A', 'B', 'C', 'D'], series: [{ label: 's', values: [3, 4, 60, 33] }], dataLabels: { placement: 'outside' } }))
    expect(short.slices[0]!.arc!.r).toBeGreaterThan(geo.slices[0]!.arc!.r)
  })

  it('the gutters are per side, and the pie sits centred in what they leave', () => {
    // Every small slice on the left with a long name; one big slice on the right.
    const geo = buildChart(pie({
      width: 444, height: 320,
      categories: ['Chrome', 'Safari', 'Edge', 'Firefox', 'Samsung Internet', 'Other'],
      series: [{ label: 's', values: [61.2, 19.8, 6.9, 3.4, 2.6, 5.1] }],
      dataLabels: { placement: 'outside' },
    }))
    const arc = geo.slices[0]!.arc!
    // Sized by the widest label on either side the radius was 70; the right
    // side only needs room for "Chrome 62%".
    expect(arc.r).toBeGreaterThanOrEqual(85)
    expect(arc.cx).toBeGreaterThan(444 / 2)
    // Each label still ends inside the chart.
    const est = (label: string, max: number) => (Math.min(label.length, 18, max) + 4) * 6.3
    for (const sl of geo.slices) {
      const c = sl.callout
      if (!c) continue
      const textEnd = c.anchor === 'start' ? c.tx + est(sl.label, c.maxChars) : c.tx - est(sl.label, c.maxChars)
      expect(textEnd).toBeGreaterThanOrEqual(0)
      expect(textEnd).toBeLessThanOrEqual(444)
    }
  })

  it('a hidden label config or an inside placement leaves the pie alone', () => {
    const plain = buildChart(pie())
    expect(buildChart(pie({ dataLabels: { placement: 'outside', show: false } })).slices[0]!.arc!.r).toBe(plain.slices[0]!.arc!.r)
    expect(buildChart(pie({ dataLabels: { placement: 'inside' } })).slices.some((sl) => sl.callout)).toBe(false)
  })
})

describe('series end labels', () => {
  const spec = (extra: Partial<ChartSpec> = {}): ChartSpec => ({
    type: 'line',
    categories: ['a', 'b', 'c', 'd'],
    series: [
      { label: 'North', values: [1, 2, 3, 4] },
      { label: 'South', values: [4, 3, 2, 1] },
      { label: 'Gapped', values: [2, 2, 2, NaN] },
      { label: 'Bars', values: [1, 1, 1, 1], type: 'bar' },
    ],
    width: W,
    height: H,
    seriesLabels: true,
    ...extra,
  })

  it('names every line at its last defined point and reserves a gutter for the text', () => {
    const geo = buildChart(spec())
    const plain = buildChart(spec({ seriesLabels: false }))
    expect(geo.plot.w).toBeLessThan(plain.plot.w)
    // Sorted top to bottom, the way a reader scans the gutter.
    expect(geo.seriesLabels.map((l) => l.text)).toEqual(['North', 'Gapped', 'South'])
    const north = geo.seriesLabels.find((l) => l.series === 'North')!
    const last = geo.lines.find((l) => l.label === 'North')!.points[3]!
    expect(north.x).toBeCloseTo(last.x + 6, 1)
    expect(north.color).toBe(geo.lines.find((l) => l.label === 'North')!.color)
    // The gapped series is labelled at its third point, not at the NaN.
    const gapped = geo.seriesLabels.find((l) => l.series === 'Gapped')!
    expect(gapped.x).toBeCloseTo(geo.lines.find((l) => l.label === 'Gapped')!.points[2]!.x + 6, 1)
  })

  it('pushes labels that end together apart by a line height and keeps them inside the plot', () => {
    const geo = buildChart(spec({ series: [
      { label: 'one', values: [1, 2, 3, 4] },
      { label: 'two', values: [4, 3, 2, 4] },
      { label: 'three', values: [2, 2, 2, 4.05] },
    ] }))
    const ys = geo.seriesLabels.map((l) => l.y).sort((a, b) => a - b)
    expect(ys).toHaveLength(3)
    expect(ys[1]! - ys[0]!).toBeGreaterThanOrEqual(12)
    expect(ys[2]! - ys[1]!).toBeGreaterThanOrEqual(12)
    expect(ys[0]!).toBeGreaterThanOrEqual(geo.plot.y)
    expect(ys[2]!).toBeLessThanOrEqual(geo.plot.y + geo.plot.h)
  })

  it('a formatter writes the text from the label and the last value', () => {
    const geo = buildChart(spec({ seriesLabels: { formatter: (s, v) => `${s} (${v})` } }))
    expect(geo.seriesLabels.map((l) => l.text).sort()).toEqual(['Gapped (2)', 'North (4)', 'South (1)'])
  })
})

describe('responsive rules', () => {
  const base: ChartSpec = {
    type: 'line',
    categories: ['a', 'b'],
    series: [{ label: 's', values: [1, 2] }],
    yAxis: { title: 'Units', gridLines: true },
    seriesLabels: true,
    responsive: [
      { maxWidth: 480, spec: { seriesLabels: false, yAxis: { title: undefined } } },
      { maxWidth: 320, spec: { yAxis: { gridLines: false } }, legend: false },
      { minWidth: 1200, spec: { title: 'Wide' } },
    ],
  }

  it('matchResponsiveRules keeps spec order and every rule that fits the size', () => {
    expect(matchResponsiveRules(base.responsive, 300, 200).map((r) => r.maxWidth)).toEqual([480, 320])
    expect(matchResponsiveRules(base.responsive, 400, 200).map((r) => r.maxWidth)).toEqual([480])
    expect(matchResponsiveRules(base.responsive, 800, 200)).toEqual([])
    expect(matchResponsiveRules(base.responsive, 1400, 200).map((r) => r.minWidth)).toEqual([1200])
    expect(matchResponsiveRules(undefined, 100, 100)).toEqual([])
  })

  it('resolveResponsive merges every matching patch in order, axes one level deep, and returns the input when none match', () => {
    expect(resolveResponsive(base, 800, 300)).toBe(base)
    const narrow = resolveResponsive(base, 300, 300)
    expect(narrow.seriesLabels).toBe(false)
    expect(narrow.yAxis).toEqual({ title: undefined, gridLines: false })
    expect(narrow.responsive).toBe(base.responsive)
    const wide = resolveResponsive(base, 1400, 300)
    expect(wide.title).toBe('Wide')
    expect(wide.seriesLabels).toBe(true)
  })

  it('buildChart applies the rules at the spec size and a rule cannot resize the chart', () => {
    const wide = buildChart({ ...base, width: 800, height: 300 })
    const narrow = buildChart({ ...base, width: 300, height: 300, responsive: [{ maxWidth: 480, spec: { seriesLabels: false, width: 999, height: 999 } }] })
    expect(wide.seriesLabels).toHaveLength(1)
    expect(narrow.seriesLabels).toHaveLength(0)
    expect(narrow.width).toBe(300)
    expect(narrow.height).toBe(300)
    expect(narrow.grid.y).toBe(true)
  })
})
