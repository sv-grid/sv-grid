/**
 * Pure, render-free value formatting for data export. The grid's on-screen
 * `formatCellValue` (see cell-render.ts) is a closure bound to a `Row<TData>`
 * and the live table, so it can't be reused directly by an exporter that only
 * has raw values + a column's `format` config. These helpers replicate the
 * numeric / date / percent branches of that formatter as standalone functions:
 *
 *   - `formatValueForExport(value, format)` returns the display STRING a user
 *     sees on screen, so CSV / TSV / HTML / PDF exports are faithful to the
 *     grid ("what you see is what you export") instead of dumping raw values.
 *   - `toExcelNumFmt(format)` maps a `CellFormatConfig` to an Excel number
 *     format code, so an xlsx cell can stay a real number / date while still
 *     displaying formatted (currency symbol, thousands, date pattern).
 *
 * Custom per-row `formatter` callbacks are intentionally NOT handled here -
 * they may close over row/table state. Columns that need custom export text
 * should provide an `exportValue(row)` hook at the export layer instead.
 */
import type { CellFormatConfig } from './core'
import {
  formatNumericWithConfig,
  getDateFormatter,
  resolveDatePattern,
} from './cell-formatting'

// Re-export the pure conditional-formatting engine here too, so the
// Svelte-free `@svgrid/grid/format` subpath carries it for @svgrid/enterprise's
// export code (which must not pull in SvGrid.svelte).
export {
  computeColumnStat,
  contrastText,
  formatsNeedingStats,
  resolveCellFormat,
  type ColumnStat,
  type ConditionalFormat,
  type ResolvedCellFormat,
} from './conditional-formatting'

/** Best-effort coercion of a cell value to a Date. Accepts Date, epoch ms
 *  numbers, and parseable date strings. Returns null when it isn't a date. */
export function coerceExportDate(value: unknown): Date | null {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value
  if (typeof value === 'number' && Number.isFinite(value)) {
    const d = new Date(value)
    return Number.isNaN(d.getTime()) ? null : d
  }
  if (typeof value === 'string' && value.trim() !== '') {
    const d = new Date(value)
    return Number.isNaN(d.getTime()) ? null : d
  }
  return null
}

/**
 * Format a raw cell value to its on-screen display string using the column's
 * `format` config. Mirrors the grid's own numeric / currency / percent / date
 * branches. Values with no (or an unrecognised) format fall back to
 * `String(value)`, and `null` / `undefined` become an empty string.
 */
export function formatValueForExport(
  value: unknown,
  format: CellFormatConfig | undefined,
): string {
  if (value == null) return ''
  if (!format) return String(value)

  if (format.type === 'number' || format.type === 'currency' || format.type === 'percent') {
    return formatNumericWithConfig(value, {
      type: format.type,
      locales: format.locales,
      currency: format.type === 'currency' ? (format.currency ?? 'USD') : undefined,
      valueIsPercentPoints:
        format.type === 'percent' ? format.valueIsPercentPoints : undefined,
      options: format.options,
    })
  }

  if (format.type === 'date' || format.type === 'datetime') {
    const parsed = coerceExportDate(value)
    if (parsed) {
      const preset = resolveDatePattern(format.pattern, format.type)
      const merged: Intl.DateTimeFormatOptions =
        preset || format.options
          ? { ...preset, ...format.options }
          : format.type === 'date'
            ? { year: 'numeric', month: '2-digit', day: '2-digit' }
            : {
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
              }
      return getDateFormatter(format.locales, merged).format(parsed)
    }
  }

  return String(value)
}

/**
 * Map a `CellFormatConfig` to an Excel/OOXML number-format code, so an xlsx
 * writer can keep the cell numeric/date while displaying it formatted.
 * Returns `undefined` when the format has no natural Excel representation
 * (or the caller should just write a string).
 *
 * These are deliberately conservative, widely-recognised codes:
 *   number   → `#,##0[.00…]`   (grouping + N decimals)
 *   currency → `"$"#,##0.00`   (symbol + grouping + 2 decimals)
 *   percent  → `0[.00…]%`      (Excel multiplies by 100, so this pairs with a
 *                               0..1 fraction; see `valueForExcel`)
 *   date     → `yyyy-mm-dd`, datetime → `yyyy-mm-dd hh:mm`
 */
