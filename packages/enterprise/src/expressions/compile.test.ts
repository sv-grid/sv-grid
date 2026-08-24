import { describe, it, expect } from 'vitest'
import { compilePredicate } from './compile'
import { evaluatePredicate } from './evaluate'
import type { PredicateExpr } from './expression-types'

/**
 * The compiler's correctness is defined as "agrees with the evaluator".
 *
 * `evaluate.ts` is the reference implementation and is exercised by its own
 * suite; rather than restate every operator's semantics here, these tests run
 * both over the same corpus and assert identical results row by row. If the
 * compiler ever diverges - a hoisted value captured wrongly, an aggregate
 * folded over the wrong set - this catches it without anyone having to predict
 * the failure mode.
 */

type Row = {
  id: string
  name: string
  region: string
  amount: number
  score: number
  note: string | null
}

const rows: Row[] = [
  { id: 'a', name: 'Ada',   region: 'EMEA',     amount: 100, score: 10, note: 'alpha' },
  { id: 'b', name: 'Brian', region: 'EMEA',     amount: 250, score: 42, note: '' },
  { id: 'c', name: 'Chen',  region: 'APAC',     amount: 900, score: 42, note: null },
  { id: 'd', name: 'Dara',  region: 'APAC',     amount: 250, score: 7,  note: 'delta' },
  { id: 'e', name: 'Émile', region: 'Americas', amount: 0,   score: 99, note: 'Emile' },
  { id: 'f', name: 'Fay',   region: 'Americas', amount: -50, score: 0,  note: '  ' },
]

const getValue = (row: Row, columnId: string) => (row as never as Record<string, unknown>)[columnId]

const cmp = (column: string, op: string, value?: unknown, valueTo?: unknown): PredicateExpr =>
  ({ kind: 'cmp', column, op, value, valueTo }) as PredicateExpr

const corpus: PredicateExpr[] = [
  { kind: 'const', value: true },
  { kind: 'const', value: false },

  // Text operators, including the folding cases.
  cmp('name', 'contains', 'a'),
  cmp('name', 'contains', 'É'),
  cmp('name', 'contains', 'e'),
  cmp('name', 'notContains', 'a'),
  cmp('name', 'notContains', ''),
  cmp('region', 'equals', 'EMEA'),
  cmp('region', 'notEquals', 'EMEA'),
  cmp('region', 'notEquals', ''),
  cmp('name', 'startsWith', 'A'),
  cmp('name', 'endsWith', 'n'),
  cmp('name', 'regex', '^[AB]'),
  cmp('name', 'regex', '('),
  cmp('name', 'regex', ''),

  // Set operators.
  cmp('region', 'in', 'EMEA, APAC'),
  cmp('region', 'notIn', 'EMEA, APAC'),
  cmp('region', 'in', ''),

  // Numeric + range.
  cmp('amount', 'greaterThan', 100),
  cmp('amount', 'lessThan', 100),
  cmp('amount', 'between', 0, 250),
  cmp('amount', 'between', '0', '250'),
  cmp('score', 'equals', 42),

  // Blankness.
  cmp('note', 'isBlank'),
  cmp('note', 'isNotBlank'),

  // Boolean composition.
  { kind: 'and', parts: [cmp('region', 'equals', 'EMEA'), cmp('amount', 'greaterThan', 100)] },
  { kind: 'or', parts: [cmp('region', 'equals', 'APAC'), cmp('score', 'greaterThan', 90)] },
  { kind: 'not', expr: cmp('region', 'equals', 'EMEA') },
  { kind: 'and', parts: [] },
  { kind: 'or', parts: [] },
  {
    kind: 'not',
    expr: { kind: 'or', parts: [cmp('region', 'equals', 'EMEA'), cmp('amount', 'lessThan', 0)] },
  },

  // Cross-column comparison and arithmetic.
  { kind: 'scalarCmp', left: { kind: 'col', id: 'amount' }, op: '>', right: { kind: 'col', id: 'score' } },
  {
    kind: 'scalarCmp',
    left: { kind: 'bin', op: '*', left: { kind: 'col', id: 'score' }, right: { kind: 'lit', value: 2 } },
    op: '>=',
    right: { kind: 'lit', value: 84 },
  },
  {
    kind: 'scalarCmp',
    left: { kind: 'neg', expr: { kind: 'col', id: 'amount' } },
    op: '>',
    right: { kind: 'lit', value: 0 },
  },
  {
    kind: 'scalarCmp',
    left: { kind: 'func', name: 'UPPER', args: [{ kind: 'col', id: 'region' }] },
    op: '=',
    right: { kind: 'lit', value: 'EMEA' },
  },
  {
    kind: 'scalarCmp',
    left: { kind: 'func', name: 'NOPE', args: [] },
    op: '=',
    right: { kind: 'lit', value: 1 },
  },

  // Aggregates - the O(N^2) case the compiler folds.
  {
    kind: 'scalarCmp',
    left: { kind: 'col', id: 'amount' },
    op: '>',
    right: { kind: 'agg', fn: 'avg', column: 'amount' },
  },
  {
    kind: 'scalarCmp',
    left: { kind: 'agg', fn: 'sum', column: 'amount' },
    op: '>',
    right: { kind: 'lit', value: 1000 },
  },
  {
    kind: 'scalarCmp',
    left: { kind: 'agg', fn: 'count', column: 'amount' },
    op: '=',
    right: { kind: 'lit', value: 6 },
  },
  {
    kind: 'scalarCmp',
    left: { kind: 'col', id: 'amount' },
    op: '=',
    right: { kind: 'agg', fn: 'max', column: 'amount' },
  },
  {
    kind: 'scalarCmp',
    left: { kind: 'col', id: 'amount' },
    op: '=',
    right: { kind: 'agg', fn: 'min', column: 'amount' },
  },
  // An aggregate over a column with no numeric values at all.
  {
    kind: 'scalarCmp',
    left: { kind: 'agg', fn: 'sum', column: 'name' },
    op: '=',
    right: { kind: 'lit', value: 0 },
  },
  {
    kind: 'scalarCmp',
    left: { kind: 'agg', fn: 'avg', column: 'name' },
    op: '=',
    right: { kind: 'lit', value: 0 },
  },
]

