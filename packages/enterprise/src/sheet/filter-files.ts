/**
 * The AutoFilter in a file: which rows it hides, and its criteria as an
 * .xlsx `<autoFilter>` or an .ods `<table:filter>`, both ways.
 *
 * The first writers put the filter's REGION in the file and nothing else,
 * so a sheet saved while filtered (34 of 40 rows showing) opened in Excel,
 * in LibreOffice and here with every row visible and the arrows plain.
 * Excel writes the rows a filter hides as hidden rows and keeps the
 * criteria beside the region, so the file reopens in the same view and
 * Clear Filter knows what to bring back. This does the same.
 *
 * What each format can say: .xlsx holds every kind the menu makes except a
 * colour (that needs a differential style, and the rows are hidden anyway);
 * .ods holds values and conditions, not a date period or a colour; .xls
 * holds only the hidden rows. A criterion a format cannot hold is left
 * out, and its rows go hidden by hand, which shows the same rows.
 */
import { colToLetters } from './address'
import { compileNumberFormat } from './number-format'
import { isError } from './ast'
import { hiddenRowsFor, type AutoFilterState, type ColumnFilter, type DatePeriod, type FilterCondition } from './auto-filter'
import type { SheetDocument } from './document'
import type { Rect } from './rects'

// Excel's day serials, as xlsx-document spells them; here again so this module
// stays free of the writers, since the document itself reads it.
const EXCEL_EPOCH_MS = Date.UTC(1899, 11, 30)
const DAY_MS = 86400000
const isoToSerial = (iso: string): number | null => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso)
  if (!m) return null
  return Math.round((Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])) - EXCEL_EPOCH_MS) / DAY_MS)
}
const serialToIso = (serial: number): string => new Date(EXCEL_EPOCH_MS + Math.round(serial) * DAY_MS).toISOString().slice(0, 10)

const esc = (text: string): string =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

/** What a cell shows, as the filter menu shows it: the value under its format. */
export function displayTextOf(doc: SheetDocument, name: string, r: number, c: number): string {
  const value = doc.workbook.getValue(name, r, c)
  if (isError(value)) return value.error
  const entry = doc.get(name).formats.get(`r${r}`, colToLetters(c))
  if (entry?.numFmt) return compileNumberFormat(entry.numFmt).format(value).text
  if (value === '' || value == null) return ''
  if (typeof value === 'boolean') return value ? 'TRUE' : 'FALSE'
  return String(value)
}

/**
 * The rows a sheet's filter hides, worked out afresh: the shell keeps
 * `filterHidden` for the sheet it shows, and a writer cannot trust it for
 * the others.
 */
export function filteredRows(doc: SheetDocument, name: string): Set<number> {
  const state = doc.get(name)
  if (!state.autoFilter) return new Set()
  return hiddenRowsFor(
    state.autoFilter,
    (r, c) => doc.workbook.getValue(name, r, c),
    (r, c) => displayTextOf(doc, name, r, c),
    { fillAt: (r, c) => state.formats.get(`r${r}`, colToLetters(c))?.fill ?? null },
  )
}

/**
 * Rows a file marked hidden that the sheet's own criteria hide: the
 * filter's to fold, not the user's, so they leave the hand-hidden set and
 * Clear Filter can bring them back. A row hidden by hand that the filter
 * does not reach stays hidden by hand; one under a criterion a file could
 * not carry stays hidden too, which shows the rows the file showed.
 */
export function releaseFilteredRows(doc: SheetDocument, name: string): void {
  const state = doc.get(name)
  if (!state.autoFilter || !Object.keys(state.autoFilter.filters).length || !state.hidden.rows.size) return
  for (const r of filteredRows(doc, name)) state.hidden.rows.delete(r)
}

/** The distinct texts a column offers, header row left out. */
function columnTexts(doc: SheetDocument, name: string, state: AutoFilterState, col: number): string[] {
  const seen = new Set<string>()
  for (let r = state.range[0] + 1; r <= state.range[2]; r += 1) seen.add(displayTextOf(doc, name, r, col))
  return [...seen]
}

/** Whether a column's cells are dates, which decides how a bound is spelled. */
function dateColumn(doc: SheetDocument, name: string, state: AutoFilterState, col: number): boolean {
  let dates = 0
  let filled = 0
  for (let r = state.range[0] + 1; r <= state.range[2]; r += 1) {
    const raw = doc.workbook.getRaw(name, r, col)
    if (raw === '') continue
    filled += 1
    if (isoToSerial(raw.trim()) !== null) dates += 1
  }
  return filled > 0 && dates === filled
}

