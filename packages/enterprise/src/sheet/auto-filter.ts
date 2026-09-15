/**
 * Excel's AutoFilter: arrows on the header row of a region, each opening a
 * menu of the column's values to tick and untick, or a condition (equals,
 * greater than, contains, between...), and the rows that fail fold away.
 * The rows are hidden through the grid's collapsed rows, kept apart from
 * the rows the user hid by hand so Unhide and the saved document see
 * only those.
 *
 * This module is the pure part: the state, the values a column offers,
 * which rows a state hides, and how the state moves with an insert or
 * delete. Conditions run through the grid's own Excel-filter compiler, so
 * the operator semantics are the ones the grid's filter row has.
 */
import { compileExcelFilter, type ExcelFilterOperator } from '@svgrid/grid/filtering'
import { isError, type CellValue } from './ast'
import type { StructuralEdit } from './refs'
import { shiftRect, lineShift, type Rect } from './rects'

export type FilterCondition = { op: ExcelFilterOperator; value?: string; valueTo?: string }

export type ColumnFilter =
  | { kind: 'values'; /** Display texts left unticked; '' stands for the blanks. */ excluded: string[] }
  | { kind: 'condition'; first: FilterCondition; join?: 'and' | 'or'; second?: FilterCondition }

export type AutoFilterState = {
  /** The region, header row first. */
  range: Rect
  /** Filters by column index; a column absent here shows every row. */
  filters: Record<number, ColumnFilter>
}

export type FilterValue = { text: string; count: number; numeric: number | null }

/** The operators that compare as numbers; the rest compare the display text. */
const NUMERIC_OPS: ReadonlySet<ExcelFilterOperator> = new Set(['greaterThan', 'lessThan', 'between'])

/**
 * The values a column offers, each once with its count: numbers first
 * in order, then text A to Z, the blanks last. `rowVisible` leaves out the
 * rows other columns' filters hide, as Excel's list does.
 */
export function distinctValues(
  state: AutoFilterState,
  col: number,
  valueAt: (r: number, c: number) => CellValue,
  displayAt: (r: number, c: number) => string,
  rowVisible: (r: number) => boolean = () => true,
): FilterValue[] {
  const seen = new Map<string, FilterValue>()
  for (let r = state.range[0] + 1; r <= state.range[2]; r += 1) {
    if (!rowVisible(r)) continue
    const text = displayAt(r, col)
    const v = valueAt(r, col)
    const entry = seen.get(text)
    if (entry) { entry.count += 1; continue }
    seen.set(text, { text, count: 1, numeric: typeof v === 'number' && Number.isFinite(v) ? v : null })
  }
  return [...seen.values()].sort((a, b) => {
    if (a.text === '') return 1
    if (b.text === '') return -1
    if (a.numeric !== null && b.numeric !== null) return a.numeric - b.numeric
    if (a.numeric !== null) return -1
    if (b.numeric !== null) return 1
    return a.text.localeCompare(b.text, undefined, { sensitivity: 'base' })
  })
}

function passesCondition(cond: FilterCondition, value: CellValue, display: string): boolean {
  const test = compileExcelFilter({ id: 'f', operator: cond.op, value: cond.value, valueTo: cond.valueTo })
  if (NUMERIC_OPS.has(cond.op)) {
    if (typeof value !== 'number' || !Number.isFinite(value)) return false
    return test(value)
  }
  if (cond.op === 'isBlank' || cond.op === 'isNotBlank') return test(display === '' ? null : display)
  return test(isError(value) ? value.error : display)
}

/** Whether a row passes one column's filter. */
export function passesFilter(filter: ColumnFilter, value: CellValue, display: string): boolean {
  if (filter.kind === 'values') return !filter.excluded.includes(display)
  const first = passesCondition(filter.first, value, display)
  if (!filter.second) return first
  const second = passesCondition(filter.second, value, display)
  return filter.join === 'or' ? first || second : first && second
}

/**
 * The rows the state hides: every row of the region under the header
 * that fails a column's filter. Blanks past the region's edge are not in
 * it, as Excel's region is what was filtered.
 */
export function hiddenRowsFor(
  state: AutoFilterState | null,
  valueAt: (r: number, c: number) => CellValue,
  displayAt: (r: number, c: number) => string,
): Set<number> {
  const out = new Set<number>()
  if (!state) return out
  const columns = Object.entries(state.filters).map(([c, f]) => [Number(c), f] as const)
  if (!columns.length) return out
  for (let r = state.range[0] + 1; r <= state.range[2]; r += 1) {
    for (const [c, filter] of columns) {
      if (!passesFilter(filter, valueAt(r, c), displayAt(r, c))) { out.add(r); break }
    }
  }
  return out
}

/** Whether any column is filtered. */
export function isFiltering(state: AutoFilterState | null): boolean {
  return !!state && Object.keys(state.filters).length > 0
}

/** The state with one column's filter set, or cleared with null. */
export function withColumnFilter(state: AutoFilterState, col: number, filter: ColumnFilter | null): AutoFilterState {
  const filters = { ...state.filters }
  if (filter === null) delete filters[col]
  else filters[col] = filter
  return { range: state.range, filters }
}

/** A values filter from the ticked list, or null when everything is ticked. */
export function valuesFilter(all: ReadonlyArray<string>, ticked: ReadonlySet<string>): ColumnFilter | null {
  const excluded = all.filter((text) => !ticked.has(text))
  return excluded.length ? { kind: 'values', excluded } : null
}

/** The state after an insert or delete: the region moves, the filters follow their columns. */
export function shiftAutoFilter(state: AutoFilterState | null, edit: StructuralEdit): AutoFilterState | null {
  if (!state) return null
  const range = shiftRect(state.range, edit)
  if (!range) return null
  if (edit.kind === 'insertRows' || edit.kind === 'deleteRows') return { range, filters: { ...state.filters } }
  const shift = lineShift(edit)
  const filters: Record<number, ColumnFilter> = {}
  for (const [c, f] of Object.entries(state.filters)) {
    const next = shift(Number(c))
    if (next !== null) filters[next] = f
  }
  return { range, filters }
}

const OP_WORDS: Partial<Record<ExcelFilterOperator, string>> = {
  equals: 'equals', notEquals: 'does not equal', greaterThan: 'is greater than', lessThan: 'is less than',
  between: 'is between', contains: 'contains', notContains: 'does not contain', startsWith: 'begins with',
  endsWith: 'ends with', isBlank: 'is blank', isNotBlank: 'is not blank',
}

/** A filter in words, for the menu's heading. */
export function describeFilter(filter: ColumnFilter): string {
  if (filter.kind === 'values') return filter.excluded.length === 1 ? '1 value hidden' : `${filter.excluded.length} values hidden`
  const one = (c: FilterCondition) => {
    const word = OP_WORDS[c.op] ?? c.op
    if (c.op === 'isBlank' || c.op === 'isNotBlank') return word
    return c.op === 'between' ? `${word} ${c.value ?? ''} and ${c.valueTo ?? ''}` : `${word} ${c.value ?? ''}`
  }
  return filter.second ? `${one(filter.first)} ${filter.join ?? 'and'} ${one(filter.second)}` : one(filter.first)
}
