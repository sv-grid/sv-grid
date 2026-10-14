/**
 * The summary a field shows in the grid's footer row (the `summary` prop):
 * what the footer's picker offers for each kind of field, and the function
 * that computes it. A field keeps its choice in `fieldProps.summary`; without
 * one it shows nothing until someone picks.
 */
import { toDate } from './format'

export type SummaryKind =
  | 'none'
  | 'empty'
  | 'filled'
  | 'unique'
  | 'percentEmpty'
  | 'percentFilled'
  | 'sum'
  | 'avg'
  | 'median'
  | 'min'
  | 'max'
  | 'range'
  | 'checked'
  | 'unchecked'
  | 'percentChecked'
  | 'earliest'
  | 'latest'
  | 'dateRange'

type Def = Record<string, any>
type Choice = { value: SummaryKind; label: string }

const COMMON: Choice[] = [
  { value: 'empty', label: 'Empty' },
  { value: 'filled', label: 'Filled' },
  { value: 'unique', label: 'Unique' },
  { value: 'percentEmpty', label: 'Percent empty' },
  { value: 'percentFilled', label: 'Percent filled' },
]
const NUMERIC: Choice[] = [
  { value: 'sum', label: 'Sum' },
  { value: 'avg', label: 'Average' },
  { value: 'median', label: 'Median' },
  { value: 'min', label: 'Min' },
  { value: 'max', label: 'Max' },
  { value: 'range', label: 'Range' },
]
const CHECKBOX: Choice[] = [
  { value: 'checked', label: 'Checked' },
  { value: 'unchecked', label: 'Unchecked' },
  { value: 'percentChecked', label: 'Percent checked' },
]
const DATES: Choice[] = [
  { value: 'earliest', label: 'Earliest date' },
  { value: 'latest', label: 'Latest date' },
  { value: 'dateRange', label: 'Date range (days)' },
]

/** What a field's data is, for the summaries it can have. */
function shapeOf(def: Def): 'number' | 'checkbox' | 'date' | 'other' {
  // A registered type that stores true / false says so with cellDataType.
  if (def.fieldType === 'checkbox' || def.cellDataType === 'boolean') return 'checkbox'
  // A formula is what it computes.
  const result = def.fieldType === 'formula' ? def.fieldProps?.result : undefined
  if (result === 'number' || result === 'currency' || result === 'percent') return 'number'
  if (result === 'date') return 'date'
  if (def.cellDataType === 'number' || def.fieldType === 'currency' || def.fieldType === 'percent') return 'number'
  if (def.cellDataType === 'date' || def.cellDataType === 'dateString' || ['createdTime', 'lastModifiedTime'].includes(def.fieldType)) return 'date'
  return 'other'
}

/** The footer picker's choices for a field, `none` first. */
export function summaryChoices(def: Def): Choice[] {
  const shape = shapeOf(def)
  return [
    { value: 'none', label: 'None' },
    ...(shape === 'number' ? NUMERIC : shape === 'checkbox' ? CHECKBOX : shape === 'date' ? DATES : []),
    ...COMMON,
  ]
}

export const summaryLabel = (kind: SummaryKind) =>
  [...NUMERIC, ...CHECKBOX, ...DATES, ...COMMON].find((c) => c.value === kind)?.label ?? ''

const isEmpty = (v: unknown) => v == null || v === '' || (Array.isArray(v) && v.length === 0)
const pct = (n: number, of: number) => (of ? `${Math.round((n / of) * 100)}%` : '0%')

/**
 * The footer function for a field (the grid's column `summary`): it gets the
 * rows and returns the text to show, the value formatted as the field
 * formats it ("$4,320", "75%", "October 31, 2026").
 */
export function makeSummary(kind: SummaryKind, def: Def): ((values: number[], rows: unknown[]) => string) | false {
  if (kind === 'none') return false
  const read = (row: unknown): unknown =>
    typeof def.fieldFn === 'function' ? def.fieldFn(row) : def.field != null ? (row as Record<string, unknown>)?.[def.field] : undefined
  const format = (v: unknown): string => {
    const f = def.formatter as ((c: { value: unknown }) => unknown) | undefined
    return f ? String(f({ value: v }) ?? '') : String(v)
  }
  return (_values, rows) => {
    const all = rows.map(read)
    const total = all.length
    switch (kind) {
      case 'empty':
        return String(all.filter(isEmpty).length)
      case 'filled':
        return String(all.filter((v) => !isEmpty(v)).length)
      case 'percentEmpty':
        return pct(all.filter(isEmpty).length, total)
      case 'percentFilled':
        return pct(all.filter((v) => !isEmpty(v)).length, total)
      case 'unique':
        return String(new Set(all.filter((v) => !isEmpty(v)).map((v) => JSON.stringify(v))).size)
      case 'checked':
        return String(all.filter((v) => v === true).length)
      case 'unchecked':
        return String(all.filter((v) => v !== true).length)
      case 'percentChecked':
        return pct(all.filter((v) => v === true).length, total)
      case 'earliest':
      case 'latest':
      case 'dateRange': {
        const times = all.map((v) => toDate(v)?.getTime()).filter((t): t is number => t != null && Number.isFinite(t))
        if (!times.length) return ''
        const lo = Math.min(...times)
        const hi = Math.max(...times)
        if (kind === 'dateRange') return `${Math.round((hi - lo) / 86_400_000)} days`
        // Back to the field's own value shape: a date-only field holds 'YYYY-MM-DD'.
        const pick = all[all.findIndex((v) => toDate(v)?.getTime() === (kind === 'earliest' ? lo : hi))]
        return format(pick)
      }
      default: {
        const nums = all.map((v) => (typeof v === 'number' ? v : v === '' || v == null ? NaN : Number(v))).filter((n) => Number.isFinite(n))
        if (!nums.length) return ''
        const sum = nums.reduce((a, b) => a + b, 0)
        if (kind === 'sum') return format(sum)
        if (kind === 'avg') return format(sum / nums.length)
        if (kind === 'min') return format(Math.min(...nums))
        if (kind === 'max') return format(Math.max(...nums))
        if (kind === 'range') return format(Math.max(...nums) - Math.min(...nums))
        const sorted = [...nums].sort((a, b) => a - b)
        const mid = sorted.length >> 1
        return format(sorted.length % 2 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2)
      }
    }
  }
}

/** The filled column with its footer summary: the app's own `summary` wins. */
export function withSummary<T extends Def>(filled: T, props: Record<string, unknown>): T {
  if (filled.summary !== undefined) return filled
  const kind = (props.summary as SummaryKind | undefined) ?? 'none'
  const known = summaryChoices(filled).some((c) => c.value === kind)
  return { ...filled, summary: known ? makeSummary(kind, filled) : false }
}
