/**
 * The canonical filter-operator catalogue: which operators exist, and the
 * semantics every surface must agree on.
 *
 * Deliberately narrow. Two things live here:
 *
 *   1. `ALL_FILTER_OPERATORS` - the operator identity list, so a new operator
 *      cannot be added to one surface and silently missed by another.
 *   2. The input-shape predicates - whether an operator takes no value, a
 *      token list, or a second value. Get these wrong and a filter UI renders
 *      the wrong control, so they cannot be allowed to diverge.
 *
 * What deliberately does NOT live here: labels, ordering, and which operators
 * a given column type offers. Those are presentation choices that legitimately
 * differ per surface - the grid's filter menu leads with "Contains" for text
 * while the expression editor leads with "Equals", and both are right for
 * their context.
 *
 * Zero imports beyond the operator union, so any package can consume this
 * without pulling in the grid's type graph.
 */
import type { ExcelFilterOperator } from './excel-filters'

/** Coarse value type used to decide which operators a column offers. */
export type FilterValueType = 'text' | 'number' | 'date' | 'datetime' | 'boolean'

/**
 * Every filter operator, in the grid's filter-menu order. Any surface that
 * presents operators should be able to account for all of these.
 */
export const ALL_FILTER_OPERATORS: ReadonlyArray<ExcelFilterOperator> = [
  'contains',
  'notContains',
  'equals',
  'notEquals',
  'startsWith',
  'endsWith',
  'regex',
  'in',
  'notIn',
  'greaterThan',
  'lessThan',
  'between',
  'isBlank',
  'isNotBlank',
]

/** Operators whose predicate is a set-membership test over a token list.
 *  A filter UI renders a multi-value chip input for these. */
export const SET_OPERATOR_IDS: ReadonlyArray<ExcelFilterOperator> = ['in', 'notIn']

/** Operators that need no value input - they act on emptiness alone. */
export const VALUELESS_OPERATOR_IDS: ReadonlyArray<ExcelFilterOperator> = [
  'isBlank',
  'isNotBlank',
]

/** Operators that need a second value (`valueTo`). */
export const RANGE_OPERATOR_IDS: ReadonlyArray<ExcelFilterOperator> = ['between']

/** Whether an operator takes a multi-value token list. */
export function isSetOperator(op: ExcelFilterOperator): boolean {
  return SET_OPERATOR_IDS.includes(op)
}

/** Whether an operator needs no value input. */
export function isValuelessOperator(op: ExcelFilterOperator): boolean {
  return VALUELESS_OPERATOR_IDS.includes(op)
}

/** Whether an operator needs a second (`valueTo`) value. */
export function isRangeOperator(op: ExcelFilterOperator): boolean {
  return RANGE_OPERATOR_IDS.includes(op)
}
