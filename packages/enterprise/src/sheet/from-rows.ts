/**
 * Rows into a sheet: the cells a workbook takes from an array of records,
 * the way a grid's rows read when pasted into Excel. A header row of
 * labels, one row per record with each value as the text the engine
 * reads (a number as its digits, a boolean as TRUE / FALSE, a Date as
 * `yyyy-mm-dd`, nothing for null), and, when asked, a totals row with a
 * SUM over every column that held a number. What comes out is what
 * `createWorkbook` and `<SvSheet data>` take.
 */
import { colToLetters } from './address'

export type SheetField = { field: string; label?: string }

export type SheetFromRowsOptions = {
  /** A last row with `=SUM(...)` over each column that held a number. */
  totals?: boolean
  /** The first cell of the totals row. */
  totalsLabel?: string
}

/** A record's value as the raw text a cell holds. */
export function cellTextOf(value: unknown): string {
  if (value === null || value === undefined) return ''
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : ''
  if (typeof value === 'boolean') return value ? 'TRUE' : 'FALSE'
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? '' : value.toISOString().slice(0, 10)
  if (typeof value === 'string') return value.startsWith('=') ? `'${value}` : value
  if (typeof value === 'bigint') return value.toString()
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}

/** The cells: a header row, a row per record, and a totals row when asked. */
export function sheetCellsFromRows(
  rows: ReadonlyArray<Record<string, unknown>>,
  fields: ReadonlyArray<SheetField | string>,
  options: SheetFromRowsOptions = {},
): string[][] {
  const specs = fields.map((f) => (typeof f === 'string' ? { field: f, label: f } : { field: f.field, label: f.label ?? f.field }))
  const out: string[][] = [specs.map((s) => s.label)]
  const numeric = specs.map(() => false)
  for (const row of rows) {
    out.push(specs.map((s, i) => {
      const value = row[s.field]
      if (typeof value === 'number' && Number.isFinite(value)) numeric[i] = true
      return cellTextOf(value)
    }))
  }
  if (options.totals && rows.length) {
    const last = rows.length + 1
    const totals = specs.map((_, i) => (numeric[i] ? `=SUM(${colToLetters(i)}2:${colToLetters(i)}${last})` : ''))
    if (!numeric[0]) totals[0] = options.totalsLabel ?? 'Total'
    out.push(totals)
  }
  return out
}
