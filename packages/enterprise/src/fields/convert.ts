/**
 * Changing a field's type converts its values where they can be: a number
 * typed as text stays a number, a comma list becomes multiple-select values,
 * URLs in text become attachments. What cannot convert becomes empty, and the
 * field editor says how many cells that is before it applies the change.
 */
import { attachmentsFromText, attachmentsText, toAttachments } from './attachments'
import { parseDuration } from './format'
import { fillFieldColumn, getFieldType } from './registry.svelte'
import { splitNames } from './name-list'
import { getLinkedTable, resolveLinkId, resolveLinkIds } from './sources.svelte'

const TEXT_TYPES = new Set(['text', 'longText', 'url', 'email', 'phone', 'barcode'])
/** Types whose cells the module computes or writes itself: switching to one keeps the stored values and clears nothing. */
const COMPUTED_TYPES = new Set(['formula', 'lookup', 'rollup', 'count', 'createdTime', 'lastModifiedTime', 'createdBy', 'lastModifiedBy', 'autoNumber', 'button'])
const NUMBER_TYPES = new Set(['number', 'currency', 'percent', 'rating'])

/** Whether switching a field to `to` keeps its stored values as they are. */
export const keepsStoredValues = (to: string) => COMPUTED_TYPES.has(to)

export const isEmptyValue = (v: unknown) =>
  v == null || v === '' || (Array.isArray(v) && v.length === 0) || (typeof v === 'number' && Number.isNaN(v))

/** A value as plain text, whatever its type. */
export function asText(v: unknown, fromType?: string): string {
  if (v == null) return ''
  if (fromType === 'attachment') return attachmentsText(v)
  if (Array.isArray(v)) return v.map((x) => asText(x)).filter(Boolean).join(', ')
  if (v instanceof Date) return localDay(v)
  return String(v)
}

/** A date's local calendar day as YYYY-MM-DD: a formula's TODAY() is local midnight. */
const localDay = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

/** `value` of a field of type `from`, as a value of type `to` (with `toProps`, the new field's properties). */
export function convertValue(value: unknown, from: string | undefined, to: string, toProps?: Record<string, unknown>): unknown {
  if (COMPUTED_TYPES.has(to)) return value
  if (isEmptyValue(value)) return to === 'checkbox' ? false : to === 'multiSelect' || to === 'attachment' ? [] : null
  if (from === to) return value
  if (TEXT_TYPES.has(to)) return asText(value, from)
  if (to === 'duration') return typeof value === 'number' ? value : parseDuration(asText(value, from))
  if (to === 'user') return Array.isArray(value) ? value.map((x) => asText(x)) : asText(value, from) || null
  if (to === 'link') {
    // Names (a multiple select, a lookup, "Acme, Northwind" in text) become
    // the ids of the linked table's records; a name no record has is dropped.
    const table = getLinkedTable(toProps?.table)
    const ids = table ? resolveLinkIds(table, linkParts(value, from)) : []
    return toProps?.multiple === false ? ids.slice(0, 1) : ids
  }
  if (NUMBER_TYPES.has(to)) {
    if (typeof value === 'boolean') return value ? 1 : 0
    if (typeof value === 'number') return to === 'rating' ? Math.max(0, Math.min(10, Math.round(value))) : value
    // A list (a lookup, a multiple select) is a number only when it holds one value: [1, 2] is not 12.
    if (Array.isArray(value)) return value.length === 1 ? convertValue(value[0], undefined, to) : null
    // Keep digits, the decimal point, a sign and an exponent: "$1,200" -> 1200.
    const kept = asText(value, from).replace(/[^0-9.eE+-]/g, '')
    // No digit at all ("n/a") is not zero; Number('') would say it is.
    const n = /\d/.test(kept) ? Number(kept) : NaN
    if (!Number.isFinite(n)) return null
    return to === 'rating' ? Math.max(0, Math.min(10, Math.round(n))) : n
  }
  if (to === 'checkbox') {
    if (typeof value === 'boolean') return value
    if (typeof value === 'number') return value !== 0
    return /^(true|yes|y|1|x|on|done|checked)$/i.test(asText(value, from).trim())
  }
  if (to === 'date') {
    if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : localDay(value)
    const t = new Date(asText(value, from))
    return Number.isNaN(t.getTime()) ? null : t.toISOString().slice(0, 10)
  }
  if (to === 'singleSelect') {
    const text = Array.isArray(value) ? asText(value[0]) : asText(value, from)
    return text.trim() || null
  }
  if (to === 'multiSelect') {
    const parts = Array.isArray(value) ? value.map((x) => asText(x)) : asText(value, from).split(',')
    return [...new Set(parts.map((s) => s.trim()).filter(Boolean))]
  }
  if (to === 'attachment') {
    return from === 'attachment' ? toAttachments(value) : attachmentsFromText(asText(value, from))
  }
  // An app-registered type: the value as text, read by the type's valueParser
  // as a paste would be. Without a parser, a list or an object becomes its
  // text and a plain value stays as it is.
  const parse = parserFor(to, toProps)
  const text = asText(value, from)
  if (!parse) return value !== null && typeof value === 'object' ? text || null : value
  const out = parse(text)
  return out === undefined ? null : out
}

