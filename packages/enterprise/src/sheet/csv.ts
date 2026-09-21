import { parseEntry } from './entry'
import { formatKeyAt, type CellFormatEntry } from './format-store'
import type { SheetState } from './document'

/**
 * A sheet as CSV, the way Excel's Save As CSV writes one: what the cells
 * SHOW, so a formula goes out as its value and a formatted number as its
 * text; a field with a comma, a quote or a line break in quotes, a quote
 * doubled; CRLF between rows; trailing empty cells kept so every row has
 * the sheet's width.
 */
export function csvText(rows: ReadonlyArray<ReadonlyArray<string>>, separator = ','): string {
  const width = rows.reduce((max, row) => Math.max(max, row.length), 0)
  const field = (text: string): string =>
    /[",\r\n]/.test(text) || text.includes(separator) ? `"${text.replace(/"/g, '""')}"` : text
  return rows
    .map((row) => Array.from({ length: width }, (_, i) => field(row[i] ?? '')).join(separator))
    .join('\r\n')
}

/**
 * CSV text back into rows.
 *
 * A scan, not a split: a quoted field may hold the separator, a line break
 * or a doubled quote, and every real export uses all three. CRLF and LF both
 * end a row, a BOM at the start is dropped (Excel writes one), and the
 * separator is guessed when it is not given, so a semicolon file from a
 * European Excel and a tab file pasted from anywhere read as themselves.
 */
export function csvRows(text: string, separator?: string): string[][] {
  const body = text.replace(/^﻿/, '')
  if (body === '') return []
  const sep = separator ?? guessCsvSeparator(body)
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let quoted = false
  let i = 0
  const endField = () => { row.push(field); field = '' }
  const endRow = () => { endField(); rows.push(row); row = [] }
  while (i < body.length) {
    const ch = body[i]!
    if (quoted) {
      if (ch === '"') {
        if (body[i + 1] === '"') { field += '"'; i += 2; continue }
        quoted = false
        i += 1
        continue
      }
      field += ch
      i += 1
      continue
    }
    if (ch === '"' && field === '') { quoted = true; i += 1; continue }
    if (body.startsWith(sep, i)) { endField(); i += sep.length; continue }
    if (ch === '\r') { if (body[i + 1] === '\n') i += 1; endRow(); i += 1; continue }
    if (ch === '\n') { endRow(); i += 1; continue }
    field += ch
    i += 1
  }
  if (field !== '' || row.length) endRow()
  return rows
}

/** The separator a file uses: the one that divides its first lines evenly. */
export function guessCsvSeparator(text: string): string {
  const lines = text.split(/\r?\n/).filter((line) => line !== '').slice(0, 20)
  if (!lines.length) return ','
  let best: { sep: string; score: number } | null = null
  for (const sep of [',', ';', '\t', '|']) {
    // Count outside quotes: a comma inside "Smith, John" divides nothing.
    const counts = lines.map((line) => {
      let n = 0
      let quoted = false
      for (let i = 0; i < line.length; i += 1) {
        const ch = line[i]!
        if (ch === '"') { quoted = !quoted; continue }
        if (!quoted && line.startsWith(sep, i)) n += 1
      }
      return n
    })
    const present = counts.filter((n) => n > 0).length
    if (!present) continue
    const first = counts.find((n) => n > 0) ?? 0
    const even = counts.every((n) => n === 0 || n === first)
    const score = present * (even ? 3 : 1) + first
    if (!best || score > best.score) best = { sep, score }
  }
  return best?.sep ?? ','
}

/**
 * A CSV (or TSV) file as a one-sheet document.
 *
 * Every spreadsheet exports CSV and every one of them reads it back the same
 * way: a field that looks like a number IS a number, and one that looks like
 * a percentage, a currency amount or a grouped number keeps the format it
 * implies, which is what `parseEntry` decides for typing. A field is never
 * read as a formula - a CSV holding `=1+1` is text in Excel too, since the
 * file came from somewhere else.
 */
export function sheetStateFromCsv(text: string, sheetName = 'Sheet1', separator?: string): SheetState {
  const rows = csvRows(text, separator)
  const cells: string[][] = []
  const formats: Record<string, CellFormatEntry> = {}
  rows.forEach((row, r) => {
    const line: string[] = []
    row.forEach((field, c) => {
      const parsed = field === '' ? null : parseEntry(field)
      if (parsed) {
        line.push(parsed.value)
        if (parsed.numFmt) formats[formatKeyAt(r, c)] = { numFmt: parsed.numFmt }
        return
      }
      // A leading = would be read as a formula by the workbook, and this
      // text was never one: Excel's own CSV import keeps it as it reads.
      line.push(field.startsWith('=') ? `'${field}` : field)
    })
    cells.push(line)
  })
  return {
    version: 1,
    workbook: { sheets: [{ name: sheetName, cells }], active: sheetName, names: {} },
    sheets: {
      [sheetName]: {
        formats, columnWidths: {}, rowHeights: [], hidden: { rows: [], cols: [] },
        freeze: { rows: 0, cols: 0 }, comments: {}, protected: false,
        merges: [], validation: [], conditionalFormats: [], autoFilter: null,
      },
    },
  }
}
