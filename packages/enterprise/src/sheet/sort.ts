/**
 * Excel's sort order over a block of rows, by one key or several.
 *
 * The rules that make a sheet's sort read as Excel's: numbers before text
 * before booleans and errors, blanks last whichever way the sort runs,
 * text without regard to case, a stable order so a tie keeps the rows as
 * they were, and each key only consulted when the ones before it tie.
 */
import { isError, type CellValue } from './ast'
import { isBlankValue } from './navigate'

export type SortDirection = 'asc' | 'desc'

export type SortKey = {
  /** The column the key reads, as a sheet column index. */
  col: number
  direction: SortDirection
}

/** Excel's type order: numbers, then text, then booleans and errors. */
function rank(v: CellValue): [kind: number, value: number | string] {
  if (isBlankValue(v)) return [3, '']
  if (typeof v === 'number') return [0, v]
  if (typeof v === 'boolean') return [2, v ? 1 : 0]
  if (isError(v)) return [2, 0]
  return [1, String(v).toLowerCase()]
}

function compareValues(a: CellValue, b: CellValue, direction: SortDirection): number {
  const [ka, va] = rank(a)
  const [kb, vb] = rank(b)
  // A blank sorts last both ways, as in Excel.
  if (ka === 3 || kb === 3) return ka === kb ? 0 : ka === 3 ? 1 : -1
  if (ka !== kb) return direction === 'asc' ? ka - kb : kb - ka
  const cmp = typeof va === 'number' && typeof vb === 'number' ? va - vb : String(va).localeCompare(String(vb))
  return direction === 'asc' ? cmp : -cmp
}

/**
 * The rows in sorted order. `rows` are the row indexes of the block's data
 * rows (the header left out), `valueAt` reads a computed cell.
 */
export function sortOrder(
  rows: ReadonlyArray<number>,
  keys: ReadonlyArray<SortKey>,
  valueAt: (row: number, col: number) => CellValue,
): number[] {
  if (!keys.length) return [...rows]
  return rows
    .map((row, index) => ({ row, index }))
    .sort((a, b) => {
      for (const key of keys) {
        const cmp = compareValues(valueAt(a.row, key.col), valueAt(b.row, key.col), key.direction)
        if (cmp !== 0) return cmp
      }
      return a.index - b.index
    })
    .map((entry) => entry.row)
}

/**
 * Excel's guess at "my data has headers": the first row of the key column
 * holds text and the row under it holds something that is not text.
 */
export function guessHeaderRow(
  valueAt: (row: number, col: number) => CellValue,
  top: number,
  col: number,
): boolean {
  const isText = (v: CellValue) => typeof v === 'string' && v !== ''
  const below = valueAt(top + 1, col)
  return isText(valueAt(top, col)) && !isText(below) && !isBlankValue(below)
}