// ---------------------------------------------------------------------------
// .xlsx

/** OOXML's dynamic filter types that a date period maps onto, both ways. */
const DYNAMIC: Partial<Record<DatePeriod, string>> = {
  today: 'today', yesterday: 'yesterday', tomorrow: 'tomorrow',
  thisWeek: 'thisWeek', lastWeek: 'lastWeek', nextWeek: 'nextWeek',
  thisMonth: 'thisMonth', lastMonth: 'lastMonth', nextMonth: 'nextMonth',
  thisQuarter: 'thisQuarter', lastQuarter: 'lastQuarter', nextQuarter: 'nextQuarter',
  thisYear: 'thisYear', lastYear: 'lastYear', nextYear: 'nextYear', yearToDate: 'yearToDate',
}
const PERIOD_OF: Record<string, DatePeriod> = Object.fromEntries(Object.entries(DYNAMIC).map(([k, v]) => [v, k as DatePeriod]))

/** One condition as Excel's `<customFilter>`: the text operators ride as wildcards. */
function customFilterXml(cond: FilterCondition, isDate: boolean): string[] {
  const value = cond.value ?? ''
  const bound = (text: string): string => {
    if (!isDate) return text
    const serial = isoToSerial(text.trim())
    return serial === null ? text : String(serial)
  }
  const one = (operator: string, val: string) => `<customFilter operator="${operator}" val="${esc(val)}"/>`
  switch (cond.op) {
    case 'equals': return [one('equal', bound(value))]
    case 'notEquals': return [one('notEqual', bound(value))]
    case 'greaterThan': return [one('greaterThan', bound(value))]
    case 'lessThan': return [one('lessThan', bound(value))]
    case 'between': return [one('greaterThanOrEqual', bound(value)), one('lessThanOrEqual', bound(cond.valueTo ?? ''))]
    case 'contains': return [one('equal', `*${value}*`)]
    case 'notContains': return [one('notEqual', `*${value}*`)]
    case 'startsWith': return [one('equal', `${value}*`)]
    case 'endsWith': return [one('equal', `*${value}`)]
    case 'isBlank': return [one('equal', '')]
    case 'isNotBlank': return [one('notEqual', '')]
    default: return []
  }
}

/** A column's filter as the `<filterColumn>` Excel keeps, or '' for one .xlsx cannot hold. */
function filterColumnXml(doc: SheetDocument, name: string, state: AutoFilterState, col: number, filter: ColumnFilter): string {
  const colId = col - state.range[1]
  const open = `<filterColumn colId="${colId}">`
  switch (filter.kind) {
    case 'values': {
      // Excel lists what is IN, and the blanks as a flag on the list.
      const excluded = new Set(filter.excluded)
      const kept = filter.included ?? columnTexts(doc, name, state, col).filter((text) => !excluded.has(text))
      const blank = kept.includes('')
      const items = kept.filter((text) => text !== '').map((text) => `<filter val="${esc(text)}"/>`).join('')
      return `${open}<filters${blank ? ' blank="1"' : ''}>${items}</filters></filterColumn>`
    }
    case 'condition': {
      const isDate = dateColumn(doc, name, state, col)
      const parts = [...customFilterXml(filter.first, isDate), ...(filter.second ? customFilterXml(filter.second, isDate) : [])]
      if (!parts.length) return ''
      // `and` is the default; a between is an and of its two bounds.
      const and = filter.second ? filter.join !== 'or' : true
      return `${open}<customFilters${and ? ' and="1"' : ''}>${parts.join('')}</customFilters></filterColumn>`
    }
    case 'top':
      return `${open}<top10 top="${filter.top ? 1 : 0}" percent="${filter.percent ? 1 : 0}" val="${filter.count}"/></filterColumn>`
    case 'date': {
      const dynamic = DYNAMIC[filter.period]
      if (dynamic) return `${open}<dynamicFilter type="${dynamic}"/></filterColumn>`
      const serial = (text: string | undefined): string => { const s = isoToSerial((text ?? '').trim()); return s === null ? '' : String(s) }
      const from = serial(filter.value)
      if (!from) return ''
      if (filter.period === 'equals') return `${open}<customFilters and="1"><customFilter operator="greaterThanOrEqual" val="${from}"/><customFilter operator="lessThan" val="${Number(from) + 1}"/></customFilters></filterColumn>`
      if (filter.period === 'before') return `${open}<customFilters><customFilter operator="lessThan" val="${from}"/></customFilters></filterColumn>`
      if (filter.period === 'after') return `${open}<customFilters><customFilter operator="greaterThan" val="${from}"/></customFilters></filterColumn>`
      const to = serial(filter.valueTo)
      return to ? `${open}<customFilters and="1"><customFilter operator="greaterThanOrEqual" val="${from}"/><customFilter operator="lessThanOrEqual" val="${to}"/></customFilters></filterColumn>` : ''
    }
    case 'color':
      return ''
    default:
      return ''
  }
}

