/**
 * Expression / query language - the model layer.
 *
 * A tiny, dependency-free expression language that end users author through the
 * grid UI. It is the connective tissue behind the Alert Rules engine (and, in
 * time, styled columns and calculated columns): one predicate/scalar/change
 * model, evaluated the same way everywhere.
 *
 * The canonical, persisted form is a JSON AST (the types below) - no parser on
 * the hot path. A light tokenizer/parser (`parse.ts`) is offered only for the
 * editor's free-text mode; the structured builder writes the AST directly.
 *
 * Leaf comparisons delegate to the grid's own `applyExcelFilter`, so a rule's
 * "greater than" is byte-for-byte the grid filter's "greater than".
 */
import type { ExcelFilterOperator } from '@svgrid/grid'

/** Symbolic comparison operators used by `scalarCmp` (general value compare). */
export type ComparisonOp = '=' | '!=' | '>' | '<' | '>=' | '<='

/** Arithmetic operators for `bin` scalar nodes. */
export type ArithmeticOp = '+' | '-' | '*' | '/' | '%'

/** Column aggregate reducers (evaluated over the row set in scope). */
export type AggFn = 'sum' | 'avg' | 'min' | 'max' | 'count'

/**
 * A scalar expression - evaluates to a single value (number / string /
 * boolean / null) for a given row (and, for aggregates, the row set).
 */
export type ScalarExpr =
  | { kind: 'col'; id: string }
  | { kind: 'lit'; value: string | number | boolean | null }
  | { kind: 'neg'; expr: ScalarExpr }
  | { kind: 'bin'; op: ArithmeticOp; left: ScalarExpr; right: ScalarExpr }
  | { kind: 'agg'; fn: AggFn; column: string }
  | { kind: 'func'; name: string; args: ScalarExpr[] }

/**
 * A boolean (predicate) expression - the thing an alert rule / filter needs.
 *
 * - `cmp` maps straight onto the grid's `applyExcelFilter` (text/set/range ops).
 * - `scalarCmp` compares two scalar expressions with a symbolic operator, so
 *   cross-column maths (`[filled] / [target] >= 0.9`) is expressible.
 */
export type PredicateExpr =
  | { kind: 'and'; parts: PredicateExpr[] }
  | { kind: 'or'; parts: PredicateExpr[] }
  | { kind: 'not'; expr: PredicateExpr }
  | { kind: 'cmp'; column: string; op: ExcelFilterOperator; value?: unknown; valueTo?: unknown }
  | { kind: 'scalarCmp'; left: ScalarExpr; op: ComparisonOp; right: ScalarExpr }
  | { kind: 'const'; value: boolean }

/**
 * A change (observable) expression - true when a value moves between the
 * previous and current snapshot of a row. Powers "relative change" alerts.
 */
export type ChangeExpr =
  | { kind: 'changed'; column: string }
  | { kind: 'delta'; column: string; op: ComparisonOp; value: number; abs?: boolean }
  | { kind: 'percentChange'; column: string; op: ComparisonOp; value: number; abs?: boolean }
  | { kind: 'crossed'; column: string; threshold: number; direction: 'above' | 'below' }

/** The shape the evaluator reads rows as (a plain field bag by default). */
export type ExprRow = Record<string, unknown>

/**
 * Everything the evaluator needs for one evaluation. `getValue` lets a caller
 * resolve a column id to a value when it is not a plain `row[id]` field;
 * `functions` injects extra scalar functions (e.g. delegate to HyperFormula).
 */
export type EvalContext<TData = ExprRow> = {
  row: TData
  /** Prior snapshot of the same row - required by `ChangeExpr`. */
  prev?: TData
  /** The row set in scope - required by aggregates. Defaults to `[row]`. */
  rows?: ReadonlyArray<TData>
  /** Resolve a column id to its cell value. Defaults to `row[id]`. */
  getValue?: (row: TData, columnId: string) => unknown
  /** BCP-47 locale(s) threaded into `applyExcelFilter` for text folding. */
  locale?: string | ReadonlyArray<string>
  /** Extra scalar functions by upper-case name, merged over the builtins. */
  functions?: Record<string, (args: Array<number | string | boolean | null>) => number | string | boolean | null>
}
