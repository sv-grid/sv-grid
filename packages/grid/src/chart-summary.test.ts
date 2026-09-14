import { describe, expect, it } from 'vitest'
import { chartSummary } from './chart-summary'
import { CHART_TYPES } from './chart-validate'
import { sampleChartSpec } from './chart-samples'
import { pearson } from './chart-stats'
import type { ChartSpec } from './chart-types'

const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun']

describe('chartSummary', () => {
  it('reads a rising line with its ends, change, peak and trough', () => {
    const s = chartSummary({ type: 'line', categories: months, series: [{ label: 'Revenue', values: [100, 180, 90, 140, 160, 150] }] })
    expect(s).toBe('Revenue rises 50% from 100 at Jan to 150 at Jun, peaking at 180 at Feb, lowest at 90 at Mar.')
  })

  it('reads a falling series, a flat one, and caps the series it lists', () => {
    const spec: ChartSpec = {
      type: 'bar',
      categories: months,
      series: [
        { label: 'Cost', values: [200, 190, 170, 160, 150, 120] },
        { label: 'Flat', values: [50, 50.2, 49.9, 50.1, 50, 50] },
        { label: 'A', values: [1, 2, 3, 4, 5, 6] },
        { label: 'B', values: [1, 2, 3, 4, 5, 6] },
        { label: 'C', values: [1, 2, 3, 4, 5, 6] },
      ],
    }
    const s = chartSummary(spec)
    expect(s).toContain('Cost falls 40% from 200 at Jan to 120 at Jun.')
    expect(s).toContain('Flat holds at about 50 from Jan to Jun.')
    expect(s).toContain('And 1 more series.')
    expect(chartSummary(spec, { maxSeries: 2 })).toContain('And 3 more series.')
    // Hidden series are left out; the formatter is honoured.
    const hidden = chartSummary({ ...spec, series: [{ ...spec.series[0]!, visible: false }, spec.series[1]!] }, { formatValue: (v) => `$${v}` })
    expect(hidden).toBe('Flat holds at about $50 from Jan to Jun.')
  })

  it('shares the top three slices of a pie and a tree map', () => {
    expect(chartSummary({ type: 'pie', categories: ['A', 'B', 'C', 'D', 'E'], series: [{ label: 'v', values: [50, 25, 15, 6, 4] }] })).toBe(
      '5 slices totalling 100: A 50%, B 25%, C 15%, 2 more share the rest.',
    )
    expect(chartSummary({ type: 'treemap', categories: [], series: [], treemap: { name: 'r', children: [{ name: 'X', value: 3 }, { name: 'Y', children: [{ name: 'y1', value: 1 }] }] } })).toBe(
      '2 nodes totalling 4: X 75%, Y 25%.',
    )
  })

  it('reports the correlation of a scatter, the last close of candles, and the gauge against its target', () => {
    const pts = Array.from({ length: 20 }, (_, i) => ({ x: i, y: 2 * i + (i % 2) }))
    expect(chartSummary({ type: 'scatter', categories: [], series: [{ label: 'p', values: [], points: pts }] })).toMatch(/^20 points in 1 series with a strong positive correlation \(r (?:0\.9\d|1\.00)\)/)
    const anti = pts.map((p) => ({ x: p.x, y: -p.y }))
    expect(chartSummary({ type: 'scatter', categories: [], series: [{ label: 'p', values: [], points: anti }] })).toContain('strong negative')
    expect(pearson([1, 2, 3], [1, 1, 1])).toBe(0)
    const candles = chartSummary({
      type: 'candlestick',
      categories: ['d1', 'd2', 'd3'],
      series: [{ label: 'ACME', values: [10, 11, 12], ohlc: [{ o: 10, h: 12, l: 9, c: 10 }, { o: 10, h: 13, l: 10, c: 11 }, { o: 11, h: 14, l: 11, c: 12.1 }] }],
    })
    expect(candles).toBe('ACME: last close 12.1, up 10% on the session, ranging 9 to 14 over 3 bars.')
    expect(chartSummary({ type: 'gauge', categories: [], series: [], gaugeValue: 72, gaugeMin: 0, gaugeMax: 100, gaugeTarget: 80, gaugeUnit: '%' })).toBe(
      '72 %, 72% of the way from 0 to 100, below the target of 80.',
    )
  })

  it('reads a heat map, a calendar, a funnel, a box plot and a sankey', () => {
    expect(chartSummary({ type: 'heatmap', categories: ['c1', 'c2'], series: [{ label: 'r1', values: [1, 9] }, { label: 'r2', values: [4, 2] }] })).toBe(
      '2 rows by 2 columns; the highest cell is 9 at r1 and c2.',
    )
    expect(chartSummary({ type: 'calendar', categories: [], series: [], calendarValues: [{ date: '2026-01-01', value: 2 }, { date: '2026-01-02', value: 7 }] })).toBe(
      '2 days totalling 9; the busiest is 2026-01-02 at 7.',
    )
    expect(chartSummary({ type: 'funnel', categories: ['Visit', 'Sign up', 'Pay'], series: [{ label: 'n', values: [1000, 300, 150] }] })).toBe(
      '15% of 1k at Visit reach Pay; the biggest drop is into Sign up (70% lost).',
    )
    expect(chartSummary({ type: 'boxplot', categories: ['a'], series: [{ label: 'X', values: [5], boxes: [{ min: 1, q1: 4, median: 5, q3: 6, max: 9 }] }, { label: 'Y', values: [5], boxes: [{ min: 0, q1: 2, median: 5, q3: 9, max: 12 }] }] })).toBe(
      '2 distributions over 1 categories; Y has the widest interquartile range at 7.',
    )
    expect(chartSummary({ type: 'sankey', categories: [], series: [], sankeyNodes: [{ id: 'a' }, { id: 'b' }, { id: 'c' }], sankeyLinks: [{ source: 'a', target: 'b', value: 3 }, { source: 'a', target: 'c', value: 5 }] })).toBe(
      '2 flows totalling 8; the largest is a to c at 5.',
    )
  })

  it('never throws on an empty spec of any type, and describes every sample spec', () => {
    for (const type of CHART_TYPES) {
      expect(chartSummary({ type, categories: [], series: [] }), type).toBe('No data.')
      const s = chartSummary(sampleChartSpec(type))
      expect(typeof s, type).toBe('string')
      expect(s.length, type).toBeGreaterThan(8)
    }
  })
})