/** The sheet's `<autoFilter>` element with its criteria, or '' without a filter. */
export function autoFilterXlsx(doc: SheetDocument, name: string): string {
  const state = doc.get(name).autoFilter
  if (!state) return ''
  const [r1, c1, r2, c2] = state.range
  const ref = `${colToLetters(c1)}${r1 + 1}:${colToLetters(c2)}${r2 + 1}`
  const columns = Object.entries(state.filters)
    .map(([col, filter]) => filterColumnXml(doc, name, state, Number(col), filter))
    .filter(Boolean)
    .join('')
  return columns ? `<autoFilter ref="${ref}">${columns}</autoFilter>` : `<autoFilter ref="${ref}"/>`
}

/** A `<customFilter>` read back as a condition; the wildcards become the text operators. */
function conditionFromXlsx(operator: string, val: string, isDate: boolean): FilterCondition | null {
  const unbound = (text: string): string => {
    if (!isDate) return text
    const n = Number(text)
    return Number.isFinite(n) && text.trim() !== '' ? serialToIso(n) : text
  }
  const wild = (text: string): FilterCondition | null => {
    if (text === '') return null
    if (text.startsWith('*') && text.endsWith('*') && text.length >= 2) return { op: 'contains', value: text.slice(1, -1) }
    if (text.endsWith('*')) return { op: 'startsWith', value: text.slice(0, -1) }
    if (text.startsWith('*')) return { op: 'endsWith', value: text.slice(1) }
    return null
  }
  switch (operator) {
    case 'equal': {
      if (val === '') return { op: 'isBlank' }
      return wild(val) ?? { op: 'equals', value: unbound(val) }
    }
    case 'notEqual': {
      if (val === '') return { op: 'isNotBlank' }
      const w = wild(val)
      if (w) return w.op === 'contains' ? { op: 'notContains', value: w.value } : null
      return { op: 'notEquals', value: unbound(val) }
    }
    case 'greaterThan': return { op: 'greaterThan', value: unbound(val) }
    case 'lessThan': return { op: 'lessThan', value: unbound(val) }
    // The menu has no "or equal" operators; the nearest reading keeps the
    // rows Excel showed apart from the one on the bound itself.
    case 'greaterThanOrEqual': return { op: 'greaterThan', value: unbound(val) }
    case 'lessThanOrEqual': return { op: 'lessThan', value: unbound(val) }
    default: return null
  }
}

/**
 * The criteria of an `<autoFilter>` element, by absolute column, with
 * whether every `<filterColumn>` was understood: the rows Excel hid under
 * one this cannot read must stay hidden by hand, or they would reappear.
 */
