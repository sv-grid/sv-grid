import { describe, expect, it } from 'vitest'
import { nearestIndexByTime, panWindow, pinchWindow, presetWindow, wheelWindow } from './chart-zoom'
import { drillTree, pathTo } from './chart-hierarchy'
import { interpolateGeometry } from './chart-motion'
import { buildChart, type ChartSpec } from './chart'

describe('wheelWindow', () => {
  it('zooms in around the anchor and keeps its relative position', () => {
    const n = 100
    const w = wheelWindow(null, n, 50, 0.5)!
    expect(w.i1 - w.i0 + 1).toBe(50)
    // The anchor was at the middle of the full axis, so it stays at the middle.
    expect((50 - w.i0) / (w.i1 - w.i0)).toBeCloseTo(0.5, 1)
    const edge = wheelWindow(null, n, 0, 0.5)!
    expect(edge.i0).toBe(0)
    expect(edge.i1).toBe(49)
  })
  it('zooms out until the whole axis, which is null', () => {
    const w = wheelWindow({ i0: 40, i1: 59 }, 100, 50, 2)!
    expect(w.i1 - w.i0 + 1).toBe(40)
    expect(wheelWindow({ i0: 10, i1: 89 }, 100, 50, 2)).toBeNull()
  })
  it('never goes below two categories', () => {
    expect(wheelWindow({ i0: 10, i1: 11 }, 100, 10, 0.5)).toEqual({ i0: 10, i1: 11 })
  })
})

describe('panWindow', () => {
  it('slides the window and clamps at both ends', () => {
    expect(panWindow({ i0: 10, i1: 19 }, 100, 5)).toEqual({ i0: 15, i1: 24 })
    expect(panWindow({ i0: 10, i1: 19 }, 100, -50)).toEqual({ i0: 0, i1: 9 })
    expect(panWindow({ i0: 85, i1: 94 }, 100, 50)).toEqual({ i0: 90, i1: 99 })
    expect(panWindow(null, 100, 5)).toBeNull()
  })
})

describe('pinchWindow', () => {
  it('spreading the fingers zooms in', () => {
    const w = pinchWindow(null, 100, 50, 2)!
    expect(w.i1 - w.i0 + 1).toBe(50)
  })
})

describe('presetWindow', () => {
  const days = Array.from({ length: 730 }, (_, i) => new Date(Date.UTC(2025, 0, 1) + i * 86_400_000).toISOString().slice(0, 10))
  it('picks the last month, three months and year to date up to the latest category', () => {
    const m = presetWindow(days, '1M')!
    expect(m.i1).toBe(729)
    expect(m.i1 - m.i0).toBeGreaterThanOrEqual(28)
    expect(m.i1 - m.i0).toBeLessThanOrEqual(31)
    const q = presetWindow(days, '3M')!
    expect(q.i1 - q.i0).toBeGreaterThanOrEqual(89)
    const ytd = presetWindow(days, 'YTD')!
    expect(days[ytd.i0]).toBe('2026-01-01')
    expect(ytd.i1).toBe(729)
    expect(presetWindow(days, '1W')!.i1 - presetWindow(days, '1W')!.i0).toBe(7)
  })
  it('All and unparseable categories give the whole axis', () => {
    expect(presetWindow(days, 'All')).toBeNull()
    expect(presetWindow(['a', 'b', 'c'], '1M')).toBeNull()
  })
  it('takes explicit from / to and day counts', () => {
    const w = presetWindow(days, { label: 'Q1', from: '2026-01-01', to: '2026-03-31' })!
    expect(days[w.i0]).toBe('2026-01-01')
    expect(days[w.i1]).toBe('2026-03-31')
    const d = presetWindow(days, { label: '10d', days: 10 })!
    expect(d.i1 - d.i0).toBe(10)
  })
  it('honours an explicit now', () => {
    const w = presetWindow(days, '1M', Date.UTC(2025, 5, 30))!
    expect(days[w.i1]).toBe('2025-06-30')
  })
})

