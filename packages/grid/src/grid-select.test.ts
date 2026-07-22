import { describe, expect, it } from 'vitest'
import { filterGridRows } from './grid-select'

const rows = [
  { id: 1, name: 'Ada Lovelace', email: 'ada@x.io' },
  { id: 2, name: 'Alan Turing', email: 'alan@x.io' },
  { id: 3, name: 'Grace Hopper', email: 'grace@x.io' },
]

describe('filterGridRows', () => {
  it('returns every row for a blank query', () => {
    expect(filterGridRows(rows, ['name', 'email'], '')).toHaveLength(3)
    expect(filterGridRows(rows, ['name'], '   ')).toHaveLength(3)
  })

  it('matches a substring in any of the given fields (case-insensitive)', () => {
    expect(filterGridRows(rows, ['name', 'email'], 'grace').map((r) => r.id)).toEqual([3])
    expect(filterGridRows(rows, ['name', 'email'], 'ALAN').map((r) => r.id)).toEqual([2])
    // "a" appears in every name -> all 3
    expect(filterGridRows(rows, ['name'], 'a')).toHaveLength(3)
  })

  it('only searches the fields it is given', () => {
    // 'x.io' is in email but we only search name -> no matches
    expect(filterGridRows(rows, ['name'], 'x.io')).toHaveLength(0)
    expect(filterGridRows(rows, ['email'], 'x.io')).toHaveLength(3)
  })
})
