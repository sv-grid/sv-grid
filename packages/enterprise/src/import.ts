/**
 * Pro Import feature
 * ------------------
 *
 * Read Excel (.xlsx), CSV, TSV, or JSON in the browser and produce a typed
 * preview of the parsed rows, including per-cell validation errors. The
 * caller decides whether to commit the parsed rows into the grid via
 * `api.addRows(...)`, or to render an editing modal so the user can fix
 * issues first.
 *
 * Two flavours of usage:
 *
 *   1. Read + preview, then commit explicitly:
 *
 *        const result = await api.importData({ file, format: 'auto' })
 *        // result.headers, result.rows, result.errors
 *        if (result.errors.length === 0) api.addRows(result.rows, 'bottom')
 *
 *   2. Read and commit in one go (no preview UX):
 *
 *        await api.importData({ file, format: 'auto', commit: true })
 *
 * Both go through the same polite license soft-gate as `exportData` and
 * `print`, so unlicensed evaluation works but emits a one-time nudge.
 */

import type { RowData, SvGridApi, TableFeatures } from '@svgrid/grid'
import { assertEnterpriseLicensed } from './license'

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type ImportFormat = 'xlsx' | 'csv' | 'tsv' | 'json' | 'auto'

export type ImportColumnMap = Record<string, string>

/**
 * Declared data type per target field. When `columnTypes` is set on
 * `ImportOptions`, the parser tries to coerce each non-empty cell into
 * the declared shape and emits an `ImportRowError` when it can't -
 * stricter than the ad-hoc "looks like a number" fallback.
 */
export type ImportFieldType =
  | 'string'
  | 'number'
  | 'integer'
  | 'boolean'
  | 'date'      // returns ISO yyyy-mm-dd
  | 'datetime'  // returns ISO yyyy-mm-ddThh:mm:ss
  | 'json'      // parses the cell as JSON (object / array / primitive)

export type ImportColumnTypes = Record<string, ImportFieldType>

/**
 * The slice of a grid column the auto-mapper needs: its target `field`,
 * a human `header` to match source headers against, and the `format`
 * config to infer a column type from. Shaped to accept the output of
 * `api.getColumns()` directly.
 */
export type ImportGridColumn = {
  field?: string
  header?: string
  format?: { type?: string } | null
}

/** Progress ticks emitted during a large import so a UI can show a bar. */
export type ImportProgress = {
  /** Which stage is running. */
  phase: 'parse' | 'map'
  /** 0..1 completion of the current phase. */
  ratio: number
  /** Rows processed so far in this phase. */
  done: number
  /** Total rows this phase will process (0 when unknown, e.g. mid-parse). */
  total: number
}

export type ImportRowError = {
  /** 0-based row index in the SOURCE file (excluding the header). */
  rowIndex: number
  /** Target field name (the grid's column field), or '*' for whole-row errors. */
  field: string
  message: string
}

export type ImportValidator<TData> = (
  row: TData,
  rowIndex: number,
) => Array<{ field: string; message: string }>

export type ImportOptions<TData> = {
  /** The file to read. A `File`/`Blob` works for xlsx; a string is treated as
   *  inline CSV/TSV/JSON text. */
  file: File | Blob | string
  /** When 'auto', the format is sniffed from `file.name`'s extension (Files
   *  only), otherwise the function inspects the first characters of the
   *  text payload. */
  format?: ImportFormat
  /**
   * Map source-header -> target-field. Missing entries fall back to the
   * source header verbatim (lowercased + trimmed). Pass `null` for a
   * source header you want to drop on the floor.
   */
  columnMap?: ImportColumnMap
  /**
   * Declared data types per target field. When set, the importer uses
   * strict per-type coercion (`'2024-03-15'` -> ISO date; `'$1,234'`
   * -> 1234 for `number` fields) and emits an `ImportRowError` whenever
   * a value can't be coerced. Fields not listed fall back to the
   * built-in best-effort coercion (currency / number / date sniffing
   * by value shape).
   */
  columnTypes?: ImportColumnTypes
  /** Per-row validator. Returned errors land in `result.errors`. */
  validator?: ImportValidator<TData>
  /**
   * When true, source headers are fuzzy-matched to the grid's own columns
   * (by header label or field name) to build the `columnMap` automatically,
   * and `columnTypes` are inferred from each matched column's `format`
   * (currency / number / percent -> number, date -> date, datetime ->
   * datetime). Anything you pass explicitly in `columnMap` / `columnTypes`
   * wins over the guess. This is what powers "drop a file and it lines up
   * with my grid" in `SvImportDialog`.
   */
  autoMap?: boolean
  /** When true, the parsed rows are appended to the grid via
   *  `api.addRows(...)` automatically. Defaults to false (preview mode). */
  commit?: boolean
  /** Where to insert when `commit` is true. Defaults to 'bottom'. */
  commitAt?: 'top' | 'bottom' | number
  /**
   * Drop duplicate rows by this key field, keeping the LAST occurrence
   * (upsert-style, so a later row in the file wins). Runs after mapping,
   * so pass the TARGET field name. Rows with a null/undefined key are kept.
   */
  dedupeBy?: keyof TData | (string & {})
  // --- Enterprise guard-rails ----------------------------------------------
  /** Reject the import if the source has more than this many data rows.
   *  Guards against a runaway upload locking up the tab. */
  maxRows?: number
  /**
   * What to do when the source exceeds `maxRows`. `'reject'` (default)
   * throws so no data is silently lost; `'truncate'` keeps the first
   * `maxRows` rows and sets `result.truncated` so you can warn the user.
   * Only affects `maxRows` - `maxBytes` always rejects (a partial binary /
   * CSV can't be truncated safely).
   */
  overLimit?: 'reject' | 'truncate'
  /** Reject a File/Blob larger than this many bytes before it is read. */
  maxBytes?: number
  /** Stop collecting validation errors past this many (keeps memory bounded
   *  on a pathological file). `result.errorsTruncated` flags when it hit. */
  maxErrors?: number
  /** Text encoding for CSV/TSV/JSON read from a File/Blob. Default 'utf-8'.
   *  Set e.g. 'windows-1252' / 'latin1' for legacy Excel CSV exports. */
  encoding?: string
  /** Abort a long parse/map (wire to an AbortController). Throws an
   *  AbortError, matching the export API. */
  signal?: AbortSignal
  /** Progress callback for large files (parse + map phases). */
  onProgress?: (progress: ImportProgress) => void
}

