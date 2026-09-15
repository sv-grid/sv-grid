import { describe, expect, it } from 'vitest'
import { lineShift, rectContains, remapNotes, shiftRect, shiftRects, subtractRect } from './rects'

describe('shiftRect', () => {
  const rect = [4, 1, 7, 2] as const // B5:C8

  it('moves a range below an insert, grows one an insert lands inside, leaves one above alone', () => {
    expect(shiftRect(rect, { kind: 'insertRows', at: 2, count: 2 })).toEqual([6, 1, 9, 2])
    expect(shiftRect(rect, { kind: 'insertRows', at: 5, count: 2 })).toEqual([4, 1, 9, 2])
    expect(shiftRect(rect, { kind: 'insertRows', at: 4, count: 1 })).toEqual([5, 1, 8, 2])
    expect(shiftRect(rect, { kind: 'insertRows', at: 9, count: 3 })).toEqual([4, 1, 7, 2])
  })

  it('moves a range up past a delete above it and shrinks one a delete overlaps', () => {
    expect(shiftRect(rect, { kind: 'deleteRows', at: 0, count: 2 })).toEqual([2, 1, 5, 2])
    // Rows 3-5 deleted: the range loses row 5 and starts where the deletion did.
    expect(shiftRect(rect, { kind: 'deleteRows', at: 2, count: 3 })).toEqual([2, 1, 4, 2])
    // Rows 7-9 deleted: the tail goes.
    expect(shiftRect(rect, { kind: 'deleteRows', at: 6, count: 3 })).toEqual([4, 1, 5, 2])
    // Rows 5-6 deleted inside: shorter.
    expect(shiftRect(rect, { kind: 'deleteRows', at: 4, count: 2 })).toEqual([4, 1, 5, 2])
    // A delete spanning the whole range removes it.
    expect(shiftRect(rect, { kind: 'deleteRows', at: 3, count: 6 })).toBeNull()
    expect(shiftRect(rect, { kind: 'deleteRows', at: 4, count: 4 })).toBeNull()
  })

  it('does the same along columns', () => {
    expect(shiftRect(rect, { kind: 'insertCols', at: 0, count: 1 })).toEqual([4, 2, 7, 3])
    expect(shiftRect(rect, { kind: 'deleteCols', at: 2, count: 1 })).toEqual([4, 1, 7, 1])
    expect(shiftRect(rect, { kind: 'deleteCols', at: 1, count: 2 })).toBeNull()
  })
})

describe('shiftRects', () => {
  it('moves every rect of every item and drops an item left with none', () => {
    const items = [
      { id: 'a', rects: [[0, 0, 1, 1] as const, [5, 0, 5, 0] as const] },
      { id: 'b', rects: [[5, 0, 5, 0] as const] },
    ]
    const out = shiftRects(items, { kind: 'deleteRows', at: 5, count: 1 })
    expect(out).toEqual([{ id: 'a', rects: [[0, 0, 1, 1]] }])
  })
})

describe('subtractRect', () => {
  it('cuts a hole into up to four pieces and leaves a rect the hole misses alone', () => {
    const rect = [0, 0, 4, 4] as const
    expect(subtractRect(rect, [1, 1, 2, 2])).toEqual([
      [0, 0, 0, 4],
      [3, 0, 4, 4],
      [1, 0, 2, 0],
      [1, 3, 2, 4],
    ])
    expect(subtractRect(rect, [0, 0, 4, 4])).toEqual([])
    expect(subtractRect(rect, [9, 9, 9, 9])).toEqual([rect])
    expect(subtractRect(rect, [0, 0, 1, 4])).toEqual([[2, 0, 4, 4]])
  })
})

describe('rectContains / lineShift / remapNotes', () => {
  it('contains inclusive edges', () => {
    expect(rectContains([1, 1, 2, 2], 2, 2)).toBe(true)
    expect(rectContains([1, 1, 2, 2], 3, 2)).toBe(false)
  })

  it('lineShift matches the format store rule', () => {
    const insert = lineShift({ kind: 'insertRows', at: 2, count: 2 })
    expect([0, 2, 5].map(insert)).toEqual([0, 4, 7])
    const del = lineShift({ kind: 'deleteRows', at: 2, count: 2 })
    expect([0, 2, 3, 4].map(del)).toEqual([0, null, null, 2])
  })

  it('remaps notes by row and by column, dropping deleted lines', () => {
    const notes = { r1: { A: 'one', C: 'three' }, r4: { B: 'four' } }
    expect(remapNotes(notes, 'rows', lineShift({ kind: 'insertRows', at: 2, count: 1 }))).toEqual({
      r1: { A: 'one', C: 'three' },
      r5: { B: 'four' },
    })
    expect(remapNotes(notes, 'cols', lineShift({ kind: 'deleteCols', at: 0, count: 1 }))).toEqual({
      r1: { B: 'three' },
      r4: { A: 'four' },
    })
    expect(remapNotes(notes, 'rows', lineShift({ kind: 'deleteRows', at: 1, count: 1 }))).toEqual({ r3: { B: 'four' } })
  })
})
