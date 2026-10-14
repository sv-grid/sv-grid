/**
 * The `ext` predicate node: a condition kind another module registers, read
 * by the compiler, the evaluator, the column walk and the text form.
 */
import { describe, expect, it } from 'vitest'
import { registerPredicateKind } from './kinds'
import { compilePredicate } from './compile'
import { evaluatePredicate } from './evaluate'
import { collectColumnRefs, stringifyPredicate } from './parse'
import type { PredicateExpr } from './expression-types'

type Row = { id: string; tags: string[]; price: number }

// "has tag": true when the row's list holds the payload's tag.
registerPredicateKind('test-hasTag', {
  compile: (payload, ctx) => {
    const p = payload as { column: string; tag?: string }
    if (!p.tag) return null
    return (row) => ((ctx.getValue(row, p.column) as string[]) ?? []).includes(p.tag!)
  },
  describe: (payload, name) => `${name((payload as { column: string }).column)} has ${(payload as { tag?: string }).tag}`,
  columns: (payload) => [(payload as { column: string }).column],
})

const hasTag = (tag?: string): PredicateExpr => ({ kind: 'ext', type: 'test-hasTag', payload: { column: 'tags', tag } })
const rows: Row[] = [
  { id: 'a', tags: ['red', 'big'], price: 10 },
  { id: 'b', tags: ['blue'], price: 30 },
]
const getValue = (row: Row, id: string) => (row as Record<string, unknown>)[id]

describe('ext predicate node', () => {
  it('compiles through the registered kind, inside and/or like any node', () => {
    const red = compilePredicate<Row>(hasTag('red'), { getValue, rows })!
    expect(rows.filter(red).map((r) => r.id)).toEqual(['a'])
    const both = compilePredicate<Row>(
      { kind: 'or', parts: [hasTag('blue'), { kind: 'cmp', column: 'price', op: 'lessThan', value: 5 }] },
      { getValue, rows },
    )!
    expect(rows.filter(both).map((r) => r.id)).toEqual(['b'])
  })

  it('evaluates the same as it compiles', () => {
    expect(rows.filter((row) => evaluatePredicate(hasTag('big'), { row, getValue })).map((r) => r.id)).toEqual(['a'])
  })

  it('an empty condition matches every row', () => {
    expect(rows.filter(compilePredicate<Row>(hasTag(), { getValue, rows })!)).toHaveLength(2)
    expect(rows.filter((row) => evaluatePredicate(hasTag(), { row, getValue }))).toHaveLength(2)
  })

  it('a type nobody registered matches nothing', () => {
    const unknown: PredicateExpr = { kind: 'ext', type: 'test-nobody', payload: {} }
    expect(rows.filter(compilePredicate<Row>(unknown, { getValue, rows })!)).toHaveLength(0)
    expect(rows.filter((row) => evaluatePredicate(unknown, { row, getValue }))).toHaveLength(0)
    expect(stringifyPredicate(unknown)).toBe('[test-nobody]')
  })

  it('reports its columns and reads as its own words', () => {
    expect(collectColumnRefs({ kind: 'and', parts: [hasTag('red'), { kind: 'cmp', column: 'price', op: 'greaterThan', value: 1 }] })).toEqual(['tags', 'price'])
    expect(stringifyPredicate(hasTag('red'), [{ id: 'tags', name: 'Labels' }])).toBe('Labels has red')
  })
})