export type ImportResult<TData> = {
  /** Source headers as found in the file, in their original order. */
  headers: string[]
  /** Parsed + mapped rows. Order matches the source. */
  rows: TData[]
  /** All validation errors (zero-length if the file passed clean). */
  errors: ImportRowError[]
  /** Rows skipped because they were entirely blank. */
  skipped: number
  /** Total source rows the parser saw (including blanks and bad rows). */
  total: number
  /** Detected format (resolved from 'auto'). */
  format: Exclude<ImportFormat, 'auto'>
  /** True when `maxErrors` capped the error list (there were more). */
  errorsTruncated?: boolean
  /** Rows dropped by `dedupeBy` (0 when not deduping). */
  deduped?: number
  /** True when `maxRows` + `overLimit:'truncate'` dropped trailing rows.
   *  `total` still reports the original source row count. */
  truncated?: boolean
}

// ---------------------------------------------------------------------------
// Lazy peer dependency: jszip (xlsx only)
// ---------------------------------------------------------------------------

let jszipPromise: Promise<unknown> | null = null
async function getJSZip(): Promise<any> {
  if (typeof window === 'undefined') {
    throw new Error('@svgrid/enterprise: importData requires a browser environment')
  }
  const g = globalThis as unknown as { JSZip?: unknown }
  if (g.JSZip) return g.JSZip
  if (!jszipPromise) {
    jszipPromise = (async () => {
      let mod: unknown
      try {
        // Optional peer, loaded on demand (keeps consumer type-checks clean when absent).
        // @ts-ignore - "jszip" is an optional peerDependency
        mod = await import('jszip')
      } catch {
        throw new Error(
          '@svgrid/enterprise: xlsx import requires the "jszip" peer dependency. ' +
            'Install it with: pnpm add jszip',
        )
      }
      const J = (mod as { default?: unknown }).default ?? mod
      g.JSZip = J
      return J
    })()
  }
  return jszipPromise
}

// ---------------------------------------------------------------------------
// Format sniffing
// ---------------------------------------------------------------------------

function sniffFormat(
  file: File | Blob | string,
  declared: ImportFormat,
): Exclude<ImportFormat, 'auto'> {
  if (declared !== 'auto') return declared
  // File: trust the extension.
  if (file instanceof File && file.name) {
    const ext = file.name.toLowerCase().split('.').pop() ?? ''
    if (ext === 'xlsx') return 'xlsx'
    if (ext === 'csv') return 'csv'
    if (ext === 'tsv' || ext === 'tab') return 'tsv'
    if (ext === 'json') return 'json'
  }
  // String: sniff the first non-whitespace char.
  if (typeof file === 'string') {
    const trimmed = file.trimStart()
    if (trimmed.startsWith('[') || trimmed.startsWith('{')) return 'json'
    // Tab-rich heads are tsv; otherwise default to csv.
    const firstLine = trimmed.slice(0, 200).split(/\r?\n/)[0] ?? ''
    if ((firstLine.match(/\t/g)?.length ?? 0) >= 1) return 'tsv'
    return 'csv'
  }
  // Blob without a filename / extension: assume xlsx (the most common case
  // the importer is asked to handle).
  return 'xlsx'
}

// ---------------------------------------------------------------------------
// CSV / TSV parser
// ---------------------------------------------------------------------------

