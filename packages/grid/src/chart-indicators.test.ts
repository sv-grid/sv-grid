import { describe, expect, it } from 'vitest'
import {
  atr, bollingerBands, computeOverlay, computeOverlayFit, indicatorPane, macd, obv, overlayName, rsi, stochastic, vwap, wma,
} from './chart-indicators'
import { exponentialFit, linearFit, logarithmicFit, polynomialFit, powerFit, rSquared } from './chart-stats'
import { regressionFit } from './chart-indicators'
import { resampleOhlc, rowsToOhlcSpec } from './chart-financial'
import { applyChartFormat, buildChart, CHART_RESPONSIVE_PRESETS } from './chart'
import type { ChartSpec, OhlcBar } from './chart-types'

const closes = [44.34, 44.09, 44.15, 43.61, 44.33, 44.83, 45.10, 45.42, 45.84, 46.08, 45.89, 46.03, 45.61, 46.28, 46.28, 46.00, 46.03, 46.41, 46.22, 45.64]
const bars = (cs: number[]): OhlcBar[] => cs.map((c, i) => ({ o: i ? cs[i - 1]! : c, h: c + 1, l: c - 1, c }))
const finite = (a: number[]) => a.filter(Number.isFinite)

describe('indicators', () => {
  it('wma weights the latest value most and pads the warm-up with NaN', () => {
    const out = wma([1, 2, 3, 4], 3)
    expect(out.slice(0, 2).every(Number.isNaN)).toBe(true)
    // (1*1 + 2*2 + 3*3) / 6 = 14/6
    expect(out[2]).toBeCloseTo(14 / 6, 6)
    expect(out[3]).toBeCloseTo((2 + 6 + 12) / 6, 6)
  })

  it('bollinger bands sit k deviations around the average', () => {
    const { middle, upper, lower } = bollingerBands([2, 4, 4, 4, 5, 5, 7, 9], 8, 2)
    expect(middle[7]).toBe(5)
    // Population standard deviation of that sample is exactly 2.
    expect(upper[7]).toBe(9)
    expect(lower[7]).toBe(1)
    expect(Number.isNaN(upper[6])).toBe(true)
  })

  it('rsi is 0..100, NaN before the period, and 100 with no losses', () => {
    const out = rsi(closes, 14)
    expect(out.slice(0, 14).every(Number.isNaN)).toBe(true)
    expect(finite(out).every((v) => v >= 0 && v <= 100)).toBe(true)
    // The textbook 14-day RSI on this series lands near 70 at bar 14.
    expect(out[14]).toBeGreaterThan(65)
    expect(out[14]).toBeLessThan(75)
    expect(rsi([1, 2, 3, 4, 5], 3)[3]).toBe(100)
  })

  it('macd is fast EMA minus slow EMA, with a signal and a histogram', () => {
    const series = Array.from({ length: 60 }, (_, i) => 100 + Math.sin(i / 5) * 10)
    const m = macd(series, 12, 26, 9)
    expect(m.macd.slice(0, 25).every(Number.isNaN)).toBe(true)
    expect(Number.isFinite(m.macd[25])).toBe(true)
    // Histogram is the line minus its signal wherever both exist.
    for (let i = 0; i < 60; i += 1) {
      if (Number.isFinite(m.signal[i])) expect(m.histogram[i]).toBeCloseTo(m.macd[i]! - m.signal[i]!, 9)
    }
    expect(finite(m.signal).length).toBeGreaterThan(20)
  })

  it('vwap is the running volume-weighted typical price', () => {
    const b: OhlcBar[] = [{ o: 1, h: 3, l: 1, c: 2 }, { o: 2, h: 5, l: 3, c: 4 }]
    // typical prices 2 and 4; volumes 1 and 3 -> (2*1 + 4*3) / 4 = 3.5
    expect(vwap(b, [1, 3])).toEqual([2, 3.5])
  })

  it('atr seeds with the mean true range and then smooths', () => {
    const b = bars(closes)
    const out = atr(b, 14)
    expect(out.slice(0, 13).every(Number.isNaN)).toBe(true)
    expect(Number.isFinite(out[13])).toBe(true)
    expect(finite(out).every((v) => v > 0)).toBe(true)
  })

  it('stochastic %K is the close inside the window range, %D its average', () => {
    const b = bars(closes)
    const { k, d } = stochastic(b, 5, 3)
    expect(finite(k).every((v) => v >= 0 && v <= 100)).toBe(true)
    expect(Number.isNaN(k[3])).toBe(true)
    expect(Number.isFinite(k[4])).toBe(true)
    expect(Number.isNaN(d[5])).toBe(true)
    expect(d[6]).toBeCloseTo((k[4]! + k[5]! + k[6]!) / 3, 9)
  })

  it('obv adds volume on up closes and subtracts it on down closes', () => {
    expect(obv([10, 11, 10.5, 10.5, 12], [100, 200, 300, 400, 500])).toEqual([0, 200, -100, -100, 400])
  })

  it('computeOverlay dispatches the new kinds', () => {
    expect(computeOverlay([1, 2, 3, 4], 'wma:3')[3]).toBeCloseTo(20 / 6, 6)
    expect(computeOverlay([2, 4, 4, 4, 5, 5, 7, 9], 'bb:8:2')[7]).toBe(5)
    const b: OhlcBar[] = [{ o: 1, h: 3, l: 1, c: 2 }, { o: 2, h: 5, l: 3, c: 4 }]
    expect(computeOverlay([2, 4], 'vwap', { ohlc: b, volumes: [1, 3] })).toEqual([2, 3.5])
    // Without bars and volumes a vwap is gaps, not zeros.
    expect(computeOverlay([2, 4], 'vwap').every(Number.isNaN)).toBe(true)
  })
})

