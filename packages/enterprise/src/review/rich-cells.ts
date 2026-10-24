/**
 * The proposed value beside a cell the in-cell wrapper (`ghost.ts`) cannot
 * take: a select, a rating, a person, a checkbox, a field type with a cell of
 * its own. The grid's `cellDecor` slot draws a mark after the cell's own
 * content, so the cell stays as it is and "-> Closed" follows it.
 *
 * Registered once, by the first review: `cellDecor` takes every cell off the
 * grid's plain-text fast path, which an app without a review should not pay.
 */
import { getGridExtension, registerGridExtension } from '@svgrid/grid'
import { cellProposalFor } from './card-marks.svelte'
import { canGhost } from './ghost'
import RichCellMark from './RichCellMark.svelte'

let registered = false

export function registerRichCellMarks(): void {
  if (registered) return
  registered = true
  const before = getGridExtension()?.cellDecor
  registerGridExtension({
    cellDecor: (ctrl, row, column) => {
      const own = before?.(ctrl, row, column)
      if (own) return own
      const def = column?.columnDef
      if (!def?.field || !row || row.original === undefined) return null
      // Cheap lookups first: this runs for every cell of every grid.
      const p = cellProposalFor(ctrl?.props?.getRowId, row.original, String(row.id), def.field)
      if (!p) return null
      // The wrapper draws the proposal in cells it can wrap.
      return canGhost(def) ? null : (RichCellMark as never)
    },
  })
}
