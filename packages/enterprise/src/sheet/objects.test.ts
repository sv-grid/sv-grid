import { describe, expect, it } from 'vitest'
import { chartSpecOf, chartFromRange, shiftObject, shiftObjects, objectAt, copyObject, objectId, type SheetChartObject, type SheetObject } from './objects'
import type { Rect } from './format-store'
import type { CellValue } from './ast'

const grid: CellValue[][] = [
  ['Month', 'Online', 'Retail'],
  ['Jan', 120, 80],
  ['Feb', 150, 95],
  ['Mar', 170, 90],
]
const valueAt = (r: number, c: number) => grid[r]?.[c] ?? ''
const textAt = (r: number, c: number) => String(grid[r]?.[c] ?? '')

const chart = (over: Partial<SheetChartObject> = {}): SheetChartObject => ({
  id: 'c1',
  kind: 'chart',
  anchor: { row: 5, col: 0, dx: 8, dy: 8, width: 420, height: 260 },
  range: [0, 0, 3, 2] as unknown as Rect,
  type: 'bar',
  headers: true,
  series: 'columns',
  ...over,
})

describe('chartSpecOf', () => {
  it('reads a header row and a label column, one series per column', () => {
    expect(chartSpecOf(chart(), valueAt, textAt)).toEqual({
      type: 'bar',
      categories: ['Jan', 'Feb', 'Mar'],
      series: [
        { label: 'Online', values: [120, 150, 170] },
        { label: 'Retail', values: [80, 95, 90] },
      ],
    })
  })

  it('series along the rows swaps what is what', () => {
    expect(chartSpecOf(chart({ series: 'rows' }), valueAt, textAt)).toEqual({
      type: 'bar',
      categories: ['Online', 'Retail'],
      series: [
        { label: 'Jan', values: [120, 80] },
        { label: 'Feb', values: [150, 95] },
        { label: 'Mar', values: [170, 90] },
      ],
    })
  })

  it('without headers the labels are the letters and the numbers, and a text column is left out', () => {
    const spec = chartSpecOf(chart({ headers: false }), valueAt, textAt)
    expect(spec.categories).toEqual(['1', '2', '3', '4'])
    expect(spec.series.map((s) => s.label)).toEqual(['B', 'C'])
    expect(spec.series[0]!.values).toEqual([0, 120, 150, 170])
  })

  it('a blank cell is a zero, the type and the stack carry, and a range with no numbers has no series', () => {
    const holes: CellValue[][] = [['Q', 'V'], ['a', 5], ['b', ''], ['c', 7]]
    const spec = chartSpecOf(
      chart({ range: [0, 0, 3, 1] as unknown as Rect, type: 'line', stacked: true }),
      (r, c) => holes[r]?.[c] ?? '',
      (r, c) => String(holes[r]?.[c] ?? ''),
    )
    expect(spec).toEqual({ type: 'line', stacked: true, categories: ['a', 'b', 'c'], series: [{ label: 'V', values: [5, 0, 7] }] })
    const empty = chartSpecOf(chart({ range: [0, 0, 1, 0] as unknown as Rect }), () => 'text', () => 'text')
    expect(empty.series).toEqual([])
  })
})

describe('chartFromRange', () => {
  it('guesses a header row, anchors under the block, and starts on a bar chart', () => {
    const made = chartFromRange([0, 0, 3, 2] as unknown as Rect, valueAt)
    expect(made).toMatchObject({ kind: 'chart', type: 'bar', headers: true, series: 'columns', range: [0, 0, 3, 2] })
    expect(made.anchor).toMatchObject({ row: 4, col: 0, width: 420, height: 260 })
    expect(made.id).not.toBe(chartFromRange([0, 0, 1, 1] as unknown as Rect, valueAt).id)
    // No header row where the first row is numbers too.
    const numbers: CellValue[][] = [[1, 2], [3, 4]]
    expect(chartFromRange([0, 0, 1, 1] as unknown as Rect, (r, c) => numbers[r]?.[c] ?? '').headers).toBe(false)
    // Nor on a single row, which has nothing under the header to read.
    expect(chartFromRange([0, 0, 0, 2] as unknown as Rect, valueAt).headers).toBe(false)
  })
})

describe('shiftObject', () => {
  it('moves the anchor and the range, and drops an object whose cell went', () => {
    const inserted = shiftObject(chart(), { kind: 'insertRows', at: 0, count: 2 })!
    expect(inserted.anchor.row).toBe(7)
    expect((inserted as SheetChartObject).range).toEqual([2, 0, 5, 2])
    const cols = shiftObject(chart(), { kind: 'insertCols', at: 0, count: 1 })!
    expect(cols.anchor.col).toBe(1)
    expect((cols as SheetChartObject).range).toEqual([0, 1, 3, 3])
    expect(shiftObject(chart(), { kind: 'deleteRows', at: 5, count: 1 })).toBeNull()
    expect(shiftObject(chart(), { kind: 'deleteRows', at: 0, count: 4 })).toBeNull()
    const image: SheetObject = { id: 'i1', kind: 'image', anchor: { row: 2, col: 2, dx: 0, dy: 0, width: 100, height: 60 }, src: 'data:,' }
    expect(shiftObjects([chart(), image], { kind: 'deleteRows', at: 5, count: 1 })).toEqual([shiftObject(image, { kind: 'deleteRows', at: 5, count: 1 })])
  })

  it('a copy is its own', () => {
    const one = chart()
    const two = copyObject(one) as SheetChartObject
    expect(two).toEqual(one)
    expect(two.anchor).not.toBe(one.anchor)
    expect(two.range).not.toBe(one.range)
    expect(objectId()).not.toBe(objectId())
  })
})

describe('objectAt', () => {
  it('hits the topmost object under the point', () => {
    const a = chart({ id: 'a' })
    const b = chart({ id: 'b' })
    const boxes: Record<string, { left: number; top: number; width: number; height: number }> = {
      a: { left: 0, top: 0, width: 100, height: 100 },
      b: { left: 50, top: 50, width: 100, height: 100 },
    }
    const boxOf = (o: SheetObject) => boxes[o.id] ?? null
    expect(objectAt([a, b], { x: 10, y: 10 }, boxOf)?.id).toBe('a')
    expect(objectAt([a, b], { x: 60, y: 60 }, boxOf)?.id).toBe('b')
    expect(objectAt([a, b], { x: 300, y: 300 }, boxOf)).toBeNull()
  })
})
