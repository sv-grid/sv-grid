import { describe, expect, it } from 'vitest'
import { chartSpecToTable } from './chart-table'
import type { ChartSpec } from './chart-types'

describe('chartSpecToTable', () => {
  it('lays a category chart out as one row per category and a column per series, in the chart format', () => {
    const t = chartSpecToTable({
      type: 'bar',
      categories: ['Q1', 'Q2', 'Q1', 'Q2'],
      categoryGroups: [{ label: '2025', span: 2 }, { label: '2026', span: 2 }],
      series: [{ label: 'Americas', values: [1, 2, 3, Number.NaN] }, { label: 'EMEA', values: [4, 5, 6, 7] }],
      valueFormat: 'currency',
      currency: 'EUR',
    })
    expect(t.columns.map((c) => c.header)).toEqual(['Group', 'Category', 'Americas', 'EMEA'])
    expect(t.columns[2]).toMatchObject({ cellDataType: 'number', format: { type: 'currency', currency: 'EUR' } })
    expect(t.rows).toEqual([
      { group: '2025', category: 'Q1', s0: 1, s1: 4 },
      { group: '2025', category: 'Q2', s0: 2, s1: 5 },
      { group: '2026', category: 'Q1', s0: 3, s1: 6 },
      { group: '2026', category: 'Q2', s0: null, s1: 7 },
    ])
  })

  it('reads a date axis as a date column named after the axis, and a right-axis series in that axis format', () => {
    const t = chartSpecToTable({
      type: 'bar',
      xType: 'time',
      categories: ['2026-01-01', '2026-02-01'],
      series: [{ label: 'Revenue', values: [2.1, 2.3] }, { label: 'Margin', values: [0.29, 0.31], type: 'line', axis: 'right' }],
      valueFormat: 'currency',
      y2Axis: { format: 'percent' },
      xAxisTitle: 'Month',
    })
    expect(t.columns[0]).toEqual({ field: 'category', header: 'Month', cellDataType: 'date' })
    expect(t.columns[1]!.format).toEqual({ type: 'currency', currency: 'USD' })
    expect(t.columns[2]!.format).toEqual({ type: 'percent' })
    expect(chartSpecToTable({ type: 'gauge', categories: [], series: [], gaugeValue: 1, gaugeUnit: 'ms' }).columns[1]!.header).toBe('Value (ms)')
  })

  it('expands the numbers a series carries: ranges, targets, error bars, candles, boxes, bins', () => {
    const range = chartSpecToTable({ type: 'range-bar', categories: ['a'], series: [{ label: 'Band', values: [9], lowValues: [4] }] })
    expect(range.columns.map((c) => c.header)).toEqual(['Category', 'Band Low', 'Band High'])
    expect(range.rows[0]).toEqual({ category: 'a', s0lo: 4, s0hi: 9 })
    const bullet = chartSpecToTable({ type: 'bullet', categories: ['a'], series: [{ label: 'Actual', values: [82], targets: [90] }] })
    expect(bullet.rows[0]).toEqual({ category: 'a', s0: 82, s0t: 90 })
    const err = chartSpecToTable({ type: 'bar', categories: ['a', 'b'], series: [{ label: 'Mean', values: [10, 20], errors: [2, { lo: 15, hi: 30 }] }] })
    expect(err.rows).toEqual([{ category: 'a', s0: 10, s0lo: 8, s0hi: 12 }, { category: 'b', s0: 20, s0lo: 15, s0hi: 30 }])
    const candles = chartSpecToTable({ type: 'candlestick', categories: ['d1'], series: [{ label: 'ACME', values: [3], ohlc: [{ o: 1, h: 4, l: 0.5, c: 3 }], volumes: [100] }] })
    expect(candles.columns.map((c) => c.header)).toEqual(['Category', 'ACME Open', 'ACME High', 'ACME Low', 'ACME Close', 'ACME Volume'])
    expect(candles.rows[0]).toEqual({ category: 'd1', s0o: 1, s0h: 4, s0l: 0.5, s0c: 3, s0v: 100 })
    const boxes = chartSpecToTable({ type: 'boxplot', categories: ['a'], series: [{ label: 'ms', values: [5], boxes: [{ min: 1, q1: 3, median: 5, q3: 7, max: 9, outliers: [20, 30] }] }] })
    expect(boxes.rows[0]).toEqual({ category: 'a', s0min: 1, s0q1: 3, s0med: 5, s0q3: 7, s0max: 9, s0out: '20 30' })
    const bins = chartSpecToTable({ type: 'histogram', categories: ['5', '15'], series: [{ label: 'n', values: [2, 3] }], binEdges: [0, 10, 20] })
    expect(bins.columns.map((c) => c.header)).toEqual(['From', 'To', 'n'])
    expect(bins.rows).toEqual([{ from: 0, to: 10, s0: 2 }, { from: 10, to: 20, s0: 3 }])
  })

  it('tabulates the shapes the category grid cannot: points, links, leaves, days, a gauge', () => {
    const scatter = chartSpecToTable({ type: 'scatter', categories: [], series: [{ label: 'S', values: [], points: [{ x: 1, y: 2, r: 3, label: 'p' }] }] })
    expect(scatter.columns.map((c) => c.header)).toEqual(['Series', 'X', 'Y', 'Size', 'Label'])
    expect(scatter.rows).toEqual([{ series: 'S', x: 1, y: 2, size: 3, label: 'p' }])
    const flow = chartSpecToTable({ type: 'sankey', categories: [], series: [], sankeyNodes: [{ id: 'a', label: 'Wind' }, { id: 'b' }], sankeyLinks: [{ source: 'a', target: 'b', value: 27 }] })
    expect(flow.rows).toEqual([{ source: 'Wind', target: 'b', value: 27 }])
    const tree: ChartSpec = { type: 'sunburst', categories: [], series: [], tree: { name: 'All', children: [{ name: 'Blink', children: [{ name: 'Chrome', value: 6 }] }, { name: 'Gecko', value: 3 }] } }
    const leaves = chartSpecToTable(tree)
    expect(leaves.columns.map((c) => c.header)).toEqual(['Level 1', 'Level 2', 'Value'])
    expect(leaves.rows).toEqual([{ level1: 'Blink', level2: 'Chrome', value: 6 }, { level1: 'Gecko', value: 3 }])
    const days = chartSpecToTable({ type: 'calendar', categories: [], series: [], calendarValues: [{ date: '2026-01-05', value: 4 }] })
    expect(days.columns[0]).toMatchObject({ header: 'Date', cellDataType: 'date' })
    expect(days.rows).toEqual([{ date: '2026-01-05', value: 4 }])
    const gauge = chartSpecToTable({ type: 'gauge', categories: [], series: [], title: 'Uptime', gaugeValue: 99.2, gaugeMin: 99, gaugeMax: 100, gaugeTarget: 99.9 })
    expect(gauge.rows).toEqual([{ metric: 'Uptime', value: 99.2, min: 99, max: 100, target: 99.9 }])
    expect(chartSpecToTable({ type: 'bar', categories: [], series: [] })).toEqual({ columns: [], rows: [] })
  })
})