/**
 * RFC 4180-flavour CSV / TSV parser. Handles:
 *   - quoted fields with embedded commas / tabs / newlines
 *   - escaped quotes ("") inside quoted fields
 *   - both \r\n and \n line endings
 *
 * Doesn't aim to be the world's fastest parser - it walks the string
 * character-by-character. For files in the 10-100k row range this is
 * fine; for million-row imports, do the import server-side.
 */
function parseDelimited(text: string, sep: ',' | '\t'): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let i = 0
  let inQuotes = false
  // Strip a UTF-8 BOM if present so the first header isn't named "﻿ID".
  if (text.charCodeAt(0) === 0xfeff) i = 1
  while (i < text.length) {
    const c = text[i]!
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i += 2; continue }
        inQuotes = false
        i += 1
        continue
      }
      field += c
      i += 1
      continue
    }
    if (c === '"') { inQuotes = true; i += 1; continue }
    if (c === sep) { row.push(field); field = ''; i += 1; continue }
    if (c === '\r') {
      if (text[i + 1] === '\n') i += 1
      row.push(field); rows.push(row); row = []; field = ''; i += 1; continue
    }
    if (c === '\n') {
      row.push(field); rows.push(row); row = []; field = ''; i += 1; continue
    }
    field += c
    i += 1
  }
  // Flush the trailing field / row (no trailing newline).
  if (field.length > 0 || row.length > 0) {
    row.push(field)
    rows.push(row)
  }
  return rows
}

// ---------------------------------------------------------------------------
// XLSX parser (minimal)
// ---------------------------------------------------------------------------

/**
 * Minimal SpreadsheetML reader. Supports the .xlsx shape Excel and Google
 * Sheets produce by default: one default sheet, optional shared-strings
 * table, inline strings, numbers, and dates expressed as serial numbers.
 *
 * The grid does NOT try to be a fully-featured Excel reader. Formulas
 * are read as their cached value when present. Multi-sheet imports
 * require the caller to pre-extract the desired sheet (or for a future
 * release).
 */
async function parseXlsx(file: File | Blob): Promise<string[][]> {
  const J = await getJSZip()
  const buf = await (file as Blob).arrayBuffer()
  const zip = await J.loadAsync(buf)

  // Read sharedStrings.xml if it exists.
  let sharedStrings: string[] = []
  const ssEntry = zip.file('xl/sharedStrings.xml')
  if (ssEntry) {
    const ssText = await ssEntry.async('string')
    sharedStrings = parseSharedStrings(ssText)
  }

  // Read the FIRST sheet. Workbook.xml -> rels mapping is involved; for the
  // 99% case the first sheet lives at xl/worksheets/sheet1.xml.
  const sheetEntry =
    zip.file('xl/worksheets/sheet1.xml') ??
    zip.file('xl/worksheets/sheet 1.xml')
  if (!sheetEntry) {
    throw new Error(
      '@svgrid/enterprise: could not locate sheet1.xml in the .xlsx archive',
    )
  }
  const sheetText = await sheetEntry.async('string')
  return parseSheetXml(sheetText, sharedStrings)
}

/** Pull every `<t>...</t>` out of sharedStrings.xml in document order. */
function parseSharedStrings(xml: string): string[] {
  const out: string[] = []
  // A shared-string item may be a plain <si><t>X</t></si> or a rich-text
  // <si><r><t>X</t></r><r><t>Y</t></r></si>. Concatenate every <t> inside
  // each <si>.
  const itemRe = /<si\b[^>]*>([\s\S]*?)<\/si>/g
  const tRe = /<t\b[^>]*>([\s\S]*?)<\/t>/g
  let m: RegExpExecArray | null
  while ((m = itemRe.exec(xml)) !== null) {
    let combined = ''
    let n: RegExpExecArray | null
    tRe.lastIndex = 0
    while ((n = tRe.exec(m[1] ?? '')) !== null) {
      combined += decodeXmlEntities(n[1] ?? '')
    }
    out.push(combined)
  }
  return out
}