describe('indicatorPane', () => {
  const price: ChartSpec = {
    type: 'candlestick',
    categories: closes.map((_, i) => `2026-01-${String(i + 1).padStart(2, '0')}`),
    series: [{ label: 'ACME', values: closes, ohlc: bars(closes), volumes: closes.map((_, i) => 100 + i) }],
    xType: 'ordinal-time',
    height: 300,
  }

  it('builds an RSI pane with the 30 / 70 lines and a fixed 0..100 axis', () => {
    const pane = indicatorPane(price, { kind: 'rsi' })
    expect(pane.type).toBe('line')
    expect(pane.categories).toBe(price.categories)
    expect(pane.referenceLines?.map((r) => r.value)).toEqual([30, 70])
    expect(pane.yAxis).toMatchObject({ min: 0, max: 100 })
    expect(pane.height).toBe(100)
    expect(pane.series[0]!.values).toHaveLength(closes.length)
  })

  it('builds a MACD pane as a histogram with two lines on top', () => {
    const pane = indicatorPane(price, { kind: 'macd', params: { fast: 3, slow: 6, signal: 2 } })
    expect(pane.type).toBe('bar')
    expect(pane.series.map((s) => s.label)).toEqual(['Histogram', 'MACD', 'Signal'])
    expect(pane.series[1]!.type).toBe('line')
    expect(pane.title).toBe('MACD 3, 6, 2')
  })

  it('colours volume bars by candle direction', () => {
    const pane = indicatorPane(price, { kind: 'volume', height: 80 })
    expect(pane.series[0]!.values).toEqual(price.series[0]!.volumes)
    expect(pane.series[0]!.colors![1]).toBe('#ef4444')
    expect(pane.series[0]!.colors![2]).toBe('#16a34a')
    expect(pane.height).toBe(80)
  })

  it('reads a plain line series as closes when there are no bars', () => {
    const line: ChartSpec = { type: 'line', categories: price.categories, series: [{ label: 'x', values: closes }] }
    const pane = indicatorPane(line, { kind: 'rsi', params: { period: 5 } })
    expect(finite(pane.series[0]!.values).length).toBe(closes.length - 5)
    expect(finite(indicatorPane(line, { kind: 'stochastic' }).series[0]!.values).length).toBeGreaterThan(0)
  })
})

