import { describe, expect, it } from 'vitest'
import { buildChart, chartScales, chartStyleVars, type ChartSpec, type ChartType } from './chart'
import { axisScale } from './chart-scale'
import { layoutDataLabels, markerPath } from './chart-cartesian'

const line = (extra: Partial<ChartSpec> = {}): ChartSpec => ({
  type: 'line',
  categories: ['Jan', 'Feb', 'Mar', 'Apr'],
  series: [{ label: 'Sales', values: [40, 90, 60, 120] }],
  width: 400,
  height: 240,
  ...extra,
})

describe('axisScale', () => {
  it('is niceScale when nothing is configured', () => {
    expect(axisScale(3, 97)).toEqual(axisScale(3, 97, {}))
    expect(axisScale(3, 97).min).toBe(0)
    expect(axisScale(3, 97).max).toBe(100)
  })
  it('pins min / max and drops the ticks outside them', () => {
    const s = axisScale(3, 97, { min: 10, max: 90 })
    expect(s.min).toBe(10)
    expect(s.max).toBe(90)
    expect(s.ticks.every((t) => t >= 10 && t <= 90)).toBe(true)
  })
  it('honours an exact tickInterval', () => {
    const s = axisScale(0, 100, { tickInterval: 25 })
    expect(s.ticks).toEqual([0, 25, 50, 75, 100])
    expect(s.step).toBe(25)
  })
  it('nice: false keeps the raw extent with evenly spaced ticks', () => {
    const s = axisScale(3, 97, { nice: false, tickCount: 2 })
    expect(s.min).toBe(3)
    expect(s.max).toBe(97)
    expect(s.ticks).toEqual([3, 50, 97])
  })
  it('never loops forever on a tiny interval over a huge range', () => {
    const s = axisScale(0, 1e9, { tickInterval: 1 })
    expect(s.ticks.length).toBeLessThanOrEqual(1000)
  })
})

describe('value axis config', () => {
  it('yAxis.min / max pin the domain', () => {
    const geo = buildChart(line({ yAxis: { min: 0, max: 500 } }))
    expect(geo.axes!.y).toMatchObject({ min: 0, max: 500 })
    expect(geo.yTicks.every((t) => t.value >= 0 && t.value <= 500)).toBe(true)
  })
  it('the flat yAxisTitle and yScale still fill the axis object', () => {
    const a = buildChart(line({ yAxisTitle: 'Units', yScale: 'log' }))
    const b = buildChart(line({ yAxis: { title: 'Units', scale: 'log' } }))
    expect(a.axes!.y).toEqual(b.axes!.y)
    expect(a.plot).toEqual(b.plot)
  })
  it('a formatter owns the tick labels', () => {
    const geo = buildChart(line({ yAxis: { formatter: (v) => `${v} u` } }))
    expect(geo.yTicks.every((t) => t.label.endsWith(' u'))).toBe(true)
  })
  it('per-axis format beats the spec valueFormat', () => {
    const geo = buildChart(line({ valueFormat: 'currency', yAxis: { format: 'percent' } }))
    expect(geo.yTicks.some((t) => t.label.includes('%'))).toBe(true)
    expect(geo.yTicks.some((t) => t.label.includes('$'))).toBe(false)
  })
  it('reversed flips the value axis', () => {
    const geo = buildChart(line({ yAxis: { reversed: true } }))
    const sc = chartScales(geo)!
    expect(sc.yOf(geo.axes!.y.max)).toBeGreaterThan(sc.yOf(geo.axes!.y.min))
    // The line's highest value is now drawn LOWEST on the plot.
    const pts = geo.lines[0]!.points
    const top = pts.reduce((a, b) => (b.value > a.value ? b : a))
    expect(top.y).toBe(Math.max(...pts.map((p) => p.y)))
    expect(sc.yInvert(sc.yOf(90))).toBeCloseTo(90, 6)
  })
  it('labels: false keeps the ticks but blanks the text and shrinks the gutter', () => {
    const on = buildChart(line())
    const off = buildChart(line({ yAxis: { labels: false } }))
    expect(off.yTicks.length).toBe(on.yTicks.length)
    expect(off.yTicks.every((t) => t.label === '')).toBe(true)
    expect(off.plot.x).toBeLessThan(on.plot.x)
  })
  it('width fixes the left gutter', () => {
    const geo = buildChart(line({ yAxis: { width: 80 } }))
    expect(geo.plot.x).toBe(80)
  })
  it('gridLines flags travel to the geometry', () => {
    expect(buildChart(line()).grid).toEqual({ x: false, y: true })
    expect(buildChart(line({ xAxis: { gridLines: true }, yAxis: { gridLines: false } })).grid).toEqual({ x: true, y: false })
  })
  it('tickInterval on the right axis', () => {
    const geo = buildChart(
      line({
        series: [
          { label: 'a', values: [1, 2, 3, 4] },
          { label: 'b', values: [10, 20, 30, 40], axis: 'right' },
        ],
        y2Axis: { tickInterval: 20 },
      }),
    )
    expect(geo.y2Ticks.map((t) => t.value)).toEqual([0, 20, 40])
  })
})

