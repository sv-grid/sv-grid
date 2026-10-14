/**
 * The view bar's filter: conditions on fields, each with the operators that
 * fit its type ("has any of" for a multiple select, "is within the past
 * week" for a date), joined by "and" or "or", one level of groups deep.
 *
 * It is the grid's advanced filter (`api.setAdvancedFilter`) with its own
 * expression kind, `fieldFilter`, so it is saved and restored with the rest
 * of the grid's state.
 */

/**
 * A person condition's value meaning whoever is signed in (`setCurrentUser`)
 * when the filter runs, so one "My tasks" view works for everyone. With
 * nobody signed in it matches no one.
 */
export const ME = '@me'

// Who `ME` is. `enableFields` points it at the signed-in user; this module
// stays free of Svelte state so it runs anywhere (the server runner too).
let currentUserId: () => string | undefined = () => undefined
export function resolveMeWith(fn: () => string | undefined): void {
  currentUserId = fn
}

/** What a condition compares, from the field's type. */
export type FilterKind = 'text' | 'number' | 'select' | 'multi' | 'checkbox' | 'date' | 'files' | 'link'

export type FilterOp =
  | 'contains'
  | 'notContains'
  | 'is'
  | 'isNot'
  | 'isEmpty'
  | 'isNotEmpty'
  | 'eq'
  | 'neq'
  | 'lt'
  | 'gt'
  | 'lte'
  | 'gte'
  | 'isAnyOf'
  | 'isNoneOf'
  | 'hasAnyOf'
  | 'hasAllOf'
  | 'hasNoneOf'
  | 'isExactly'
  | 'isBefore'
  | 'isAfter'
  | 'isOnOrBefore'
  | 'isOnOrAfter'
  | 'isWithin'

/** A day a date condition names, relative to today or exact. */
export type DateTarget =
  | { mode: 'today' | 'tomorrow' | 'yesterday' | 'oneWeekAgo' | 'oneWeekFromNow' | 'oneMonthAgo' | 'oneMonthFromNow' }
  | { mode: 'exactDate'; date: string }

/** The span "is within" names. */
export type DateSpan = { span: 'pastWeek' | 'pastMonth' | 'pastYear' | 'nextWeek' | 'nextMonth' | 'nextYear' | 'pastDays' | 'nextDays'; days?: number }

export type FieldCondition = {
  /** The column id. */
  column: string
  kind: FilterKind
  op: FilterOp
  value?: unknown
  /** A link field's table, to match its records by name. */
  table?: string
}

export type FieldConditionGroup = { conjunction: 'and' | 'or'; conditions: FieldCondition[] }

export type FieldFilter = {
  kind: 'fieldFilter'
  conjunction: 'and' | 'or'
  conditions: Array<FieldCondition | FieldConditionGroup>
}

export const isGroup = (c: FieldCondition | FieldConditionGroup): c is FieldConditionGroup =>
  Array.isArray((c as FieldConditionGroup).conditions)

const TEXT_TYPES = new Set(['text', 'longText', 'url', 'email', 'phone', 'barcode'])
const NUMBER_TYPES = new Set(['number', 'currency', 'percent', 'rating', 'duration', 'autoNumber', 'count'])
const DATE_TYPES = new Set(['date', 'createdTime', 'lastModifiedTime'])
// Their values are whatever they compute, so the column's cellDataType says what they compare as.
// A numeric rollup (SUM, COUNT...) has cellDataType 'number'; one without it
// is a list joined as text (ARRAYJOIN, CONCATENATE), or AND / OR, a checkbox.
const COMPUTED_TYPES: Record<string, FilterKind> = { formula: 'text', lookup: 'text', rollup: 'text' }
const BOOLEAN_ROLLUPS = new Set(['AND', 'OR'])

/** What a column's cellDataType compares as, or null when it does not say. */
function kindOfData(def: Record<string, any>): FilterKind | null {
  const d = def.cellDataType
  if (d === 'number') return 'number'
  if (d === 'date' || d === 'dateString') return 'date'
  if (d === 'boolean') return 'checkbox'
  return null
}

