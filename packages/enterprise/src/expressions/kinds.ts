/**
 * Condition kinds from other modules: the `ext` node of a predicate.
 *
 * The expression language compares cell values with the grid filter's
 * operators. A module whose fields mean more than their raw values (SvGrid
 * Base: a select's option, a person, a linked record shown by name, "within
 * the past week") registers its own condition kind here, and an `ext` node
 * names it: `{ kind: 'ext', type: 'fieldFilter', payload }`. Alerts, the
 * advanced filter and anything else that compiles predicates then evaluate
 * it with that module's own semantics, with no second language for users.
 */

/** What a registered kind needs to evaluate its payload. */
export type PredicateKindContext<TRow> = {
  /** A row's value for a column (computed fields included). */
  getValue: (row: TRow, columnId: string) => unknown
  locale?: string | ReadonlyArray<string>
}

export type PredicateKind = {
  /** The payload as a row test, or null when it cannot test anything (an empty condition). */
  compile: <TRow>(payload: unknown, ctx: PredicateKindContext<TRow>) => ((row: TRow) => boolean) | null
  /** Short words for the condition, where it is shown as text ("Status is Done"). */
  describe?: (payload: unknown, columnName: (columnId: string) => string) => string
  /** The columns the payload reads: alerts pick the column a message names from these. */
  columns?: (payload: unknown) => string[]
}

const kinds = new Map<string, PredicateKind>()

/** Teach the expression language a condition kind (one per type; a second call replaces it). */
export function registerPredicateKind(type: string, kind: PredicateKind): void {
  kinds.set(type, kind)
}

export function getPredicateKind(type: string): PredicateKind | undefined {
  return kinds.get(type)
}