describe('numeric x axis', () => {
  it('positions marks by value, not by index', () => {
    const geo = buildChart({
      type: 'line',
      categories: ['0', '1', '10'],
      series: [{ label: 's', values: [1, 2, 3] }],
      xType: 'number',
      width: 400,
      height: 200,
    })
    const [p0, p1, p2] = geo.lines[0]!.points
    expect(p1!.x - p0!.x).toBeCloseTo((p2!.x - p0!.x) / 10, 0)
    expect(geo.axes!.x).toMatchObject({ type: 'number', min: 0, max: 10 })
    expect(geo.axes!.x!.values).toEqual([0, 1, 10])
  })
  it('sizes bars from the smallest gap between neighbouring values', () => {
    const geo = buildChart({
      type: 'bar',
      categories: ['0', '5', '10', '12'],
      series: [{ label: 's', values: [1, 2, 3, 4] }],
      xAxis: { type: 'number' },
      width: 400,
      height: 200,
    })
    const widths = new Set(geo.bars.map((b) => b.w))
    expect(widths.size).toBe(1)
    const w = geo.bars[0]!.w
    // A gap of 2 in a domain of 12 over the plot width, minus the group pad.
    expect(w).toBeLessThan((2 / 12) * geo.plot.w)
    expect(w).toBeGreaterThan((2 / 12) * geo.plot.w * 0.6)
  })
  it('labels the ticks through the x formatter', () => {
    const geo = buildChart({
      type: 'line',
      categories: ['0', '50', '100'],
      series: [{ label: 's', values: [1, 2, 3] }],
      xAxis: { type: 'number', formatter: (v) => `${v}%` },
      width: 400,
      height: 200,
    })
    expect(geo.xTicks.every((t) => t.label.endsWith('%'))).toBe(true)
  })
  it('falls back to a category axis when nothing parses', () => {
    const geo = buildChart(line({ xAxis: { type: 'number' } }))
    expect(geo.axes!.x).toBeUndefined()
    expect(geo.xTicks.map((t) => t.label)).toEqual(['Jan', 'Feb', 'Mar', 'Apr'])
  })
  it('xOfValue / xInvertValue round-trip on every axis kind', () => {
    const cat = chartScales(buildChart(line()))!
    expect(cat.xOfValue('Mar')).toBe(cat.xOf(2))
    expect(Number.isNaN(cat.xOfValue('Nope'))).toBe(true)
    expect(cat.xInvertValue(cat.xOf(2))).toBeCloseTo(2, 6)

    const num = chartScales(
      buildChart({ type: 'line', categories: ['0', '10'], series: [{ label: 's', values: [1, 2] }], xType: 'number', width: 400, height: 200 }),
    )!
    expect(num.xOfValue(5)).toBeCloseTo((num.xOfValue(0) + num.xOfValue(10)) / 2, 6)
    expect(num.xInvertValue(num.xOfValue(7.5))).toBeCloseTo(7.5, 6)

    const time = chartScales(
      buildChart({
        type: 'line',
        categories: ['2026-01-01', '2026-01-11'],
        series: [{ label: 's', values: [1, 2] }],
        xType: 'time',
        width: 400,
        height: 200,
      }),
    )!
    const mid = Date.parse('2026-01-06')
    expect(time.xOfValue('2026-01-06')).toBeCloseTo(time.xOfValue(mid), 6)
    expect(time.xOfValue(new Date(mid))).toBeCloseTo(time.xOfValue(mid), 6)
    expect(time.xInvertValue(time.xOfValue(mid))).toBeCloseTo(mid, 0)
  })
  it('a time axis puts its ticks on calendar boundaries and fills the plot', () => {
    const months = Array.from({ length: 30 }, (_, i) => new Date(Date.UTC(2024, 3 + i, 1)).toISOString().slice(0, 10))
    const geo = buildChart({ type: 'line', xType: 'time', categories: months, series: [{ label: 's', values: months.map((_, i) => i) }], width: 900, height: 300 })
    const labels = geo.xTicks.map((t) => t.label)
    // Thirty months on a 900px plot: quarters, each at the first of its month.
    expect(labels.length).toBeGreaterThanOrEqual(6)
    expect(labels.length).toBeLessThanOrEqual(11)
    expect(labels[0]).toMatch(/^(Apr|Jul) 24$/)
    const year = buildChart({ type: 'line', xType: 'time', categories: ['2020-06-15', '2026-03-01'], series: [{ label: 's', values: [1, 2] }], width: 600, height: 300 })
    // Six years: one tick per New Year, labelled by the year it starts.
    expect(year.xTicks.map((t) => t.label)).toEqual(['2021', '2022', '2023', '2024', '2025', '2026'])
    const days = buildChart({ type: 'line', xType: 'time', categories: ['2026-01-05', '2026-01-19'], series: [{ label: 's', values: [1, 2] }], width: 400, height: 300 })
    // Two weeks: Mondays.
    expect(days.xTicks.map((t) => t.label)).toEqual(['Jan 5', 'Jan 12', 'Jan 19'])
  })
  it('an ordinal date axis of trading days ticks on Mondays', () => {
    // Weekdays only, five weeks: the ticks are the first session of each week.
    const days: string[] = []
    for (let d = new Date(Date.UTC(2026, 7, 10)); days.length < 25; d.setUTCDate(d.getUTCDate() + 1)) {
      if (d.getUTCDay() !== 0 && d.getUTCDay() !== 6) days.push(d.toISOString().slice(0, 10))
    }
    const geo = buildChart({ type: 'line', xType: 'ordinal-time', categories: days, series: [{ label: 's', values: days.map((_, i) => i) }], width: 600, height: 300 })
    const labels = geo.xTicks.map((t) => t.label)
    expect(labels[0]).toBe('Aug 10')
    expect(labels).toEqual(['Aug 10', 'Aug 17', 'Aug 24', 'Aug 31', 'Sep 7'])
  })
  it('reversed runs the category axis right to left', () => {
    const fwd = buildChart(line())
    const rev = buildChart(line({ xAxis: { reversed: true } }))
    expect(rev.lines[0]!.points[0]!.x).toBeGreaterThan(rev.lines[0]!.points[3]!.x)
    expect(rev.lines[0]!.points[0]!.x).toBe(fwd.lines[0]!.points[3]!.x)
    expect(chartScales(rev)!.xInvert(rev.lines[0]!.points[0]!.x)).toBe(0)
  })
})

