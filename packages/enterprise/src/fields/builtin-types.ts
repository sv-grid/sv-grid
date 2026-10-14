/**
 * The field types `enableFields()` registers, with every option the field
 * editor offers for each. Most map onto what the grid already draws and edits
 * (an editor, a formatter, chips); some bring a cell of their own (checkbox
 * icons, rating, percent bar, people, buttons, links). Every `fill` keeps what
 * the column set itself, so `{ fieldType: 'number', align: 'left' }` stays left.
 *
 * Computed types (formula, lookup, rollup, count) give the column a `fieldFn`
 * and make it read-only; automatic ones (autonumber, created / modified time
 * and by) are written by the module and read-only too.
 */
import type { FieldPropertyDef, FieldTypeDef, FieldEditorContext } from './registry.svelte'
import { fillFieldColumn } from './registry.svelte'
import RatingCell from './RatingCell.svelte'
import LinkCell from './LinkCell.svelte'
import AttachmentCell from './AttachmentCell.svelte'
import CheckboxCell from './CheckboxCell.svelte'
import PercentCell from './PercentCell.svelte'
import UserCell from './UserCell.svelte'
import ButtonCell from './ButtonCell.svelte'
import BarcodeCell from './BarcodeCell.svelte'
import LinkedRecordsCell from './LinkedRecordsCell.svelte'
import RichTextCell from './RichTextCell.svelte'
import SelectCell from './SelectCell.svelte'
import { attachmentsText, parseAttachments } from './attachments'
import { dateEditTokens, formatCurrency, formatDate, formatDuration, formatNumber, formatPercent, numberFieldShape, numberFromText, numberKind, parseDuration, toNumber, type DurationFormat, type NumberFieldKind, type NumberFieldProps } from './format'
import { BRIGHT, CHECKBOX_ICONS, RATING_ICONS } from './palette'
import { compileFormula, isoDate, selfReferenceError, type FormulaValue } from './formula'
import { findFieldUser, getCurrentUser, getFieldUsers, getLinkedTable, linkedRows, listLinkedTables, resolveLinkIds, type LinkedTable } from './sources.svelte'
import { splitNames } from './name-list'
import { linkedFields } from './linked-fields'

/**
 * A field of a linked table's records, read the way that table reads it: a
 * formula, lookup, rollup or count there is worked out, not taken from the
 * stored record (which has no value for it). A rollup of rollups that point
 * back at each other stops after a few steps instead of looping.
 */
const linkedReaders = new WeakMap<object, Map<string, ((r: Record<string, unknown>) => unknown) | null>>()
let readingDepth = 0
/** Field types whose value is worked out from the row, never stored. */
const COMPUTED_TYPES = new Set(['formula', 'lookup', 'rollup', 'count'])
function readLinked(table: LinkedTable | undefined, field: string): (r: Record<string, unknown>) => unknown {
  const raw = (r: Record<string, unknown>) => r?.[field]
  if (!table?.fields?.length) return raw
  let byField = linkedReaders.get(table.fields)
  if (!byField) linkedReaders.set(table.fields, (byField = new Map()))
  if (!byField.has(field)) {
    const f = linkedFields(table).find((x) => x.def.field === field)
    byField.set(field, (f?.def.fieldFn as ((r: Record<string, unknown>) => unknown) | undefined) ?? null)
  }
  const fn = byField.get(field)
  if (!fn) return raw
  return (r) => {
    if (readingDepth > 3) return raw(r)
    readingDepth += 1
    try {
      return fn(r)
    } finally {
      readingDepth -= 1
    }
  }
}

type Def = Record<string, unknown>
type P = Record<string, any>
type Option = { value: string | number; label?: string; color?: string }

// 24x24 path data for the picker and the header (stroke icons).
const ICON = {
  text: 'M4 6h16M4 12h10M4 18h7',
  longText: 'M4 6h16M4 10h16M4 14h16M4 18h10',
  number: 'M9 4 7 20M17 4l-2 16M4 9h16M3 15h16',
  currency: 'M12 3v18M16 7.5C16 5.6 14.2 4.5 12 4.5S8 5.6 8 7.5s1.8 2.7 4 3.5 4 1.6 4 3.5-1.8 3-4 3-4-1.1-4-3',
  percent: 'M19 5 5 19M7 7h.01M17 17h.01',
  date: 'M4 6h16v14H4zM4 10h16M8 3v4M16 3v4',
  duration: 'M12 4a8 8 0 1 0 0 16 8 8 0 0 0 0-16zM12 8v4l3 2',
  checkbox: 'M4 4h16v16H4zM8 12l3 3 5-6',
  singleSelect: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM8 11l4 4 4-4',
  multiSelect: 'M3 7h11M3 12h11M3 17h11M17 6l2 2 3-3M17 16l2 2 3-3',
  rating: 'M12 3l2.8 5.7 6.2.9-4.5 4.4 1 6.2L12 17.3 6.5 20.2l1-6.2L3 9.6l6.2-.9z',
  url: 'M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1',
  email: 'M3 6h18v12H3zM3 7l9 6 9-6',
  phone: 'M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2',
  attachment: 'M20 11.5 12.3 19a5 5 0 0 1-7.1-7.1l7.8-7.8a3.3 3.3 0 0 1 4.7 4.7L9.9 16.6a1.7 1.7 0 0 1-2.4-2.4l7.1-7',
  user: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21a8 8 0 0 1 16 0',
  createdTime: 'M12 4a8 8 0 1 0 0 16 8 8 0 0 0 0-16zM12 8v4h4',
  modifiedTime: 'M4 12a8 8 0 1 0 2.3-5.7M4 4v4h4M12 8v4l3 2',
  createdBy: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21a8 8 0 0 1 11-7.5M19 15v6M16 18h6',
  modifiedBy: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21a8 8 0 0 1 11-7.5M16 21l5-5-2-2-5 5v2z',
  autoNumber: 'M5 7h3v10M11 9a2 2 0 1 1 4 0c0 2-4 3-4 6h4M18 7h2v10',
  barcode: 'M4 5v14M7 5v14M10 5v14M13 5v14M15 5v14M18 5v14M20 5v14',
  button: 'M4 7h16v10H4zM9 12h6',
  formula: 'M7 20c2 0 2.5-2 3-5l2-10c.5-2 1.5-2 3-2M8 9h7',
  link: 'M9 7H6a5 5 0 0 0 0 10h3M15 7h3a5 5 0 0 1 0 10h-3M8 12h8',
  lookup: 'M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM20 20l-4-4M8 11h6',
  rollup: 'M6 4h12L12 12l6 8H6',
  count: 'M5 5h14v14H5zM9 9v6M12 9v6M15 9v6',
} as const