describe('compilePredicate agrees with evaluatePredicate', () => {
  it.each(corpus.map((expr, i) => [i, expr] as const))(
    'expression #%i matches the evaluator on every row',
    (_i, expr) => {
      const compiled = compilePredicate(expr, { getValue, rows })
      expect(compiled).not.toBeNull()
      for (const row of rows) {
        expect(compiled!(row)).toBe(evaluatePredicate(expr, { row, rows, getValue }))
      }
    },
  )
})

describe('aggregate folding', () => {
  it('reads the row set once regardless of row count', () => {
    let reads = 0
    const counting = (row: Row, columnId: string) => {
      reads += 1
      return getValue(row, columnId)
    }
    const expr: PredicateExpr = {
      kind: 'scalarCmp',
      left: { kind: 'col', id: 'amount' },
      op: '>',
      right: { kind: 'agg', fn: 'avg', column: 'amount' },
    }
    const compiled = compilePredicate(expr, { getValue: counting, rows })!
    const afterCompile = reads
    // Compilation folds the aggregate: one read per row, once.
    expect(afterCompile).toBe(rows.length)

    for (const row of rows) compiled(row)
    // Each row then costs a single `amount` read - no rescan of the row set.
    expect(reads - afterCompile).toBe(rows.length)
  })

  it('does not scan rows at all when there is no aggregate', () => {
    let reads = 0
    const counting = (row: Row, columnId: string) => {
      reads += 1
      return getValue(row, columnId)
    }
    compilePredicate(cmp('region', 'equals', 'EMEA'), { getValue: counting, rows })
    expect(reads).toBe(0)
  })

  it('stays linear as the row count grows', () => {
    const big = Array.from({ length: 4000 }, (_, i) => ({
      ...rows[i % rows.length]!,
      id: String(i),
      amount: i,
    }))
    const expr: PredicateExpr = {
      kind: 'scalarCmp',
      left: { kind: 'col', id: 'amount' },
      op: '>',
      right: { kind: 'agg', fn: 'avg', column: 'amount' },
    }
    let reads = 0
    const counting = (row: Row, columnId: string) => {
      reads += 1
      return getValue(row, columnId)
    }
    const compiled = compilePredicate(expr, { getValue: counting, rows: big })!
    for (const row of big) compiled(row)
    // 2N, not N^2. The evaluator would be ~16,000,000 reads here.
    expect(reads).toBe(big.length * 2)
  })
})

describe('robustness', () => {
  it('returns a predicate that matches nothing for an unknown node kind', () => {
    const weird = { kind: 'nonsense' } as unknown as PredicateExpr
    const compiled = compilePredicate(weird, { getValue, rows })
    expect(compiled).not.toBeNull()
    expect(rows.filter(compiled!)).toEqual([])
  })

  it('never throws on a malformed scalar node', () => {
    const weird = {
      kind: 'scalarCmp',
      left: { kind: 'bogus' },
      op: '=',
      right: { kind: 'lit', value: 1 },
    } as unknown as PredicateExpr
    expect(() => {
      const c = compilePredicate(weird, { getValue, rows })
      if (c) rows.forEach(c)
    }).not.toThrow()
  })
})