describe('reference lines and bands', () => {
  it('an x reference line resolves by category label', () => {
    const geo = buildChart(line({ referenceLines: [{ axis: 'x', value: 'Mar', label: 'Launch' }] }))
    expect(geo.referenceLinesV).toHaveLength(1)
    expect(geo.referenceLinesV[0]!.x).toBe(geo.lines[0]!.points[2]!.x)
    expect(geo.referenceLinesV[0]!.label).toBe('Launch')
  })
  it('an x reference line resolves by date on a time axis and by number on a numeric one', () => {
    const t = buildChart({
      type: 'line',
      categories: ['2026-01-01', '2026-01-11'],
      series: [{ label: 's', values: [1, 2] }],
      xType: 'time',
      referenceLines: [{ axis: 'x', value: '2026-01-06' }],
      width: 400,
      height: 200,
    })
    const [a, b] = t.lines[0]!.points
    expect(t.referenceLinesV[0]!.x).toBeCloseTo((a!.x + b!.x) / 2, 0)
    const n = buildChart({
      type: 'line',
      categories: ['0', '10'],
      series: [{ label: 's', values: [1, 2] }],
      xType: 'number',
      referenceLines: [{ axis: 'x', value: 2.5 }],
      width: 400,
      height: 200,
    })
    const [c, d] = n.lines[0]!.points
    expect(n.referenceLinesV[0]!.x).toBeCloseTo(c!.x + (d!.x - c!.x) / 4, 0)
  })
  it('an unknown x reference is dropped, not drawn at NaN', () => {
    const geo = buildChart(line({ referenceLines: [{ axis: 'x', value: 'Nope' }] }))
    expect(geo.referenceLinesV).toHaveLength(0)
  })
  it('a value band is a full-width rectangle between its two values', () => {
    const geo = buildChart(line({ referenceBands: [{ from: 50, to: 100, color: 'red', label: 'target' }] }))
    const sc = chartScales(geo)!
    expect(geo.referenceBands).toHaveLength(1)
    const b = geo.referenceBands[0]!
    expect(b.axis).toBe('y')
    expect(b.x).toBe(geo.plot.x)
    expect(b.w).toBe(geo.plot.w)
    expect(b.y).toBeCloseTo(sc.yOf(100), 6)
    expect(b.h).toBeCloseTo(sc.yOf(50) - sc.yOf(100), 6)
    expect(b.color).toBe('red')
    expect(b.label).toBe('target')
  })
  it('a category band covers the whole slots from its first to its last category', () => {
    const geo = buildChart(line({ referenceBands: [{ axis: 'x', from: 'Feb', to: 'Mar' }] }))
    const b = geo.referenceBands[0]!
    expect(b.axis).toBe('x')
    expect(b.x).toBeCloseTo(geo.plot.x + geo.axes!.slot, 0)
    expect(b.w).toBeCloseTo(geo.axes!.slot * 2, 0)
    expect(b.y).toBe(geo.plot.y)
    expect(b.h).toBe(geo.plot.h)
  })
  it('a band stretches the value domain like a reference line does', () => {
    const geo = buildChart(line({ referenceBands: [{ from: 200, to: 300 }] }))
    expect(geo.axes!.y.max).toBeGreaterThanOrEqual(300)
  })
  it('horizontal bars flip: a value band is vertical, a category band is horizontal', () => {
    const geo = buildChart({
      type: 'bar',
      orientation: 'horizontal',
      categories: ['a', 'b', 'c'],
      series: [{ label: 's', values: [1, 2, 3] }],
      referenceBands: [{ from: 1, to: 2 }, { axis: 'x', from: 'a', to: 'b' }],
      referenceLines: [{ axis: 'x', value: 'c' }],
      width: 400,
      height: 200,
    })
    const [v, c] = geo.referenceBands
    expect(v!.axis).toBe('x')
    expect(v!.h).toBe(geo.plot.h)
    expect(c!.axis).toBe('y')
    expect(c!.w).toBe(geo.plot.w)
    expect(geo.referenceLines).toHaveLength(1)
  })
})