// ---- shared properties ------------------------------------------------------

const SEPARATORS: FieldPropertyDef = {
  key: 'separators', label: 'Separators', kind: 'choice',
  choices: [
    { value: 'local', label: 'Local' },
    { value: 'comma-period', label: '1,000,000.00' },
    { value: 'period-comma', label: '1.000.000,00' },
    { value: 'space-comma', label: '1 000 000,00' },
    { value: 'space-period', label: '1 000 000.00' },
  ],
}
const SHOW_THOUSANDS: FieldPropertyDef = { key: 'showThousands', label: 'Show thousands separator', kind: 'checkbox' }
const ABBREVIATION: FieldPropertyDef = {
  key: 'abbreviation', label: 'Large number abbreviation', kind: 'choice',
  choices: [
    { value: 'none', label: 'None' },
    { value: 'thousand', label: 'Thousand (K)' },
    { value: 'million', label: 'Million (M)' },
    { value: 'billion', label: 'Billion (B)' },
  ],
}
const NEGATIVE: FieldPropertyDef = { key: 'allowNegative', label: 'Allow negative numbers', kind: 'checkbox' }
const DEFAULT: FieldPropertyDef = { key: 'default', label: 'Default value', kind: 'default', hint: 'New rows start with this value.' }
const precisionChoices = (from: number, to: number) =>
  Array.from({ length: to - from + 1 }, (_, i) => {
    const d = from + i
    return { value: String(d), label: d === 0 ? '1' : `1.${'0'.repeat(d)}` }
  })
const DATE_FORMAT: FieldPropertyDef = {
  key: 'dateFormat', label: 'Date format', kind: 'choice',
  choices: [
    { value: 'local', label: 'Local' },
    { value: 'friendly', label: 'Friendly (October 14, 2026)' },
    { value: 'us', label: 'US (10/14/2026)' },
    { value: 'european', label: 'European (14/10/2026)' },
    { value: 'iso', label: 'ISO (2026-10-14)' },
  ],
}
const TIME_PROPS: FieldPropertyDef[] = [
  { key: 'time', label: 'Include time', kind: 'checkbox' },
  { key: 'timeFormat', label: 'Time format', kind: 'segmented', choices: [{ value: '12hour', label: '12 hour' }, { value: '24hour', label: '24 hour' }], visible: (p) => !!p.time },
  { key: 'gmt', label: 'Use the same time zone (GMT) for everyone', kind: 'checkbox', visible: (p) => !!p.time },
  { key: 'showTimeZone', label: 'Display time zone', kind: 'checkbox', visible: (p) => !!p.time },
]
const linkColumns = (ctx: FieldEditorContext) =>
  ctx.columns.filter((c) => c.fieldType === 'link').map((c) => ({ value: String(c.id ?? c.field), label: String(c.header ?? c.field) }))
const LINK_FIELD: FieldPropertyDef = { key: 'linkField', label: 'Link field', kind: 'choice', choices: linkColumns, hint: 'A link-to-records field of this table.' }
const fieldsOfLinked = (ctx: FieldEditorContext) => {
  const link = ctx.columns.find((c) => String(c.id ?? c.field) === ctx.props.linkField)
  const table = getLinkedTable((link?.fieldProps as P | undefined)?.table)
  if (!table) return []
  const fields = table.fields ?? [{ field: table.primaryField, header: table.primaryField }]
  return fields.map((f) => ({ value: f.field, label: f.header }))
}
const LINKED_FIELD: FieldPropertyDef = { key: 'field', label: 'Field in the linked table', kind: 'choice', choices: fieldsOfLinked, visible: (p) => !!p.linkField }

// ---- helpers ------------------------------------------------------------------

const digits = (p: P, fallback = 0) => {
  const n = Number(p.precision)
  return Number.isInteger(n) && n >= 0 && n <= 8 ? n : fallback
}
const numberProps = (p: P) => ({
  precision: p.format === 'integer' ? 0 : digits(p, p.format === 'decimal' ? 1 : 0),
  separators: p.separators,
  showThousands: p.showThousands !== false,
  abbreviation: p.abbreviation,
})
/**
 * Store what a paste or fill brings into a number, currency or percent cell
 * as the field reads it ("$1,200", "75%", "2.5k"); a number (the editor's own
 * commit) passes as is, and text that is not a number keeps the old value.
 */
const numberParser = (kind: NumberFieldKind, p: P) => (x: { newValue: unknown; oldValue?: unknown; rawInput?: unknown }) => {
  // The pasted text itself: the grid's own number coercion has already
  // turned "$1,200" into null by the time newValue arrives.
  const v = typeof x.rawInput === 'string' ? x.rawInput : x.newValue
  if (typeof v === 'number' || v == null) return v
  if (String(v).trim() === '') return null
  const n = numberFromText(String(v), kind, p as NumberFieldProps)
  return n == null ? x.oldValue : n
}
/** Refuse a negative value when the field says so (the grid's rejectInvalid). */
const negativeRule = (d: Def, p: P) =>
  p.allowNegative === false && !d.validate
    ? { rejectInvalid: true, validate: (ctx: { value: unknown }) => (Number(ctx.value) < 0 ? 'Negative numbers are not allowed' : null) }
    : {}