function decodeXmlEntities(s: string): string {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#10;/g, '\n')
    .replace(/&#9;/g, '\t')
}

/**
 * Convert a sheet's XML body into a dense `string[][]`. Holes in the
 * cell stream (e.g. row jumps from col B to col E) are filled with
 * empty strings so the result is rectangular.
 */
function parseSheetXml(xml: string, sharedStrings: string[]): string[][] {
  const rows: string[][] = []
  const rowRe = /<row\b[^>]*>([\s\S]*?)<\/row>/g
  const cellRe = /<c\b([^>]*)>([\s\S]*?)<\/c>/g
  const inlineStrRe = /<is>\s*([\s\S]*?)\s*<\/is>/
  const tRe = /<t\b[^>]*>([\s\S]*?)<\/t>/g
  const vRe = /<v>([\s\S]*?)<\/v>/
  let rowMatch: RegExpExecArray | null
  while ((rowMatch = rowRe.exec(xml)) !== null) {
    const rowBody = rowMatch[1] ?? ''
    const cells: string[] = []
    let cellMatch: RegExpExecArray | null
    cellRe.lastIndex = 0
    while ((cellMatch = cellRe.exec(rowBody)) !== null) {
      const attrs = cellMatch[1] ?? ''
      const body = cellMatch[2] ?? ''
      const ref = /r="([A-Z]+)\d+"/.exec(attrs)?.[1] ?? ''
      const colIndex = colRefToIndex(ref)
      const type = /t="([^"]+)"/.exec(attrs)?.[1] ?? 'n'
      // Pad holes with empty strings so column alignment survives.
      while (cells.length < colIndex) cells.push('')
      let value = ''
      if (type === 's') {
        const idx = Number(vRe.exec(body)?.[1] ?? '-1')
        value = sharedStrings[idx] ?? ''
      } else if (type === 'inlineStr' || type === 'str') {
        const inlineBody = inlineStrRe.exec(body)?.[1] ?? body
        let parts = ''
        let n: RegExpExecArray | null
        tRe.lastIndex = 0
        while ((n = tRe.exec(inlineBody)) !== null) parts += decodeXmlEntities(n[1] ?? '')
        value = parts || decodeXmlEntities(vRe.exec(body)?.[1] ?? '')
      } else if (type === 'b') {
        value = vRe.exec(body)?.[1] === '1' ? 'true' : 'false'
      } else {
        // Numeric or date - we surface as the raw number string. The
        // caller's column type then handles parsing.
        value = decodeXmlEntities(vRe.exec(body)?.[1] ?? '')
      }
      cells.push(value)
    }
    rows.push(cells)
  }
  return rows
}

/** Excel column reference ("A", "B", ..., "AA", ...) to a zero-based index. */
function colRefToIndex(ref: string): number {
  if (!ref) return 0
  let n = 0
  for (let i = 0; i < ref.length; i += 1) {
    n = n * 26 + (ref.charCodeAt(i) - 64)
  }
  return Math.max(0, n - 1)
}

// ---------------------------------------------------------------------------
// Coerce raw string values into typed JS values based on a sample of other
// values in the same column. We don't ask the consumer for a schema - it
// would defeat the "drop a file in and go" UX - but we DO want
// "$1,234.56" to become 1234.56 and "true" to become true.
// ---------------------------------------------------------------------------

function inferAndCoerce(value: string): unknown {
  if (value === '') return ''
  const trimmed = value.trim()
  if (trimmed === '') return ''
  // Boolean
  if (trimmed === 'true' || trimmed === 'TRUE')  return true
  if (trimmed === 'false' || trimmed === 'FALSE') return false
  // Currency / number with grouping. Strip $, commas, whitespace.
  if (/^[-+]?\$?\s?[\d,]+(?:\.\d+)?$/.test(trimmed)) {
    const n = parseFloat(trimmed.replace(/[$,\s]/g, ''))
    if (!Number.isNaN(n)) return n
  }
  // Bare integer / float
  if (/^[-+]?\d+(?:\.\d+)?(?:e[+-]?\d+)?$/i.test(trimmed)) {
    const n = parseFloat(trimmed)
    if (!Number.isNaN(n)) return n
  }
  // ISO date (yyyy-mm-dd, optionally with time) -> keep as ISO string. We
  // don't return a Date because most grid columns prefer strings on the
  // wire (sort + filter + format paths are already date-aware).
  if (/^\d{4}-\d{2}-\d{2}(?:[T ]\d{2}:\d{2}(?::\d{2})?(?:Z|[+-]\d{2}:?\d{2})?)?$/.test(trimmed)) {
    return trimmed
  }
  return trimmed
}

// ---------------------------------------------------------------------------
// Map source rows -> typed records.
// ---------------------------------------------------------------------------

/**
 * Field names we refuse to write, because assigning them from untrusted file
 * headers would let a malicious upload walk the prototype chain (prototype
 * pollution). Applies to the default snake_case fallback AND anything a
 * columnMap points at.
 */
const UNSAFE_FIELDS = new Set(['__proto__', 'prototype', 'constructor'])

/** Resolve each source header to a target field (or null = drop the column),
 *  honouring the columnMap and refusing blank + pollution-prone names. */
function computeFields(
  headers: string[],
  columnMap: ImportColumnMap | undefined,
): Array<string | null> {
  return headers.map((h) => {
    let field: string | null
    if (columnMap && Object.prototype.hasOwnProperty.call(columnMap, h)) {
      field = columnMap[h] ?? null
    } else {
      field = h.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '')
    }
    if (field == null || field === '' || UNSAFE_FIELDS.has(field)) return null
    return field
  })
}

/** Build one typed record from a row of cells. Pure; no side effects on the
 *  shared error list (returns its own). */
