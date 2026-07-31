import { describe, expect, it } from 'vitest'
import { enabledIndices, wrapMove } from './list-nav'

describe('enabledIndices', () => {
  it('lists every index when nothing is disabled', () => {
    expect(enabledIndices(3)).toEqual([0, 1, 2])
  })

  it('skips indices the predicate marks disabled', () => {
    expect(enabledIndices(5, (i) => i === 1 || i === 3)).toEqual([0, 2, 4])
  })

  it('returns an empty array for a zero count', () => {
    expect(enabledIndices(0)).toEqual([])
  })
})

describe('wrapMove', () => {
  const list = [0, 2, 4] // e.g. indices 1 and 3 are disabled

  it('moves forward to the next enabled index', () => {
    expect(wrapMove(list, 2, 1)).toBe(4)
  })

  it('wraps past the end back to the head', () => {
    expect(wrapMove(list, 4, 1)).toBe(0)
  })

  it('wraps before the head to the tail', () => {
    expect(wrapMove(list, 0, -1)).toBe(4)
  })

  it('from an absent current, delta 1 lands on the first entry', () => {
    expect(wrapMove(list, -1, 1)).toBe(0)
  })

  it('from an absent current, delta -1 lands on the last-but-one', () => {
    expect(wrapMove(list, -1, -1)).toBe(2)
  })

  it('stays put for a single-entry list', () => {
    expect(wrapMove([5], 5, 1)).toBe(5)
    expect(wrapMove([5], 5, -1)).toBe(5)
  })

  it('returns -1 for an empty list', () => {
    expect(wrapMove([], 0, 1)).toBe(-1)
  })
})
