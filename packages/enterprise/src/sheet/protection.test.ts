import { describe, expect, it } from 'vitest'
import { isLocked, rectsHaveLocked, rectsMixLocked, PROTECTED_MESSAGE } from './protection'
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
