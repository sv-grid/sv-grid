// A dom-project test: the bridge now runs the grid's chart engine, whose
// package root imports Svelte components the plugin-free unit project cannot parse.
import { describe, expect, it } from 'vitest'
import { createPivotModel } from './pivot'
import { pivotToChartSpec } from './pivot-chart'

const data = [
  { region: 'EMEA', product: 'A', revenue: 100 },
  { region: 'EMEA', product: 'B', revenue: 200 },
  { region: 'APAC', product: 'A', revenue: 50 },
  { region: 'APAC', product: 'B', revenue: 70 },
]

describe('pivotToChartSpec', () => {
  it('maps row leaves to categories and column leaves to series', () => {
    const result = createPivotModel(data, {
      rows: ['region'],
      cols: ['product'],
      values: [{ field: 'revenue', agg: 'sum' }],
      grandTotalRow: false,
      grandTotalCol: false,
    })
    const spec = pivotToChartSpec(result, { type: 'bar' })
    expect(spec.type).toBe('bar')
    expect([...spec.categories].sort()).toEqual(['APAC', 'EMEA'])
    // One series per product.
    expect(spec.series.map((s) => s.label).sort()).toEqual(['A', 'B'])
    const emeaIdx = spec.categories.indexOf('EMEA')
    expect(spec.series.find((s) => s.label === 'A')!.values[emeaIdx]).toBe(100)
    expect(spec.series.find((s) => s.label === 'B')!.values[emeaIdx]).toBe(200)
  })

  it('excludes the grand-total column / row and stacks when asked', () => {
    const result = createPivotModel(data, {
      rows: ['region'],
      cols: ['product'],
      values: [{ field: 'revenue', agg: 'sum' }],
      grandTotalRow: true,
      grandTotalCol: true,
    })
    const spec = pivotToChartSpec(result, { stacked: true })
    expect(spec.series.some((s) => /total/i.test(s.label))).toBe(false)
    expect(spec.categories.some((c) => /total/i.test(c))).toBe(false)
    expect(spec.stacked).toBe(true)
  })

  it('labels nested row leaves by their full path', () => {
    const nested = [
      { region: 'EMEA', country: 'UK', revenue: 10 },
      { region: 'EMEA', country: 'France', revenue: 20 },
      { region: 'APAC', country: 'Japan', revenue: 30 },
    ]
    const result = createPivotModel(nested, {
      rows: ['region', 'country'],
      cols: [],
      values: [{ field: 'revenue', agg: 'sum', label: 'Revenue' }],
      grandTotalRow: false,
      grandTotalCol: false,
      rowSubtotals: false,
    })
    const spec = pivotToChartSpec(result)
    // Leaf categories are the own labels...
    expect(spec.categories).toContain('UK')
    expect(spec.categories).toContain('France')
    expect(spec.categories).toContain('Japan')
    // ...and a parent group tier spans them.
    expect(spec.categoryGroups).toBeTruthy()
    const spans = spec.categoryGroups!.reduce((a, g) => a + g.span, 0)
    expect(spans).toBe(spec.categories.length)
    expect(spec.categoryGroups!.map((g) => g.label).sort()).toEqual(['APAC', 'EMEA'])
    expect(spec.categoryGroups!.find((g) => g.label === 'EMEA')!.span).toBe(2)
  })

  it('carries the measure format and name to the chart, and reads an empty cell as a gap', () => {
    const result = createPivotModel(data, {
      rows: ['region'],
      cols: ['product'],
      values: [{ field: 'revenue', agg: 'avg', label: 'Revenue', format: { type: 'currency', currency: 'EUR', locales: 'de-DE' } }],
      grandTotalRow: false,
      grandTotalCol: false,
    })
    const spec = pivotToChartSpec(result, { format: { type: 'currency', currency: 'EUR', locales: 'de-DE' } })
    expect(spec.valueFormat).toBe('currency')
    expect(spec.currency).toBe('EUR')
    expect(spec.locale).toBe('de-DE')
    expect(spec.yAxis?.title).toBe('Revenue')
    // Percentage points keep their numbers and gain a sign.
    const pts = pivotToChartSpec(result, { format: { type: 'percent', valueIsPercentPoints: true } })
    expect(pts.valueFormat).toBeUndefined()
    expect(pts.yAxis?.formatter?.(42, 0)).toBe('42%')
    expect(pts.yAxis?.title).toBe('Revenue')
    // No format, no title asked for: nothing is invented.
    const bare = pivotToChartSpec(result, { yAxisTitle: null })
    expect(bare.valueFormat).toBeUndefined()
    expect(bare.yAxis).toBeUndefined()
    // An average over no rows is null in the cell and a gap on the chart.
    const sparse = createPivotModel([{ region: 'EMEA', product: 'A', revenue: 100 }, { region: 'APAC', product: 'B', revenue: 70 }], {
      rows: ['region'],
      cols: ['product'],
      values: [{ field: 'revenue', agg: 'avg' }],
      grandTotalRow: false,
      grandTotalCol: false,
    })
    const gaps = pivotToChartSpec(sparse)
    const emea = gaps.categories.indexOf('EMEA')
    expect(gaps.series.find((s) => s.label === 'A')!.values[emea]).toBe(100)
    expect(Number.isNaN(gaps.series.find((s) => s.label === 'B')!.values[emea])).toBe(true)
  })

  it('handles no column dims (one series per measure)', () => {
    const result = createPivotModel(data, {
      rows: ['region'],
      cols: [],
      values: [{ field: 'revenue', agg: 'sum', label: 'Revenue' }],
      grandTotalRow: false,
      grandTotalCol: false,
    })
    const spec = pivotToChartSpec(result)
    expect(spec.series.length).toBe(1)
    expect(spec.series[0]!.label).toBe('Revenue')
    const emeaIdx = spec.categories.indexOf('EMEA')
    expect(spec.series[0]!.values[emeaIdx]).toBe(300)
  })
})