export function filtersFromXlsx(
  node: Element,
  range: Rect,
  isDateColumn: (col: number) => boolean,
): { filters: Record<number, ColumnFilter>; complete: boolean } {
  const filters: Record<number, ColumnFilter> = {}
  let complete = true
  const children = (el: Element, local: string): Element[] => Array.from(el.children).filter((k) => k.localName === local)
  for (const column of children(node, 'filterColumn')) {
    const colId = Number(column.getAttribute('colId'))
    if (!Number.isFinite(colId)) { complete = false; continue }
    const col = range[1] + colId
    const isDate = isDateColumn(col)
    const filtersEl = children(column, 'filters')[0]
    const custom = children(column, 'customFilters')[0]
    const top = children(column, 'top10')[0]
    const dynamic = children(column, 'dynamicFilter')[0]
    if (filtersEl) {
      // Excel lists what is IN; the filter carries it as `included`.
      const kept = children(filtersEl, 'filter').map((f) => f.getAttribute('val') ?? '')
      if (filtersEl.getAttribute('blank') === '1') kept.push('')
      // Date group items name days, months or years; those become a period only for a single day.
      const groups = children(filtersEl, 'dateGroupItem')
      if (groups.length && !kept.length) { complete = false; continue }
      filters[col] = { kind: 'values', excluded: [], included: kept }
      continue
    }
    if (custom) {
      const parts = children(custom, 'customFilter').map((f) => ({ operator: f.getAttribute('operator') ?? 'equal', val: f.getAttribute('val') ?? '' }))
      const and = custom.getAttribute('and') === '1'
      // A between: >= and <= together, on a number or a date.
      if (parts.length === 2 && and && parts[0]!.operator === 'greaterThanOrEqual' && (parts[1]!.operator === 'lessThanOrEqual' || parts[1]!.operator === 'lessThan')) {
        if (isDate) {
          const from = Number(parts[0]!.val)
          const to = Number(parts[1]!.val)
          if (Number.isFinite(from) && Number.isFinite(to)) {
            filters[col] = parts[1]!.operator === 'lessThan' && to === from + 1
              ? { kind: 'date', period: 'equals', value: serialToIso(from) }
              : { kind: 'date', period: 'between', value: serialToIso(from), valueTo: serialToIso(to) }
            continue
          }
        }
        filters[col] = { kind: 'condition', first: { op: 'between', value: parts[0]!.val, valueTo: parts[1]!.val } }
        continue
      }
      if (isDate && parts.length === 1 && (parts[0]!.operator === 'lessThan' || parts[0]!.operator === 'greaterThan')) {
        const n = Number(parts[0]!.val)
        if (Number.isFinite(n)) {
          filters[col] = { kind: 'date', period: parts[0]!.operator === 'lessThan' ? 'before' : 'after', value: serialToIso(n) }
          continue
        }
      }
      const first = parts[0] ? conditionFromXlsx(parts[0].operator, parts[0].val, isDate) : null
      if (!first) { complete = false; continue }
      const second = parts[1] ? conditionFromXlsx(parts[1].operator, parts[1].val, isDate) : null
      if (parts[1] && !second) { complete = false; continue }
      filters[col] = { kind: 'condition', first, ...(second ? { join: and ? 'and' : 'or', second } : {}) }
      continue
    }
    if (top) {
      const val = Number(top.getAttribute('val'))
      if (!Number.isFinite(val)) { complete = false; continue }
      filters[col] = { kind: 'top', top: top.getAttribute('top') !== '0', count: val, ...(top.getAttribute('percent') === '1' ? { percent: true } : {}) }
      continue
    }
    if (dynamic) {
      const period = PERIOD_OF[dynamic.getAttribute('type') ?? '']
      if (!period) { complete = false; continue }
      filters[col] = { kind: 'date', period }
      continue
    }
    // A colour filter, or something newer: the rows stay hidden as they are.
    complete = false
  }
  return { filters, complete }
}

// ---------------------------------------------------------------------------
// .ods

/** A condition as ODF's operator and value, or null for one ODF cannot say. */
function odsCondition(cond: FilterCondition): Array<{ operator: string; value: string }> | null {
  const value = cond.value ?? ''
  switch (cond.op) {
    case 'equals': return [{ operator: '=', value }]
    case 'notEquals': return [{ operator: '!=', value }]
    case 'greaterThan': return [{ operator: '>', value }]
    case 'lessThan': return [{ operator: '<', value }]
    case 'between': return [{ operator: '>=', value }, { operator: '<=', value: cond.valueTo ?? '' }]
    case 'contains': return [{ operator: 'contains', value }]
    case 'notContains': return [{ operator: '!contains', value }]
    case 'startsWith': return [{ operator: 'begins', value }]
    case 'endsWith': return [{ operator: 'ends', value }]
    case 'isBlank': return [{ operator: 'empty', value: '' }]
    case 'isNotBlank': return [{ operator: '!empty', value: '' }]
    default: return null
  }
}