describe('title, subtitle and caption', () => {
  const TYPES: ChartType[] = ['bar', 'line', 'area', 'pie', 'scatter', 'heatmap', 'waterfall', 'funnel', 'radar', 'calendar', 'gauge', 'treemap', 'sankey', 'candlestick', 'boxplot']
  const fixture = (type: ChartType): ChartSpec => {
    const base: ChartSpec = { type, categories: ['a', 'b', 'c'], series: [{ label: 's', values: [1, 2, 3] }], width: 400, height: 240, title: 'Title', subtitle: 'Sub', caption: 'Source: tests' }
    if (type === 'scatter') base.series = [{ label: 's', values: [], points: [{ x: 1, y: 2 }, { x: 3, y: 4 }] }]
    if (type === 'calendar') base.calendarValues = [{ date: '2026-01-05', value: 1 }, { date: '2026-02-10', value: 2 }]
    if (type === 'gauge') base.gaugeValue = 40
    if (type === 'treemap') base.treemap = { name: 'root', children: [{ name: 'a', value: 1 }, { name: 'b', value: 2 }] }
    if (type === 'sankey') { base.sankeyNodes = [{ id: 'a' }, { id: 'b' }]; base.sankeyLinks = [{ source: 'a', target: 'b', value: 3 }] }
    if (type === 'candlestick') base.series = [{ label: 's', values: [2, 3, 4], ohlc: [{ o: 1, h: 3, l: 1, c: 2 }, { o: 2, h: 4, l: 2, c: 3 }, { o: 3, h: 5, l: 2, c: 4 }] }]
    if (type === 'boxplot') base.series = [{ label: 's', values: [2, 3, 4], boxes: [{ min: 1, q1: 1.5, median: 2, q3: 2.5, max: 3 }, { min: 2, q1: 2.5, median: 3, q3: 3.5, max: 4 }, { min: 3, q1: 3.5, median: 4, q3: 4.5, max: 5 }] }]
    return base
  }
  it('reserves room above and below on every chart type', () => {
    for (const type of TYPES) {
      const plain = buildChart({ ...fixture(type), title: undefined, subtitle: undefined, caption: undefined })
      const framed = buildChart(fixture(type))
      expect(framed.frame.top, `${type} frame.top`).toBeGreaterThan(0)
      expect(framed.frame.bottom, `${type} frame.bottom`).toBeGreaterThan(0)
      expect(framed.frame.title?.text).toBe('Title')
      expect(framed.frame.subtitle?.text).toBe('Sub')
      expect(framed.frame.caption?.text).toBe('Source: tests')
      expect(plain.frame.top).toBe(0)
      // The plot (or, for the radial types, the centre) moves down by the
      // reserved room, so a title never sits on top of the marks.
      if (framed.plot.h !== framed.height) {
        expect(framed.plot.y, `${type} plot.y`).toBeGreaterThanOrEqual(plain.plot.y + framed.frame.top)
      }
      // The radial types recentre inside the smaller box, so what matters is
      // that the top of the disc clears the reserved room.
      if (type === 'pie') expect(framed.donut === null ? framed.slices[0]!.cy : framed.donut.cy).toBeGreaterThan(framed.frame.top)
      if (type === 'gauge') expect(framed.gauge!.cy - framed.gauge!.r).toBeGreaterThanOrEqual(framed.frame.top)
    }
  })
  it('the title is centred and the caption sits bottom-left', () => {
    const geo = buildChart(line({ title: 'T', caption: 'C' }))
    expect(geo.frame.title!.x).toBe(200)
    expect(geo.frame.caption!.x).toBeLessThan(20)
    expect(geo.frame.caption!.y).toBeGreaterThan(geo.plot.y + geo.plot.h)
  })
})

