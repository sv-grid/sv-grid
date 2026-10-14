/**
 * A base condition in the expression language: the view bar's filter, kept as
 * `{ kind: 'ext', type: 'fieldFilter', payload }`, so an alert rule or an
 * advanced filter reads a select's option, a person, a linked record's name
 * or "within the past week" the way the view bar does. Also the readers that
 * give a field's value and its text outside the grid.
 */
import { registerPredicateKind } from '../expressions/kinds'
import type { PredicateExpr } from '../expressions/expression-types'
import { compileFieldFilter, describeFieldFilter, fieldFilterColumns, type FieldFilter, type LinkNames } from './filter-model'
import type { FieldColumn } from './grid-access'
import { getLinkedTable, linkedRows } from './sources.svelte'

/** A link value's records by name, for a condition on a link field. */
export const linkNames: LinkNames = (table, value) => {
  const t = getLinkedTable(table)
  return t ? linkedRows(t, value).map((r) => String(r[t.primaryField] ?? '')) : []
}

const EMPTY: FieldFilter = { kind: 'fieldFilter', conjunction: 'and', conditions: [] }
const asFilter = (payload: unknown): FieldFilter => {
  const f = payload as Partial<FieldFilter> | null
  return f && Array.isArray(f.conditions) ? { ...EMPTY, ...f, kind: 'fieldFilter' } : EMPTY
}

/**
 * A rule condition written as a base filter.
 *
 * ```ts
 * predicate: baseCondition({ conjunction: 'and', conditions: [
 *   { column: 'due', kind: 'date', op: 'isBefore', value: { mode: 'today' } },
 *   { column: 'status', kind: 'select', op: 'isNot', value: 'Done' },
 * ] })
 * ```
 */
export function baseCondition(filter: Omit<FieldFilter, 'kind'> | FieldFilter): PredicateExpr {
  return { kind: 'ext', type: 'fieldFilter', payload: { ...filter, kind: 'fieldFilter' } }
}

/** The base filter inside a predicate, or null when the predicate is something else. */
export function baseFilterOf(expr: PredicateExpr | null | undefined): FieldFilter | null {
  return expr?.kind === 'ext' && expr.type === 'fieldFilter' ? asFilter(expr.payload) : null
}

let registered = false

/** Teach the expression language the base filter (once; `enableFields` calls it). */
export function registerBaseCondition(): void {
  if (registered) return
  registered = true
  registerPredicateKind('fieldFilter', {
    compile: (payload, ctx) => compileFieldFilter(asFilter(payload), ctx.getValue, linkNames),
    describe: (payload, name) => describeFieldFilter(asFilter(payload), name),
    columns: (payload) => fieldFilterColumns(asFilter(payload)),
  })
}

/** A field's value in a record: computed for a formula, lookup, rollup or count. */
export function fieldValue(column: FieldColumn, row: Record<string, unknown>): unknown {
  const fn = column.def.fieldFn as ((r: Record<string, unknown>) => unknown) | undefined
  return fn ? fn(row) : row?.[column.field]
}

/** A field's value as its cell shows it, as text. */
export function fieldText(column: FieldColumn, row: Record<string, unknown>): string {
  const value = fieldValue(column, row)
  const fmt = column.def.formatter as ((c: { value: unknown; row: unknown; column: unknown }) => unknown) | undefined
  if (fmt) return String(fmt({ value, row, column: { id: column.id, columnDef: column.def } }) ?? '')
  if (Array.isArray(value)) return value.join(', ')
  return value == null ? '' : String(value)
}
