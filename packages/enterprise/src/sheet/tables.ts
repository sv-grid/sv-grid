/**
 * Tables: a named region with a header row, so a formula can say
 * `Orders[Amount]` instead of `D2:D57` and keep meaning it after rows are
 * added.
 *
 * The point is not shorter text. A1 references are positional, so a total
 * under a table has to be re-pointed every time the table grows, and a
 * reference typed against 57 rows silently stops covering row 58. A
 * structured reference names the COLUMN, and the range it resolves to is
 * whatever the table currently is.
 *
 * This module is the model; the grammar that reads `Orders[Amount]` lives in
 * the tokenizer, and resolving one to a range happens at evaluation, because
 * the range depends on the table's size at that moment rather than at parse
 * time.
 */

export type TableRegion = {
  name: string
  sheet: string
  /** Row of the header. The data starts on the next one. */
  headerRow: number
  /** First and last column, inclusive. */
  firstCol: number
  lastCol: number
  /** Last row of the DATA, not counting a totals row. */
  lastRow: number
  /** Whether the row after `lastRow` is a totals row. */
  hasTotals: boolean
}

/** Which part of a table a structured reference asks for. */
export type TableSpecifier = '#All' | '#Data' | '#Headers' | '#Totals' | '#ThisRow'

export type TableRange = {
  sheet: string
  firstRow: number
  lastRow: number
  firstCol: number
  lastCol: number
}

export type TableRegistry = {
  define(table: TableRegion): void
  remove(name: string): boolean
  get(name: string): TableRegion | undefined
  list(): TableRegion[]
  /** The table containing a cell, if any. This is what makes an unqualified
   *  `[@Amount]` work: it only means something inside a table. */
  at(sheet: string, row: number, col: number): TableRegion | undefined
  /** Grow a table to include a row written just below it, the way Excel's
   *  auto-expand does. Returns whether anything changed. */
  growToInclude(sheet: string, row: number, col: number): boolean
  clear(): void
}

/** Excel's rules for a table name are the same as for a defined name. */
export function isValidTableName(name: string): boolean {
  if (!/^[A-Za-z_][A-Za-z0-9_.]*$/.test(name)) return false
  if (name.length > 255) return false
  if (/^\$?[A-Za-z]{1,3}\$?\d+$/.test(name)) return false
  if (/^[RC]$/i.test(name)) return false
  return true
}

export function createTableRegistry(initial: ReadonlyArray<TableRegion> = []): TableRegistry {
  const byName = new Map<string, TableRegion>()

  const registry: TableRegistry = {
    define(table) {
      if (!isValidTableName(table.name)) {
        throw new Error(`"${table.name}" is not a valid table name`)
      }
      byName.set(table.name.toLowerCase(), { ...table })
    },

    remove(name) {
      return byName.delete(name.toLowerCase())
    },

    get(name) {
      return byName.get(name.toLowerCase())
    },

    list() {
      return [...byName.values()].sort((a, b) => a.name.localeCompare(b.name))
    },

    at(sheet, row, col) {
      for (const table of byName.values()) {
        if (table.sheet !== sheet) continue
        if (col < table.firstCol || col > table.lastCol) continue
        const bottom = table.hasTotals ? table.lastRow + 1 : table.lastRow
        if (row < table.headerRow || row > bottom) continue
        return table
      }
      return undefined
    },

    growToInclude(sheet, row, col) {
      for (const table of byName.values()) {
        if (table.sheet !== sheet) continue
        if (col < table.firstCol || col > table.lastCol) continue
        // Only the row immediately after the data extends it. A write five
        // rows below is a separate thing the user put there, and swallowing
        // it would be worse than not expanding.
        if (row !== table.lastRow + 1) continue
        // A totals row occupies that slot already; Excel inserts above it,
        // which is a structural edit rather than a grow.
        if (table.hasTotals) continue
        table.lastRow = row
        return true
      }
      return false
    },

    clear() {
      byName.clear()
    },
  }

  for (const table of initial) registry.define(table)
  return registry
}

/** Column index for a header name, or -1. Case-insensitive, as Excel is. */
export function columnIndexOf(
  table: TableRegion,
  header: string,
  headerAt: (sheet: string, row: number, col: number) => string,
): number {
  const wanted = header.trim().toLowerCase()
  for (let c = table.firstCol; c <= table.lastCol; c += 1) {
    if (headerAt(table.sheet, table.headerRow, c).trim().toLowerCase() === wanted) return c
  }
  return -1
}

/**
 * Resolve a structured reference to a rectangle.
 *
 * `currentRow` is where the formula lives, which is the only way `[@Amount]`
 * can mean anything: "this row" is relative to the formula, not the table.
 * A `#ThisRow` reference from outside the table has no answer, so it returns
 * null and the evaluator reports #VALUE!, which is what Excel does.
 */
export function resolveTableRange(
  table: TableRegion,
  specifier: TableSpecifier,
  columns: { from: number; to: number } | null,
  currentRow: number | null,
): TableRange | null {
  const firstCol = columns ? columns.from : table.firstCol
  const lastCol = columns ? columns.to : table.lastCol
  if (firstCol < 0 || lastCol < 0) return null

  const totalsRow = table.hasTotals ? table.lastRow + 1 : null

  switch (specifier) {
    case '#Headers':
      return { sheet: table.sheet, firstRow: table.headerRow, lastRow: table.headerRow, firstCol, lastCol }
    case '#Totals':
      return totalsRow === null
        ? null
        : { sheet: table.sheet, firstRow: totalsRow, lastRow: totalsRow, firstCol, lastCol }
    case '#All':
      return {
        sheet: table.sheet,
        firstRow: table.headerRow,
        lastRow: totalsRow ?? table.lastRow,
        firstCol, lastCol,
      }
    case '#ThisRow': {
      if (currentRow === null) return null
      // Outside the table's data rows, "this row" is meaningless.
      if (currentRow <= table.headerRow || currentRow > table.lastRow) return null
      return { sheet: table.sheet, firstRow: currentRow, lastRow: currentRow, firstCol, lastCol }
    }
    case '#Data':
    default: {
      const firstRow = table.headerRow + 1
      // An empty table has no data rows. Returning the header row instead
      // would make =SUM(Orders[Amount]) add the word "Amount".
      if (firstRow > table.lastRow) return null
      return { sheet: table.sheet, firstRow, lastRow: table.lastRow, firstCol, lastCol }
    }
  }
}

/** How many data rows a table holds. */
export function rowCountOf(table: TableRegion): number {
  return Math.max(0, table.lastRow - table.headerRow)
}