describe('missing values, steps and markers', () => {
  const gappy = (extra: Partial<ChartSpec['series'][number]> = {}, spec: Partial<ChartSpec> = {}): ChartSpec => ({
    type: 'line',
    categories: ['a', 'b', 'c', 'd'],
    series: [{ label: 's', values: [1, Number.NaN, 3, 4], ...extra }],
    width: 400,
    height: 200,
    ...spec,
  })
  it('a gap breaks the path by default', () => {
    const geo = buildChart(gappy())
    expect((geo.lines[0]!.path.match(/M/g) ?? []).length).toBe(2)
    expect(geo.lines[0]!.points[1]!.defined).toBe(false)
  })
  it('connectNulls bridges the gap and still draws no marker there', () => {
    const geo = buildChart(gappy({ connectNulls: true }))
    expect((geo.lines[0]!.path.match(/M/g) ?? []).length).toBe(1)
    expect(geo.lines[0]!.points[1]!.defined).toBe(false)
  })
  it('nullAs: zero plots the gap at 0, on the series or on the spec', () => {
    const a = buildChart(gappy({ nullAs: 'zero' }))
    expect(a.lines[0]!.points[1]).toMatchObject({ defined: true, value: 0 })
    const b = buildChart(gappy({}, { nullAs: 'zero' }))
    expect(b.lines[0]!.points[1]).toMatchObject({ defined: true, value: 0 })
    // and the area / bar kinds see the same zero
    const c = buildChart({ ...gappy({}, { nullAs: 'zero' }), type: 'bar' })
    expect(c.bars).toHaveLength(4)
  })
  it('step draws the corner point between neighbours', () => {
    const geo = buildChart(gappy({ values: [1, 2, 3, 4], step: 'after' }))
    const [p0, p1] = geo.lines[0]!.points
    expect(geo.lines[0]!.path).toContain(`L${p1!.x},${p0!.y}`)
    const mid = buildChart(gappy({ values: [1, 2, 3, 4], step: 'middle' }))
    const [q0, q1] = mid.lines[0]!.points
    const mx = Math.round(((q0!.x + q1!.x) / 2) * 100) / 100
    expect(mid.lines[0]!.path).toContain(`L${mx},${q0!.y}`)
    // step wins over smooth: no cubic segments
    const both = buildChart(gappy({ values: [1, 2, 3, 4], step: 'before', smooth: true }))
    expect(both.lines[0]!.path).not.toContain('C')
  })
  it('steps carry into the area fill', () => {
    const geo = buildChart({ ...gappy({ values: [1, 2, 3, 4], step: 'after' }), type: 'area' })
    expect(geo.lines[0]!.areaPath).toContain('Z')
    const [p0, p1] = geo.lines[0]!.points
    expect(geo.lines[0]!.areaPath).toContain(`L${p1!.x},${p0!.y}`)
  })
  it('a series marker and per-point overrides land on the points', () => {
    const geo = buildChart(gappy({ values: [1, 2, 3, 4], marker: 'square', markers: [null, { shape: 'diamond', color: 'red' }, null, { shape: 'none' }] }))
    const pts = geo.lines[0]!.points
    expect(pts[0]!.marker).toEqual({ shape: 'square' })
    expect(pts[1]!.marker).toEqual({ shape: 'diamond', color: 'red' })
    expect(pts[3]!.marker).toEqual({ shape: 'none' })
    expect(buildChart(gappy({ values: [1, 2, 3, 4] })).lines[0]!.points[0]!.marker).toBeUndefined()
  })
  it('per-point colours reach bars, points and scatter dots', () => {
    const bars = buildChart({ ...gappy({ values: [1, 2, 3, 4], colors: [null, 'red', null, null] }), type: 'bar' })
    expect(bars.bars[1]!.color).toBe('red')
    expect(bars.bars[0]!.color).not.toBe('red')
    const pts = buildChart(gappy({ values: [1, 2, 3, 4], colors: [null, null, 'blue', null] }))
    expect(pts.lines[0]!.points[2]!.marker).toEqual({ color: 'blue' })
    const sc = buildChart({
      type: 'scatter',
      categories: [],
      series: [{ label: 's', values: [], points: [{ x: 1, y: 1 }, { x: 2, y: 2 }], colors: ['green', null] }],
      width: 300,
      height: 200,
    })
    expect(sc.scatterPoints[0]!.color).toBe('green')
  })
  it('series style resolves onto the line', () => {
    const geo = buildChart(gappy({ values: [1, 2, 3, 4], strokeWidth: 4, dash: [6, 2], opacity: 0.5, gradient: true }))
    expect(geo.lines[0]!.style).toEqual({ strokeWidth: 4, dash: '6 2', opacity: 0.5, gradient: { from: geo.lines[0]!.color, to: 'transparent' } })
    expect(buildChart(gappy()).lines[0]!.style).toBeUndefined()
    const bar = buildChart({ ...gappy({ values: [1, 2, 3, 4], opacity: 0.3 }), type: 'bar' })
    expect(bar.bars[0]!.opacity).toBe(0.3)
  })
  it('markerPath draws every shape but circle and none', () => {
    expect(markerPath('circle', 0, 0, 3)).toBe('')
    expect(markerPath('none', 0, 0, 3)).toBe('')
    for (const s of ['square', 'diamond', 'triangle', 'cross'] as const) {
      expect(markerPath(s, 10, 10, 3).startsWith('M')).toBe(true)
    }
  })
})

