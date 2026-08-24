/**
 * Registration seam for the advanced filter (a `@svgrid/enterprise` feature).
 *
 * The grid owns the state and the pipeline slot; enterprise owns the compiler.
 * Same shape as `pivot-view.svelte.ts`: a module-level `$state` holder with a
 * register / get / has triple, so the free package carries no commercial code.
 */
import type { GridPredicateExpr } from './filtering/predicate-expr'

/** What the engine needs in order to compile an expression into a predicate. */
export type AdvancedFilterCompileContext<TRow> = {
  /**
   * Resolve a column id to its cell value for a row. The grid passes the same
   * accessor the column-menu filter stage uses, so a `cmp` on a `fieldFn` or
   * value-getter column resolves identically in both.
   */
  getValue: (row: TRow, columnId: string) => unknown
  /** Locale for text folding, matching the column filters. */
  locale?: string | ReadonlyArray<string>
  /**
   * The rows entering this stage. Aggregates (`SUM(amount) > 1000`) are folded
   * over exactly these, once, so they see the rows the user is currently
   * looking at rather than the raw dataset.
   */
  rows: ReadonlyArray<TRow>
}

/** A compiled expression: cheap to call once per row. */
export type CompiledRowPredicate<TRow> = (row: TRow) => boolean

/**
 * Compile an expression to a row predicate.
 *
 * Returns `null` when the expression cannot be compiled (an unknown node kind,
 * an unresolvable column). Must never throw: the grid treats both `null` and a
 * thrown error as "do not filter", because a half-applied filter silently
 * showing the wrong rows is worse than an unapplied one.
 */
export type AdvancedFilterEngine = <TRow>(
  expr: GridPredicateExpr,
  ctx: AdvancedFilterCompileContext<TRow>,
) => CompiledRowPredicate<TRow> | null

let engine = $state<AdvancedFilterEngine | null>(null)

/** Register the engine. Enterprise calls this from `enableAdvancedFilter()`. */
export function registerAdvancedFilterEngine(fn: AdvancedFilterEngine | null): void {
  engine = fn
}

/** The registered engine, or null when enterprise is not installed. */
export function getAdvancedFilterEngine(): AdvancedFilterEngine | null {
  return engine
}

/** Whether an advanced-filter engine has been registered. */
export function hasAdvancedFilterEngine(): boolean {
  return engine != null
}
