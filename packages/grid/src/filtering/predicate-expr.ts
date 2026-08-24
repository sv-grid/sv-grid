/**
 * The advanced-filter expression shape, as the free grid sees it.
 *
 * This is a structural mirror of `@svgrid/enterprise`'s `PredicateExpr`. It is
 * written here, in MIT code, against the grid's own operator union - the same
 * arrangement `GridPivotConfig` uses so the free package can type a commercial
 * feature's payload without depending on the commercial package.
 *
 * The two definitions must stay assignable in both directions. A bidirectional
 * assignability test in `@svgrid/enterprise` fails `pnpm test:types` the moment
 * either side drifts, so this is a checked mirror rather than a hopeful one.
 *
 * The grid never interprets these nodes. It hands the whole expression to the
 * engine registered via `registerAdvancedFilterEngine`, which compiles it. That
 * keeps the evaluator, the parser and the editor commercial.
 */
import type { ExcelFilterOperator } from './excel-filters.js'

/** Comparison operators available to a cross-column (`scalarCmp`) node. */
export type GridComparisonOp = '=' | '!=' | '>' | '<' | '>=' | '<='

/** Arithmetic operators available inside a scalar expression. */
export type GridArithmeticOp = '+' | '-' | '*' | '/' | '%'

/** Aggregate functions available inside a scalar expression. */
export type GridAggFn = 'sum' | 'avg' | 'min' | 'max' | 'count'

/** A value-producing expression: a column, a literal, or maths over them. */
export type GridScalarExpr =
  | { kind: 'col'; id: string }
  | { kind: 'lit'; value: string | number | boolean | null }
  | { kind: 'neg'; expr: GridScalarExpr }
  | { kind: 'bin'; op: GridArithmeticOp; left: GridScalarExpr; right: GridScalarExpr }
  | { kind: 'agg'; fn: GridAggFn; column: string }
  | { kind: 'func'; name: string; args: GridScalarExpr[] }

/**
 * A boolean expression over a row.
 *
 * `cmp` is deliberately isomorphic to one column-menu filter condition: its
 * `op` is the same `ExcelFilterOperator` the filter row uses, so a simple
 * advanced filter and a column filter mean exactly the same thing.
 */
export type GridPredicateExpr =
  | { kind: 'and'; parts: GridPredicateExpr[] }
  | { kind: 'or'; parts: GridPredicateExpr[] }
  | { kind: 'not'; expr: GridPredicateExpr }
  | { kind: 'cmp'; column: string; op: ExcelFilterOperator; value?: unknown; valueTo?: unknown }
  | { kind: 'scalarCmp'; left: GridScalarExpr; op: GridComparisonOp; right: GridScalarExpr }
  | { kind: 'const'; value: boolean }