describe('x label rotation', () => {
  it('auto tilts labels that do not fit their slot and reports the angle', () => {
    const geo = buildChart(line({ categories: ['January 2026', 'February 2026', 'March 2026', 'April 2026'], width: 320 }))
    expect(geo.xLabelRotated).toBe(true)
    expect(geo.xLabelAngle).toBe(-40)
    // With room for them they stay upright, so a wide chart never tilts short labels.
    const roomy = buildChart(line({ categories: ['January 2026', 'February 2026', 'March 2026', 'April 2026'], width: 900 }))
    expect(roomy.xLabelRotated).toBe(false)
  })
  it('an explicit angle is honoured and 0 never rotates', () => {
    const geo = buildChart(line({ categories: ['January 2026', 'February 2026', 'March 2026', 'April 2026'], width: 320, xAxis: { labelRotation: -90 } }))
    expect(geo.xLabelAngle).toBe(-90)
    expect(geo.xLabelRotated).toBe(true)
    const flat = buildChart(line({ categories: ['January 2026', 'February 2026', 'March 2026', 'April 2026'], width: 320, xAxis: { labelRotation: 0 } }))
    expect(flat.xLabelRotated).toBe(false)
    expect(flat.plot.h).toBeGreaterThan(geo.plot.h)
  })
})

