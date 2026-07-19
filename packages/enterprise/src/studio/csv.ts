/**
 * CSV / spreadsheet import - turn a pasted or uploaded CSV into a runnable
 * entity: infer an `EntitySchema` from the header + values, and return the
 * parsed rows (coerced to real JS types) so they can seed a data source.
 *
 * Pure and dependency-free: a hand-rolled RFC-4180-ish reader (quoted fields,
 * escaped `""`, embedded newlines, CRLF), then per-column type inference. The
 * Studio generator and the visual designer both call `csvToEntity` to add a
 * table from a file the user drops in - no backend, no parsing library.
 */
import type { EntityField, EntityFieldType, EntitySchema } from '../schema.js'

/** Parse CSV text into a matrix of string cells. Handles quotes, `""`, embedded newlines, CRLF. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let inQuotes = false
  // Strip a UTF-8 BOM if present so the first header isn't polluted.
  const s = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text
  for (let i = 0; i < s.length; i++) {
    const c = s[i]
    if (inQuotes) {
      if (c === '"') {
        if (s[i + 1] === '"') { field += '"'; i++ } // escaped quote
        else inQuotes = false
      } else field += c
    } else if (c === '"') {
      inQuotes = true
    } else if (c === ',') {
      row.push(field); field = ''
    } else if (c === '\n') {
      row.push(field); field = ''; rows.push(row); row = []
    } else if (c === '\r') {
      // swallow; the paired \n (or EOF) ends the row
    } else {
      field += c
    }
  }
  // Flush the trailing field/row (files without a final newline).
  if (field !== '' || row.length > 0) { row.push(field); rows.push(row) }
  // Drop fully-empty trailing rows (a blank final line).
  return rows.filter((r) => !(r.length === 1 && r[0] === ''))
}

const TRUE_SET = new Set(['true', 'yes', 'y', '1'])
const FALSE_SET = new Set(['false', 'no', 'n', '0'])
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const DATETIME_RE = /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}/
const NUMBER_RE = /^-?(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?$/ // 1200, -3.5, 1,200

/** Coerce one raw cell to a JS value, given the column's inferred type. Empty -> null. */
function coerce(raw: string, type: EntityFieldType): unknown {
  const v = raw.trim()
  if (v === '') return null
  switch (type) {
    case 'number': return Number(v.replace(/,/g, ''))
    case 'boolean': return TRUE_SET.has(v.toLowerCase())
    default: return v // text / date / datetime / json stay strings (grid + schema handle them)
  }
}

/** Infer a column's type from all its non-empty raw values. Defaults to text. */
function inferColumnType(values: string[]): EntityFieldType {
  const nonEmpty = values.map((v) => v.trim()).filter((v) => v !== '')
  if (nonEmpty.length === 0) return 'text'
  const all = (pred: (v: string) => boolean) => nonEmpty.every(pred)
  if (all((v) => NUMBER_RE.test(v))) return 'number'
  if (all((v) => TRUE_SET.has(v.toLowerCase()) || FALSE_SET.has(v.toLowerCase()))) return 'boolean'
  if (all((v) => DATETIME_RE.test(v))) return 'datetime'
  if (all((v) => DATE_RE.test(v))) return 'dateString'
  return 'text'
}

/** Turn a header string into a safe, camel-ish field key. */
function toFieldKey(header: string, index: number, taken: Set<string>): string {
  let key = header.trim().replace(/[^\w]+/g, '_').replace(/^_+|_+$/g, '').toLowerCase()
  if (/^\d/.test(key)) key = 'col_' + key
  if (!key) key = `col_${index + 1}`
  let unique = key, n = 2
  while (taken.has(unique)) unique = `${key}_${n++}`
  taken.add(unique)
  return unique
}

export type CsvEntity = {
  schema: EntitySchema
  rows: Array<Record<string, unknown>>
  /** Fields whose header was renamed to a safe key (original -> key), for a UI note. */
  renamed: Array<{ header: string; field: string }>
}

/**
 * Parse CSV text into a ready-to-use entity: an `EntitySchema` (types inferred
 * per column, an `id` primary key ensured) plus the coerced rows to seed with.
 *
 * If the file has no id-like column, a synthetic string `id` (`"1"`, `"2"`, ...)
 * is added so the grid, edit form, and CRUD have a stable row key.
 */
export function csvToEntity(name: string, text: string): CsvEntity {
  const matrix = parseCsv(text)
  if (matrix.length === 0) return { schema: { name, fields: [] }, rows: [], renamed: [] }

  const headers = matrix[0]!
  const body = matrix.slice(1)
  const taken = new Set<string>()
  const renamed: Array<{ header: string; field: string }> = []
  const cols = headers.map((h, i) => {
    const field = toFieldKey(h, i, taken)
    const values = body.map((r) => r[i] ?? '')
    const type = inferColumnType(values)
    if (field !== h.trim()) renamed.push({ header: h.trim() || `Column ${i + 1}`, field })
    return { field, type, index: i }
  })

  const rows = body.map((r) => {
    const obj: Record<string, unknown> = {}
    for (const c of cols) obj[c.field] = coerce(r[c.index] ?? '', c.type)
    return obj
  })

  // Ensure a primary key: reuse an existing id-like column, else synthesize one.
  const idCol = cols.find((c) => c.field === 'id') ?? cols.find((c) => /(^|_)id$/.test(c.field))
  if (!idCol) {
    rows.forEach((row, i) => { row.id = String(i + 1) })
    cols.unshift({ field: 'id', type: 'text', index: -1 })
  }

  const fields: EntityField[] = cols.map((c) => {
    const f: EntityField = { field: c.field, type: c.type }
    const isId = idCol ? c.field === idCol.field : c.field === 'id'
    if (isId) { f.primaryKey = true; f.readonly = true }
    return f
  })

  // Let introspectJson refine any 'json'/edge types from the actual coerced values,
  // but keep our column types + pk decisions (they saw every row, not just the first).
  const schema: EntitySchema = { name, fields }
  return { schema, rows, renamed }
}