export function toExcelNumFmt(format: CellFormatConfig | undefined): string | undefined {
  if (!format) return undefined

  const decimals = (): number => {
    // `options` is a union across number/date formats; only the numeric ones
    // carry fraction-digit hints, so read them through a narrow shape.
    const o = format.options as
      | { maximumFractionDigits?: number; minimumFractionDigits?: number }
      | undefined
    if (o && typeof o.maximumFractionDigits === 'number') return o.maximumFractionDigits
    if (o && typeof o.minimumFractionDigits === 'number') return o.minimumFractionDigits
    return format.type === 'currency' ? 2 : format.type === 'number' ? 0 : 2
  }
  const dp = (n: number) => (n > 0 ? '.' + '0'.repeat(n) : '')

  switch (format.type) {
    case 'number':
      return `#,##0${dp(decimals())}`
    case 'currency': {
      const sym = currencySymbol(format.currency ?? 'USD')
      return `"${sym}"#,##0${dp(decimals())}`
    }
    case 'percent':
      return `0${dp(decimals())}%`
    case 'date':
      return 'yyyy-mm-dd'
    case 'datetime':
      return 'yyyy-mm-dd hh:mm'
    default:
      return undefined
  }
}

/**
 * Turn a grid's data rows + columns into the header-first `{ field: value }`
 * record shape the serializers consume, applying each column's `format` so
 * the export matches what's on screen (unless `rawValues`). Optionally
 * restricts + reorders columns to a `columns` field subset.
 */
export function projectGridRows(
  dataRows: ReadonlyArray<Record<string, unknown>>,
  columns: ReadonlyArray<GridExportColumn>,
  opts: { columns?: ReadonlyArray<string>; rawValues?: boolean } = {},
): {
  records: Array<Record<string, unknown>>
  fields: string[]
  align: Record<string, 'left' | 'center' | 'right'>
} {
  const chosen =
    opts.columns && opts.columns.length
      ? opts.columns
          .map((f) => columns.find((c) => c.field === f))
          .filter((c): c is GridExportColumn => !!c)
      : columns.filter((c) => c.field)
  const fields = chosen.map((c) => c.field)
  const align: Record<string, 'left' | 'center' | 'right'> = {}
  for (const c of chosen) if (c.align) align[c.field] = c.align

  const header: Record<string, unknown> = {}
  for (const c of chosen) header[c.field] = c.header
  const records: Array<Record<string, unknown>> = [header]
  for (const row of dataRows) {
    const rec: Record<string, unknown> = {}
    for (const c of chosen) {
      const raw = row[c.field]
      rec[c.field] = opts.rawValues ? raw : formatValueForExport(raw, c.format)
    }
    records.push(rec)
  }
  return { records, fields, align }
}

/** A tiny currency-code → symbol map for the Excel numFmt code. Falls back
 *  to the ISO code itself (e.g. "CHF") when we don't have a glyph. */
function currencySymbol(code: string): string {
  const map: Record<string, string> = {
    USD: '$',
    EUR: '€',
    GBP: '£',
    JPY: '¥',
    CNY: '¥',
    INR: '₹',
    KRW: '₩',
    RUB: '₽',
    BRL: 'R$',
  }
  return map[code.toUpperCase()] ?? code.toUpperCase()
}

/**
 * The value to write into a native xlsx cell that carries an Excel numFmt.
 * Numbers stay numbers; percent values are divided to the 0..1 fraction Excel
 * expects (unless the config already stores 0..1); dates become real `Date`s.
 * Returns `{ ok: false }` when the value can't be represented natively and the
 * caller should fall back to the formatted string.
 */
export function valueForExcel(
  value: unknown,
  format: CellFormatConfig | undefined,
): { ok: true; value: number | Date } | { ok: false } {
  if (value == null || !format) return { ok: false }

  if (format.type === 'number' || format.type === 'currency') {
    const n = typeof value === 'number' ? value : Number(value)
    return Number.isFinite(n) ? { ok: true, value: n } : { ok: false }
  }
  if (format.type === 'percent') {
    const n = typeof value === 'number' ? value : Number(value)
    if (!Number.isFinite(n)) return { ok: false }
    // Excel's percent numFmt multiplies by 100, so it wants the fraction.
    return { ok: true, value: format.valueIsPercentPoints === true ? n / 100 : n }
  }
  if (format.type === 'date' || format.type === 'datetime') {
    const d = coerceExportDate(value)
    return d ? { ok: true, value: d } : { ok: false }
  }
  return { ok: false }
}

// ===========================================================================
// Free data export (CSV / TSV / JSON) + delivery. Kept in this same
// Svelte-free module (the `@svgrid/grid/format` subpath) so @svgrid/enterprise
// re-uses ONE implementation of each serializer. Input is already-projected
// rows: an array of `{ field: value }` records whose FIRST record is the
// header row. Use `projectGridRows` above to build that shape.
// ===========================================================================