describe('log x axis', () => {
  const spec = (extra: Partial<ChartSpec> = {}): ChartSpec => ({
    type: 'line',
    categories: ['1', '10', '100', '1000'],
    series: [{ label: 'gain', values: [0, 3, 6, 9] }],
    xAxis: { type: 'number', scale: 'log' },
    width: 520,
    height: 300,
    ...extra,
  })

  it('places decades at equal pixel spacing and reports the log flag', () => {
    const geo = buildChart(spec())
    const xs = geo.lines[0]!.points.map((p) => p.x)
    expect(xs[1]! - xs[0]!).toBeCloseTo(xs[2]! - xs[1]!, 0)
    expect(xs[2]! - xs[1]!).toBeCloseTo(xs[3]! - xs[2]!, 0)
    expect(geo.axes!.x!.log).toBe(true)
    expect(geo.axes!.x!.min).toBe(1)
    expect(geo.axes!.x!.max).toBe(1000)
  })

  it('labels the decades, with 2 and 5 minors under three decades, and drops non-positive categories', () => {
    const geo = buildChart(spec())
    expect(geo.xTicks.map((t) => t.label)).toEqual(['1', '10', '100', '1k'])
    const two = buildChart(spec({ categories: ['1', '10', '100'], series: [{ label: 'g', values: [0, 1, 2] }] }))
    expect(two.xTicks.map((t) => t.label)).toEqual(['1', '2', '5', '10', '20', '50', '100'])
    const bad = buildChart(spec({ categories: ['0', '-5', '10', '100'], series: [{ label: 'g', values: [1, 2, 3, 4] }] }))
    const pts = bad.lines[0]!.points
    // A category at or below zero has no position on a log axis; the point
    // is undefined and the line starts at the first positive one.
    expect(pts[2]!.x).toBeLessThan(pts[3]!.x)
    expect(bad.axes!.x!.min).toBe(10)
  })

  it('chartScales.xOfValue and xInvertValue invert each other through log10', () => {
    const geo = buildChart(spec())
    const sc = chartScales(geo)!
    for (const v of [1, 3, 10, 55, 400, 1000]) expect(sc.xInvertValue(sc.xOfValue(v))).toBeCloseTo(v, 6)
    // Halfway across the plot is the geometric middle, not the arithmetic one.
    const mid = sc.xInvertValue(geo.plot.x + geo.plot.w / 2)
    expect(mid).toBeCloseTo(Math.sqrt(1 * 1000), 3)
    expect(Number.isNaN(sc.xOfValue(0))).toBe(true)
  })

  it('a vertical reference line at 50 lands between 10 and 100 by log distance, and min / max pin the ends', () => {
    const geo = buildChart(spec({ referenceLines: [{ value: 50, axis: 'x', label: 'cut' }] }))
    const x = geo.referenceLinesV[0]!.x
    const [, p10, p100] = geo.lines[0]!.points
    expect(x).toBeGreaterThan(p10!.x)
    expect(x).toBeLessThan(p100!.x)
    // log10(50) is 0.699 of the way from 10 to 100.
    expect((x - p10!.x) / (p100!.x - p10!.x)).toBeCloseTo(Math.log10(5), 1)
    const pinned = buildChart(spec({ xAxis: { type: 'number', scale: 'log', min: 0.1, max: 10000 } }))
    expect(pinned.axes!.x!.min).toBe(0.1)
    expect(pinned.axes!.x!.max).toBe(10000)
  })

  it('a scatter takes the same log x axis and skips points at or below zero', () => {
    const geo = buildChart({
      type: 'scatter',
      categories: [],
      series: [{ label: 'p', values: [], points: [{ x: 1, y: 1 }, { x: 10, y: 2 }, { x: 100, y: 3 }, { x: 0, y: 9 }] }],
      xAxis: { scale: 'log' },
      width: 520,
      height: 300,
    })
    expect(geo.scatterPoints).toHaveLength(3)
    const xs = geo.scatterPoints.map((d) => d.cx)
    expect(xs[1]! - xs[0]!).toBeCloseTo(xs[2]! - xs[1]!, 0)
    expect(geo.axes!.x!.log).toBe(true)
  })

  it('a histogram keeps a linear axis even when asked for log', () => {
    const geo = buildChart(spec({ type: 'histogram', binEdges: [0, 10, 20, 30, 40], categories: ['5', '15', '25', '35'], series: [{ label: 'n', values: [1, 2, 3, 4] }] }))
    expect(geo.axes!.x!.log).toBeUndefined()
  })
})