describe('resampleOhlc / rowsToOhlcSpec', () => {
  const days = ['2026-01-05', '2026-01-06', '2026-01-07', '2026-01-08', '2026-01-09', '2026-01-12', '2026-01-13']
  const ohlc: OhlcBar[] = [
    { o: 10, h: 12, l: 9, c: 11 }, { o: 11, h: 15, l: 10, c: 14 }, { o: 14, h: 14, l: 8, c: 9 },
    { o: 9, h: 10, l: 7, c: 8 }, { o: 8, h: 11, l: 8, c: 10 }, { o: 10, h: 13, l: 9, c: 12 }, { o: 12, h: 16, l: 11, c: 15 },
  ]
  const volumes = [1, 2, 3, 4, 5, 6, 7]

  it('rolls daily bars into weekly ones: first open, max high, min low, last close, summed volume', () => {
    const out = resampleOhlc(days, ohlc, { bucket: 'week', volumes })
    expect(out.categories).toEqual(['2026-01-05', '2026-01-12'])
    expect(out.ohlc[0]).toEqual({ o: 10, h: 15, l: 7, c: 10 })
    expect(out.ohlc[1]).toEqual({ o: 10, h: 16, l: 9, c: 15 })
    expect(out.volumes).toEqual([15, 13])
  })

  it('takes the open from the earliest bar and the close from the latest, whatever the row order', () => {
    const shuffled = [3, 0, 4, 1, 2]
    const out = resampleOhlc(shuffled.map((i) => days[i]!), shuffled.map((i) => ohlc[i]!), { bucket: 'week' })
    expect(out.ohlc[0]).toEqual({ o: 10, h: 15, l: 7, c: 10 })
  })

  it('rowsToOhlcSpec sorts rows by date, keeps volume on the series and can bucket', () => {
    const rows = days.map((d, i) => ({ day: d, o: ohlc[i]!.o, h: ohlc[i]!.h, l: ohlc[i]!.l, c: ohlc[i]!.c, v: volumes[i]! })).reverse()
    const spec = rowsToOhlcSpec(rows, { date: 'day', open: 'o', high: 'h', low: 'l', close: 'c', volume: 'v', lastPriceLine: true })
    expect(spec.type).toBe('candlestick')
    expect(spec.xType).toBe('ordinal-time')
    expect(spec.categories).toEqual(days)
    expect(spec.series[0]!.volumes).toEqual(volumes)
    expect(spec.series[0]!.values).toEqual(ohlc.map((b) => b.c))
    expect(spec.lastPriceLine).toBe(true)
    const weekly = rowsToOhlcSpec(rows, { date: 'day', open: 'o', high: 'h', low: 'l', close: 'c', volume: 'v', bucket: 'week', label: 'ACME' })
    expect(weekly.categories).toEqual(['2026-01-05', '2026-01-12'])
    expect(weekly.series[0]!.label).toBe('ACME')
    expect(weekly.series[0]!.volumes).toEqual([15, 13])
  })
})

describe('last price, bands, flags and drawings in the layout', () => {
  const cats = ['2026-01-01', '2026-01-02', '2026-01-03', '2026-01-04', '2026-01-05']
  const spec: ChartSpec = {
    type: 'line',
    categories: cats,
    series: [{ label: 'p', values: [10, 12, 11, 15, 13], overlay: 'bb:3:2' }],
    lastPriceLine: true,
    annotations: [{ at: { category: '2026-01-02' }, label: 'E', shape: 'flag', text: 'Earnings call' }],
    drawings: [
      { id: 't', kind: 'trend', points: [{ x: '2026-01-01', y: 10 }, { x: '2026-01-05', y: 13 }] },
      { id: 'r', kind: 'hray', points: [{ x: '2026-01-03', y: 12 }] },
      { id: 'f', kind: 'fib', points: [{ x: '2026-01-01', y: 10 }, { x: '2026-01-04', y: 15 }] },
      { id: 'lost', kind: 'trend', points: [{ x: 'nowhere', y: 1 }, { x: '2026-01-05', y: 13 }] },
    ],
    width: 600,
    height: 300,
  }
  const geo = buildChart(spec, 'light')

  it('draws the last close as a red pill line (it closed down) at the value', () => {
    const pill = geo.referenceLines.find((r) => r.pill)!
    expect(pill).toBeTruthy()
    expect(pill.color).toBe('#ef4444')
    expect(pill.label).toBe('13')
    const last = geo.lines[0]!.points[4]!
    expect(pill.y).toBe(last.y)
  })

  it('a Bollinger overlay carries a band path', () => {
    expect(geo.overlays).toHaveLength(1)
    expect(geo.overlays[0]!.bandPath).toMatch(/^M.*Z$/)
  })

  it('annotations keep their shape and text', () => {
    expect(geo.annotations[0]).toMatchObject({ shape: 'flag', text: 'Earnings call', label: 'E' })
  })

  it('drawings resolve to pixels, fib gets six levels, a ray a value label, an unplaceable one is dropped', () => {
    expect(geo.drawings.map((d) => d.id)).toEqual(['t', 'r', 'f'])
    const t = geo.drawings[0]!
    expect(t.points[0]).toEqual({ x: geo.lines[0]!.points[0]!.x, y: geo.lines[0]!.points[0]!.y })
    expect(geo.drawings[1]!.label).toBe('12')
    const f = geo.drawings[2]!
    expect(f.levels).toHaveLength(6)
    expect(f.levels![0]!.ratio).toBe(0)
    expect(f.levels![5]!.ratio).toBe(1)
    // 0% is at the second point's value (15), 100% at the first (10).
    expect(f.levels![0]!.y).toBe(geo.lines[0]!.points[3]!.y)
    expect(f.levels![5]!.y).toBe(geo.lines[0]!.points[0]!.y)
  })

  it('drawings outside a zoom window are dropped rather than drawn at a wrong x', () => {
    const zoomed = buildChart({ ...spec, categories: cats.slice(2), series: [{ label: 'p', values: [11, 15, 13] }] }, 'light')
    expect(zoomed.drawings.map((d) => d.id)).toEqual(['r'])
  })
})