// ----- Public option types (shared by the grid API export methods) ---------

export type GridExportScope = 'displayed' | 'selected' | 'all'

/** The slice of a grid column an exporter needs. Accepts `api.getColumns()`. */
export type GridExportColumn = {
  field: string
  header: string
  format?: CellFormatConfig | undefined
  align?: 'left' | 'center' | 'right'
}

export type GridExportOptions = {
  /** Base filename (no extension). Default 'grid'. */
  filename?: string
  /** Which rows to export. Default 'displayed' (current view). */
  rows?: GridExportScope
  /** Restrict to these fields, in this order. Default: all visible columns. */
  columns?: string[]
  /** Export raw values instead of the on-screen formatted display. Default false. */
  rawValues?: boolean
  /** Prepend a UTF-8 BOM (csv/tsv) so Excel detects UTF-8. Default true. */
  bom?: boolean
  /** Cancel a large export. */
  signal?: AbortSignal
  /** Progress for large exports. */
  onProgress?: (progress: SerializeProgress) => void
  /** When false, skip the browser download and just return the text. Default true. */
  download?: boolean
}

export type GridClipboardFormat = 'csv' | 'tsv' | 'markdown'

export type GridClipboardOptions = {
  /** Clipboard payload format. Default 'tsv' (pastes straight into Excel). */
  format?: GridClipboardFormat
  rows?: GridExportScope
  columns?: string[]
  rawValues?: boolean
}

// ----- Serializers ---------------------------------------------------------

export type SerializeProgress = {
  phase: 'serialize'
  /** 0..1 completion of the row walk. */
  ratio: number
  row: number
  total: number
}

export type CsvOptions = {
  /** Field delimiter. Default ',' (','→CSV, '\t'→TSV). */
  delimiter?: string
  /** Line ending between records. Default '\r\n' (Excel-friendly). */
  eol?: string
  /** Prepend a UTF-8 BOM so Excel detects UTF-8. Default true for csv/tsv. */
  bom?: boolean
}

export type SerializeOptions = {
  onProgress?: (p: SerializeProgress) => void
  signal?: AbortSignal
  csv?: CsvOptions
  /** Rows processed between event-loop yields. Default 5000. */
  chunkRows?: number
}

const EXPORT_BOM = '﻿'

function throwIfAborted(signal: AbortSignal | undefined): void {
  if (signal?.aborted) {
    throw new DOMException('Export aborted', 'AbortError')
  }
}

/** Let the event loop breathe (paint a progress bar, honour an abort). */
const yieldToLoop = (): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, 0))

/** RFC-4180 quoting: wrap in double quotes and double any embedded quote
 *  when the value contains the delimiter, a quote, or a newline. */
function csvCell(value: unknown, delimiter: string): string {
  const s =
    value == null
      ? ''
      : value instanceof Date
        ? value.toISOString()
        : String(value)
  if (s === '') return s
  if (s.includes(delimiter) || s.includes('"') || s.includes('\n') || s.includes('\r')) {
    return `"${s.replace(/"/g, '""')}"`
  }
  return s
}

/**
 * Serialize projected rows to a delimited string (CSV / TSV).
 * `rows[0]` is treated as the header row.
 */
export async function serializeDelimited(
  rows: ReadonlyArray<Record<string, unknown>>,
  fields: ReadonlyArray<string>,
  opts: SerializeOptions = {},
): Promise<string> {
  const delimiter = opts.csv?.delimiter ?? ','
  const eol = opts.csv?.eol ?? '\r\n'
  const useBom = opts.csv?.bom ?? true
  const chunk = Math.max(1, opts.chunkRows ?? 5000)
  const total = rows.length

  const parts: string[] = []
  for (let i = 0; i < rows.length; i++) {
    throwIfAborted(opts.signal)
    const row = rows[i]!
    parts.push(fields.map((f) => csvCell(row[f], delimiter)).join(delimiter))
    if (i > 0 && i % chunk === 0) {
      opts.onProgress?.({ phase: 'serialize', ratio: i / total, row: i, total })
      await yieldToLoop()
    }
  }
  opts.onProgress?.({ phase: 'serialize', ratio: 1, row: total, total })
  const body = parts.join(eol)
  return (useBom ? EXPORT_BOM : '') + body
}