/** A number as its field shows it: places, separators, abbreviation, symbol or percent sign. */
const numberText = (kind: NumberFieldKind, p: P) => {
  const base = {
    precision: numberFieldShape(kind, p as NumberFieldProps).places,
    separators: p.separators,
    showThousands: p.showThousands !== false,
    abbreviation: kind === 'percent' ? undefined : p.abbreviation,
  }
  return (ctx: { value: unknown }) => {
    const n = toNumber(ctx.value)
    if (n == null) return ''
    if (kind === 'currency') return formatCurrency(n, { ...base, symbol: p.symbol, symbolPosition: p.symbolPosition })
    if (kind === 'percent') return formatPercent(n, { ...base, points: p.points })
    return formatNumber(n, base)
  }
}
/**
 * The number field in each format (and the older currency and percent
 * types): a number column (sorting, filters, alignment) edited in the
 * number editor; a column can name another editorType and stay a number.
 */
const fillNumber = (d: Def, p: P, kind: NumberFieldKind): Def => ({
  ...d,
  cellDataType: d.cellDataType ?? 'number',
  editorType: d.editorType ?? 'fieldNumber',
  align: d.align ?? (kind === 'percent' && p.showBar ? 'left' : 'right'),
  ...negativeRule(d, p),
  valueParser: d.valueParser ?? numberParser(kind, p),
  formatter: d.formatter ?? numberText(kind, p),
})
const options = (p: { options?: unknown }): Option[] =>
  Array.isArray(p.options)
    ? (p.options as Option[]).map((o) => ({ value: o.value, label: o.label ?? String(o.value), ...(o.color ? { color: o.color } : {}) }))
    : []
/**
 * A select's pasted or filled text as its values: a label or value per
 * option, comma-separated for a multiple select. A value from the editor
 * (already a value, or a list of them) passes as is.
 */
const optionParser = (p: { options?: unknown }, multiple: boolean) => {
  const byText = new Map<string, unknown>()
  for (const o of options(p)) {
    byText.set(String(o.value).toLowerCase(), o.value)
    byText.set(String(o.label).toLowerCase(), o.value)
  }
  const one = (t: string) => byText.get(t.toLowerCase()) ?? t
  return (x: { newValue: unknown; rawInput?: unknown }) => {
    if (typeof x.rawInput !== 'string') return x.newValue
    const parts = x.rawInput.split(multiple ? ',' : /\n/).map((s) => s.trim()).filter(Boolean)
    return multiple ? [...new Set(parts.map(one))] : parts.length ? one(parts[0]!) : null
  }
}
/**
 * A select value as text, by option label: the column's formatter, which
 * lookups and summaries read. A copy (Ctrl+C) takes the stored value, not this
 * (in a base, people, links and files copy as shown: copy-text.ts).
 */
const optionText = (p: { options?: unknown }) => {
  const labels = new Map(options(p).map((o) => [String(o.value), o.label]))
  return (ctx: { value: unknown }) =>
    (Array.isArray(ctx.value) ? ctx.value : ctx.value == null || ctx.value === '' ? [] : [ctx.value]).map((v) => labels.get(String(v)) ?? String(v)).join(', ')
}
/** A select sorts in the order of its options, not by their text. */
const optionRank = (p: { options?: unknown }) => {
  const rank = new Map(options(p).map((o, i) => [String(o.value), i]))
  return (value: unknown) => (value == null || value === '' ? null : rank.get(String(value)) ?? rank.size)
}
/** Row key per field name (header, lower-cased) and per key, for `{Field name}`. */
const fieldNames = (columns: ReadonlyArray<Def>): Record<string, string> => {
  const map: Record<string, string> = {}
  for (const c of columns) {
    const key = String(c.field ?? c.id ?? '')
    if (!key) continue
    map[key.toLowerCase()] = key
    if (typeof c.header === 'string') map[c.header.trim().toLowerCase()] = key
  }
  return map
}
const readOnly = (d: Def) => ({ editable: d.editable ?? false })
const dateText = (p: P) => (ctx: { value: unknown }) => formatDate(ctx.value, p)
const userNames = (v: unknown) =>
  (Array.isArray(v) ? v : v == null || v === '' ? [] : [v]).map((x) => findFieldUser(x)?.name ?? String(x)).join(', ')
/**
 * Pasted or filled names (or emails, or ids) as user ids, comma-separated
 * for a field with several people. A name nobody has stays as typed.
 */
const userParser = (multiple: boolean) => (x: { newValue: unknown; rawInput?: unknown }) => {
  if (typeof x.rawInput !== 'string') return x.newValue
  const people = getFieldUsers()
  const one = (t: string) => {
    const q = t.toLowerCase()
    return people.find((u) => u.id.toLowerCase() === q || u.name.toLowerCase() === q || u.email?.toLowerCase() === q)?.id ?? t
  }
  // Several people split at commas outside quotes, as a copy writes them ("Lee, Ann", Bo).
  const parts = multiple ? splitNames(x.rawInput) : x.rawInput.split(/\n/).map((s) => s.trim()).filter(Boolean)
  return multiple ? [...new Set(parts.map(one))] : parts.length ? one(parts[0]!) : null
}
/**
 * Pasted or filled text as link ids: each comma-separated part is a linked
 * record's id or its name (the primary field). A name with a comma comes
 * quoted, as a copy writes it ("Acme, Inc."). A part no record has is dropped.
 */
const linkParser = (p: P) => (x: { newValue: unknown; rawInput?: unknown }) => {
  if (typeof x.rawInput !== 'string') return x.newValue
  const t = getLinkedTable(p.table)
  if (!t) return x.newValue
  const ids = resolveLinkIds(t, splitNames(x.rawInput))
  return p.multiple === false ? ids.slice(0, 1) : ids
}