/** The `<table:filter>` for a sheet's criteria, or '' when none can be said. */
export function autoFilterOds(doc: SheetDocument, name: string): string {
  const state = doc.get(name).autoFilter
  if (!state) return ''
  const conditions: string[] = []
  for (const [key, filter] of Object.entries(state.filters)) {
    const col = Number(key)
    const field = col - state.range[1]
    const one = (operator: string, value: string, inner = '') =>
      `<table:filter-condition table:field-number="${field}" table:operator="${esc(operator)}" table:value="${esc(value)}"${inner ? `>${inner}</table:filter-condition>` : '/>'}`
    if (filter.kind === 'values') {
      const excluded = new Set(filter.excluded)
      const kept = filter.included ?? columnTexts(doc, name, state, col).filter((text) => !excluded.has(text))
      conditions.push(one('=', kept[0] ?? '', kept.map((text) => `<table:filter-set-item table:value="${esc(text)}"/>`).join('')))
      continue
    }
    if (filter.kind === 'condition') {
      const first = odsCondition(filter.first)
      const second = filter.second ? odsCondition(filter.second) : null
      if (!first || (filter.second && !second)) continue
      const parts = [...first, ...(second ?? [])].map((p) => one(p.operator, p.value))
      conditions.push(parts.length === 1 ? parts[0]! : `<table:filter-${filter.second && filter.join === 'or' ? 'or' : 'and'}>${parts.join('')}</table:filter-${filter.second && filter.join === 'or' ? 'or' : 'and'}>`)
      continue
    }
    if (filter.kind === 'top') {
      conditions.push(one(`${filter.top ? 'top' : 'bottom'} ${filter.percent ? 'percent' : 'values'}`, String(filter.count)))
    }
    // A date period or a colour has no ODF spelling; its rows go hidden.
  }
  if (!conditions.length) return ''
  return `<table:filter>${conditions.length === 1 ? conditions[0] : `<table:filter-and>${conditions.join('')}</table:filter-and>`}</table:filter>`
}

/** The criteria under a database range, by absolute column. */
export function filtersFromOds(filterEl: Element, range: Rect): { filters: Record<number, ColumnFilter>; complete: boolean } {
  const filters: Record<number, ColumnFilter> = {}
  let complete = true
  const local = (el: Element) => el.localName
  const get = (el: Element, attribute: string) => el.getAttribute(`table:${attribute}`) ?? el.getAttributeNS?.('urn:oasis:names:tc:opendocument:xmlns:table:1.0', attribute) ?? el.getAttribute(attribute)
  const conditionOf = (el: Element): { col: number; cond: FilterCondition | null; kept?: string[]; top?: ColumnFilter } | null => {
    const field = Number(get(el, 'field-number'))
    if (!Number.isFinite(field)) return null
    const col = range[1] + field
    const operator = get(el, 'operator') ?? '='
    const value = get(el, 'value') ?? ''
    const items = Array.from(el.children).filter((k) => local(k) === 'filter-set-item').map((k) => get(k, 'value') ?? '')
    if (items.length) return { col, cond: null, kept: items }
    const topMatch = /^(top|bottom) (values|percent)$/.exec(operator)
    if (topMatch) return { col, cond: null, top: { kind: 'top', top: topMatch[1] === 'top', count: Number(value) || 10, ...(topMatch[2] === 'percent' ? { percent: true } : {}) } }
    const cond: FilterCondition | null = (() => {
      switch (operator) {
        case '=': return { op: 'equals', value }
        case '!=': return { op: 'notEquals', value }
        case '>': return { op: 'greaterThan', value }
        case '<': return { op: 'lessThan', value }
        case '>=': return { op: 'greaterThan', value }
        case '<=': return { op: 'lessThan', value }
        case 'contains': return { op: 'contains', value }
        case '!contains': return { op: 'notContains', value }
        case 'begins': return { op: 'startsWith', value }
        case 'ends': return { op: 'endsWith', value }
        case 'empty': return { op: 'isBlank' }
        case '!empty': return { op: 'isNotBlank' }
        default: return null
      }
    })()
    return { col, cond }
  }
  const walk = (el: Element, join: 'and' | 'or') => {
    for (const child of Array.from(el.children)) {
      if (local(child) === 'filter-and') { walk(child, 'and'); continue }
      if (local(child) === 'filter-or') { walk(child, 'or'); continue }
      if (local(child) !== 'filter-condition') continue
      const read = conditionOf(child)
      if (!read) { complete = false; continue }
      if (read.kept) { filters[read.col] = { kind: 'values', excluded: [], included: read.kept }; continue }
      if (read.top) { filters[read.col] = read.top; continue }
      if (!read.cond) { complete = false; continue }
      const have = filters[read.col]
      if (have && have.kind === 'condition' && !have.second) {
        // The second half of a pair: a between written as >= and <=, or an or.
        if (have.first.op === 'greaterThan' && read.cond.op === 'lessThan' && join === 'and') {
          filters[read.col] = { kind: 'condition', first: { op: 'between', value: have.first.value, valueTo: read.cond.value } }
        } else {
          filters[read.col] = { kind: 'condition', first: have.first, join, second: read.cond }
        }
        continue
      }
      filters[read.col] = { kind: 'condition', first: read.cond }
    }
  }
  walk(filterEl, 'and')
  return { filters, complete }
}