describe('nearestIndexByTime', () => {
  it('finds the closest date and skips non-dates', () => {
    expect(nearestIndexByTime(['2026-01-01', 'x', '2026-01-10', '2026-01-20'], Date.parse('2026-01-12'))).toBe(2)
    expect(nearestIndexByTime(['a', 'b'], 0)).toBe(-1)
  })
})

describe('drillTree / pathTo', () => {
  const tree = { name: 'root', children: [{ name: 'A', children: [{ name: 'A1', value: 1 }] }, { name: 'B', value: 2 }] }
  it('descends by names and reports the path to a node', () => {
    expect(drillTree(tree, [])).toBe(tree)
    expect(drillTree(tree, ['A'])!.name).toBe('A')
    expect(drillTree(tree, ['A', 'A1'])!.value).toBe(1)
    expect(drillTree(tree, ['Z'])).toBeNull()
    expect(pathTo(tree, 'A1')).toEqual(['A', 'A1'])
    expect(pathTo(tree, 'nope')).toBeNull()
  })
})

describe('interpolateGeometry', () => {
  const spec = (values: number[], categories = ['a', 'b', 'c']): ChartSpec => ({
    type: 'bar', categories, series: [{ label: 's', values }, { label: 'l', values: values.map((v) => v / 2), type: 'line' }], width: 400, height: 200,
  })
  it('is the source at 0 and the target at 1, and halfway between in between', () => {
    const a = buildChart(spec([10, 20, 30]))
    const b = buildChart(spec([30, 20, 10]))
    expect(interpolateGeometry(a, b, 0)).toBe(a)
    expect(interpolateGeometry(a, b, 1)).toBe(b)
    const mid = interpolateGeometry(a, b, 0.5)
    expect(mid.bars[0]!.h).toBeCloseTo((a.bars[0]!.h + b.bars[0]!.h) / 2, 1)
    expect(mid.lines[0]!.points[0]!.y).toBeCloseTo((a.lines[0]!.points[0]!.y + b.lines[0]!.points[0]!.y) / 2, 1)
    expect(mid.lines[0]!.path).not.toBe(a.lines[0]!.path)
  })
  it('grows a new bar from the baseline and shrinks a removed one', () => {
    const a = buildChart(spec([10, 20], ['a', 'b']))
    const b = buildChart(spec([10, 20, 30]))
    const mid = interpolateGeometry(a, b, 0.5)
    const c = mid.bars.find((x) => x.label === 'c')!
    expect(c.h).toBeCloseTo(b.bars[2]!.h / 2, 1)
    const back = interpolateGeometry(b, a, 0.5)
    const gone = back.bars.find((x) => x.label === 'c')!
    expect(gone.h).toBeCloseTo(b.bars[2]!.h / 2, 1)
    expect(interpolateGeometry(b, a, 1).bars.find((x) => x.label === 'c')).toBeUndefined()
  })
  it('tweens pie slices and arcs by angle', () => {
    const pie = (v: number[]): ChartSpec => ({ type: 'pie', categories: ['x', 'y'], series: [{ label: 's', values: v }], width: 300, height: 200 })
    const a = buildChart(pie([1, 1]))
    const b = buildChart(pie([3, 1]))
    const mid = interpolateGeometry(a, b, 0.5)
    expect(mid.slices[0]!.arc!.a1).toBeCloseTo((a.slices[0]!.arc!.a1 + b.slices[0]!.arc!.a1) / 2, 6)
    expect(mid.slices[0]!.path).not.toBe(a.slices[0]!.path)
    const rb = (v: number[]): ChartSpec => ({ type: 'radial-bar', categories: ['x', 'y'], series: [{ label: 's', values: v }], width: 300, height: 200 })
    const ra = buildChart(rb([50, 100]))
    const rbz = buildChart(rb([100, 100]))
    const rm = interpolateGeometry(ra, rbz, 0.5)
    expect(rm.arcs[0]!.a1).toBeCloseTo((ra.arcs[0]!.a1 + rbz.arcs[0]!.a1) / 2, 6)
  })
  it('snaps when the chart type changes', () => {
    const a = buildChart(spec([1, 2, 3]))
    const b = buildChart({ ...spec([1, 2, 3]), type: 'pie' })
    expect(interpolateGeometry(a, b, 0.5)).toBe(b)
  })
})