describe('applyChartFormat', () => {
  const base: ChartSpec = {
    type: 'bar',
    categories: ['a', 'b'],
    series: [{ label: 'Plan', values: [1, 2] }, { label: 'Actual', values: [2, 3] }],
    yAxis: { min: 0 },
  }

  it('merges titles, axes, palette and per-series style into a copy', () => {
    const out = applyChartFormat(base, {
      title: 'Sales', subtitle: '', caption: 'Q1',
      yAxis: { min: null, max: 10, title: 'Units', format: 'compact' },
      xAxis: { gridLines: true, labelRotation: -45 },
      series: { Actual: { color: '#f00', type: 'line', axis: 'right', marker: 'square', strokeWidth: 3, smooth: true }, Missing: { color: '#0f0' } },
      palette: ['#111', '#222'],
    })
    expect(out).not.toBe(base)
    expect(base.title).toBeUndefined()
    expect(out.title).toBe('Sales')
    expect(out.subtitle).toBeUndefined()
    expect(out.caption).toBe('Q1')
    expect(out.yAxis).toEqual({ max: 10, title: 'Units', format: 'compact' })
    expect(out.xAxis).toEqual({ gridLines: true, labelRotation: -45 })
    expect(out.palette).toEqual(['#111', '#222'])
    expect(out.series[0]).toEqual(base.series[0])
    expect(out.series[1]).toMatchObject({ color: '#f00', type: 'line', axis: 'right', marker: 'square', strokeWidth: 3, smooth: true })
    expect(out.series).toHaveLength(2)
  })

  it('a null or empty format is the same spec', () => {
    expect(applyChartFormat(base, null)).toBe(base)
    expect(applyChartFormat(base, {})).toEqual(base)
  })

  it('writes series labels, a stack group, the style and a compact rule; crosshair pills stay a component prop', () => {
    const withRule: ChartSpec = { ...base, responsive: [{ maxWidth: 200, spec: { title: 'tiny' } }], style: { gridColor: '#eee' } }
    const out = applyChartFormat(withRule, {
      seriesLabels: true,
      crosshairLabels: false,
      compactBelow: 420,
      series: { Plan: { stack: 'a' }, Actual: { stack: '' } },
      style: { fontSize: 14, background: '#fff' },
    })
    expect(out.seriesLabels).toBe(true)
    expect((out as Record<string, unknown>).crosshairLabels).toBeUndefined()
    // The spec's own rule first, the preset appended.
    expect(out.responsive).toHaveLength(2)
    expect(out.responsive![0]).toEqual(withRule.responsive![0])
    expect(out.responsive![1]).toEqual(CHART_RESPONSIVE_PRESETS.compact(420))
    expect(out.responsive![1]!.legend).toBe(false)
    expect(out.responsive![1]!.spec).toMatchObject({ seriesLabels: false, dataLabels: { show: false }, xAxis: { labelRotation: 90 } })
    expect(withRule.responsive).toHaveLength(1)
    expect(out.series[0]!.stack).toBe('a')
    expect(out.series[1]!.stack).toBeUndefined()
    // Style merges over what the spec carries.
    expect(out.style).toEqual({ gridColor: '#eee', fontSize: 14, background: '#fff' })
    // Off or unset leaves the spec alone.
    expect(applyChartFormat(base, { compactBelow: null, seriesLabels: false }).responsive).toBeUndefined()
    expect(applyChartFormat(base, { compactBelow: 0 }).responsive).toBeUndefined()
    expect(applyChartFormat(base, { seriesLabels: false }).seriesLabels).toBe(false)
  })
})

