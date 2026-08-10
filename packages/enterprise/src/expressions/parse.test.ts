import { describe, expect, it } from 'vitest'
import {
  ExpressionParseError,
  collectColumnRefs,
  parsePredicate,
  stringifyPredicate,
  validateExpression,
} from './parse'
import { evaluatePredicate } from './evaluate'
import type { ExprColumn } from './expression-columns'
import type { PredicateExpr } from './expression-types'

const columns: ExprColumn[] = [
  { id: 'price', name: 'Unit Price', type: 'number' },
  { id: 'qty', name: 'Qty', type: 'number' },
  { id: 'name', name: 'Name', type: 'text' },
  { id: 'region', name: 'Region', type: 'text' },
]

describe('parsePredicate', () => {
  it('parses a col-vs-literal comparison into a cmp node (grid-filter semantics)', () => {
    const e = parsePredicate('price > 100', columns)
    expect(e).toEqual({ kind: 'cmp', column: 'price', op: 'greaterThan', value: 100 })
  })

  it('resolves [Bracketed Name] references to ids', () => {
    const e = parsePredicate('[Unit Price] >= 50', columns) as Extract<PredicateExpr, { kind: 'scalarCmp' }>
    // >= has no cmp equivalent, so it becomes a scalarCmp over the resolved column id
    expect(e.kind).toBe('scalarCmp')
    expect(e.left).toEqual({ kind: 'col', id: 'price' })
  })

  it('parses keyword text/set/range operators', () => {
    expect(parsePredicate('name CONTAINS "wid"', columns)).toEqual({ kind: 'cmp', column: 'name', op: 'contains', value: 'wid' })
    expect(parsePredicate('region IN ("EU", "US")', columns)).toEqual({ kind: 'cmp', column: 'region', op: 'in', value: ['EU', 'US'] })
    expect(parsePredicate('price BETWEEN 10 AND 20', columns)).toEqual({ kind: 'cmp', column: 'price', op: 'between', value: 10, valueTo: 20 })
    expect(parsePredicate('name ISBLANK', columns)).toEqual({ kind: 'cmp', column: 'name', op: 'isBlank' })
  })

  it('honours AND/OR/NOT precedence and grouping', () => {
    const e = parsePredicate('price > 100 AND (region = "EU" OR region = "US")', columns) as Extract<PredicateExpr, { kind: 'and' }>
    expect(e.kind).toBe('and')
    expect(e.parts[1]!.kind).toBe('or')
  })

  it('parses cross-column scalar maths', () => {
    const e = parsePredicate('price / qty >= 40', columns) as Extract<PredicateExpr, { kind: 'scalarCmp' }>
    expect(e.kind).toBe('scalarCmp')
    expect(e.op).toBe('>=')
    expect(e.left).toEqual({ kind: 'bin', op: '/', left: { kind: 'col', id: 'price' }, right: { kind: 'col', id: 'qty' } })
  })

  it('throws a positioned error on a syntax problem', () => {
    expect(() => parsePredicate('price >', columns)).toThrow(ExpressionParseError)
    try {
      parsePredicate('price @ 5', columns)
    } catch (err) {
      expect(err).toBeInstanceOf(ExpressionParseError)
      expect((err as ExpressionParseError).pos).toBeGreaterThan(0)
    }
  })

  it('parsed expressions evaluate correctly end to end', () => {
    const e = parsePredicate('price > 100 AND region = "EU"', columns)
    expect(evaluatePredicate(e, { row: { price: 120, region: 'EU' } })).toBe(true)
    expect(evaluatePredicate(e, { row: { price: 120, region: 'US' } })).toBe(false)
  })
})

describe('stringifyPredicate', () => {
  it('round-trips through parse for the common forms', () => {
    for (const src of [
      'price > 100',
      'name CONTAINS "wid"',
      'region IN ("EU", "US")',
      'price BETWEEN 10 AND 20',
      'name ISBLANK',
    ]) {
      const ast = parsePredicate(src, columns)
      const back = stringifyPredicate(ast, columns)
      expect(stringifyPredicate(parsePredicate(back, columns), columns)).toBe(back)
    }
  })

  it('writes [bracketed] names when a label has spaces', () => {
    const ast = parsePredicate('price > 100', columns)
    expect(stringifyPredicate(ast, columns)).toBe('[Unit Price] > 100')
  })
})

describe('validateExpression + collectColumnRefs', () => {
  it('collects every referenced column id', () => {
    const ast = parsePredicate('price / qty >= 40 AND region = "EU"', columns)
    expect(collectColumnRefs(ast).sort()).toEqual(['price', 'qty', 'region'])
  })

  it('flags unknown columns and functions', () => {
    const ast = parsePredicate('bogus > 5', columns)
    expect(validateExpression(ast, columns)).toContain('Unknown column "bogus"')
  })

  it('passes a sound expression', () => {
    const ast = parsePredicate('price > 100', columns)
    expect(validateExpression(ast, columns)).toEqual([])
  })
})
