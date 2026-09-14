import { describe, expect, it } from 'vitest'
import { createDependencyGraph, cellKey, parseCellKey, precedentsOf } from './deps'
import { parseFormula } from './parse'

const k = (row: number, col: number) => cellKey(null, row, col)
const lastRow = () => 9

describe('cellKey', () => {
  it('round-trips', () => {
    expect(parseCellKey(cellKey(null, 2, 3))).toEqual({ sheet: null, row: 2, col: 3 })
    expect(parseCellKey(cellKey('Orders', 0, 0))).toEqual({ sheet: 'Orders', row: 0, col: 0 })
  })

  it('round-trips a sheet name with spaces, and does not collide', () => {
    // The sheet goes LAST for exactly this: with it first, splitting on spaces
    // would make 'Price list' ambiguous against a different cell.
    expect(parseCellKey(cellKey('Price list', 4, 5)))
      .toEqual({ sheet: 'Price list', row: 4, col: 5 })
    expect(cellKey('a:1', 0, 0)).not.toBe(cellKey('a', 1, 0))
    expect(cellKey('1 0', 0, 0)).not.toBe(cellKey('0', 1, 0))
  })
})

describe('precedentsOf', () => {
  it('reports a single reference', () => {
    expect(precedentsOf(parseFormula('=A1'), { sheet: null }, lastRow)).toEqual([k(0, 0)])
  })

  it('expands a range into every cell', () => {
    const got = precedentsOf(parseFormula('=SUM(A1:B2)'), { sheet: null }, lastRow)
    expect(got.sort()).toEqual([k(0, 0), k(0, 1), k(1, 0), k(1, 1)].sort())
  })

  it('uses lastRow for an open-ended column reference', () => {
    const got = precedentsOf(parseFormula('=SUM(Data!A)'), { sheet: null }, () => 2)
    expect(got).toHaveLength(3)
    expect(got[0]).toBe(cellKey('Data', 0, 0))
  })

  it('attributes an unqualified reference to the formula own sheet', () => {
    expect(precedentsOf(parseFormula('=A1'), { sheet: 'Budget' }, lastRow))
      .toEqual([cellKey('Budget', 0, 0)])
  })

  it('finds references nested in a call', () => {
    const got = precedentsOf(parseFormula('=IF(A1>0,B1,C1)'), { sheet: null }, lastRow)
    expect(got.sort()).toEqual([k(0, 0), k(0, 1), k(0, 2)].sort())
  })

  it('reports nothing for a formula with no references', () => {
    expect(precedentsOf(parseFormula('=1+2'), { sheet: null }, lastRow)).toEqual([])
  })
})

describe('dirtyFrom', () => {
  it('returns nothing when no one reads the changed cell', () => {
    expect(createDependencyGraph().dirtyFrom([k(0, 0)])).toEqual([])
  })

  it('returns the direct reader', () => {
    const g = createDependencyGraph()
    g.setPrecedents(k(1, 0), [k(0, 0)])
    expect(g.dirtyFrom([k(0, 0)])).toEqual([k(1, 0)])
  })

  it('follows a chain transitively, in order', () => {
    const g = createDependencyGraph()
    g.setPrecedents(k(1, 0), [k(0, 0)])
    g.setPrecedents(k(2, 0), [k(1, 0)])
    g.setPrecedents(k(3, 0), [k(2, 0)])
    expect(g.dirtyFrom([k(0, 0)])).toEqual([k(1, 0), k(2, 0), k(3, 0)])
  })

  it('orders a diamond so the join comes last', () => {
    //   A -> B -> D
    //    \-> C ---^    D must not recompute before B and C have.
    const g = createDependencyGraph()
    g.setPrecedents(k(1, 0), [k(0, 0)])
    g.setPrecedents(k(2, 0), [k(0, 0)])
    g.setPrecedents(k(3, 0), [k(1, 0), k(2, 0)])
    const order = g.dirtyFrom([k(0, 0)])
    expect(order).toHaveLength(3)
    expect(order.indexOf(k(3, 0))).toBe(2)
  })

  it('leaves untouched branches out, which is the whole point', () => {
    const g = createDependencyGraph()
    g.setPrecedents(k(1, 0), [k(0, 0)])
    g.setPrecedents(k(9, 9), [k(5, 5)])
    expect(g.dirtyFrom([k(0, 0)])).toEqual([k(1, 0)])
  })

  it('still emits cells caught in a cycle, so they can report #CYCLE!', () => {
    const g = createDependencyGraph()
    g.setPrecedents(k(1, 0), [k(0, 0), k(2, 0)])
    g.setPrecedents(k(2, 0), [k(1, 0)])
    const order = g.dirtyFrom([k(0, 0)])
    expect(order).toContain(k(1, 0))
    expect(order).toContain(k(2, 0))
  })

  it('takes several changed cells at once without duplicating work', () => {
    const g = createDependencyGraph()
    g.setPrecedents(k(2, 0), [k(0, 0), k(1, 0)])
    expect(g.dirtyFrom([k(0, 0), k(1, 0)])).toEqual([k(2, 0)])
  })
})

describe('rewiring', () => {
  it('drops the old edge when a formula is replaced', () => {
    const g = createDependencyGraph()
    g.setPrecedents(k(1, 0), [k(0, 0)])
    g.setPrecedents(k(1, 0), [k(5, 5)])
    expect(g.dirtyFrom([k(0, 0)])).toEqual([])
    expect(g.dirtyFrom([k(5, 5)])).toEqual([k(1, 0)])
  })

  it('drops every edge when a formula becomes a literal', () => {
    const g = createDependencyGraph()
    g.setPrecedents(k(1, 0), [k(0, 0)])
    g.setPrecedents(k(1, 0), null)
    expect(g.dirtyFrom([k(0, 0)])).toEqual([])
  })

  it('clears everything', () => {
    const g = createDependencyGraph()
    g.setPrecedents(k(1, 0), [k(0, 0)])
    g.clear()
    expect(g.dirtyFrom([k(0, 0)])).toEqual([])
  })
})

describe('cycles', () => {
  it('reports nothing for an acyclic sheet', () => {
    const g = createDependencyGraph()
    g.setPrecedents(k(1, 0), [k(0, 0)])
    expect(g.cycles()).toEqual([])
  })

  it('reports a self reference', () => {
    const g = createDependencyGraph()
    g.setPrecedents(k(0, 0), [k(0, 0)])
    expect(g.cycles()).toEqual([k(0, 0)])
  })

  it('reports both cells of a two-cell cycle', () => {
    const g = createDependencyGraph()
    g.setPrecedents(k(0, 0), [k(1, 0)])
    g.setPrecedents(k(1, 0), [k(0, 0)])
    expect(g.cycles().sort()).toEqual([k(0, 0), k(1, 0)].sort())
  })

  it('reports a longer cycle', () => {
    const g = createDependencyGraph()
    g.setPrecedents(k(0, 0), [k(1, 0)])
    g.setPrecedents(k(1, 0), [k(2, 0)])
    g.setPrecedents(k(2, 0), [k(0, 0)])
    expect(g.cycles()).toHaveLength(3)
  })
})

describe('dependentsOf', () => {
  it('names the direct readers', () => {
    const g = createDependencyGraph()
    g.setPrecedents(k(1, 0), [k(0, 0)])
    g.setPrecedents(k(2, 0), [k(0, 0)])
    expect(g.dependentsOf(k(0, 0)).sort()).toEqual([k(1, 0), k(2, 0)].sort())
  })
})
