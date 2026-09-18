import { describe, expect, it } from 'vitest'
import {
  isLocked, rectsHaveLocked, rectsMixLocked, PROTECTED_MESSAGE, inEditRange, cellLocked, PROTECTION_PERMISSIONS,
  copyProtection, defaultProtection, newEditRangeId, parseRangeText, rangeText,
} from './protection'
import { createFormatStore, type CellAddressLookup } from './format-store'

const at: CellAddressLookup = {
  rowIdAt: (i) => (i >= 0 && i < 4 ? `r${i}` : null),
  columnIdAt: (i) => (i >= 0 && i < 4 ? `c${i}` : null),
}

describe('isLocked', () => {
  it('locks every cell unless the format says otherwise, as Excel does', () => {
    expect(isLocked(undefined)).toBe(true)
    expect(isLocked({})).toBe(true)
    expect(isLocked({ bold: true })).toBe(true)
    expect(isLocked({ locked: false })).toBe(false)
    expect(isLocked({ locked: true })).toBe(true)
  })
})

describe('rectsHaveLocked / rectsMixLocked', () => {
  it('reports a locked cell anywhere in the rectangles', () => {
    const store = createFormatStore()
    store.set([[0, 0, 1, 1]], { locked: false }, at)
    expect(rectsHaveLocked(store, at, [[0, 0, 1, 1]])).toBe(false)
    expect(rectsHaveLocked(store, at, [[0, 0, 2, 1]])).toBe(true)
    expect(rectsHaveLocked(store, at, [[0, 0, 1, 1], [3, 3, 3, 3]])).toBe(true)
  })

  it('tells a mixed selection from a uniform one', () => {
    const store = createFormatStore()
    store.set([[0, 0, 0, 0]], { locked: false }, at)
    expect(rectsMixLocked(store, at, [[0, 0, 0, 0]])).toBe(false)
    expect(rectsMixLocked(store, at, [[1, 1, 2, 2]])).toBe(false)
    expect(rectsMixLocked(store, at, [[0, 0, 1, 0]])).toBe(true)
  })

  it('ignores cells outside the sheet', () => {
    const store = createFormatStore()
    expect(rectsHaveLocked(store, at, [[10, 10, 12, 12]])).toBe(false)
  })

  it('has Excel\'s wording for the refusal', () => {
    expect(PROTECTED_MESSAGE).toMatch(/protected sheet/)
  })
})

describe('edit ranges and the allow list', () => {
  const ranges = [{ id: 'a', title: 'Reviewer', rects: [[1, 1, 2, 2], [5, 0, 5, 0]] as [number, number, number, number][] }]

  it('a locked cell inside an edit range is not locked on the protected sheet', () => {
    expect(inEditRange(ranges, 1, 1)).toBe(true)
    expect(inEditRange(ranges, 5, 0)).toBe(true)
    expect(inEditRange(ranges, 0, 0)).toBe(false)
    expect(cellLocked(undefined, ranges, 2, 2)).toBe(false)
    expect(cellLocked(undefined, ranges, 3, 3)).toBe(true)
    expect(cellLocked({ locked: false }, [], 3, 3)).toBe(false)
  })

  it('rectsHaveLocked sees the ranges', () => {
    const store = createFormatStore()
    expect(rectsHaveLocked(store, at, [[1, 1, 2, 2]])).toBe(true)
    expect(rectsHaveLocked(store, at, [[1, 1, 2, 2]], ranges)).toBe(false)
    expect(rectsHaveLocked(store, at, [[1, 1, 3, 2]], ranges)).toBe(true)
  })

  it('the permissions list is Excel\'s order, and a copy is its own', () => {
    expect(PROTECTION_PERMISSIONS).toEqual(['formatCells', 'formatColumns', 'formatRows', 'insertColumns', 'insertRows', 'deleteColumns', 'deleteRows', 'sort', 'autoFilter'])
    const p = { allow: { sort: true }, ranges }
    const c = copyProtection(p)
    expect(c).toEqual(p)
    expect(c.ranges[0]).not.toBe(p.ranges[0])
    expect(c.ranges[0]!.rects[0]).not.toBe(p.ranges[0]!.rects[0])
    expect(defaultProtection()).toEqual({ allow: {}, ranges: [] })
    expect(newEditRangeId()).not.toBe(newEditRangeId())
  })
})

describe('range text', () => {
  it('reads cells and ranges in any order, and spells them back', () => {
    expect(parseRangeText('B2:B10, A1 c3:C5')).toEqual([[1, 1, 9, 1], [0, 0, 0, 0], [2, 2, 4, 2]])
    expect(parseRangeText('=$B$10:B2')).toEqual([[1, 1, 9, 1]])
    expect(parseRangeText('')).toBeNull()
    expect(parseRangeText('B2, nope')).toBeNull()
    expect(parseRangeText('A:A')).toBeNull()
    expect(rangeText([[1, 1, 9, 1], [0, 0, 0, 0]])).toBe('B2:B10, A1')
  })
})