/**
 * The kind of comparison a column gets; null for one that cannot be filtered
 * (a button). A built-in type decides it; a computed type (formula, lookup,
 * rollup), a type the app registered, and a plain column follow the
 * column's cellDataType, as the footer summaries do.
 */
export function filterKindOf(def: Record<string, any>): FilterKind | null {
  const t = def.fieldType as string | undefined
  if (t === 'button') return null
  if (t === 'singleSelect') return 'select'
  if (t === 'multiSelect') return 'multi'
  if (t === 'user' || t === 'createdBy' || t === 'lastModifiedBy') return def.fieldProps?.multiple ? 'multi' : 'select'
  if (t === 'checkbox') return 'checkbox'
  if (t === 'attachment') return 'files'
  if (t === 'link') return 'link'
  if (t && DATE_TYPES.has(t)) return 'date'
  if (t && NUMBER_TYPES.has(t)) return 'number'
  if (t && TEXT_TYPES.has(t)) return 'text'
  if (t === 'rollup' && !def.cellDataType && BOOLEAN_ROLLUPS.has(String(def.fieldProps?.aggregation))) return 'checkbox'
  // A formula formatted as a number or a date compares as one, as its footer summaries do.
  const result = t === 'formula' ? def.fieldProps?.result : undefined
  if (result === 'number' || result === 'currency' || result === 'percent') return 'number'
  if (result === 'date') return 'date'
  return kindOfData(def) ?? (t ? COMPUTED_TYPES[t] : undefined) ?? 'text'
}

const EMPTY_OPS: ReadonlyArray<{ op: FilterOp; label: string }> = [
  { op: 'isEmpty', label: 'is empty' },
  { op: 'isNotEmpty', label: 'is not empty' },
]

/** The operators a kind offers, in the order the menu shows them. */
export function operatorsFor(kind: FilterKind): ReadonlyArray<{ op: FilterOp; label: string }> {
  switch (kind) {
    case 'number':
      return [
        { op: 'eq', label: '=' },
        { op: 'neq', label: '≠' },
        { op: 'lt', label: '<' },
        { op: 'gt', label: '>' },
        { op: 'lte', label: '≤' },
        { op: 'gte', label: '≥' },
        ...EMPTY_OPS,
      ]
    case 'select':
      return [
        { op: 'is', label: 'is' },
        { op: 'isNot', label: 'is not' },
        { op: 'isAnyOf', label: 'is any of' },
        { op: 'isNoneOf', label: 'is none of' },
        ...EMPTY_OPS,
      ]
    case 'multi':
      return [
        { op: 'hasAnyOf', label: 'has any of' },
        { op: 'hasAllOf', label: 'has all of' },
        { op: 'isExactly', label: 'is exactly' },
        { op: 'hasNoneOf', label: 'has none of' },
        ...EMPTY_OPS,
      ]
    case 'checkbox':
      return [{ op: 'is', label: 'is' }]
    case 'date':
      return [
        { op: 'is', label: 'is' },
        { op: 'isBefore', label: 'is before' },
        { op: 'isAfter', label: 'is after' },
        { op: 'isOnOrBefore', label: 'is on or before' },
        { op: 'isOnOrAfter', label: 'is on or after' },
        { op: 'isWithin', label: 'is within' },
        ...EMPTY_OPS,
      ]
    case 'files':
      return [{ op: 'contains', label: 'file name contains' }, ...EMPTY_OPS]
    case 'link':
    case 'text':
      return [
        { op: 'contains', label: 'contains' },
        { op: 'notContains', label: 'does not contain' },
        { op: 'is', label: 'is' },
        { op: 'isNot', label: 'is not' },
        ...EMPTY_OPS,
      ]
  }
}