describe('regression fits', () => {
  const close = (a: number[], b: number[], digits = 6) => a.forEach((v, i) => expect(v).toBeCloseTo(b[i]!, digits))

  it('poly:2 fits a parabola exactly, with r2 = 1 and an equation', () => {
    const values = Array.from({ length: 12 }, (_, i) => 3 * i * i - 2 * i + 5)
    const fit = polynomialFit(values, 2)
    close(fit.fitted, values, 6)
    expect(fit.r2).toBeCloseTo(1, 9)
    expect(fit.equation).toMatch(/^y = .* u\^2/)
    // Through the overlay dispatch too, with the fit attached.
    const ovl = computeOverlayFit(values, 'poly:2')
    close(ovl.values, values, 6)
    expect(ovl.r2).toBeCloseTo(1, 9)
    expect(ovl.equation).toBe(fit.equation)
    // Plain computeOverlay keeps its old signature.
    close(computeOverlay(values, 'poly:2'), values, 6)
  })

  it('exp fits 2^i within 1e-9 and skips non-positive values', () => {
    const values = Array.from({ length: 10 }, (_, i) => Math.pow(2, i))
    const fit = exponentialFit(values)
    close(fit.fitted, values, 6)
    expect(fit.r2).toBeCloseTo(1, 9)
    expect(fit.equation).toMatch(/e\^\(0\.693 x\)/)
    const holes = exponentialFit([1, 2, 0, 8, -1, 32])
    expect(Number.isNaN(holes.fitted[2])).toBe(true)
    expect(Number.isNaN(holes.fitted[4])).toBe(true)
    expect(holes.fitted[5]).toBeCloseTo(32, 6)
  })

  it('log and power fits recover their generating functions', () => {
    const logs = Array.from({ length: 20 }, (_, i) => 4 + 1.5 * Math.log(i + 1))
    const lf = logarithmicFit(logs)
    close(lf.fitted, logs, 6)
    expect(lf.r2).toBeCloseTo(1, 9)
    const pows = Array.from({ length: 20 }, (_, i) => 2 * Math.pow(i + 1, 1.7))
    const pf = powerFit(pows)
    close(pf.fitted, pows, 4)
    expect(pf.r2).toBeCloseTo(1, 9)
    expect(pf.equation).toMatch(/\^1\.7$/)
    const lin = linearFit([1, 3, 5, 7])
    expect(lin.equation).toBe('y = 2 x + 1')
    expect(lin.r2).toBe(1)
  })

  it('a noisy series gets an r2 under 1, rSquared is bounded, and the degree is clamped to 6', () => {
    const noisy = [1, 4, 2, 8, 5, 7, 9, 6, 11, 10]
    const fit = polynomialFit(noisy, 3)
    expect(fit.r2).toBeGreaterThan(0.5)
    expect(fit.r2).toBeLessThan(1)
    expect(rSquared([1, 1, 1], [1, 1, 1])).toBe(1)
    expect(rSquared([1, 2, 3], [9, 9, 9])).toBe(0)
    expect(polynomialFit(noisy, 12).equation).toContain('u^6')
    expect(polynomialFit(noisy, 12).equation).not.toContain('u^7')
    // Too few points for the degree: all NaN, no equation.
    expect(polynomialFit([1, 2], 3).equation).toBe('')
    expect(computeOverlayFit([1, 2, 3], 'nope' as never).values.every(Number.isNaN)).toBe(true)
  })

  it('overlayName reads the way a legend would', () => {
    expect(overlayName('sma:20')).toBe('SMA 20')
    expect(overlayName('poly:3')).toBe('poly 3')
    expect(overlayName('bb:20:2')).toBe('BB 20')
    expect(overlayName('linear')).toBe('trend')
    expect(overlayName('exp')).toBe('exp')
  })

  it('buildChart carries r2 and the equation on a regression overlay line only', () => {
    const spec: ChartSpec = {
      type: 'line',
      categories: ['a', 'b', 'c', 'd', 'e'],
      series: [
        { label: 'fit', values: [1, 2, 3, 4, 5], overlay: 'linear' },
        { label: 'avg', values: [1, 2, 3, 4, 5], overlay: 'sma:2' },
      ],
      width: 400,
      height: 240,
    }
    const geo = buildChart(spec)
    expect(geo.overlays).toHaveLength(2)
    expect(geo.overlays[0]!.r2).toBe(1)
    expect(geo.overlays[0]!.equation).toBe('y = 1 x + 1')
    expect(geo.overlays[1]!.r2).toBeUndefined()
    expect(geo.overlays[1]!.equation).toBeUndefined()
  })
})

