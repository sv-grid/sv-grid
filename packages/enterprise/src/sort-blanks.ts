/**
 * Blanks at one end - column comparators that hold blank cells (null,
 * undefined, '') at the bottom or the top whichever way the column sorts. The
 * grid's own order puts blanks first ascending and last descending, so rows
 * with no due date jump to the top when the dates run up.
 *
 * ```ts
 * import { blanksLast } from '@svgrid/enterprise'
 * const columns = [
 *   { field: 'due', header: 'Due', cellDataType: 'dateString', sortComparator: blanksLast('date') },
 * ]
 * ```
 *
 * The values themselves sort as the grid sorts them (`sortFns`). The grid's
 * `sortComparator` hands the direction over; a column with `sortValue` keeps
 * using that instead.
 */
import { sortFns } from '@svgrid/grid/core'
import { hasValidLicense } from './license'
import { emitUnlicensedNudge } from './watermark'

/** How the non-blank values compare: as the grid compares that data type. */
export type BlanksSortType = 'auto' | 'number' | 'date'

type ColumnComparator = (a: unknown, b: unknown, desc: boolean) => number

const isBlank = (v: unknown) => v == null || v === ''

function holdBlanks(end: 1 | -1, type: BlanksSortType): ColumnComparator {
  if (!hasValidLicense()) emitUnlicensedNudge()
  const compare = sortFns[type]
  return (a, b, desc) => {
    const aBlank = isBlank(a)
    const bBlank = isBlank(b)
    if (aBlank || bBlank) {
      if (aBlank === bBlank) return 0
      // The grid reverses the result for a descending sort; answer for blanks
      // before that happens, so they stay put.
      const side = aBlank ? end : -end
      return desc ? -side : side
    }
    return compare(a, b)
  }
}

/** Sort blank cells last in both directions. Pass as a column's `sortComparator`. */
export function blanksLast(type: BlanksSortType = 'auto'): ColumnComparator {
  return holdBlanks(1, type)
}

/** Sort blank cells first in both directions. Pass as a column's `sortComparator`. */
export function blanksFirst(type: BlanksSortType = 'auto'): ColumnComparator {
  return holdBlanks(-1, type)
}
