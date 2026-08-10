import { describe, expect, it } from 'vitest'
import { evaluatePredicate, evaluateScalar, evaluateChange } from './evaluate'
import type { ChangeExpr, EvalContext, PredicateExpr, ScalarExpr } from './expression-types'

type Row = { price: number; qty: number; name: string; region: string }

const row: Row = { price: 120, qty: 3, name: 'Widget', region: 'EU' }
const ctx = (r: Row, extra: Partial<EvalContext<Row>> = {}): EvalContext<Row> => ({ row: r, ...extra })

describe('evaluateScalar', () => {
  it('reads columns, literals and arithmetic', () => {
    const total: ScalarExpr = { kind: 'bin', op: '*', left: { kind: 'col', id: 'price' }, right: { kind: 'col', id: 'qty' } }
    expect(evaluateScalar(total, ctx(row))).toBe(360)
    expect(evaluateScalar({ kind: 'lit', value: 5 }, ctx(row))).toBe(5)
    expect(evaluateScalar({ kind: 'neg', expr: { kind: 'col', id: 'price' } }, ctx(row))).toBe(-120)
  })

  it('concatenates strings with +', () => {
    const e: ScalarExpr = { kind: 'bin', op: '+', left: { kind: 'col', id: 'name' }, right: { kind: 'lit', value: '!' } }
    expect(evaluateScalar(e, ctx(row))).toBe('Widget!')
  })

  it('guards divide by zero', () => {
    const e: ScalarExpr = { kind: 'bin', op: '/', left: { kind: 'lit', value: 10 }, right: { kind: 'lit', value: 0 } }
    expect(Number.isNaN(evaluateScalar(e, ctx(row)) as number)).toBe(true)
  })

  it('runs built-in functions', () => {
    expect(evaluateScalar({ kind: 'func', name: 'ABS', args: [{ kind: 'lit', value: -7 }] }, ctx(row))).toBe(7)
    expect(evaluateScalar({ kind: 'func', name: 'ROUND', args: [{ kind: 'lit', value: 3.14159 }, { kind: 'lit', value: 2 }] }, ctx(row))).toBe(3.14)
  })

  it('aggregates over the row set in scope', () => {
    const rows: Row[] = [row, { ...row, price: 80 }, { ...row, price: 40 }]
    const sum: ScalarExpr = { kind: 'agg', fn: 'sum', column: 'price' }
    expect(evaluateScalar(sum, ctx(row, { rows }))).toBe(240)
    expect(evaluateScalar({ kind: 'agg', fn: 'avg', column: 'price' }, ctx(row, { rows }))).toBe(80)
    expect(evaluateScalar({ kind: 'agg', fn: 'count', column: 'price' }, ctx(row, { rows }))).toBe(3)
  })
})

describe('evaluatePredicate', () => {
  it('cmp delegates to applyExcelFilter semantics', () => {
    const gt: PredicateExpr = { kind: 'cmp', column: 'price', op: 'greaterThan', value: 100 }
    expect(evaluatePredicate(gt, ctx(row))).toBe(true)
    expect(evaluatePredicate(gt, ctx({ ...row, price: 50 }))).toBe(false)

    const contains: PredicateExpr = { kind: 'cmp', column: 'name', op: 'contains', value: 'idge' }
    expect(evaluatePredicate(contains, ctx(row))).toBe(true)

    const inSet: PredicateExpr = { kind: 'cmp', column: 'region', op: 'in', value: ['EU', 'US'] }
    expect(evaluatePredicate(inSet, ctx(row))).toBe(true)
    expect(evaluatePredicate(inSet, ctx({ ...row, region: 'APAC' }))).toBe(false)
  })

  it('combines with and/or/not', () => {
    const expr: PredicateExpr = {
      kind: 'and',
      parts: [
        { kind: 'cmp', column: 'price', op: 'greaterThan', value: 100 },
        { kind: 'not', expr: { kind: 'cmp', column: 'region', op: 'equals', value: 'US' } },
      ],
    }
    expect(evaluatePredicate(expr, ctx(row))).toBe(true)
    expect(evaluatePredicate(expr, ctx({ ...row, region: 'US' }))).toBe(false)
  })

  it('scalarCmp compares cross-column maths', () => {
    // price / qty >= 40  -> 120/3 = 40 -> true
    const expr: PredicateExpr = {
      kind: 'scalarCmp',
      left: { kind: 'bin', op: '/', left: { kind: 'col', id: 'price' }, right: { kind: 'col', id: 'qty' } },
      op: '>=',
      right: { kind: 'lit', value: 40 },
    }
    expect(evaluatePredicate(expr, ctx(row))).toBe(true)
    expect(evaluatePredicate(expr, ctx({ ...row, qty: 4 }))).toBe(false)
  })
})

describe('evaluateChange', () => {
  const change = (e: ChangeExpr, prev: Row, next: Row) => evaluateChange(e, ctx(next, { prev }))

  it('detects a bare change', () => {
    expect(change({ kind: 'changed', column: 'price' }, row, { ...row, price: 121 })).toBe(true)
    expect(change({ kind: 'changed', column: 'price' }, row, { ...row })).toBe(false)
  })

  it('returns false with no prior snapshot', () => {
    expect(evaluateChange({ kind: 'changed', column: 'price' }, ctx(row))).toBe(false)
  })

  it('tests absolute delta', () => {
    const e: ChangeExpr = { kind: 'delta', column: 'price', op: '>', value: 10, abs: true }
    expect(change(e, row, { ...row, price: 140 })).toBe(true)
    expect(change(e, row, { ...row, price: 100 })).toBe(true) // abs of -20
    expect(change(e, row, { ...row, price: 125 })).toBe(false)
  })

  it('tests percent change', () => {
    const e: ChangeExpr = { kind: 'percentChange', column: 'price', op: '>', value: 5, abs: true }
    expect(change(e, row, { ...row, price: 132 })).toBe(true) // +10%
    expect(change(e, row, { ...row, price: 123 })).toBe(false) // +2.5%
  })

  it('detects threshold crossing', () => {
    const above: ChangeExpr = { kind: 'crossed', column: 'price', threshold: 130, direction: 'above' }
    expect(change(above, row, { ...row, price: 135 })).toBe(true)
    expect(change(above, { ...row, price: 131 }, { ...row, price: 140 })).toBe(false) // already above
  })
})