function buildRecord(
  cells: string[],
  headerCount: number,
  fields: Array<string | null>,
  columnTypes: ImportColumnTypes | undefined,
  outRowIndex: number,
): { rec: Record<string, unknown>; errors: ImportRowError[] } {
  const rec: Record<string, unknown> = {}
  const errors: ImportRowError[] = []
  for (let i = 0; i < headerCount; i += 1) {
    const field = fields[i]
    if (field == null) continue
    const raw = cells[i] ?? ''
    const declaredType = columnTypes?.[field]
    if (declaredType) {
      const result = coerceTyped(raw, declaredType)
      if (result.ok) {
        rec[field] = result.value
      } else {
        errors.push({ rowIndex: outRowIndex, field, message: result.message })
        // Park the raw string so downstream code still sees SOMETHING.
        rec[field] = raw
      }
    } else {
      rec[field] = inferAndCoerce(raw)
    }
  }
  return { rec, errors }
}

/** Push `source` errors into `target`, stopping at `maxErrors`. Returns true
 *  when it had to truncate. */
function collectErrors(
  target: ImportRowError[],
  source: ImportRowError[],
  maxErrors: number | undefined,
): boolean {
  for (const e of source) {
    if (maxErrors != null && target.length >= maxErrors) return true
    target.push(e)
  }
  return false
}

/** Drop duplicate rows by `key`, keeping the last occurrence in place. */
function dedupeRows<TData>(rows: TData[], key: string): { rows: TData[]; deduped: number } {
  const idx = new Map<unknown, number>()
  const out: TData[] = []
  for (const r of rows) {
    const k = (r as Record<string, unknown>)?.[key]
    if (k == null) { out.push(r); continue }
    const at = idx.get(k)
    if (at !== undefined) out[at] = r
    else { idx.set(k, out.length); out.push(r) }
  }
  return { rows: out, deduped: rows.length - out.length }
}

function isBlankRow(cells: string[]): boolean {
  return cells.every((c) => c === undefined || c.trim() === '')
}

function abortError(): Error {
  const e = new Error('@svgrid/enterprise: import cancelled')
  e.name = 'AbortError'
  return e
}

/** Yield to the event loop so a long map doesn't block paint / input. */
function nextTick(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0))
}

function buildRecords<TData>(
  matrix: string[][],
  columnMap: ImportColumnMap | undefined,
  columnTypes: ImportColumnTypes | undefined,
  maxErrors?: number,
): { headers: string[]; rows: TData[]; skipped: number; errors: ImportRowError[]; errorsTruncated: boolean } {
  if (matrix.length === 0) return { headers: [], rows: [], skipped: 0, errors: [], errorsTruncated: false }
  const headers = (matrix[0] ?? []).map((h) => h.trim())
  const fields = computeFields(headers, columnMap)
  const dataRows = matrix.slice(1)
  const out: TData[] = []
  const errors: ImportRowError[] = []
  let skipped = 0
  let errorsTruncated = false
  // Skipped (blank) rows don't count toward the output row index used
  // in errors, so the indices match what the consumer's preview UI shows.
  let outRowIndex = 0
  for (const cells of dataRows) {
    if (isBlankRow(cells)) { skipped += 1; continue }
    const { rec, errors: rowErrs } = buildRecord(cells, headers.length, fields, columnTypes, outRowIndex)
    if (rowErrs.length && collectErrors(errors, rowErrs, maxErrors)) errorsTruncated = true
    out.push(rec as unknown as TData)
    outRowIndex += 1
  }
  return { headers, rows: out, skipped, errors, errorsTruncated }
}

/**
 * Strict per-type coercion used when the consumer declares
 * `columnTypes`. Returns either `{ ok: true, value }` or
 * `{ ok: false, message }` describing why the value couldn't be
 * shaped into the declared type.
 *
 * Empty values for required types (number, date) error rather than
 * silently coerce to 0 / null - the consumer can drop the row in
 * their validator if blanks should be tolerated.
 */