/** The value a new condition starts with for an operator. */
export function defaultValue(kind: FilterKind, op: FilterOp): unknown {
  if (op === 'isEmpty' || op === 'isNotEmpty') return undefined
  if (kind === 'checkbox') return true
  if (kind === 'date') return op === 'isWithin' ? ({ span: 'pastWeek' } satisfies DateSpan) : ({ mode: 'today' } satisfies DateTarget)
  if (kind === 'select' && (op === 'is' || op === 'isNot')) return ''
  if (kind === 'select' || kind === 'multi') return []
  return ''
}

/** A new condition on a column, with its first operator. */
export function newCondition(column: string, def: Record<string, any>): FieldCondition | null {
  const kind = filterKindOf(def)
  if (!kind) return null
  const op = operatorsFor(kind)[0]!.op
  const table = kind === 'link' && typeof def.fieldProps?.table === 'string' ? (def.fieldProps.table as string) : undefined
  return { column, kind, op, value: defaultValue(kind, op), ...(table ? { table } : {}) }
}

/** Whether a condition says enough to filter: an empty value is a condition still being written. */
export function isComplete(c: FieldCondition): boolean {
  if (c.op === 'isEmpty' || c.op === 'isNotEmpty' || c.kind === 'checkbox') return true
  const v = c.value
  if (v == null) return false
  if (Array.isArray(v)) return v.length > 0
  if (typeof v === 'string') return v.trim() !== ''
  if (c.kind === 'date' && typeof v === 'object') {
    const t = v as DateTarget & DateSpan
    if (t.mode === 'exactDate') return !!(t as { date?: string }).date
    if (t.span === 'pastDays' || t.span === 'nextDays') return Number(t.days) > 0
  }
  return true
}

/** How many complete conditions a filter has (the view bar's count). */
export function conditionCount(filter: FieldFilter | null | undefined): number {
  if (!filter) return 0
  let n = 0
  for (const c of filter.conditions) {
    if (isGroup(c)) n += c.conditions.filter(isComplete).length
    else if (isComplete(c)) n += 1
  }
  return n
}

// ---- Evaluation -------------------------------------------------------------

/** What turns a link value (record ids) into the linked records' names. */
export type LinkNames = (table: string, value: unknown) => string[]

const fold = (s: unknown) => String(s ?? '').trim().toLocaleLowerCase()
const list = (v: unknown): string[] =>
  v == null || v === '' ? [] : Array.isArray(v) ? v.map((x) => String(x && typeof x === 'object' ? ((x as any).id ?? (x as any).name ?? '') : x)) : [String(v)]
const isBlank = (v: unknown) => v == null || v === '' || (Array.isArray(v) && v.length === 0) || (typeof v === 'number' && Number.isNaN(v))

const DAY = 86_400_000
/** A value's day as a count of local days, or null. */
export function dayOf(v: unknown): number | null {
  if (v == null || v === '') return null
  let d: Date
  if (v instanceof Date) d = v
  else if (typeof v === 'number') d = new Date(v)
  else {
    const s = String(v)
    // A bare date is that day where the user is, not midnight UTC.
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s)
    d = m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : new Date(s)
  }
  if (Number.isNaN(d.getTime())) return null
  return Math.floor((d.getTime() - d.getTimezoneOffset() * 60_000) / DAY)
}

function targetDay(t: DateTarget, today: number): number | null {
  switch (t.mode) {
    case 'today':
      return today
    case 'tomorrow':
      return today + 1
    case 'yesterday':
      return today - 1
    case 'oneWeekAgo':
      return today - 7
    case 'oneWeekFromNow':
      return today + 7
    case 'oneMonthAgo':
      return today - 30
    case 'oneMonthFromNow':
      return today + 30
    case 'exactDate':
      return dayOf(t.date)
  }
}

function spanDays(s: DateSpan, today: number): [number, number] {
  const n = Math.max(1, Math.floor(Number(s.days) || 1))
  switch (s.span) {
    case 'pastWeek':
      return [today - 7, today]
    case 'pastMonth':
      return [today - 30, today]
    case 'pastYear':
      return [today - 365, today]
    case 'nextWeek':
      return [today, today + 7]
    case 'nextMonth':
      return [today, today + 30]
    case 'nextYear':
      return [today, today + 365]
    case 'pastDays':
      return [today - n, today]
    case 'nextDays':
      return [today, today + n]
  }
}

