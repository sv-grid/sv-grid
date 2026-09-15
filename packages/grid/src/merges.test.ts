import { describe, expect, it } from 'vitest'
import {
  buildMergeIndex, mergeAt, isCovered, originOf, endOf, expandRectToMerges, stepPastMerge, mergeDrawAt,
} from './merges'

// A1:C1 (three across), B3:B5 (three down), E5:F6 (two by two).
const index = buildMergeIndex([
  { rowIndex: 0, colIndex: 0, rowSpan: 1, colSpan: 3 },
  { rowIndex: 2, colIndex: 1, rowSpan: 3, colSpan: 1 },
  { rowIndex: 4, colIndex: 4, rowSpan: 2, colSpan: 2 },
])
const bounds = { maxRow: 9, maxCol: 9 }

describe('buildMergeIndex', () => {
  it('is null for nothing, and drops 1x1 merges', () => {
    expect(buildMergeIndex([])).toBeNull()
    expect(buildMergeIndex(undefined)).toBeNull()
    expect(buildMergeIndex([{ rowIndex: 0, colIndex: 0, rowSpan: 1, colSpan: 1 }])).toBeNull()
  })

  it('indexes every covered cell to its merge', () => {
    expect(mergeAt(index, 0, 2)?.colSpan).toBe(3)
    expect(mergeAt(index, 4, 1)?.rowSpan).toBe(3)
    expect(mergeAt(index, 5, 5)).toMatchObject({ rowIndex: 4, colIndex: 4 })
    expect(mergeAt(index, 1, 1)).toBeUndefined()
    expect(isCovered(index, 0, 0)).toBe(false)
    expect(isCovered(index, 0, 1)).toBe(true)
    expect(originOf(index, 5, 5)).toEqual({ rowIndex: 4, colIndex: 4 })
    expect(originOf(index, 7, 7)).toEqual({ rowIndex: 7, colIndex: 7 })
    expect(endOf(index, 2, 1)).toEqual({ rowIndex: 4, colIndex: 1 })
    expect(endOf(index, 7, 7)).toEqual({ rowIndex: 7, colIndex: 7 })
  })
})

describe('expandRectToMerges', () => {
  it('grows a rectangle to hold every merge it touches, to a fixed point', () => {
    expect(expandRectToMerges(index, { minRow: 0, maxRow: 0, minCol: 1, maxCol: 1 })).toEqual({ minRow: 0, maxRow: 0, minCol: 0, maxCol: 2 })
    // B4 alone pulls in B3:B5; a rectangle reaching E5 pulls in E5:F6.
    expect(expandRectToMerges(index, { minRow: 3, maxRow: 3, minCol: 1, maxCol: 1 })).toEqual({ minRow: 2, maxRow: 4, minCol: 1, maxCol: 1 })
    expect(expandRectToMerges(index, { minRow: 4, maxRow: 4, minCol: 1, maxCol: 4 })).toEqual({ minRow: 2, maxRow: 5, minCol: 1, maxCol: 5 })
  })

  it('hands the same object back when nothing grows', () => {
    const rect = { minRow: 7, maxRow: 8, minCol: 7, maxCol: 8 }
    expect(expandRectToMerges(index, rect)).toBe(rect)
    expect(expandRectToMerges(null, rect)).toBe(rect)
  })
})

