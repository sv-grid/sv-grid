import { describe, expect, it } from 'vitest'
import { buildChart } from './chart'
import { interpolateGeometry } from './chart-motion'
import type { ChartSpec } from './chart-types'

const bars = (values: number[], categories = ['a', 'b', 'c']): ChartSpec => ({
  type: 'bar', categories, series: [{ label: 's', values }], width: 400, height: 200,
})
const lines = (values: number[]): ChartSpec => ({
  type: 'line', categories: ['a', 'b', 'c'], series: [{ label: 's', values }], width: 400, height: 200,
})

describe('interpolateGeometry', () => {
  const a = buildChart(bars([1, 2, 3]), 'light')
  const b = buildChart(bars([3, 2, 1]), 'light')

  it('is the start at t = 0 and the end at t = 1, without copying', () => {
    expect(interpolateGeometry(a, b, 0)).toBe(a)
    expect(interpolateGeometry(a, b, 1)).toBe(b)
    expect(interpolateGeometry(a, b, 1.5)).toBe(b)
  })

  it('moves bars halfway at t = 0.5, keyed by series and label', () => {
    const mid = interpolateGeometry(a, b, 0.5)
    expect(mid.bars).toHaveLength(3)
    for (let i = 0; i < 3; i += 1) {
      expect(mid.bars[i]!.y).toBeCloseTo((a.bars[i]!.y + b.bars[i]!.y) / 2, 1)
      expect(mid.bars[i]!.h).toBeCloseTo((a.bars[i]!.h + b.bars[i]!.h) / 2, 1)
    }
    // Everything that is not a mark comes from the destination.
    expect(mid.plot).toEqual(b.plot)
    expect(mid.xTicks).toEqual(b.xTicks)
  })

  it('grows a new bar from the baseline and shrinks a removed one into it', () => {
    const c = buildChart(bars([1, 2, 3, 4], ['a', 'b', 'c', 'd']), 'light')
    const grow = interpolateGeometry(a, c, 0.5)
    const fresh = grow.bars.find((x) => x.label === 'd')!
    expect(fresh.h).toBeCloseTo(c.bars[3]!.h / 2, 1)
    expect(fresh.y + fresh.h).toBeCloseTo(c.plot.y + c.plot.h, 1)
    const shrink = interpolateGeometry(c, a, 0.5)
    const gone = shrink.bars.find((x) => x.label === 'd')!
    expect(gone).toBeTruthy()
    expect(gone.h).toBeCloseTo(c.bars[3]!.h / 2, 1)
    expect(shrink.bars).toHaveLength(4)
  })

  it('slides line points and rebuilds the path; a changed point count snaps', () => {
    const l0 = buildChart(lines([1, 2, 3]), 'light')
    const l1 = buildChart(lines([3, 2, 1]), 'light')
    const mid = interpolateGeometry(l0, l1, 0.5)
    expect(mid.lines[0]!.points[0]!.y).toBeCloseTo((l0.lines[0]!.points[0]!.y + l1.lines[0]!.points[0]!.y) / 2, 1)
    expect(mid.lines[0]!.path).not.toBe(l1.lines[0]!.path)
    const l2 = buildChart({ ...lines([1, 2]), categories: ['a', 'b'] }, 'light')
    expect(interpolateGeometry(l0, l2, 0.5).lines[0]).toBe(l2.lines[0])
  })

  it('a type change is not tweened', () => {
    const pie = buildChart({ ...bars([1, 2, 3]), type: 'pie' }, 'light')
    expect(interpolateGeometry(a, pie, 0.5)).toBe(pie)
  })

  it('pie slices and sunburst arcs interpolate their angles', () => {
    const p0 = buildChart({ ...bars([1, 1, 2]), type: 'pie' }, 'light')
    const p1 = buildChart({ ...bars([2, 1, 1]), type: 'pie' }, 'light')
    const mid = interpolateGeometry(p0, p1, 0.5)
    expect(mid.slices).toHaveLength(3)
    expect(mid.slices[0]!.arc!.a1).toBeCloseTo((p0.slices[0]!.arc!.a1 + p1.slices[0]!.arc!.a1) / 2, 6)
    expect(mid.slices[0]!.path).not.toBe(p1.slices[0]!.path)
  })
})
