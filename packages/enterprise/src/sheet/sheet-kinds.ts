/**
 * What kind of thing a sheet tab is.
 *
 * A workbook's tabs have always been cell grids. A `grid` tab is the other
 * thing a business workbook wants: a data-bound table, backed by records
 * rather than by cells, sorted and filtered and edited as a grid rather
 * than as a sheet.
 *
 * The trick that makes this cheap rather than a second engine: **a grid
 * sheet PROJECTS its records into the workbook's cells.** The records are
 * the truth, and after every change they are written into the same
 * `string[][]` a cell sheet keeps, header row included. So
 * `=SUM(Orders!D2:D99)` on a cell sheet reads a grid sheet with no new
 * machinery at all: the formula engine, the dependency graph, the file
 * writers and the printer never learn that this tab is different.
 *
 * The projection runs through `setRaw`, which ignores a write that changes
 * nothing, so editing one field of one record rewrites one cell and
 * recalculates what depended on it, not the sheet.
 *
 * What a grid sheet deliberately does NOT do: hold a formula of its own.
 * Its cells are a rendering of its records, so anything typed into them
 * would be overwritten by the next projection. A sheet that needs formulas
 * beside the data is a cell sheet reading the grid one across.
 */
import { sheetCellsFromRows, type SheetField } from './from-rows'

export type SheetKind = 'cells' | 'grid'

/** One column of a grid sheet, as the sheet describes it. */
export type GridSheetField = SheetField & {
  /** Narrow the editor and the alignment, as the grid's own columns do. */
  type?: 'text' | 'number' | 'date' | 'boolean'
  width?: number
  editable?: boolean
}

export type GridSheetSpec = {
  fields: GridSheetField[]
  /** The records. A grid sheet's truth; the cells are made from these. */
  rows: Array<Record<string, unknown>>
  /** Rows may be edited in place. Off by default, as a report would want. */
  editable?: boolean
  /** A totals row under the records, summing every numeric column. */
  totals?: boolean
}

export const emptyGridSheet = (): GridSheetSpec => ({ fields: [], rows: [] })

/** The cells a grid sheet stands for: the header, the records, the totals. */
export function projectGridSheet(spec: GridSheetSpec): string[][] {
  return sheetCellsFromRows(spec.rows, spec.fields, spec.totals ? { totals: true } : {})
}

/**
 * Where a record sits in the projection.
 *
 * Row 0 is the header, so record `i` is at row `i + 1`. Kept as a function
 * rather than inlined so the offset is named in one place: getting it
 * wrong reads the header as a record and is silent.
 */
export const rowOfRecord = (index: number): number => index + 1
export const recordOfRow = (row: number): number => row - 1

/** Is this row of the projection a record, rather than a header or total? */
export const isRecordRow = (spec: GridSheetSpec, row: number): boolean =>
  row >= 1 && row <= spec.rows.length

/**
 * A field's column in the projection, or -1.
 *
 * Matched on the field name rather than the label, since two columns may
 * share a label and the name is what the record is keyed by.
 */
export const columnOfField = (spec: GridSheetSpec, field: string): number =>
  spec.fields.findIndex((f) => f.field === field)

/** A deep-enough copy for a document snapshot. */
export const copyGridSheet = (spec: GridSheetSpec): GridSheetSpec => ({
  fields: spec.fields.map((f) => ({ ...f })),
  rows: spec.rows.map((r) => ({ ...r })),
  ...(spec.editable !== undefined ? { editable: spec.editable } : {}),
  ...(spec.totals !== undefined ? { totals: spec.totals } : {}),
})

/**
 * A value typed into a grid sheet, coerced to the field's type.
 *
 * The grid hands back whatever its editor produced, which for a number
 * column typed into by hand is a string. Storing that would make the
 * record's shape depend on how it was edited, so it is narrowed here once.
 */
export function coerceFieldValue(field: GridSheetField, value: unknown): unknown {
  if (value === null || value === undefined || value === '') return value === '' ? '' : null
  switch (field.type) {
    case 'number': {
      const n = typeof value === 'number' ? value : Number(String(value).trim())
      return Number.isFinite(n) ? n : value
    }
    case 'boolean': {
      if (typeof value === 'boolean') return value
      const text = String(value).trim().toLowerCase()
      if (text === 'true' || text === 'yes' || text === '1') return true
      if (text === 'false' || text === 'no' || text === '0') return false
      return value
    }
    case 'date': {
      if (value instanceof Date) return value
      const text = String(value).trim()
      return text === '' ? null : text
    }
    default:
      return typeof value === 'string' ? value : String(value)
  }
}
