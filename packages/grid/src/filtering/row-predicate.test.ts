import { describe, expect, it } from 'vitest'
import { applyRowPredicate } from './row-predicate'

type R = { id: string; depth: number; group?: boolean; v?: number; subRows?: R[] }
const leaf = (id: string, v: number, depth = 1): R => ({ id, depth, v })
const group = (id: string, subRows: R[], depth = 0): R => ({ id, depth, group: true, subRows })
const isGroup = (r: R) => !!r.group
const keepBig = (r: R) => (r.v ?? 0) > 5
const ids = (rows: R[]) => rows.map((r) => r.id)

describe('applyRowPredicate', () => {
  it('filters a flat list', () => {
    expect(ids(applyRowPredicate([leaf('a', 1, 0), leaf('b', 9, 0)], keepBig, isGroup))).toEqual(['b'])
  })

  it('keeps an expanded group with a surviving row and drops an empty sibling', () => {
    const a = [leaf('a1', 9), leaf('a2', 1)]
    const b = [leaf('b1', 2)]
    const rows = [group('A', a), ...a, group('B', b), ...b]
    expect(ids(applyRowPredicate(rows, keepBig, isGroup))).toEqual(['A', 'a1'])
  })

  it('tests a collapsed group through its subRows', () => {
    const rows = [group('A', [leaf('a1', 9)]), group('B', [leaf('b1', 2)]), group('C', [leaf('c1', 7), leaf('c2', 0)])]
    expect(ids(applyRowPredicate(rows, keepBig, isGroup))).toEqual(['A', 'C'])
  })

  it('keeps the ancestors of a match in nested groups', () => {
    const inner1 = group('A1', [leaf('x', 1, 2)], 1)
    const inner2 = group('A2', [leaf('y', 8, 2)], 1)
    const rows = [group('A', [inner1, inner2]), inner1, inner2, group('B', [group('B1', [leaf('z', 1, 2)], 1)])]
    expect(ids(applyRowPredicate(rows, keepBig, isGroup))).toEqual(['A', 'A2'])
  })
})
