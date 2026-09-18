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
import { dateValue } from './validation'

export type FilterCondition = { op: ExcelFilterOperator; value?: string; valueTo?: string }

/** Excel's Date Filters: a period around today, or a bound typed as a date. */
export type DatePeriod =
  | 'equals' | 'before' | 'after' | 'between'
  | 'tomorrow' | 'today' | 'yesterday'
  | 'nextWeek' | 'thisWeek' | 'lastWeek'
  | 'nextMonth' | 'thisMonth' | 'lastMonth'
  | 'nextQuarter' | 'thisQuarter' | 'lastQuarter'
  | 'nextYear' | 'thisYear' | 'lastYear' | 'yearToDate'

export type ColumnFilter =
  | { kind: 'values'; /** Display texts left unticked; '' stands for the blanks. */ excluded: string[] }
  | { kind: 'condition'; first: FilterCondition; join?: 'and' | 'or'; second?: FilterCondition }
  /** A date period; `value` and `valueTo` are `yyyy-mm-dd` for the typed bounds. */
  | { kind: 'date'; period: DatePeriod; value?: string; valueTo?: string }
  /** Excel's Filter by Color: the cell's fill, or null for the cells with none. */
  | { kind: 'color'; fill: string | null }
  /** Excel's Top 10: the `count` largest (or smallest) values, or that percent of the rows. */
  | { kind: 'top'; top: boolean; count: number; percent?: boolean }

/** What a filter reads beside the cell's value and text. */
export type FilterContext = {
  /** The cell's fill, its own or a conditional format's; null when none. */
  fillAt?: (r: number, c: number) => string | null
  /** The day the date periods count from. */
  today?: Date
}

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

const DAY_MS = 86400000
const dayStart = (d: Date): number => Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())

/**
 * The first and last day of a period, as UTC day-start milliseconds,
 * counted from `today`. Weeks run Sunday to Saturday; quarters are the
 * calendar's. The typed periods read `value` and `valueTo`.
 */
export function datePeriodBounds(
  filter: Extract<ColumnFilter, { kind: 'date' }>,
  today: Date = new Date(),
): [from: number, to: number] | null {
  const t = dayStart(today)
  const y = today.getUTCFullYear()
  const m = today.getUTCMonth()
  const q = Math.floor(m / 3)
  const sunday = t - today.getUTCDay() * DAY_MS
  const month = (yy: number, mm: number): [number, number] => [Date.UTC(yy, mm, 1), Date.UTC(yy, mm + 1, 0)]
  const quarter = (yy: number, qq: number): [number, number] => [Date.UTC(yy, qq * 3, 1), Date.UTC(yy, qq * 3 + 3, 0)]
  const typed = (text: string | undefined): number | null => {
    if (!text) return null
    const ms = dateValue(text.trim())
    return ms === null ? null : dayStart(new Date(ms))
  }
  switch (filter.period) {
    case 'today': return [t, t]
    case 'yesterday': return [t - DAY_MS, t - DAY_MS]
    case 'tomorrow': return [t + DAY_MS, t + DAY_MS]
    case 'thisWeek': return [sunday, sunday + 6 * DAY_MS]
    case 'lastWeek': return [sunday - 7 * DAY_MS, sunday - DAY_MS]
    case 'nextWeek': return [sunday + 7 * DAY_MS, sunday + 13 * DAY_MS]
    case 'thisMonth': return month(y, m)
    case 'lastMonth': return month(y, m - 1)
    case 'nextMonth': return month(y, m + 1)
    case 'thisQuarter': return quarter(y, q)
    case 'lastQuarter': return q === 0 ? quarter(y - 1, 3) : quarter(y, q - 1)
    case 'nextQuarter': return q === 3 ? quarter(y + 1, 0) : quarter(y, q + 1)
    case 'thisYear': return [Date.UTC(y, 0, 1), Date.UTC(y, 11, 31)]
    case 'lastYear': return [Date.UTC(y - 1, 0, 1), Date.UTC(y - 1, 11, 31)]
    case 'nextYear': return [Date.UTC(y + 1, 0, 1), Date.UTC(y + 1, 11, 31)]
    case 'yearToDate': return [Date.UTC(y, 0, 1), t]
    case 'equals': { const d = typed(filter.value); return d === null ? null : [d, d] }
    case 'before': { const d = typed(filter.value); return d === null ? null : [-Infinity, d - DAY_MS] }
    case 'after': { const d = typed(filter.value); return d === null ? null : [d + DAY_MS, Infinity] }
    case 'between': {
      const a = typed(filter.value)
      const b = typed(filter.valueTo)
      return a === null || b === null ? null : [Math.min(a, b), Math.max(a, b)]
    }
  }
}

const sameFill = (a: string | null, b: string | null): boolean =>
  (a ?? '').trim().toLowerCase() === (b ?? '').trim().toLowerCase()

/**
 * Whether a row passes one column's filter. A Top 10 filter needs the
 * whole column to know its threshold, which `hiddenRowsFor` works out and
 * passes as `topPasses`; on its own the filter passes everything.
 */