type Parser = (text: string) => unknown
// Per registered type, per its properties (as JSON): the parser its fill gives a column.
const parsers = new WeakMap<object, Map<string, Parser | null>>()
function parserFor(to: string, props: Record<string, unknown> | undefined): Parser | null {
  const type = getFieldType(to)
  if (!type) return null
  let byProps = parsers.get(type)
  if (!byProps) parsers.set(type, (byProps = new Map()))
  const key = JSON.stringify(props ?? {})
  if (!byProps.has(key)) {
    const fn = fillFieldColumn({ field: '__convert', fieldType: to, fieldProps: props ?? {} }).valueParser
    byProps.set(key, typeof fn === 'function'
      ? (text) => {
          try {
            return (fn as (x: { newValue: unknown; oldValue: unknown; rawInput: unknown }) => unknown)({ newValue: text, oldValue: null, rawInput: text })
          } catch {
            return null
          }
        }
      : null)
  }
  return byProps.get(key)!
}

/** The names a value gives a link: a list's items, or text split at commas outside quotes. */
function linkParts(value: unknown, from: string | undefined): string[] {
  return Array.isArray(value) ? value.map((x) => asText(x).trim()).filter(Boolean) : splitNames(asText(value, from))
}

/**
 * Whether converting `value` keeps only part of it: several names to a single
 * select (the first one stays), or names a link cannot find or cannot hold.
 */
function losesPart(value: unknown, from: string | undefined, to: string, toProps: Record<string, unknown> | undefined): boolean {
  if (to === 'singleSelect') return Array.isArray(value) && new Set(value.map((x) => asText(x).trim()).filter(Boolean)).size > 1
  if (to === 'link') {
    const table = getLinkedTable(toProps?.table)
    if (!table) return false
    const ids = linkParts(value, from).map((part) => resolveLinkId(table, part))
    return ids.some((id) => id == null) || (toProps?.multiple === false && new Set(ids).size > 1)
  }
  return false
}

/**
 * How many of `values` are not empty now and would lose their value after
 * converting: cleared, or cut to part of it (several names to a single select).
 */
export function countCleared(values: ReadonlyArray<unknown>, from: string | undefined, to: string, toProps?: Record<string, unknown>): number {
  if (COMPUTED_TYPES.has(to) || from === to) return 0
  let n = 0
  for (const v of values) {
    if (isEmptyValue(v)) continue
    if (isEmptyValue(convertValue(v, from, to, toProps)) || losesPart(v, from, to, toProps)) n += 1
  }
  return n
}

/** Select options for converted values: every distinct value, in first-seen order. */
export function optionsFromValues(values: ReadonlyArray<unknown>): Array<{ value: string }> {
  const seen = new Set<string>()
  for (const v of values) {
    for (const s of Array.isArray(v) ? v : [v]) {
      const t = s == null ? '' : String(s).trim()
      if (t) seen.add(t)
    }
  }
  return [...seen].slice(0, 200).map((value) => ({ value }))
}