function formatFormulaResult(v: FormulaValue, p: P): string {
  if (v == null) return ''
  if (Array.isArray(v)) return v.map((x) => formatFormulaResult(x, p)).join(', ')
  if (v instanceof Date) return formatDate(v, p)
  if (typeof v === 'boolean') return v ? 'true' : 'false'
  if (typeof v === 'number') {
    if (p.result === 'currency' || p.result === 'percent' || p.result === 'number') {
      // Without a precision, the number field's own: 1 place, 2 for currency, 0 for percent.
      const kind = p.result as NumberFieldKind
      const shown = { ...numberProps(p), precision: numberFieldShape(kind, { precision: p.precision }).places }
      if (kind === 'currency') return formatCurrency(v, { ...shown, symbol: p.symbol })
      if (kind === 'percent') return formatPercent(v, shown)
      return formatNumber(v, shown)
    }
    return String(Math.round(v * 1e10) / 1e10)
  }
  // Under `date`, text that is a stored date (2026-12-04) shows as a date;
  // other text ("Count now", "#ERROR") shows as it is, never blanked.
  if (p.result === 'date') {
    const d = isoDate(String(v))
    if (d) return formatDate(d, p)
  }
  return String(v)
}

const ROLLUPS: Record<string, (vals: unknown[]) => unknown> = {
  SUM: (v) => v.reduce<number>((s, x) => s + (toNumber(x) ?? 0), 0),
  AVERAGE: (v) => { const n = v.map(toNumber).filter((x): x is number => x != null); return n.length ? n.reduce((s, x) => s + x, 0) / n.length : null },
  MIN: (v) => { const n = v.map(toNumber).filter((x): x is number => x != null); return n.length ? Math.min(...n) : null },
  MAX: (v) => { const n = v.map(toNumber).filter((x): x is number => x != null); return n.length ? Math.max(...n) : null },
  COUNT: (v) => v.filter((x) => typeof x === 'number').length,
  COUNTA: (v) => v.filter((x) => x != null && x !== '').length,
  COUNTALL: (v) => v.length,
  ARRAYJOIN: (v) => v.filter((x) => x != null && x !== '').map(String).join(', '),
  ARRAYUNIQUE: (v) => [...new Set(v.filter((x) => x != null && x !== '').map(String))].join(', '),
  CONCATENATE: (v) => v.map((x) => (x == null ? '' : String(x))).join(''),
  AND: (v) => v.every(Boolean),
  OR: (v) => v.some(Boolean),
}

/**
 * The link field a lookup, rollup or count reads, and its table. The table is
 * looked up each time it is read: a base registers its tables after the
 * columns of the first one are filled.
 */
const linkKeyOf = (p: P, ctx: { columns: ReadonlyArray<Def> }) => {
  const link = ctx.columns.find((c) => String(c.id ?? c.field) === p.linkField)
  if (!link) return null
  const tableId = (link.fieldProps as P | undefined)?.table
  return {
    key: String(link.field ?? link.id),
    get table() {
      return getLinkedTable(tableId)
    },
  }
}

type Formatter = (c: { value: unknown }) => unknown
// Per linked table's field list (a new list when its fields change): field -> formatter.
const linkedFormatters = new WeakMap<object, Map<string, Formatter | undefined>>()

/** How a field of the linked table shows one value, once the table says what the field is. */
function linkedFormatter(link: ReturnType<typeof linkKeyOf>, field: unknown): Formatter | undefined {
  const fields = link?.table?.fields
  if (!fields) return undefined
  let byField = linkedFormatters.get(fields)
  if (!byField) linkedFormatters.set(fields, (byField = new Map()))
  const key = String(field)
  if (byField.has(key)) return byField.get(key)
  const source = fields.find((f) => f.field === key)
  const fmt = source?.fieldType
    ? (fillFieldColumn({ field: source.field, fieldType: source.fieldType, fieldProps: source.fieldProps }).formatter as Formatter | undefined)
    : undefined
  byField.set(key, fmt)
  return fmt
}

const nowIso = () => new Date().toISOString()
const watchProps: FieldPropertyDef[] = [
  { key: 'watch', label: 'Changes to', kind: 'segmented', choices: [{ value: 'all', label: 'All fields' }, { value: 'specific', label: 'Specific fields' }] },
  { key: 'watchFields', label: 'Fields', kind: 'columns', visible: (p) => p.watch === 'specific' },
]