function coerceTyped(raw: string, type: ImportFieldType):
  | { ok: true; value: unknown }
  | { ok: false; message: string }
{
  const trimmed = raw.trim()
  // Empty cells map to `null` for most types and the empty string for
  // `string` - this is the only case where typed import returns a
  // null. Validator step is the right place to insist on "required".
  if (trimmed === '') {
    if (type === 'string') return { ok: true, value: '' }
    return { ok: true, value: null }
  }

  switch (type) {
    case 'string':
      return { ok: true, value: trimmed }

    case 'boolean': {
      const low = trimmed.toLowerCase()
      if (low === 'true' || low === '1' || low === 'yes' || low === 'y')  return { ok: true, value: true }
      if (low === 'false' || low === '0' || low === 'no' || low === 'n')  return { ok: true, value: false }
      return { ok: false, message: `not a boolean: ${trimmed}` }
    }

    case 'number': {
      const stripped = trimmed.replace(/[$,\s]/g, '')
      const n = Number(stripped)
      if (!Number.isFinite(n)) return { ok: false, message: `not a number: ${trimmed}` }
      return { ok: true, value: n }
    }

    case 'integer': {
      const stripped = trimmed.replace(/[$,\s]/g, '')
      const n = Number(stripped)
      if (!Number.isFinite(n) || !Number.isInteger(n)) {
        return { ok: false, message: `not an integer: ${trimmed}` }
      }
      return { ok: true, value: n }
    }

    case 'date': {
      // Accept ISO dates and a handful of common day-first / month-first
      // shapes. Returns ISO yyyy-mm-dd.
      const iso = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})/)
      if (iso) return { ok: true, value: `${iso[1]}-${iso[2]}-${iso[3]}` }
      // mm/dd/yyyy or dd/mm/yyyy - we don't try to disambiguate; the
      // demo can declare the locale via its own validator if it cares.
      const slash = trimmed.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/)
      if (slash) {
        const [, a, b, y] = slash
        // Default to mm/dd/yyyy because it's the dominant locale where
        // Excel exports without an explicit ISO format. Consumers
        // wanting EU-style can pre-normalise the file.
        return { ok: true, value: `${y}-${a!.padStart(2, '0')}-${b!.padStart(2, '0')}` }
      }
      const parsed = Date.parse(trimmed)
      if (!Number.isNaN(parsed)) {
        return { ok: true, value: new Date(parsed).toISOString().slice(0, 10) }
      }
      return { ok: false, message: `not a date: ${trimmed}` }
    }

    case 'datetime': {
      // Accept anything Date.parse handles.
      const parsed = Date.parse(trimmed)
      if (Number.isNaN(parsed)) return { ok: false, message: `not a datetime: ${trimmed}` }
      return { ok: true, value: new Date(parsed).toISOString().slice(0, 19) }
    }

    case 'json': {
      try {
        return { ok: true, value: JSON.parse(trimmed) }
      } catch {
        return { ok: false, message: `not valid JSON: ${trimmed.slice(0, 30)}...` }
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Parse-once + map, so a UI (SvImportDialog) can read a file ONCE and then
// re-map / re-validate as the user tweaks the column mapping without paying
// the parse (or unzip, for xlsx) cost on every keystroke.
// ---------------------------------------------------------------------------

/**
 * Read a file (or inline text) into a raw `string[][]` matrix - header row
 * first - without any mapping, coercion, or validation. The cheap half of
 * `importData`: parse the bytes once, then feed the matrix to
 * `mapImportMatrix` as many times as the mapping UI needs.
 */
export async function readImportMatrix(
  file: File | Blob | string,
  format: ImportFormat = 'auto',
  opts: { maxBytes?: number; encoding?: string; signal?: AbortSignal } = {},
): Promise<{ format: Exclude<ImportFormat, 'auto'>; matrix: string[][] }> {
  if (opts.signal?.aborted) throw abortError()
  // Guard the byte size BEFORE reading, so an oversized upload never lands
  // in memory.
  if (opts.maxBytes != null && file instanceof Blob && file.size > opts.maxBytes) {
    throw new Error(
      `@svgrid/enterprise: file is ${file.size.toLocaleString()} bytes, ` +
        `over the ${opts.maxBytes.toLocaleString()}-byte import limit.`,
    )
  }
  const fmt = sniffFormat(file, format)
  let matrix: string[][]
  if (fmt === 'xlsx') {
    if (typeof file === 'string') {
      throw new Error(
        '@svgrid/enterprise: xlsx import expects a File or Blob, not a string. ' +
          'Use format: "csv" or "tsv" for inline text.',
      )
    }
    matrix = await parseXlsx(file)
  } else if (fmt === 'json') {
    const text = typeof file === 'string' ? file : await readText(file, opts.encoding)
    matrix = jsonToMatrix(text)
  } else {
    const sep = fmt === 'tsv' ? '\t' : ','
    const text = typeof file === 'string' ? file : await readText(file, opts.encoding)
    matrix = parseDelimited(text, sep)
  }
  if (opts.signal?.aborted) throw abortError()
  return { format: fmt, matrix }
}

type MapMatrixOptions<TData> = {
  columnMap?: ImportColumnMap
  columnTypes?: ImportColumnTypes
  validator?: ImportValidator<TData>
  maxErrors?: number
  dedupeBy?: keyof TData | (string & {})
}

type MapMatrixResult<TData> = {
  headers: string[]
  rows: TData[]
  errors: ImportRowError[]
  skipped: number
  total: number
  errorsTruncated: boolean
  deduped: number
}

/** Run the validator over built rows, capping + flagging truncation. */
function applyValidator<TData>(
  rows: TData[],
  errors: ImportRowError[],
  validator: ImportValidator<TData> | undefined,
  maxErrors: number | undefined,
  startIndex = 0,
): boolean {
  if (!validator) return false
  let truncated = false
  for (let i = startIndex; i < rows.length; i += 1) {
    const errs = validator(rows[i]!, i)
    if (errs.length) {
      const mapped = errs.map((e) => ({ rowIndex: i, field: e.field, message: e.message }))
      if (collectErrors(errors, mapped, maxErrors)) { truncated = true; break }
    }
  }
  return truncated
}

/**
 * Apply a column map + declared types + validator to an already-parsed
 * matrix. The pure, synchronous half of `importData` - no I/O, no license
 * gate - so a preview UI can call it on every mapping change. For very large
 * files prefer `mapImportMatrixAsync`, which yields to keep the UI live.
 */
export function mapImportMatrix<TData extends RowData>(
  matrix: string[][],
  opts: MapMatrixOptions<TData> = {},
): MapMatrixResult<TData> {
  const built = buildRecords<TData>(matrix, opts.columnMap, opts.columnTypes, opts.maxErrors)
  const errors = built.errors
  // Type-coercion errors come first; the validator runs on the rows we
  // managed to build, so its errors share the same `rowIndex` basis.
  let errorsTruncated = built.errorsTruncated
  if (applyValidator(built.rows, errors, opts.validator, opts.maxErrors)) errorsTruncated = true
  let rows = built.rows
  let deduped = 0
  if (opts.dedupeBy) {
    const r = dedupeRows(rows, opts.dedupeBy as string)
    rows = r.rows
    deduped = r.deduped
  }
  return {
    headers: built.headers,
    rows,
    errors,
    skipped: built.skipped,
    total: matrix.length > 0 ? matrix.length - 1 : 0,
    errorsTruncated,
    deduped,
  }
}

/**
 * Non-blocking sibling of `mapImportMatrix`: yields to the event loop every
 * few thousand rows and reports progress, so mapping a 100k-row file never
 * freezes the tab. Honors an AbortSignal. Used by `importData` and the
 * SvImportDialog preview.
 */
export async function mapImportMatrixAsync<TData extends RowData>(
  matrix: string[][],
  opts: MapMatrixOptions<TData> & {
    signal?: AbortSignal
    onProgress?: (progress: ImportProgress) => void
    /** Rows per chunk before yielding. Default 5000. */
    chunkSize?: number
  } = {},
): Promise<MapMatrixResult<TData>> {
  const headers = (matrix[0] ?? []).map((h) => h.trim())
  const fields = computeFields(headers, opts.columnMap)
  const dataRows = matrix.slice(1)
  const total = dataRows.length
  const chunk = Math.max(1, opts.chunkSize ?? 5000)
  const rows: TData[] = []
  const errors: ImportRowError[] = []
  let skipped = 0
  let outRowIndex = 0
  let errorsTruncated = false

  for (let i = 0; i < total; i += 1) {
    if (opts.signal?.aborted) throw abortError()
    const cells = dataRows[i]!
    if (isBlankRow(cells)) { skipped += 1 } else {
      const { rec, errors: rowErrs } = buildRecord(cells, headers.length, fields, opts.columnTypes, outRowIndex)
      if (rowErrs.length && collectErrors(errors, rowErrs, opts.maxErrors)) errorsTruncated = true
      rows.push(rec as unknown as TData)
      outRowIndex += 1
    }
    if ((i + 1) % chunk === 0) {
      opts.onProgress?.({ phase: 'map', ratio: total ? (i + 1) / total : 1, done: i + 1, total })
      await nextTick()
    }
  }

  if (applyValidator(rows, errors, opts.validator, opts.maxErrors)) errorsTruncated = true

  let finalRows = rows
  let deduped = 0
  if (opts.dedupeBy) {
    const r = dedupeRows(rows, opts.dedupeBy as string)
    finalRows = r.rows
    deduped = r.deduped
  }
  opts.onProgress?.({ phase: 'map', ratio: 1, done: total, total })
  return {
    headers,
    rows: finalRows,
    errors,
    skipped,
    total: matrix.length > 0 ? matrix.length - 1 : 0,
    errorsTruncated,
    deduped,
  }
}

/** Fold a header / field down to letters + digits so "Unit Price", "unit_price"
 *  and "UnitPrice" all collapse to the same key. */
function normalizeHeader(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, '')
}

/**
 * Fuzzy-match each source header to one of the grid's columns (by header
 * label first, then field name) and return a `source header -> target
 * field` map. Headers with no confident match are left OUT of the map, so
 * `buildRecords` falls back to its snake_case default for them.
 */
export function autoMapColumns(
  headers: string[],
  columns: ReadonlyArray<ImportGridColumn>,
): ImportColumnMap {
  const byKey = new Map<string, string>()
  for (const c of columns) {
    const field = c.field ?? c.header
    if (!field) continue
    // Field name is the strongest signal, so register header first then let
    // the field key overwrite on a collision.
    if (c.header) byKey.set(normalizeHeader(c.header), field)
    if (c.field) byKey.set(normalizeHeader(c.field), c.field)
  }
  const map: ImportColumnMap = {}
  for (const h of headers) {
    const hit = byKey.get(normalizeHeader(h))
    if (hit) map[h] = hit
  }
  return map
}

/**
 * Infer strict import types from each grid column's `format`, so a currency
 * / number / percent column parses "$1,234" -> 1234 and a date column parses
 * "2026-03-04" -> an ISO date. Columns with no informative format are left
 * out (best-effort coercion applies).
 */
export function inferImportColumnTypes(
  columns: ReadonlyArray<ImportGridColumn>,
): ImportColumnTypes {
  const types: ImportColumnTypes = {}
  for (const c of columns) {
    if (!c.field) continue
    const t = c.format?.type
    if (t === 'number' || t === 'currency' || t === 'percent') types[c.field] = 'number'
    else if (t === 'date') types[c.field] = 'date'
    else if (t === 'datetime') types[c.field] = 'datetime'
  }
  return types
}

// ---------------------------------------------------------------------------
// Public entry point
// ---------------------------------------------------------------------------

/**
 * Read a file (or inline text), parse, optionally validate + commit. The
 * sister function of `exportGrid`.
 */
export async function importData<
  TFeatures extends TableFeatures,
  TData extends RowData,
>(
  api: SvGridApi<TFeatures, TData>,
  opts: ImportOptions<TData>,
): Promise<ImportResult<TData>> {
  assertEnterpriseLicensed('Import')
  const { format, matrix } = await readImportMatrix(opts.file, opts.format ?? 'auto', {
    maxBytes: opts.maxBytes,
    encoding: opts.encoding,
    signal: opts.signal,
  })

  // Enforce the row cap before we do the O(rows) mapping work: either reject
  // outright, or truncate to the first maxRows and flag it.
  const dataCount = matrix.length > 0 ? matrix.length - 1 : 0
  let workMatrix = matrix
  let truncated = false
  if (opts.maxRows != null && dataCount > opts.maxRows) {
    if (opts.overLimit === 'truncate') {
      workMatrix = matrix.slice(0, opts.maxRows + 1) // header + first maxRows
      truncated = true
    } else {
      throw new Error(
        `@svgrid/enterprise: import has ${dataCount.toLocaleString()} rows, ` +
          `over the maxRows limit of ${opts.maxRows.toLocaleString()}.`,
      )
    }
  }

  // Grid-aware auto-mapping: derive the columnMap + columnTypes from the
  // grid's own columns, but let anything the caller passed win.
  let columnMap = opts.columnMap
  let columnTypes = opts.columnTypes
  if (opts.autoMap) {
    const gridCols = api.getColumns() as ReadonlyArray<ImportGridColumn>
    const headers = (workMatrix[0] ?? []).map((h) => h.trim())
    columnMap = { ...autoMapColumns(headers, gridCols), ...(opts.columnMap ?? {}) }
    columnTypes = { ...inferImportColumnTypes(gridCols), ...(opts.columnTypes ?? {}) }
  }

  const { headers, rows, errors, skipped, errorsTruncated, deduped } =
    await mapImportMatrixAsync<TData>(workMatrix, {
      columnMap,
      columnTypes,
      validator: opts.validator,
      maxErrors: opts.maxErrors,
      dedupeBy: opts.dedupeBy,
      signal: opts.signal,
      onProgress: opts.onProgress,
    })

  if (opts.commit && errors.length === 0 && rows.length > 0) {
    api.addRows(rows, opts.commitAt ?? 'bottom')
  }

  // `total` reports the ORIGINAL source row count even when truncated, so the
  // caller can say "imported X of Y".
  return { headers, rows, errors, skipped, total: dataCount, format, errorsTruncated, deduped, truncated }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function readText(blob: Blob, encoding?: string): Promise<string> {
  // The default UTF-8 path is fastest; a declared non-UTF-8 encoding (legacy
  // Windows-1252 CSVs, etc.) routes through TextDecoder.
  if (encoding && encoding.toLowerCase() !== 'utf-8' && encoding.toLowerCase() !== 'utf8') {
    const buf = await blob.arrayBuffer()
    return new TextDecoder(encoding).decode(buf)
  }
  return blob.text()
}

/** Convert JSON text containing an array of objects into a `string[][]`
 *  matrix shaped like CSV: header row, then one row per record. */
function jsonToMatrix(text: string): string[][] {
  const parsed = JSON.parse(text)
  if (!Array.isArray(parsed)) {
    throw new Error('@svgrid/enterprise: JSON import expects a top-level array')
  }
  if (parsed.length === 0) return []
  // Collect the union of keys across the first ~50 records so we don't
  // miss a column present only on later rows.
  const headers: string[] = []
  const seen = new Set<string>()
  const sample = parsed.slice(0, 50) as Record<string, unknown>[]
  for (const r of sample) {
    if (r && typeof r === 'object') {
      for (const k of Object.keys(r)) {
        if (!seen.has(k)) { seen.add(k); headers.push(k) }
      }
    }
  }
  const rows: string[][] = [headers.slice()]
  for (const r of parsed as Array<Record<string, unknown>>) {
    const row: string[] = []
    for (const h of headers) {
      const v = r?.[h]
      if (v == null) row.push('')
      else if (typeof v === 'object') row.push(JSON.stringify(v))
      else row.push(String(v))
    }
    rows.push(row)
  }
  return rows
}