/** One condition as a test of a cell value. */
export function compileCondition(c: FieldCondition, linkNames?: LinkNames, now: Date = new Date()): (value: unknown) => boolean {
  if (c.op === 'isEmpty') return isBlank
  if (c.op === 'isNotEmpty') return (v) => !isBlank(v)
  switch (c.kind) {
    case 'number': {
      const b = Number(c.value)
      if (!Number.isFinite(b)) return () => true
      const num = (v: unknown) => (isBlank(v) ? NaN : Number(v))
      const cmp: Record<string, (a: number) => boolean> = {
        eq: (a) => a === b,
        neq: (a) => a !== b,
        lt: (a) => a < b,
        gt: (a) => a > b,
        lte: (a) => a <= b,
        gte: (a) => a >= b,
      }
      const f = cmp[c.op] ?? (() => true)
      // An empty cell is no number: it matches only "not equal".
      return (v) => {
        const a = num(v)
        return Number.isNaN(a) ? c.op === 'neq' : f(a)
      }
    }
    case 'checkbox': {
      const want = c.value !== false
      return (v) => !!v === want
    }
    case 'select':
    case 'multi': {
      const me = currentUserId()
      const values = list(c.value).map((x) => (x === ME && me != null ? me : x))
      const wanted = new Set(values)
      if (c.op === 'is') return (v) => list(v)[0] === values[0]
      if (c.op === 'isNot') return (v) => list(v)[0] !== values[0]
      if (c.op === 'isAnyOf' || c.op === 'hasAnyOf') return (v) => list(v).some((x) => wanted.has(x))
      if (c.op === 'isNoneOf' || c.op === 'hasNoneOf') return (v) => !list(v).some((x) => wanted.has(x))
      if (c.op === 'hasAllOf') return (v) => {
        const have = new Set(list(v))
        return [...wanted].every((x) => have.has(x))
      }
      if (c.op === 'isExactly') return (v) => {
        const have = new Set(list(v))
        return have.size === wanted.size && [...wanted].every((x) => have.has(x))
      }
      return () => true
    }
    case 'date': {
      const today = dayOf(now)!
      if (c.op === 'isWithin') {
        const [lo, hi] = spanDays((c.value ?? { span: 'pastWeek' }) as DateSpan, today)
        return (v) => {
          const d = dayOf(v)
          return d != null && d >= lo && d <= hi
        }
      }
      const t = targetDay((c.value ?? { mode: 'today' }) as DateTarget, today)
      if (t == null) return () => true
      const cmp: Record<string, (d: number) => boolean> = {
        is: (d) => d === t,
        isBefore: (d) => d < t,
        isAfter: (d) => d > t,
        isOnOrBefore: (d) => d <= t,
        isOnOrAfter: (d) => d >= t,
      }
      const f = cmp[c.op] ?? (() => true)
      return (v) => {
        const d = dayOf(v)
        return d != null && f(d)
      }
    }
    case 'files': {
      const needle = fold(c.value)
      return (v) => (Array.isArray(v) ? v : []).some((a) => fold((a as { name?: string })?.name).includes(needle))
    }
    case 'link':
    case 'text': {
      const needle = fold(c.value)
      const text = (v: unknown): string =>
        c.kind === 'link' && c.table && linkNames
          ? fold(linkNames(c.table, v).join(', '))
          : fold(Array.isArray(v) ? v.map((x) => (x && typeof x === 'object' ? ((x as any).name ?? '') : x)).join(', ') : v)
      if (c.op === 'contains') return (v) => text(v).includes(needle)
      if (c.op === 'notContains') return (v) => !text(v).includes(needle)
      if (c.op === 'is') return (v) => text(v) === needle
      if (c.op === 'isNot') return (v) => text(v) !== needle
      return () => true
    }
  }
}

