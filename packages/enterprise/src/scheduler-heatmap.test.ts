import { describe, expect, it } from 'vitest'
import { heatCells, heatPeak } from './scheduler-heatmap'

const ticks = [
  { leftPct: 0, widthPct: 25 },
  { leftPct: 25, widthPct: 25 },
  { leftPct: 50, widthPct: 25 },
  { leftPct: 75, widthPct: 25 },
]

describe('heatCells', () => {
  it('scales load to 0..1 intensity against the peak', () => {
    const cells = heatCells(ticks, [0, 1, 2, 4], 4, 4)
    expect(cells.map((c) => c.intensity)).toEqual([0, 0.25, 0.5, 1])
  })

  it('flags over-capacity cells', () => {
    const cells = heatCells(ticks, [1, 2, 3, 5], 3, 5)
    expect(cells.map((c) => c.over)).toEqual([false, false, false, true]) // 5 > capacity 3
  })

  it('clamps intensity to 1 when load exceeds the peak', () => {
    const cells = heatCells(ticks, [8], 2, 4)
    expect(cells[0]!.intensity).toBe(1)
  })

  it('carries the axis geometry through', () => {
    const cells = heatCells(ticks, [1, 1, 1, 1], 1, 1)
    expect(cells.map((c) => c.leftPct)).toEqual([0, 25, 50, 75])
    expect(cells.every((c) => c.widthPct === 25)).toBe(true)
  })
})

describe('heatPeak', () => {
  it('returns the max load across rows (>= floor)', () => {
    expect(heatPeak([[0, 1, 2], [3, 0], [1]])).toBe(3)
    expect(heatPeak([[0, 0]], 1)).toBe(1) // floor
  })
})
