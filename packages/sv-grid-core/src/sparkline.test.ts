import { describe, expect, it } from 'vitest'
import { buildSparkline, toSparklineValues } from './sparkline'

describe('toSparklineValues', () => {
  it('passes through number arrays and drops non-finite', () => {
    expect(toSparklineValues([1, 2, NaN, 3])).toEqual([1, 2, 3])
  })
  it('parses comma / space separated strings', () => {
    expect(toSparklineValues('1, 2 3,4')).toEqual([1, 2, 3, 4])
  })
  it('returns [] for empty / unusable input', () => {
    expect(toSparklineValues(null)).toEqual([])
    expect(toSparklineValues('')).toEqual([])
    expect(toSparklineValues({})).toEqual([])
  })
})

describe('buildSparkline', () => {
  it('returns null for empty data', () => {
    expect(buildSparkline([])).toBeNull()
  })

  it('builds a line path through every point', () => {
    const g = buildSparkline([0, 5, 10], { type: 'line', width: 100, height: 20 })!
    expect(g.type).toBe('line')
    expect(g.linePath.startsWith('M')).toBe(true)
    // three points => one M + two L commands
    expect((g.linePath.match(/[ML]/g) ?? []).length).toBe(3)
    expect(g.lastPoint).not.toBeNull()
  })

  it('closes the area path back to the baseline', () => {
    const g = buildSparkline([1, 2, 3], { type: 'area' })!
    expect(g.areaPath.endsWith('Z')).toBe(true)
  })

  it('emits one bar per value and flags negatives', () => {
    const g = buildSparkline([-2, 4, -1], { type: 'bar' })!
    expect(g.bars).toHaveLength(3)
    expect(g.bars[0]!.negative).toBe(true)
    expect(g.bars[1]!.negative).toBe(false)
  })

  it('winloss uses sign only, equal-height up/down bars', () => {
    const g = buildSparkline([1, -1, 1], { type: 'winloss', height: 20 })!
    expect(g.bars).toHaveLength(3)
    expect(g.bars[0]!.negative).toBe(false)
    expect(g.bars[1]!.negative).toBe(true)
    // up and down bars are the same height (sign-only chart)
    expect(g.bars[0]!.h).toBeCloseTo(g.bars[1]!.h)
  })

  it('honors a fixed min/max scale', () => {
    const a = buildSparkline([5, 5, 5], { type: 'line', min: 0, max: 10 })!
    // flat series on a 0..10 scale sits at the vertical middle, not the top
    const ys = a.linePath.match(/,(-?\d+(\.\d+)?)/g)!.map((s) => Number(s.slice(1)))
    expect(new Set(ys).size).toBe(1)
  })
})