describe('stepPastMerge', () => {
  it('a step into a merge lands on its origin', () => {
    expect(stepPastMerge(index, { rowIndex: 1, colIndex: 1 }, { rowIndex: 0, colIndex: 1 }, bounds)).toEqual({ rowIndex: 0, colIndex: 0 })
    expect(stepPastMerge(index, { rowIndex: 5, colIndex: 3 }, { rowIndex: 5, colIndex: 4 }, bounds)).toEqual({ rowIndex: 4, colIndex: 4 })
  })

  it('a step inside the merge the move began in carries on past its far edge', () => {
    // Right from A1 (A1:C1) reaches D1, not B1.
    expect(stepPastMerge(index, { rowIndex: 0, colIndex: 0 }, { rowIndex: 0, colIndex: 1 }, bounds)).toEqual({ rowIndex: 0, colIndex: 3 })
    // Down from B3 (B3:B5) reaches B6.
    expect(stepPastMerge(index, { rowIndex: 2, colIndex: 1 }, { rowIndex: 3, colIndex: 1 }, bounds)).toEqual({ rowIndex: 5, colIndex: 1 })
    // Up from E5 (E5:F6) reaches E4; left reaches D5.
    expect(stepPastMerge(index, { rowIndex: 4, colIndex: 4 }, { rowIndex: 3, colIndex: 4 }, bounds)).toEqual({ rowIndex: 3, colIndex: 4 })
    expect(stepPastMerge(index, { rowIndex: 4, colIndex: 4 }, { rowIndex: 4, colIndex: 3 }, bounds)).toEqual({ rowIndex: 4, colIndex: 3 })
  })

  it('stays on the merge at the sheet edge, and takes the origin of a merge it lands in', () => {
    expect(stepPastMerge(index, { rowIndex: 0, colIndex: 0 }, { rowIndex: 0, colIndex: 1 }, { maxRow: 9, maxCol: 2 })).toEqual({ rowIndex: 0, colIndex: 0 })
    const chain = buildMergeIndex([
      { rowIndex: 0, colIndex: 0, rowSpan: 1, colSpan: 2 },
      { rowIndex: 0, colIndex: 2, rowSpan: 1, colSpan: 2 },
    ])
    expect(stepPastMerge(chain, { rowIndex: 0, colIndex: 0 }, { rowIndex: 0, colIndex: 1 }, bounds)).toEqual({ rowIndex: 0, colIndex: 2 })
  })

  it('is a pass-through without merges or outside them', () => {
    expect(stepPastMerge(null, { rowIndex: 0, colIndex: 0 }, { rowIndex: 0, colIndex: 1 }, bounds)).toEqual({ rowIndex: 0, colIndex: 1 })
    expect(stepPastMerge(index, { rowIndex: 7, colIndex: 7 }, { rowIndex: 7, colIndex: 8 }, bounds)).toEqual({ rowIndex: 7, colIndex: 8 })
  })
})

describe('mergeDrawAt', () => {
  const all = { firstRow: 0, lastRow: 9, firstCol: 0, lastCol: 9 }

  it('the origin draws with its spans and the covered cells are skipped', () => {
    expect(mergeDrawAt(index, 0, 0, all)).toEqual({ kind: 'origin', merge: index!.list[0], rowSpan: 1, colSpan: 3 })
    expect(mergeDrawAt(index, 0, 1, all)).toEqual({ kind: 'skip' })
    expect(mergeDrawAt(index, 4, 5, all)).toEqual({ kind: 'skip' })
    expect(mergeDrawAt(index, 1, 1, all)).toBeNull()
  })

  it('a merge whose origin is above the window continues from its first drawn row, spans clamped', () => {
    const window = { firstRow: 3, lastRow: 9, firstCol: 0, lastCol: 9 }
    // B3:B5 with rows 3.. shown: B4 draws the rest (two rows), B5 is skipped.
    expect(mergeDrawAt(index, 3, 1, window)).toEqual({ kind: 'continuation', merge: index!.list[1], rowSpan: 2, colSpan: 1 })
    expect(mergeDrawAt(index, 4, 1, window)).toEqual({ kind: 'skip' })
  })

  it('clamps to the window\'s last row and column', () => {
    const window = { firstRow: 0, lastRow: 4, firstCol: 0, lastCol: 4 }
    expect(mergeDrawAt(index, 2, 1, window)).toEqual({ kind: 'origin', merge: index!.list[1], rowSpan: 3, colSpan: 1 })
    expect(mergeDrawAt(index, 4, 4, window)).toEqual({ kind: 'origin', merge: index!.list[2], rowSpan: 1, colSpan: 1 })
  })

  it('a merge starting in the frozen band draws its remainder in the body as a continuation', () => {
    const frozen = { firstRow: 0, lastRow: 0, firstCol: 0, lastCol: 9 }
    const body = { firstRow: 1, lastRow: 9, firstCol: 0, lastCol: 9 }
    const tall = buildMergeIndex([{ rowIndex: 0, colIndex: 0, rowSpan: 3, colSpan: 1 }])
    expect(mergeDrawAt(tall, 0, 0, frozen)).toEqual({ kind: 'origin', merge: tall!.list[0], rowSpan: 1, colSpan: 1 })
    expect(mergeDrawAt(tall, 1, 0, body)).toEqual({ kind: 'continuation', merge: tall!.list[0], rowSpan: 2, colSpan: 1 })
    expect(mergeDrawAt(tall, 2, 0, body)).toEqual({ kind: 'skip' })
  })
})