export function passesFilter(
  filter: ColumnFilter,
  value: CellValue,
  display: string,
  extra: { fill?: string | null; today?: Date; topPasses?: (value: CellValue) => boolean } = {},
): boolean {
  switch (filter.kind) {
    case 'values': return !filter.excluded.includes(display)
    case 'date': {
      const bounds = datePeriodBounds(filter, extra.today)
      if (!bounds) return true
      const ms = dateValue(value)
      if (ms === null) return false
      const day = dayStart(new Date(ms))
      return day >= bounds[0] && day <= bounds[1]
    }
    case 'color': return sameFill(extra.fill ?? null, filter.fill)
    case 'top': return extra.topPasses ? extra.topPasses(value) : true
    default: {
      const first = passesCondition(filter.first, value, display)
      if (!filter.second) return first
      const second = passesCondition(filter.second, value, display)
      return filter.join === 'or' ? first || second : first && second
    }
  }
}

/** The test a Top 10 filter applies once the column's numbers are known:
 *  the values at or past the threshold, counted over the whole region as
 *  Excel counts them, whatever the other columns hide. */
function topPassesFor(filter: Extract<ColumnFilter, { kind: 'top' }>, numbers: number[]): (value: CellValue) => boolean {
  if (!numbers.length) return () => false
  const sorted = numbers.slice().sort((a, b) => (filter.top ? b - a : a - b))
  const count = filter.percent ? Math.round((filter.count / 100) * sorted.length) : filter.count
  const keep = Math.max(0, Math.min(sorted.length, Math.trunc(count)))
  if (keep === 0) return () => false
  const threshold = sorted[keep - 1]!
  return (value) => typeof value === 'number' && Number.isFinite(value) && (filter.top ? value >= threshold : value <= threshold)
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
  ctx: FilterContext = {},
): Set<number> {
  const out = new Set<number>()
  if (!state) return out
  const columns = Object.entries(state.filters).map(([c, f]) => [Number(c), f] as const)
  if (!columns.length) return out
  const tops = new Map<number, (value: CellValue) => boolean>()
  for (const [c, filter] of columns) {
    if (filter.kind !== 'top') continue
    const numbers: number[] = []
    for (let r = state.range[0] + 1; r <= state.range[2]; r += 1) {
      const v = valueAt(r, c)
      if (typeof v === 'number' && Number.isFinite(v)) numbers.push(v)
    }
    tops.set(c, topPassesFor(filter, numbers))
  }
  for (let r = state.range[0] + 1; r <= state.range[2]; r += 1) {
    for (const [c, filter] of columns) {
      const extra = {
        today: ctx.today,
        fill: filter.kind === 'color' ? ctx.fillAt?.(r, c) ?? null : undefined,
        topPasses: tops.get(c),
      }
      if (!passesFilter(filter, valueAt(r, c), displayAt(r, c), extra)) { out.add(r); break }
    }
  }
  return out
}

/** The fills a column's cells carry, each once, first seen first; null
 *  stands for the cells with none. Excel's Filter by Color list. */
export function distinctFills(
  state: AutoFilterState,
  col: number,
  fillAt: (r: number, c: number) => string | null,
): Array<string | null> {
  const seen: Array<string | null> = []
  for (let r = state.range[0] + 1; r <= state.range[2]; r += 1) {
    const fill = fillAt(r, col)
    const key = fill ? fill.trim().toLowerCase() : null
    if (!seen.some((f) => sameFill(f, key))) seen.push(key)
  }
  return seen
}

/** Whether a column reads as dates: every cell with something in it holds one. */
export function isDateColumn(values: ReadonlyArray<FilterValue>): boolean {
  const filled = values.filter((v) => v.text !== '')
  return filled.length > 0 && filled.every((v) => v.numeric === null && dateValue(v.text) !== null)
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

const PERIOD_WORDS: Record<DatePeriod, string> = {
  equals: 'equals', before: 'is before', after: 'is after', between: 'is between',
  tomorrow: 'tomorrow', today: 'today', yesterday: 'yesterday',
  nextWeek: 'next week', thisWeek: 'this week', lastWeek: 'last week',
  nextMonth: 'next month', thisMonth: 'this month', lastMonth: 'last month',
  nextQuarter: 'next quarter', thisQuarter: 'this quarter', lastQuarter: 'last quarter',
  nextYear: 'next year', thisYear: 'this year', lastYear: 'last year', yearToDate: 'year to date',
}

/** A filter in words, for the menu's heading. */
export function describeFilter(filter: ColumnFilter): string {
  if (filter.kind === 'values') return filter.excluded.length === 1 ? '1 value hidden' : `${filter.excluded.length} values hidden`
  if (filter.kind === 'date') {
    const word = PERIOD_WORDS[filter.period]
    if (filter.period === 'between') return `${word} ${filter.value ?? ''} and ${filter.valueTo ?? ''}`
    if (filter.period === 'equals' || filter.period === 'before' || filter.period === 'after') return `${word} ${filter.value ?? ''}`
    return word
  }
  if (filter.kind === 'color') return filter.fill ? `filled ${filter.fill}` : 'no fill'
  if (filter.kind === 'top') return `${filter.top ? 'top' : 'bottom'} ${filter.count}${filter.percent ? ' percent' : ''}`
  const one = (c: FilterCondition) => {
    const word = OP_WORDS[c.op] ?? c.op
    if (c.op === 'isBlank' || c.op === 'isNotBlank') return word
    return c.op === 'between' ? `${word} ${c.value ?? ''} and ${c.valueTo ?? ''}` : `${word} ${c.value ?? ''}`
  }
  return filter.second ? `${one(filter.first)} ${filter.join ?? 'and'} ${one(filter.second)}` : one(filter.first)
}
