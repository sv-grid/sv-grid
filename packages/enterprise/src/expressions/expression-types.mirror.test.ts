import { describe, it, expect } from 'vitest'
import type { GridPredicateExpr, GridScalarExpr } from '@svgrid/grid'
import type { PredicateExpr, ScalarExpr } from './expression-types'

/**
 * `@svgrid/grid` carries a structural MIRROR of this package's expression AST
 * (`GridPredicateExpr`), so the free grid can type the advanced-filter payload
 * without depending on the commercial package.
 *
 * Two definitions of the same shape only stay in step if something checks. The
 * assignments below are the check: they are compile-time only, and they fail
 * `svelte-check` / `tsc` the moment either side gains, loses or renames a node
 * kind or field. The runtime assertion just keeps vitest from reporting an
 * empty test file.
 */
describe('grid AST mirror', () => {
  it('is assignable in both directions', () => {
    // Enterprise -> grid. Fails if enterprise adds a node the grid lacks.
    const toGrid: GridPredicateExpr = null as unknown as PredicateExpr
    // Grid -> enterprise. Fails if the grid's mirror drifts ahead.
    const fromGrid: PredicateExpr = null as unknown as GridPredicateExpr
    const scalarToGrid: GridScalarExpr = null as unknown as ScalarExpr
    const scalarFromGrid: ScalarExpr = null as unknown as GridScalarExpr

    expect([toGrid, fromGrid, scalarToGrid, scalarFromGrid]).toHaveLength(4)
  })
})