const HTML_ESCAPE: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
}
function htmlCell(value: unknown): string {
  const s =
    value == null ? '' : value instanceof Date ? value.toISOString() : String(value)
  return s.replace(/[&<>"']/g, (c) => HTML_ESCAPE[c]!)
}

export type ExportCellVisual = { fill?: string; color?: string; bold?: boolean; icon?: string }

/**
 * Serialize projected rows to a standalone HTML `<table>` document.
 * `rows[0]` is the header row (rendered as `<th>`); the rest are `<td>`.
 */
export async function serializeHtml(
  rows: ReadonlyArray<Record<string, unknown>>,
  fields: ReadonlyArray<string>,
  opts: SerializeOptions & {
    title?: string
    align?: Record<string, 'left' | 'center' | 'right'>
    /** Per-data-cell conditional-format visual (`rowIdx` is 0-based over data). */
    cellStyle?: (rowIdx: number, colIdx: number) => ExportCellVisual | undefined
    /** Per-data-cell hyperlink URL. */
    cellLink?: (rowIdx: number, colIdx: number) => string | undefined
  } = {},
): Promise<string> {
  const chunk = Math.max(1, opts.chunkRows ?? 5000)
  const total = rows.length
  const align = opts.align ?? {}
  const cellStyle = opts.cellStyle
  const cellLink = opts.cellLink
  const title = opts.title ?? 'Grid export'

  const head = rows[0]
  const th = head
    ? fields.map((f) => `<th>${htmlCell(head[f])}</th>`).join('')
    : ''

  const bodyParts: string[] = []
  for (let i = 1; i < rows.length; i++) {
    throwIfAborted(opts.signal)
    const row = rows[i]!
    const tds = fields
      .map((f, ci) => {
        const a = align[f]
        const styles: string[] = []
        if (a && a !== 'left') styles.push(`text-align:${a}`)
        const cf = cellStyle?.(i - 1, ci)
        if (cf?.fill) styles.push(`background:${cf.fill}`)
        if (cf?.color) styles.push(`color:${cf.color}`)
        if (cf?.bold) styles.push('font-weight:700')
        const style = styles.length ? ` style="${styles.join(';')}"` : ''
        let text = cf?.icon ? `${cf.icon} ${htmlCell(row[f])}` : htmlCell(row[f])
        const href = cellLink?.(i - 1, ci)
        if (href) text = `<a href="${htmlCell(href)}">${text}</a>`
        return `<td${style}>${text}</td>`
      })
      .join('')
    bodyParts.push(`<tr>${tds}</tr>`)
    if (i > 0 && i % chunk === 0) {
      opts.onProgress?.({ phase: 'serialize', ratio: i / total, row: i, total })
      await yieldToLoop()
    }
  }
  opts.onProgress?.({ phase: 'serialize', ratio: 1, row: total, total })

  return (
    `<!doctype html><html><head><meta charset="utf-8"><title>${htmlCell(title)}</title>` +
    `<style>table{border-collapse:collapse;font-family:system-ui,sans-serif;font-size:13px}` +
    `th,td{border:1px solid #d0d7de;padding:6px 10px}th{background:#f6f8fa;text-align:left}</style>` +
    `</head><body><table><thead><tr>${th}</tr></thead><tbody>${bodyParts.join('')}</tbody></table></body></html>`
  )
}

/**
 * Serialize projected rows to a JSON array of `{ field: value }` objects.
 * `rows[0]` (the header row) is dropped - JSON keys are the field names.
 */
export async function serializeJson(
  rows: ReadonlyArray<Record<string, unknown>>,
  fields: ReadonlyArray<string>,
  opts: SerializeOptions = {},
): Promise<string> {
  const chunk = Math.max(1, opts.chunkRows ?? 5000)
  const total = rows.length - 1
  const out: Array<Record<string, unknown>> = []
  for (let i = 1; i < rows.length; i++) {
    throwIfAborted(opts.signal)
    const src = rows[i]!
    const obj: Record<string, unknown> = {}
    for (const f of fields) obj[f] = src[f]
    out.push(obj)
    if (i > 0 && i % chunk === 0) {
      opts.onProgress?.({ phase: 'serialize', ratio: i / total, row: i, total })
      await yieldToLoop()
    }
  }
  opts.onProgress?.({ phase: 'serialize', ratio: 1, row: total, total })
  return JSON.stringify(out, null, 2)
}

/** Escape a Markdown table cell: pipes and newlines would break the row. */
function mdCell(value: unknown): string {
  const s = value == null ? '' : value instanceof Date ? value.toISOString() : String(value)
  return s.replace(/\\/g, '\\\\').replace(/\|/g, '\\|').replace(/\r?\n/g, '<br>')
}

/**
 * Serialize projected rows to a GitHub-flavored Markdown table. `rows[0]` is
 * the header row; `align` sets the `:---`, `:--:`, `---:` markers per column.
 */
export async function serializeMarkdown(
  rows: ReadonlyArray<Record<string, unknown>>,
  fields: ReadonlyArray<string>,
  opts: SerializeOptions & { align?: Record<string, 'left' | 'center' | 'right'> } = {},
): Promise<string> {
  const chunk = Math.max(1, opts.chunkRows ?? 5000)
  const total = rows.length
  const align = opts.align ?? {}
  const head = rows[0]

  const headerLine = `| ${fields.map((f) => mdCell(head?.[f])).join(' | ')} |`
  const sepLine = `| ${fields
    .map((f) => {
      const a = align[f]
      return a === 'right' ? '---:' : a === 'center' ? ':--:' : '---'
    })
    .join(' | ')} |`

  const bodyLines: string[] = []
  for (let i = 1; i < rows.length; i++) {
    throwIfAborted(opts.signal)
    const src = rows[i]!
    bodyLines.push(`| ${fields.map((f) => mdCell(src[f])).join(' | ')} |`)
    if (i > 0 && i % chunk === 0) {
      opts.onProgress?.({ phase: 'serialize', ratio: i / total, row: i, total })
      await yieldToLoop()
    }
  }
  opts.onProgress?.({ phase: 'serialize', ratio: 1, row: total, total })
  return [headerLine, sepLine, ...bodyLines].join('\n') + '\n'
}

const XML_ESCAPE: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&apos;',
}
function xmlText(value: unknown): string {
  const s = value == null ? '' : value instanceof Date ? value.toISOString() : String(value)
  // Stripping control characters is the point: XML 1.0 forbids them outright,
  // so a stray \x00 from a data source would produce an unopenable file.
  // eslint-disable-next-line no-control-regex
  return s.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '').replace(/[&<>"']/g, (c) => XML_ESCAPE[c]!)
}
/** Coerce a field name into a valid XML element name. */
function xmlTag(field: string): string {
  const t = field.replace(/[^A-Za-z0-9_.-]/g, '_')
  return /^[A-Za-z_]/.test(t) ? t : `_${t}`
}

/**
 * Serialize projected rows to a simple XML document:
 * `<rows><row><field>value</field>…</row>…</rows>`. `rows[0]` (header) is
 * dropped - element names come from the field names.
 */
export async function serializeXml(
  rows: ReadonlyArray<Record<string, unknown>>,
  fields: ReadonlyArray<string>,
  opts: SerializeOptions & { rootTag?: string; rowTag?: string } = {},
): Promise<string> {
  const chunk = Math.max(1, opts.chunkRows ?? 5000)
  const total = rows.length - 1
  const root = opts.rootTag ?? 'rows'
  const rowTag = opts.rowTag ?? 'row'
  const tags = fields.map(xmlTag)

  const parts: string[] = [`<?xml version="1.0" encoding="UTF-8"?>`, `<${root}>`]
  for (let i = 1; i < rows.length; i++) {
    throwIfAborted(opts.signal)
    const src = rows[i]!
    const cells = fields
      .map((f, ci) => `<${tags[ci]}>${xmlText(src[f])}</${tags[ci]}>`)
      .join('')
    parts.push(`  <${rowTag}>${cells}</${rowTag}>`)
    if (i > 0 && i % chunk === 0) {
      opts.onProgress?.({ phase: 'serialize', ratio: i / total, row: i, total })
      await yieldToLoop()
    }
  }
  parts.push(`</${root}>`)
  opts.onProgress?.({ phase: 'serialize', ratio: 1, row: total, total })
  return parts.join('\n')
}

// ----- Delivery: download + clipboard (browser-guarded) --------------------

/** Trigger a browser download of an already-built Blob. No-op guard for SSR. */
export function downloadBlobFile(blob: Blob, filename: string): void {
  if (typeof document === 'undefined' || typeof URL === 'undefined') {
    throw new Error('@svgrid/grid: export requires a browser environment')
  }
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 0)
}

/** Trigger a browser download of a text blob. No-op guard for SSR. */
export function downloadTextFile(text: string, filename: string, mime: string): void {
  if (typeof document === 'undefined' || typeof URL === 'undefined') {
    throw new Error('@svgrid/grid: text export requires a browser environment')
  }
  downloadBlobFile(new Blob([text], { type: mime }), filename)
}

/** Write text to the system clipboard. Throws when the API is unavailable
 *  (insecure context / SSR). */
export async function copyTextToClipboard(text: string): Promise<void> {
  if (typeof navigator === 'undefined' || !navigator.clipboard) {
    throw new Error('@svgrid/grid: clipboard API is unavailable in this context')
  }
  await navigator.clipboard.writeText(text)
}