describe('data labels: rotation and connectors', () => {
  // Narrow bars with wide labels: every neighbour overlaps.
  const crowded: ChartSpec = {
    type: 'bar',
    categories: Array.from({ length: 12 }, (_, i) => `c${i}`),
    series: [{ label: 's', values: Array.from({ length: 12 }, (_, i) => 1000 + i) }],
    width: 260,
    height: 200,
  }
  const labels = (cfg: Parameters<typeof layoutDataLabels>[1]) => {
    const geo = buildChart(crowded)
    return layoutDataLabels(geo, { show: true, ...cfg }, (v) => String(v))
  }

  it('thins overlapping labels by default and keeps them all with connectors, pushed apart with leaders', () => {
    const thinned = labels({})
    expect(thinned.length).toBeLessThan(12)
    const connected = labels({ connector: true })
    expect(connected.length).toBeGreaterThan(thinned.length)
    const pushed = connected.filter((l) => l.leader)
    expect(pushed.length).toBeGreaterThan(0)
    for (const l of pushed) {
      // Pushed up from the mark, with the leader starting at the original spot.
      expect(l.y).toBeLessThan(l.leader!.y1)
      expect(l.leader!.x1).toBe(l.x)
    }
    // Nothing kept overlaps anything else.
    const boxes = connected.map((l) => ({ x0: l.x - (l.text.length * 5.6 + 2) / 2, x1: l.x + (l.text.length * 5.6 + 2) / 2, y0: l.y - 10, y1: l.y + 1 }))
    for (let a = 0; a < boxes.length; a += 1)
      for (let b = a + 1; b < boxes.length; b += 1) {
        const p = boxes[a]!, q = boxes[b]!
        expect(p.x0 < q.x1 && p.x1 > q.x0 && p.y0 < q.y1 && p.y1 > q.y0).toBe(false)
      }
  })

  it('rotation stamps the angle on every label and a steep angle turns the overlap box', () => {
    const flat = labels({ hideOverlap: false })
    expect(flat.every((l) => l.angle === undefined)).toBe(true)
    const tilted = labels({ rotation: -45, hideOverlap: false })
    expect(tilted.every((l) => l.angle === -45)).toBe(true)
    // Standing labels are 10px wide, so twelve of them fit where flat ones did not.
    expect(labels({ rotation: -90 }).length).toBe(12)
    expect(labels({}).length).toBeLessThan(12)
  })
})

describe('chartStyleVars', () => {
  it('maps the five fields to custom properties and skips unset ones', () => {
    expect(chartStyleVars(undefined)).toBe('')
    expect(chartStyleVars({})).toBe('')
    const vars = chartStyleVars({ background: '#111', textColor: '#eee', gridColor: '#333', fontSize: 15, fontFamily: 'Inter, sans-serif' })
    expect(vars).toBe('--sg-chart-bg:#111;--sg-bg:#111;--sg-fg:#eee;--sg-muted:#eee;--sg-border:#333;--sg-chart-font-scale:1.25;font-family:Inter, sans-serif')
    expect(chartStyleVars({ fontSize: 0 })).toBe('')
    expect(chartStyleVars({ gridColor: 'red' })).toBe('--sg-border:red')
  })
})