export const BUILTIN_FIELD_TYPES: FieldTypeDef<any>[] = [
  // ---- basic -----------------------------------------------------------------
  {
    id: 'text', label: 'Single line text', description: 'A short line of text, like a name or a title.', icon: ICON.text, group: 'basic',
    properties: [DEFAULT],
    fill: (d: Def) => ({ ...d, editorType: d.editorType ?? 'text' }),
  },
  {
    id: 'longText', label: 'Long text', description: 'Several lines of text; Alt+Enter starts a new line.', icon: ICON.longText, group: 'basic', width: 260,
    properties: [{ key: 'richText', label: 'Enable rich text formatting', kind: 'checkbox', hint: '**bold**, *italic*, `code`, [links](https://...) and lists.' }],
    // Paragraphs: a panel with room, Enter for a new line, Ctrl+Enter to save.
    fill: (d: Def) => ({ ...d, editorType: d.editorType ?? 'fieldLongText' }),
    cell: RichTextCell as never,
    hasCell: (p) => !!p.richText,
  },
  {
    id: 'attachment', label: 'Attachment', description: 'Images and files: thumbnails in the cell, a dialog to add more.', icon: ICON.attachment, group: 'basic', width: 180,
    defaults: { maxFiles: 20 },
    properties: [
      { key: 'accept', label: 'Accepted types', kind: 'text', placeholder: 'image/*,.pdf (any when empty)' },
      { key: 'maxFiles', label: 'Most files per cell', kind: 'number', min: 1, max: 100 },
    ],
    fill: (d: Def, p) => ({
      ...d,
      editorType: d.editorType ?? 'attachment',
      formatter: d.formatter ?? ((ctx: { value: unknown }) => attachmentsText(ctx.value)),
      // A paste or a copied cell keeps to accept, maxSize and maxFiles, as the dialog does.
      valueParser: d.valueParser ?? ((e: { newValue: unknown }) => parseAttachments(e.newValue, p)),
    }),
    cell: AttachmentCell as never,
  },
  {
    id: 'checkbox', label: 'Checkbox', description: 'Done or not done: one click to toggle.', icon: ICON.checkbox, group: 'basic', width: 90,
    defaults: { icon: 'check', color: '#20c933' },
    properties: [
      { key: 'icon', label: 'Icon', kind: 'icon', icons: CHECKBOX_ICONS },
      { key: 'color', label: 'Color', kind: 'color', palette: BRIGHT },
      DEFAULT,
    ],
    fill: (d: Def) => ({ ...d, editorType: d.editorType ?? 'checkbox', align: d.align ?? 'center' }),
    cell: CheckboxCell as never,
  },
  {
    id: 'singleSelect', label: 'Single select', description: 'One choice from a list of colored options.', icon: ICON.singleSelect, group: 'basic', width: 140,
    defaults: { options: [] },
    properties: [{ key: 'options', label: 'Options', kind: 'options' }, DEFAULT],
    fill: (d: Def, p) => ({ ...d, editorType: d.editorType ?? 'fieldSelect', editorOptions: d.editorOptions ?? options(p), formatter: d.formatter ?? optionText(p), valueParser: d.valueParser ?? optionParser(p, false), sortValue: d.sortValue ?? optionRank(p) }),
    cell: SelectCell as never,
  },
  {
    id: 'multiSelect', label: 'Multiple select', description: 'Any number of choices from a list of colored options.', icon: ICON.multiSelect, group: 'basic', width: 200,
    defaults: { options: [] },
    properties: [{ key: 'options', label: 'Options', kind: 'options' }, DEFAULT],
    fill: (d: Def, p) => ({ ...d, editorType: d.editorType ?? 'fieldSelect', editorMultiple: d.editorMultiple ?? true, editorOptions: d.editorOptions ?? options(p), formatter: d.formatter ?? optionText(p), valueParser: d.valueParser ?? optionParser(p, true) }),
    cell: SelectCell as never,
  },
  {
    id: 'user', label: 'User', description: 'A person (or several) from the people the app lists.', icon: ICON.user, group: 'basic', width: 170,
    properties: [{ key: 'multiple', label: 'Allow adding multiple users', kind: 'checkbox' }, DEFAULT],
    fill: (d: Def, p) => ({
      ...d,
      // The select editor, drawing people with their avatars as the cell does.
      editorType: d.editorType ?? 'fieldSelect',
      valueParser: d.valueParser ?? userParser(!!p.multiple),
      editorMultiple: d.editorMultiple ?? !!p.multiple,
      editorOptions: d.editorOptions ?? getFieldUsers().map((u) => ({ value: u.id, label: u.name })),
      formatter: d.formatter ?? ((ctx: { value: unknown }) => userNames(ctx.value)),
    }),
    cell: UserCell as never,
  },
  {
    id: 'date', label: 'Date', description: 'A calendar date, with or without the time.', icon: ICON.date, group: 'basic', width: 150,
    defaults: { dateFormat: 'local', timeFormat: '12hour' },
    properties: [DATE_FORMAT, ...TIME_PROPS, { key: 'defaultToday', label: 'Default to today', kind: 'checkbox' }],
    fill: (d: Def, p) => ({
      ...d,
      // A date without time is a calendar date ('2026-10-24'): stored as such,
      // never shifted through UTC; the editor shows it as the cell does.
      cellDataType: d.cellDataType ?? (p.time ? 'date' : 'dateString'),
      editorType: d.editorType ?? (p.time ? 'datetime' : 'date'),
      editorFormatString: d.editorFormatString ?? dateEditTokens(p),
      formatter: d.formatter ?? dateText(p),
    }),
    newRowValue: ({ props }) => (props.defaultToday ? (props.time ? nowIso() : new Date().toISOString().slice(0, 10)) : undefined),
  },
  { id: 'phone', label: 'Phone number', description: 'A phone number, shown as a tel link.', icon: ICON.phone, group: 'basic', fill: (d: Def) => ({ ...d, editorType: d.editorType ?? 'text' }), cell: LinkCell as never },
  { id: 'email', label: 'Email', description: 'An email address, shown as a mailto link.', icon: ICON.email, group: 'basic', width: 200, fill: (d: Def) => ({ ...d, editorType: d.editorType ?? 'text' }), cell: LinkCell as never },
  { id: 'url', label: 'URL', description: 'A web address, shown as a link.', icon: ICON.url, group: 'basic', width: 200, fill: (d: Def) => ({ ...d, editorType: d.editorType ?? 'text' }), cell: LinkCell as never },
  {
    id: 'barcode', label: 'Barcode', description: 'A barcode\'s text, from a scanner or typed.', icon: ICON.barcode, group: 'basic', width: 160,
    fill: (d: Def) => ({
      ...d,
      editorType: d.editorType ?? 'text',
      formatter: d.formatter ?? ((ctx: { value: unknown }) => (ctx.value && typeof ctx.value === 'object' ? String((ctx.value as { text?: unknown }).text ?? '') : String(ctx.value ?? ''))),
    }),
    cell: BarcodeCell as never,
  },
  {
    id: 'button', label: 'Button', description: 'A button in every row that opens a link made from the row.', icon: ICON.button, group: 'basic', width: 120,
    defaults: { label: 'Open', color: '#2d7ff9' },
    properties: [
      { key: 'label', label: 'Label', kind: 'text', placeholder: 'Open' },
      { key: 'color', label: 'Style', kind: 'color', palette: BRIGHT },
      { key: 'url', label: 'URL', kind: 'text', placeholder: 'https://example.com/orders/{Order id}', hint: 'Use {Field name} for that field\'s value in the row. An app can set fieldProps.onClick instead.' },
    ],
    fill: (d: Def, _p, ctx) => ({ ...d, ...readOnly(d), sortable: d.sortable ?? false, __fieldNames: fieldNames(ctx.columns) }),
    cell: ButtonCell as never,
  },

  // ---- numbers -----------------------------------------------------------------
  // One number field, in four formats: integer, decimal, currency, percent.
  // Currency and percent columns from before keep working and open in the
  // field editor as a number in that format.
  {
    id: 'number', label: 'Number', description: 'A number: whole, decimal, an amount of money or a percentage.', icon: ICON.number, group: 'number', width: 120,
    defaults: {
      format: 'decimal', precision: 1, separators: 'local', showThousands: true, abbreviation: 'none', allowNegative: true,
      symbol: '$', symbolPosition: 'before', showBar: false, points: false, step: 1,
    },
    properties: [
      {
        key: 'format', label: 'Format', kind: 'segmented',
        choices: [
          { value: 'integer', label: 'Integer' },
          { value: 'decimal', label: 'Decimal' },
          { value: 'currency', label: 'Currency' },
          { value: 'percent', label: 'Percent' },
        ],
        // Each format starts at its usual number of decimal places.
        alsoSets: (v) => ({ precision: v === 'decimal' ? 1 : v === 'currency' ? 2 : 0 }),
      },
      { key: 'symbol', label: 'Currency symbol', kind: 'text', placeholder: '$, €, £, ¥, CHF, kr', visible: (p) => p.format === 'currency' },
      {
        key: 'symbolPosition', label: 'Symbol position', kind: 'segmented', visible: (p) => p.format === 'currency',
        choices: [{ value: 'before', label: 'Before ($1.00)' }, { value: 'after', label: 'After (1.00 kr)' }],
      },
      { key: 'precision', label: 'Precision', kind: 'choice', choices: precisionChoices(0, 8), visible: (p) => p.format !== 'integer' },
      { key: 'step', label: 'Spinner step', kind: 'number', min: 0, hint: 'What the editor\'s arrows and Up / Down add or take away; Shift for ten times as much.' },
      SEPARATORS,
      SHOW_THOUSANDS,
      { ...ABBREVIATION, visible: (p) => p.format !== 'percent' },
      NEGATIVE,
      { key: 'showBar', label: 'Show as a progress bar', kind: 'checkbox', visible: (p) => p.format === 'percent' },
      { key: 'points', label: 'Values are 0 to 100 (not 0 to 1)', kind: 'checkbox', visible: (p) => p.format === 'percent' },
      DEFAULT,
    ],
    fill: (d: Def, p) => fillNumber(d, p, numberKind('number', p)),
    cell: PercentCell as never,
    hasCell: (p) => p.format === 'percent' && !!p.showBar,
  },
  {
    id: 'currency', label: 'Currency', description: 'An amount, with a currency symbol.', icon: ICON.currency, group: 'number', width: 120,
    defaults: { symbol: '$', symbolPosition: 'before', precision: 2, separators: 'local', showThousands: true, abbreviation: 'none', allowNegative: true },
    editAs: { type: 'number', props: { format: 'currency' } },
    fill: (d: Def, p) => fillNumber(d, p, 'currency'),
  },
  {
    id: 'percent', label: 'Percent', description: 'A share, shown with a percent sign.', icon: ICON.percent, group: 'number', width: 110,
    defaults: { precision: 0, separators: 'local', showThousands: true, allowNegative: true, points: false },
    editAs: { type: 'number', props: { format: 'percent' } },
    fill: (d: Def, p) => fillNumber(d, p, 'percent'),
    cell: PercentCell as never,
    hasCell: (p) => !!p.showBar,
  },
  {
    id: 'duration', label: 'Duration', description: 'A length of time, typed as 1:30 or 1h 30m.', icon: ICON.duration, group: 'number', width: 110,
    defaults: { durationFormat: 'h:mm' },
    properties: [{
      key: 'durationFormat', label: 'Duration format', kind: 'choice',
      choices: [
        { value: 'h:mm', label: 'h:mm' },
        { value: 'h:mm:ss', label: 'h:mm:ss' },
        { value: 'h:mm:ss.S', label: 'h:mm:ss.S' },
        { value: 'h:mm:ss.SS', label: 'h:mm:ss.SS' },
        { value: 'h:mm:ss.SSS', label: 'h:mm:ss.SSS' },
      ],
    }],
    fill: (d: Def, p) => ({
      ...d,
      // Seconds: a number column, typed as text ("1:30", "1h 30m").
      cellDataType: d.cellDataType ?? 'number',
      // The number editor in duration mode: "1:30" in the box, a minute a step.
      editorType: d.editorType ?? 'fieldNumber',
      formatter: d.formatter ?? ((ctx: { value: unknown }) => { const n = toNumber(ctx.value); return n == null ? '' : formatDuration(n, p.durationFormat as DurationFormat) }),
      // Pasted text ("1:30", "1h 30m") is read; the editor's seconds pass as is.
      valueParser: d.valueParser ?? ((x: { newValue: unknown; rawInput?: unknown; oldValue?: unknown }) =>
        typeof x.rawInput === 'string' ? (x.rawInput.trim() ? (parseDuration(x.rawInput) ?? x.oldValue) : null) : typeof x.newValue === 'number' ? x.newValue : parseDuration(x.newValue)),
    }),
  },
  {
    id: 'rating', label: 'Rating', description: 'One to ten stars, hearts, thumbs, flags or dots.', icon: ICON.rating, group: 'number', width: 130,
    defaults: { max: 5, icon: 'star', color: '#fcb400' },
    properties: [
      { key: 'icon', label: 'Icon', kind: 'icon', icons: RATING_ICONS },
      { key: 'color', label: 'Color', kind: 'color', palette: BRIGHT },
      { key: 'max', label: 'Maximum', kind: 'choice', choices: Array.from({ length: 10 }, (_, i) => ({ value: String(i + 1), label: String(i + 1) })) },
    ],
    fill: (d: Def) => ({ ...d, cellDataType: d.cellDataType ?? 'number', align: d.align ?? 'left', editorType: d.editorType ?? 'fieldRating' }),
    cell: RatingCell as never,
  },

  // ---- computed and automatic ----------------------------------------------------
  {
    id: 'formula', label: 'Formula', description: 'A value computed from the row\'s other fields.', icon: ICON.formula, group: 'computed', width: 160,
    defaults: { formula: '', result: 'auto' },
    properties: [
      { key: 'formula', label: 'Formula', kind: 'formula' },
      {
        key: 'result', label: 'Format the result as', kind: 'choice',
        choices: [{ value: 'auto', label: 'As computed' }, { value: 'number', label: 'Number' }, { value: 'currency', label: 'Currency' }, { value: 'percent', label: 'Percent' }, { value: 'date', label: 'Date' }],
      },
      { key: 'precision', label: 'Precision', kind: 'choice', choices: precisionChoices(0, 8), visible: (p) => ['number', 'currency', 'percent'].includes(p.result) },
      { key: 'symbol', label: 'Currency symbol', kind: 'text', placeholder: '$', visible: (p) => p.result === 'currency' },
      { ...DATE_FORMAT, visible: (p) => p.result === 'date' },
    ],
    fill: (d: Def, p, ctx) => {
      const names = fieldNames(ctx.columns)
      const src = String(p.formula ?? '')
      const self = String(d.field ?? d.id)
      const ownNames = new Set([self.toLowerCase(), typeof d.header === 'string' ? d.header.trim().toLowerCase() : ''].filter(Boolean))
      // Its own field is an error, as in the field editor: the cells show #ERROR.
      const resolve = (name: string) => {
        const n = name.trim().toLowerCase()
        const key = names[n] ?? null
        if (key === self || (key == null && ownNames.has(n))) throw selfReferenceError(name)
        return key
      }
      let fn: ((row: Record<string, unknown>) => FormulaValue) | null = null
      try {
        // A formula not written yet leaves its cells empty, not #ERROR.
        fn = src.trim() ? compileFormula(src, resolve).fn : () => null
      } catch {
        fn = null
      }
      // A field it names that is worked out too (a rollup, a count, another
      // formula) is worked out when the formula reads it, not taken from the
      // stored row, which has no value for it.
      let computed: Map<string, (row: Record<string, unknown>) => unknown> | null = null
      const computedFns = () => {
        if (computed) return computed
        computed = new Map()
        for (const c of ctx.columns) {
          if (!COMPUTED_TYPES.has(String(c.fieldType)) || String(c.field ?? c.id) === self) continue
          const filled = fillFieldColumn(c, ctx.columns) as Def
          if (typeof filled.fieldFn === 'function') computed.set(String(c.field ?? c.id), filled.fieldFn as (row: Record<string, unknown>) => unknown)
        }
        return computed
      }
      const withComputed = (row: Record<string, unknown>) => {
        const fns = computedFns()
        if (!fns.size || !row) return row
        return new Proxy(row, {
          get: (target, key) => {
            const f = typeof key === 'string' ? fns.get(key) : undefined
            if (!f || readingDepth > 3) return target[key as string]
            readingDepth += 1
            try {
              return f(target)
            } finally {
              readingDepth -= 1
            }
          },
        })
      }
      return {
        ...d,
        ...readOnly(d),
        fieldFn: (row: Record<string, unknown>) => (fn ? fn(withComputed(row)) : '#ERROR'),
        align: d.align ?? (['number', 'currency', 'percent'].includes(p.result) ? 'right' : undefined),
        formatter: d.formatter ?? ((c: { value: unknown }) => formatFormulaResult(c.value as FormulaValue, p)),
      }
    },
  },
  {
    id: 'createdTime', label: 'Created time', description: 'When the row was added. Set automatically.', icon: ICON.createdTime, group: 'computed', width: 170,
    defaults: { dateFormat: 'local', time: true, timeFormat: '12hour' },
    properties: [DATE_FORMAT, ...TIME_PROPS],
    fill: (d: Def, p) => ({ ...d, ...readOnly(d), formatter: d.formatter ?? dateText(p) }),
    newRowValue: () => nowIso(),
    onCreate: ({ rows }) => rows.map(() => nowIso()),
  },
  {
    id: 'lastModifiedTime', label: 'Last modified time', description: 'When the row last changed. Set automatically.', icon: ICON.modifiedTime, group: 'computed', width: 170,
    defaults: { dateFormat: 'local', time: true, timeFormat: '12hour', watch: 'all' },
    properties: [...watchProps, DATE_FORMAT, ...TIME_PROPS],
    fill: (d: Def, p) => ({ ...d, ...readOnly(d), formatter: d.formatter ?? dateText(p) }),
    newRowValue: () => nowIso(),
  },
  {
    id: 'createdBy', label: 'Created by', description: 'Who added the row. Set automatically.', icon: ICON.createdBy, group: 'computed', width: 160,
    fill: (d: Def) => ({ ...d, ...readOnly(d), formatter: d.formatter ?? ((c: { value: unknown }) => userNames(c.value)) }),
    newRowValue: () => getCurrentUser()?.id ?? null,
    cell: UserCell as never,
  },
  {
    id: 'lastModifiedBy', label: 'Last modified by', description: 'Who last changed the row. Set automatically.', icon: ICON.modifiedBy, group: 'computed', width: 160,
    defaults: { watch: 'all' },
    properties: watchProps,
    fill: (d: Def) => ({ ...d, ...readOnly(d), formatter: d.formatter ?? ((c: { value: unknown }) => userNames(c.value)) }),
    newRowValue: () => getCurrentUser()?.id ?? null,
    cell: UserCell as never,
  },
  {
    id: 'autoNumber', label: 'Autonumber', description: 'A number every row gets, counting up. Set automatically.', icon: ICON.autoNumber, group: 'computed', width: 100,
    fill: (d: Def) => ({ ...d, ...readOnly(d), cellDataType: d.cellDataType ?? 'number' }),
    newRowValue: ({ rows, field }) => rows.reduce((m, r) => Math.max(m, Number(r?.[field]) || 0), 0) + 1,
    onCreate: ({ rows }) => rows.map((_, i) => i + 1),
  },

  // ---- relations -------------------------------------------------------------------
  {
    id: 'link', label: 'Link to records', description: 'Rows of another table this row points at.', icon: ICON.link, group: 'relation', width: 200,
    defaults: { multiple: true },
    properties: [
      { key: 'table', label: 'Table', kind: 'choice', choices: () => listLinkedTables().map((t) => ({ value: t.id, label: t.name })), hint: 'The table gets a field that links back to this one.' },
      { key: 'multiple', label: 'Allow linking to multiple records', kind: 'checkbox' },
    ],
    fill: (d: Def, p) => ({
      ...d,
      editorType: d.editorType ?? 'fieldLink',
      formatter: d.formatter ?? ((c: { value: unknown }) => {
        const t = getLinkedTable(p.table)
        return linkedRows(t, c.value).map((r) => String(r[t!.primaryField] ?? '')).join(', ')
      }),
      valueParser: d.valueParser ?? linkParser(p),
    }),
    cell: LinkedRecordsCell as never,
  },
  {
    id: 'lookup', label: 'Lookup', description: 'A field of the linked rows, shown here.', icon: ICON.lookup, group: 'relation', width: 180,
    properties: [LINK_FIELD, LINKED_FIELD],
    fill: (d: Def, p, ctx) => {
      const link = linkKeyOf(p, ctx)
      // Each value shown as its own field shows it, when the linked table
      // says what that field is (a date, an amount).
      const text = (x: unknown) => {
        const one = linkedFormatter(link, p.field)
        return one ? String(one({ value: x }) ?? '') : String(x)
      }
      return {
        ...d,
        ...readOnly(d),
        fieldFn: (row: Record<string, unknown>) => {
          if (!link) return []
          const read = readLinked(link.table, String(p.field))
          return linkedRows(link.table, row?.[link.key]).map(read)
        },
        formatter: d.formatter ?? ((c: { value: unknown }) => (Array.isArray(c.value) ? c.value.filter((x) => x != null && x !== '').map(text).join(', ') : c.value == null ? '' : text(c.value))),
      }
    },
  },
  {
    id: 'rollup', label: 'Rollup', description: 'A summary of a field over the linked rows (a sum, a count, a list).', icon: ICON.rollup, group: 'relation', width: 140,
    defaults: { aggregation: 'SUM' },
    properties: [
      LINK_FIELD, LINKED_FIELD,
      { key: 'aggregation', label: 'Aggregation', kind: 'choice', choices: Object.keys(ROLLUPS).map((k) => ({ value: k, label: k })) },
      { key: 'precision', label: 'Precision', kind: 'choice', choices: precisionChoices(0, 8), visible: (p) => ['SUM', 'AVERAGE', 'MIN', 'MAX'].includes(p.aggregation) },
    ],
    fill: (d: Def, p, ctx) => {
      const link = linkKeyOf(p, ctx)
      const agg = ROLLUPS[String(p.aggregation)] ?? ROLLUPS.SUM!
      const numeric = ['SUM', 'AVERAGE', 'MIN', 'MAX', 'COUNT', 'COUNTA', 'COUNTALL'].includes(String(p.aggregation))
      // A sum, average, min or max of an amount is an amount: it shows as the
      // linked field shows it ($482,000), unless a precision is set here.
      const sameUnit = ['SUM', 'AVERAGE', 'MIN', 'MAX'].includes(String(p.aggregation)) && p.precision == null
      const show = (n: number) => {
        const asSource = sameUnit ? linkedFormatter(link, p.field) : undefined
        return asSource ? String(asSource({ value: n }) ?? '') : formatNumber(n, { precision: digits(p, 0) })
      }
      return {
        ...d,
        ...readOnly(d),
        // A number column, like count: the footer offers Sum and Average, the filter number operators.
        ...(numeric ? { cellDataType: d.cellDataType ?? 'number' } : {}),
        align: d.align ?? (numeric ? 'right' : undefined),
        fieldFn: (row: Record<string, unknown>) => {
          if (!link) return null
          const read = readLinked(link.table, String(p.field))
          return agg(linkedRows(link.table, row?.[link.key]).map(read))
        },
        formatter: d.formatter ?? ((c: { value: unknown }) => (typeof c.value === 'number' ? show(c.value) : String(c.value ?? ''))),
      }
    },
  },
  {
    id: 'count', label: 'Count', description: 'How many rows a link field points at.', icon: ICON.count, group: 'relation', width: 90,
    properties: [LINK_FIELD],
    fill: (d: Def, p, ctx) => {
      const link = linkKeyOf(p, ctx)
      return { ...d, ...readOnly(d), cellDataType: d.cellDataType ?? 'number', fieldFn: (row: Record<string, unknown>) => (link ? linkedRows(link.table, row?.[link.key]).length : 0) }
    },
  },
]
