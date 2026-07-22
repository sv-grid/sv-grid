import { describe, it, expect } from 'vitest'
import { kpiSeries, sparklinePoints, seriesDelta, formatKpiValue } from './dashboard'

describe('kpiSeries', () => {
  const rows = [
    { stage: '2026-01', value: 10 },
    { stage: '2026-01', value: 5 },
    { stage: '2026-03', value: 20 },
    { stage: '2026-02', value: 8 },
    { stage: '', value: 99 }, // empty bucket key is skipped
  ]
  it('buckets by trendField (sorted) and reduces the measure', () => {
    expect(kpiSeries(rows, { trendField: 'stage', measure: 'value', reduce: 'sum' })).toEqual([15, 8, 20])
  })
  it('counts rows per bucket when reduce is count', () => {
    expect(kpiSeries(rows, { trendField: 'stage', reduce: 'count' })).toEqual([2, 1, 1])
  })
})

describe('sparklinePoints', () => {
  it('maps values into a w x h box with the max at the top', () => {
    const pts = sparklinePoints([0, 10], 100, 20, 0).split(' ')
    expect(pts).toHaveLength(2)
    expect(pts[0]).toBe('0.0,20.0') // min -> bottom
    expect(pts[1]).toBe('100.0,0.0') // max -> top, last x at width
  })
  it('is empty for no data', () => {
    expect(sparklinePoints([])).toBe('')
  })
})

describe('seriesDelta', () => {
  it('is the percent change from first non-zero to last', () => {
    expect(seriesDelta([100, 150])).toBe(50)
    expect(seriesDelta([0, 100, 50])).toBe(-50) // first non-zero is 100, last is 50
  })
  it('is null when it cannot be computed', () => {
    expect(seriesDelta([5])).toBeNull()
    expect(seriesDelta([0, 0])).toBeNull()
  })
})

describe('formatKpiValue', () => {
  it('formats currency / percent / compact / number', () => {
    expect(formatKpiValue(1234.5, 'currency')).toBe('$1,235')
    expect(formatKpiValue(42.5, 'percent')).toBe('42.5%')
    expect(formatKpiValue(12500, 'compact')).toBe('12.5K')
    expect(formatKpiValue(1234.5, 'number')).toBe('1,234.5')
  })
})
