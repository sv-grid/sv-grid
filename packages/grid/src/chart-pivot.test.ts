import { describe, expect, it } from 'vitest'
import { pivotChartType, pivotResultToChartSpec } from './chart-pivot'

/** A pivot result the way the engine writes it: regions over countries, quarters across. */
const result = {
  rows: [
    { __pivotId: 'r0', __pivotKind: 'subtotal', __pivotLabel: 'EMEA', __pivotParentId: null, pv_q1__rev: 300, pv_q2__rev: 340 },
    { __pivotId: 'r1', __pivotKind: 'leaf', __pivotLabel: 'UK', __pivotParentId: 'r0', pv_q1__rev: 100, pv_q2__rev: 120 },
    { __pivotId: 'r2', __pivotKind: 'leaf', __pivotLabel: 'Germany', __pivotParentId: 'r0', pv_q1__rev: 200, pv_q2__rev: 220 },
    { __pivotId: 'r3', __pivotKind: 'subtotal', __pivotLabel: 'APAC', __pivotParentId: null, pv_q1__rev: 50, pv_q2__rev: null },
    { __pivotId: 'r4', __pivotKind: 'leaf', __pivotLabel: 'Japan', __pivotParentId: 'r3', pv_q1__rev: 50, pv_q2__rev: null },
    { __pivotId: 'r9', __pivotKind: 'grandTotal', __pivotLabel: 'Total', __pivotParentId: null, pv_q1__rev: 350, pv_q2__rev: 340 },
  ],
  columns: [
    { id: '__pivotRowHeader', header: 'Region / Country' },
    { id: 'pv_group_q1', header: 'Q1', columns: [{ id: 'pv_q1__rev', header: 'Revenue' }] },
    { id: 'pv_group_q2', header: 'Q2', columns: [{ id: 'pv_q2__rev', header: 'Revenue' }] },
    { id: 'pv_group__grand', header: 'Total', columns: [{ id: 'pv_grand__total', header: 'Revenue' }] },
  ],
}

describe('pivotResultToChartSpec', () => {
  it('reads leaves as categories under a grouped axis, column leaves as series, and skips totals', () => {
    const spec = pivotResultToChartSpec(result, { type: 'line', format: { type: 'currency', currency: 'EUR' } })
    expect(spec.type).toBe('line')
    expect(spec.categories).toEqual(['UK', 'Germany', 'Japan'])
    expect(spec.categoryGroups).toEqual([{ label: 'EMEA', span: 2 }, { label: 'APAC', span: 1 }])
    expect(spec.series.map((s) => s.label)).toEqual(['Q1', 'Q2'])
    expect(spec.series[0]!.values).toEqual([100, 200, 50])
    // Japan has no Q2: a gap, not a zero.
    expect(spec.series[1]!.values.slice(0, 2)).toEqual([120, 220])
    expect(Number.isNaN(spec.series[1]!.values[2])).toBe(true)
    expect(spec.valueFormat).toBe('currency')
    expect(spec.currency).toBe('EUR')
    expect(spec.yAxis?.title).toBe('Revenue')
  })

  it('keeps the totals when asked, stacks, and caps the categories', () => {
    const spec = pivotResultToChartSpec(result, { includeTotals: true, stacked100: true, maxCategories: 2 })
    expect(spec.series.map((s) => s.label)).toEqual(['Q1', 'Q2', 'Total'])
    expect(spec.categories).toEqual(['UK', 'Germany'])
    expect(spec.stacked).toBe(true)
    expect(spec.stacked100).toBe(true)
  })

  it('draws a shape a pivot has as itself and the rest as bars', () => {
    expect(pivotChartType('radar')).toBe('radar')
    expect(pivotChartType('heatmap')).toBe('heatmap')
    expect(pivotChartType('scatter')).toBe('bar')
    expect(pivotChartType('candlestick')).toBe('bar')
    expect(pivotChartType(undefined)).toBe('bar')
    expect(pivotResultToChartSpec(result, { type: 'gauge' }).type).toBe('bar')
  })
})