/** A whole filter as a row test; incomplete conditions are left out. Null when nothing filters. */
export function compileFieldFilter<TRow>(
  filter: FieldFilter,
  getValue: (row: TRow, columnId: string) => unknown,
  linkNames?: LinkNames,
  now?: Date,
): ((row: TRow) => boolean) | null {
  const one = (c: FieldCondition) => {
    const test = compileCondition(c, linkNames, now)
    return (row: TRow) => test(getValue(row, c.column))
  }
  const join = (conj: 'and' | 'or', parts: Array<(row: TRow) => boolean>) =>
    conj === 'or' ? (row: TRow) => parts.some((p) => p(row)) : (row: TRow) => parts.every((p) => p(row))
  const parts: Array<(row: TRow) => boolean> = []
  for (const c of filter.conditions) {
    if (isGroup(c)) {
      const inner = c.conditions.filter(isComplete).map(one)
      if (inner.length) parts.push(join(c.conjunction, inner))
    } else if (isComplete(c)) parts.push(one(c))
  }
  return parts.length ? join(filter.conjunction, parts) : null
}

// ---- As words ---------------------------------------------------------------

const DAY_WORDS: Record<string, string> = {
  today: 'today',
  tomorrow: 'tomorrow',
  yesterday: 'yesterday',
  oneWeekAgo: 'one week ago',
  oneWeekFromNow: 'one week from now',
  oneMonthAgo: 'one month ago',
  oneMonthFromNow: 'one month from now',
}
const SPAN_WORDS: Record<string, string> = {
  pastWeek: 'the past week',
  pastMonth: 'the past month',
  pastYear: 'the past year',
  nextWeek: 'the next week',
  nextMonth: 'the next month',
  nextYear: 'the next year',
}

function valueWords(c: FieldCondition): string {
  if (c.op === 'isEmpty' || c.op === 'isNotEmpty') return ''
  if (c.kind === 'checkbox') return c.value === false ? 'unchecked' : 'checked'
  if (c.kind === 'date') {
    if (c.op === 'isWithin') {
      const s = (c.value ?? { span: 'pastWeek' }) as DateSpan
      if (s.span === 'pastDays') return `the past ${s.days ?? 0} days`
      if (s.span === 'nextDays') return `the next ${s.days ?? 0} days`
      return SPAN_WORDS[s.span] ?? s.span
    }
    const t = (c.value ?? { mode: 'today' }) as DateTarget
    return t.mode === 'exactDate' ? t.date : (DAY_WORDS[t.mode] ?? t.mode)
  }
  const word = (v: unknown) => (v === ME ? 'me' : String(v))
  return Array.isArray(c.value) ? c.value.map(word).join(', ') : word(c.value ?? '')
}

/** One condition as words: "Status is Done", "Due date is before today". */
export function describeCondition(c: FieldCondition, name: (columnId: string) => string = (id) => id): string {
  const op = operatorsFor(c.kind).find((o) => o.op === c.op)?.label ?? c.op
  return [name(c.column), op, valueWords(c)].filter(Boolean).join(' ')
}

/** A filter as words, groups in parentheses; incomplete conditions are left out. */
export function describeFieldFilter(filter: FieldFilter, name?: (columnId: string) => string): string {
  const parts: string[] = []
  for (const c of filter.conditions) {
    if (isGroup(c)) {
      const inner = c.conditions.filter(isComplete).map((x) => describeCondition(x, name))
      if (inner.length) parts.push(inner.length > 1 ? `(${inner.join(` ${c.conjunction} `)})` : inner[0]!)
    } else if (isComplete(c)) parts.push(describeCondition(c, name))
  }
  return parts.length ? parts.join(` ${filter.conjunction} `) : 'every record'
}

/** The columns a filter's complete conditions read, each once. */
export function fieldFilterColumns(filter: FieldFilter): string[] {
  const out = new Set<string>()
  for (const c of filter.conditions) {
    for (const x of isGroup(c) ? c.conditions : [c]) if (isComplete(x)) out.add(x.column)
  }
  return [...out]
}
