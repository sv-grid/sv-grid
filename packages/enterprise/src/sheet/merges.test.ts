import { describe, expect, it } from 'vitest'
import {
  mergePlan, unmergePlan, mergeDropsValues, mergesIn, mergeAt, isCoveredCell, selectionMerged,
  toGridMerges, sortBlockedByMerges, reorderMerges, normalRect, expandToMerges,
} from './merges'
import type { Rect } from './rects'

const blankExcept = (...cells: Array<[number, number]>) => (r: number, c: number) => !cells.some(([a, b]) => a === r && b === c)

describe('mergePlan', () => {
  it('Merge & Center: one merge per rectangle, the other cells cleared, the origin centred', () => {
    const plan = mergePlan([], [[0, 0, 0, 2]], 'center', blankExcept([0, 0], [0, 2]))
    expect(plan.merges).toEqual([[0, 0, 0, 2]])
    expect(plan.clear).toEqual([[0, 2]])
    expect(plan.center).toBe(true)
    expect(plan.origins).toEqual([[0, 0]])
  })

  it('Merge Across: one merge per row; Merge Cells: no centring', () => {
    const across = mergePlan([], [[1, 0, 2, 2]], 'across', () => true)
    expect(across.merges).toEqual([[1, 0, 1, 2], [2, 0, 2, 2]])
    expect(across.center).toBe(false)
    const cells = mergePlan([], [[0, 0, 1, 1]], 'cells', () => true)
    expect(cells.merges).toEqual([[0, 0, 1, 1]])
    expect(cells.center).toBe(false)
  })

  it('a single cell merges nothing, and a merge already inside the selection is replaced', () => {
    expect(mergePlan([], [[3, 3, 3, 3]], 'center', () => true).merges).toEqual([])
    const plan = mergePlan([[0, 0, 0, 1], [5, 5, 6, 6]], [[0, 0, 0, 3]], 'center', () => true)
    expect(plan.merges).toEqual([[5, 5, 6, 6], [0, 0, 0, 3]])
  })

  it('normalises a rectangle dragged upwards', () => {
    expect(normalRect([2, 3, 0, 1])).toEqual([0, 1, 2, 3])
    expect(mergePlan([], [[2, 3, 0, 1]], 'cells', () => true).merges).toEqual([[0, 1, 2, 3]])
  })

  it('says when a merge would drop a value', () => {
    expect(mergeDropsValues([[0, 0, 0, 2]], 'center', blankExcept([0, 0]))).toBe(false)
    expect(mergeDropsValues([[0, 0, 0, 2]], 'center', blankExcept([0, 1]))).toBe(true)
  })
})

describe('unmerge and lookups', () => {
  const merges: Rect[] = [[0, 0, 0, 2], [3, 1, 4, 1]]

  it('expandToMerges grows a rectangle over the merges it touches, chaining through them', () => {
    expect(expandToMerges(merges, [0, 1, 0, 1])).toEqual([0, 0, 0, 2])
    expect(expandToMerges(merges, [1, 0, 3, 0])).toEqual([1, 0, 3, 0])
    // B2:B4 touches B4:B5, which pulls row 5 in; a merge on row 5 would chain further.
    expect(expandToMerges(merges, [1, 1, 3, 1])).toEqual([1, 1, 4, 1])
    expect(expandToMerges([...merges, [4, 1, 4, 3]], [1, 1, 3, 1])).toEqual([1, 1, 4, 3])
    expect(expandToMerges(merges, [7, 7, 7, 7])).toEqual([7, 7, 7, 7])
    expect(expandToMerges(merges, [0, 2, 0, 1])).toEqual([0, 0, 0, 2])
  })

  it('Unmerge drops every merge the selection touches', () => {
    expect(unmergePlan(merges, [[0, 1, 0, 1]])).toEqual([[3, 1, 4, 1]])
    expect(unmergePlan(merges, [[0, 0, 9, 9]])).toEqual([])
    expect(unmergePlan(merges, [[7, 7, 7, 7]])).toEqual(merges)
  })

  it('finds merges by cell and by rectangle', () => {
    expect(mergeAt(merges, 4, 1)).toEqual([3, 1, 4, 1])
    expect(mergeAt(merges, 4, 2)).toBeUndefined()
    expect(isCoveredCell(merges, 0, 0)).toBe(false)
    expect(isCoveredCell(merges, 0, 2)).toBe(true)
    expect(mergesIn(merges, [[4, 0, 4, 3]])).toEqual([[3, 1, 4, 1]])
    expect(selectionMerged(merges, [[1, 1, 1, 1]])).toBe(false)
    expect(selectionMerged(merges, [[0, 2, 0, 2]])).toBe(true)
  })

  it('hands the grid origins with spans', () => {
    expect(toGridMerges(merges)).toEqual([
      { rowIndex: 0, colIndex: 0, rowSpan: 1, colSpan: 3 },
      { rowIndex: 3, colIndex: 1, rowSpan: 2, colSpan: 1 },
    ])
  })
})

describe('sorting with merges', () => {
  it('refuses a merge that crosses the range or spans rows, allows one-row merges inside it', () => {
    expect(sortBlockedByMerges([[2, 0, 2, 2]], [0, 0, 5, 3])).toBe(false)
    expect(sortBlockedByMerges([[2, 0, 3, 0]], [0, 0, 5, 3])).toBe(true)
    expect(sortBlockedByMerges([[2, 2, 2, 5]], [0, 0, 5, 3])).toBe(true)
    expect(sortBlockedByMerges([[8, 0, 8, 2]], [0, 0, 5, 3])).toBe(false)
  })

  it('moves a one-row merge with its row', () => {
    const rowFor = (r: number) => ({ 1: 3, 3: 1 } as Record<number, number>)[r] ?? r
    expect(reorderMerges([[1, 0, 1, 2], [9, 0, 9, 1]], [0, 0, 5, 3], rowFor)).toEqual([[3, 0, 3, 2], [9, 0, 9, 1]])
  })
})
