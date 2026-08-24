import { describe, it, expect, beforeAll } from 'vitest'
import { getAdvancedFilterEngine, hasAdvancedFilterEngine } from '@svgrid/grid'
import { enableAdvancedFilter } from './advanced-filter-enable'
import type { PredicateExpr } from './expressions/expression-types'

/**
 * Closes the loop between the three layers.
 *
 * The grid's own tests prove the pipeline behaves correctly given ANY engine;
 * `compile.test.ts` proves the compiler is correct in isolation. This checks
 * the join: that `enableAdvancedFilter()` actually registers something with the
 * grid, and that what it registers compiles a real expression into a working
 * predicate.
 */

type Row = { region: string; amount: number }

const rows: Row[] = [
  { region: 'EMEA', amount: 100 },
  { region: 'EMEA', amount: 900 },
  { region: 'APAC', amount: 400 },
]

const getValue = (row: Row, columnId: string) =>
  (row as unknown as Record<string, unknown>)[columnId]

// Enable once for the whole file. The enabler is idempotent by design (same as
// `enablePivot`), so it deliberately will NOT re-register after something
// unregisters the engine - which means a per-test reset would leave the
// registry empty rather than restoring it.
beforeAll(() => enableAdvancedFilter())

describe('enableAdvancedFilter', () => {
  it('registers an engine with the grid', () => {
    expect(hasAdvancedFilterEngine()).toBe(true)
    expect(typeof getAdvancedFilterEngine()).toBe('function')
  })

  it('registers an engine that compiles a real expression', () => {
    const engine = getAdvancedFilterEngine()!
    const expr: PredicateExpr = { kind: 'cmp', column: 'region', op: 'equals', value: 'EMEA' }

    const predicate = engine(expr as never, { getValue, rows })
    expect(predicate).not.toBeNull()
    expect(rows.filter(predicate!)).toHaveLength(2)
  })

  it('folds an aggregate over the rows it is handed', () => {
    const engine = getAdvancedFilterEngine()!
    // amount > AVG(amount); avg here is 466.67, so only the 900 row survives.
    const expr: PredicateExpr = {
      kind: 'scalarCmp',
      left: { kind: 'col', id: 'amount' },
      op: '>',
      right: { kind: 'agg', fn: 'avg', column: 'amount' },
    }
    const predicate = engine(expr as never, { getValue, rows })!
    expect(rows.filter(predicate).map((r) => r.amount)).toEqual([900])
  })

  it('returns null rather than throwing on a malformed expression', () => {
    const engine = getAdvancedFilterEngine()!
    const junk = { kind: 'not-a-node' } as never
    // The grid treats a null OR a throw as "do not filter", but the contract
    // says never throw - a throw would escape into the row-model derivation.
    expect(() => engine(junk, { getValue, rows })).not.toThrow()
  })

  it('is idempotent', () => {
    const first = getAdvancedFilterEngine()
    enableAdvancedFilter()
    expect(getAdvancedFilterEngine()).toBe(first)
  })
})