describe('regression fits on real x (a scatter\'s y on x)', () => {
  it('fits y on the given x values, predicts anywhere, and keeps the index form when no x is given', () => {
    const xs = [10, 20, 30, 40]
    const ys = xs.map((x) => 2 * x + 1)
    const fit = linearFit(ys, xs)
    expect(fit.r2).toBeCloseTo(1, 9)
    expect(fit.predict(55)).toBeCloseTo(111, 9)
    expect(fit.equation).toBe('y = 2 x + 1')
    // Index form: the same numbers read as (0, 21), (1, 41), ... slope 20.
    const byIndex = linearFit(ys)
    expect(byIndex.predict(4)).toBeCloseTo(101, 9)
    expect(byIndex.equation).toBe('y = 20 x + 21')
  })

  it('polynomial, exponential, logarithmic and power fits take x and recover their generators', () => {
    const xs = [1, 2, 4, 8, 16, 32, 64]
    const poly = polynomialFit(xs.map((x) => 0.5 * x * x - 3 * x + 7), 2, xs)
    expect(poly.r2).toBeCloseTo(1, 9)
    expect(poly.predict(10)).toBeCloseTo(0.5 * 100 - 30 + 7, 6)
    const exp = exponentialFit(xs.map((x) => 3 * Math.exp(0.05 * x)), xs)
    expect(exp.r2).toBeCloseTo(1, 9)
    expect(exp.predict(20)).toBeCloseTo(3 * Math.exp(1), 6)
    const log = logarithmicFit(xs.map((x) => 2 + 5 * Math.log(x)), xs)
    expect(log.r2).toBeCloseTo(1, 9)
    expect(log.predict(100)).toBeCloseTo(2 + 5 * Math.log(100), 6)
    expect(log.equation).toContain('ln(x)')
    const pow = powerFit(xs.map((x) => 1.5 * Math.pow(x, 1.7)), xs)
    expect(pow.r2).toBeCloseTo(1, 9)
    expect(pow.predict(100)).toBeCloseTo(1.5 * Math.pow(100, 1.7), 4)
    // Non-positive x has no logarithm: skipped, not poisoned.
    const withZero = logarithmicFit([1, 2, 3, 4], [0, 1, 2, 3])
    expect(Number.isNaN(withZero.fitted[0])).toBe(true)
    expect(Number.isFinite(withZero.fitted[1])).toBe(true)
    expect(regressionFit([1, 2], 'sma:2')).toBeNull()
  })

  it('a scatter series with an overlay gets a fitted curve across the plot, with its R-squared', () => {
    const points = [1, 2, 3, 4, 5, 6, 7, 8].map((x) => ({ x, y: 3 * x + 2 }))
    const spec: ChartSpec = {
      type: 'scatter', categories: [], width: 400, height: 300,
      series: [{ label: 'A', values: [], points, overlay: 'linear' }, { label: 'B', values: [], points: points.map((p) => ({ x: p.x, y: p.y * 2 })) }],
    }
    const geo = buildChart(spec)
    expect(geo.overlays).toHaveLength(1)
    const ovl = geo.overlays[0]!
    expect(ovl.label).toBe('A (linear)')
    expect(ovl.r2).toBeCloseTo(1, 9)
    expect(ovl.equation).toBe('y = 3 x + 2')
    // Sampled across the x domain: the first point sits at the plot's left
    // edge, the last at its right, and the curve is inside the y domain.
    expect(ovl.points.length).toBe(49)
    expect(ovl.points[0]!.x).toBeCloseTo(geo.plot.x, 0)
    expect(ovl.points[48]!.x).toBeCloseTo(geo.plot.x + geo.plot.w, 0)
    expect(ovl.points.every((p) => p.defined)).toBe(true)
    expect(ovl.path.startsWith('M')).toBe(true)
    // On a log x axis the samples are even in log space.
    const logGeo = buildChart({ ...spec, xAxis: { scale: 'log' } })
    const xsLog = logGeo.overlays[0]!.points.map((p) => p.x)
    const gapA = xsLog[1]! - xsLog[0]!
    const gapB = xsLog[48]! - xsLog[47]!
    expect(Math.abs(gapA - gapB)).toBeLessThan(1)
  })
})
