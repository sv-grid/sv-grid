import { describe, expect, it } from 'vitest'
import { CHART_TYPES, KNOWN_SERIES_KEYS, KNOWN_SPEC_KEYS, nearestKey, validateChartSpec } from './chart-validate'
import { sampleChartSpec, sampleChartThumb } from './chart-samples'
import { PER_CATEGORY_SERIES_KEYS } from './chart-decimate'
import type { ChartSpec } from './chart-types'

const base = (): ChartSpec => ({
  type: 'bar',
  categories: ['a', 'b', 'c'],
  series: [{ label: 's', values: [1, 2, 3] }],
})
const codes = (spec: unknown) => validateChartSpec(spec).map((d) => d.code)

describe('validateChartSpec', () => {
  it('passes every sample spec of every type, full size and thumbnail', () => {
    for (const type of CHART_TYPES) {
      expect(validateChartSpec(sampleChartSpec(type)), type).toEqual([])
      expect(validateChartSpec(sampleChartThumb(type)), `${type} thumb`).toEqual([])
    }
    expect(validateChartSpec(base())).toEqual([])
  })

  it('names an unknown top-level key with the nearest known one', () => {
    const d = validateChartSpec({ ...base(), serie: [] } as unknown)
    expect(d).toHaveLength(1)
    expect(d[0]).toMatchObject({ code: 'chart/unknown-key', path: 'serie', severity: 'warning' })
    expect(d[0]!.message).toContain('"series"')
    expect(validateChartSpec({ ...base(), zzzz: 1 } as unknown)[0]!.message).toContain('is ignored')
    expect(nearestKey('valeus', KNOWN_SERIES_KEYS)).toBe('values')
    expect(nearestKey('completely-different', KNOWN_SPEC_KEYS)).toBeNull()
  })

  it('rejects an unknown chart type and suggests the closest', () => {
    const d = validateChartSpec({ ...base(), type: 'lines' })
    expect(d[0]).toMatchObject({ code: 'chart/unknown-type', path: 'type', severity: 'error' })
    expect(d[0]!.message).toContain('"line"')
    expect(codes({ categories: [], series: [] })).toContain('chart/unknown-type')
    expect(codes(null)).toEqual(['chart/not-an-object'])
    expect(codes('bar')).toEqual(['chart/not-an-object'])
  })

  it('checks series length against the categories, and every parallel array', () => {
    expect(codes({ ...base(), series: [{ label: 's', values: [1, 2] }] })).toEqual(['chart/series-length'])
    for (const key of PER_CATEGORY_SERIES_KEYS) {
      if (key === 'values') continue
      const spec = { ...base(), series: [{ label: 's', values: [1, 2, 3], [key]: [null] }] }
      expect(codes(spec), key).toContain('chart/series-length')
    }
    // Families that do not index values by category are left alone.
    expect(codes({ type: 'scatter', categories: [], series: [{ label: 'p', values: [], points: [{ x: 1, y: 2 }] }] })).toEqual([])
    expect(codes({ type: 'gauge', categories: [], series: [], gaugeValue: 3 })).toEqual([])
  })

  it('checks series keys, type, axis, stack, overlay and the point shapes', () => {
    expect(validateChartSpec({ ...base(), series: [{ label: 's', valeus: [1, 2, 3], values: [1, 2, 3] }] })[0]).toMatchObject({ code: 'chart/unknown-series-key', path: 'series[0].valeus' })
    expect(codes({ ...base(), series: [{ label: 's', values: [1, 2, 3], type: 'column' }] })).toEqual(['chart/series-type'])
    expect(codes({ ...base(), series: [{ label: 's', values: [1, 2, 3], axis: 'top' }] })).toEqual(['chart/series-axis'])
    expect(codes({ ...base(), type: 'line', series: [{ label: 's', values: [1, 2, 3], stack: 'x' }] })).toEqual(['chart/stack-kind'])
    expect(codes({ ...base(), series: [{ label: 's', values: [1, 2, 3], stack: 'x' }] })).toEqual([])
    expect(codes({ ...base(), series: [{ label: 's', values: [1, 2, 3], overlay: 'sma20' }] })).toEqual(['chart/overlay'])
    for (const ok of ['linear', 'sma:20', 'ema:7', 'wma:5', 'bb:20:2', 'bb:20:2.5', 'vwap', 'poly:3', 'exp', 'log', 'power']) {
      expect(codes({ ...base(), series: [{ label: 's', values: [1, 2, 3], overlay: ok }] }), ok).toEqual([])
    }
    expect(codes({ ...base(), type: 'candlestick', series: [{ label: 's', values: [1, 2, 3], ohlc: [{ o: 1, h: 2, l: 3, c: 2 }, null, { o: 1 }] }] })).toEqual(['chart/ohlc-range', 'chart/ohlc-shape'])
    expect(codes({ ...base(), type: 'boxplot', series: [{ label: 's', values: [1, 2, 3], boxes: [{ min: 0, q1: 5, median: 2, q3: 6, max: 9 }, null, null] }] })).toEqual(['chart/box-order'])
    expect(codes({ type: 'scatter', categories: [], series: [{ label: 'p', values: [], points: [{ x: 'a', y: 2 }] }] })).toEqual(['chart/point-shape'])
  })

  it('checks the axis config', () => {
    expect(codes({ ...base(), yAxis: { min: 10, max: 5 } })).toEqual(['chart/axis-range'])
    expect(codes({ ...base(), yAxis: { scale: 'log', min: 0 } })).toEqual(['chart/axis-log-min'])
    expect(codes({ ...base(), xAxis: { type: 'category', scale: 'log' } })).toEqual(['chart/axis-log-x'])
    expect(codes({ ...base(), xAxis: { type: 'number', scale: 'log' } })).toEqual([])
    expect(codes({ ...base(), y2Axis: { tickCount: 0 } })).toEqual(['chart/axis-ticks'])
    expect(codes({ ...base(), xAxis: { labelRotation: 'tilted' } })).toEqual(['chart/axis-rotation'])
    expect(codes({ ...base(), yAxis: { scale: 'sqrt' } })).toEqual(['chart/axis-scale'])
    expect(codes({ ...base(), yAxis: 'log' })).toEqual(['chart/axis-shape'])
  })

  it('checks the spec-level shapes: stacked100, innerRadius, groups, bins, waterfall flags, responsive rules', () => {
    expect(codes({ ...base(), type: 'pie', stacked100: true })).toEqual(['chart/stacked100-kind'])
    expect(codes({ ...base(), innerRadius: 1.5 })).toEqual(['chart/inner-radius'])
    expect(codes({ ...base(), categoryGroups: [{ label: 'g', span: 2 }] })).toEqual(['chart/category-groups'])
    expect(codes({ ...base(), type: 'histogram', binEdges: [0, 1] })).toEqual(['chart/bin-edges'])
    expect(codes({ ...base(), type: 'waterfall', waterfallTotals: [true] })).toEqual(['chart/waterfall-totals'])
    expect(codes({ ...base(), responsive: [{ spec: { title: 'x' } }] })).toEqual(['chart/responsive-size'])
    expect(codes({ ...base(), responsive: [{ maxWidth: 400, spec: { width: 10 } }] })).toEqual(['chart/responsive-size-key'])
    expect(codes({ ...base(), responsive: ['narrow'] })).toEqual(['chart/responsive-shape'])
  })

  it('warns about x anchors that name no category, and not on a time or number axis', () => {
    expect(codes({ ...base(), referenceLines: [{ axis: 'x', value: 'd' }] })).toEqual(['chart/unknown-category'])
    expect(codes({ ...base(), annotations: [{ at: { category: 'zz' }, label: 'n' }] })).toEqual(['chart/unknown-category'])
    expect(codes({ ...base(), drawings: [{ id: 'd1', kind: 'trend', points: [{ x: 'a', y: 1 }, { x: 'q', y: 2 }] }] })).toEqual(['chart/unknown-category'])
    expect(codes({ ...base(), categories: ['1', '2', '3'], xType: 'number', referenceLines: [{ axis: 'x', value: '2.5' }] })).toEqual([])
    // The drawing tools write a timestamp for every pointer position on a time axis.
    expect(codes({ ...base(), categories: ['2026-01-01', '2026-02-01', '2026-03-01'], xType: 'time', drawings: [{ id: 'd1', kind: 'trend', points: [{ x: '2026-01-12T10:00:00.000Z', y: 1 }, { x: '2026-02-20T08:30:00.000Z', y: 2 }] }] })).toEqual([])
    expect(codes({ ...base(), annotations: [{ at: { category: 'b' }, label: 'n' }] })).toEqual([])
  })
})
