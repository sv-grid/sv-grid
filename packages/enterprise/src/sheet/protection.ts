/**
 * Sheet protection, the way Excel has it: every cell is locked by default,
 * Format Cells > Protection unlocks the ones that may change, and Protect
 * Sheet turns the flags on. Until then a locked cell is an ordinary cell.
 *
 * The rules live here so the shell, the ribbon and the commands agree on
 * them without each reading the format entry its own way.
 */
import type { CellAddressLookup, CellFormatEntry, Rect, SheetFormatStore } from './format-store'

/** What the sheet says when a protected cell is asked to change. */
export const PROTECTED_MESSAGE =
  "The cell you're trying to change is on a protected sheet. To make a change, unprotect the sheet."

/** A cell is locked unless its format says otherwise. */
export function isLocked(entry: CellFormatEntry | undefined): boolean {
  return entry?.locked !== false
}

/**
 * Whether any cell of the rectangles is locked. A protected sheet refuses
 * a change that touches one locked cell rather than doing the rest, which
 * is what Excel does and what keeps an undo step whole.
 */
export function rectsHaveLocked(
  store: SheetFormatStore,
  lookup: CellAddressLookup,
  rects: ReadonlyArray<Rect>,
): boolean {
  for (const [minRow, minCol, maxRow, maxCol] of rects) {
    for (let r = minRow; r <= maxRow; r += 1) {
      for (let c = minCol; c <= maxCol; c += 1) {
        const rowId = lookup.rowIdAt(r)
        const columnId = lookup.columnIdAt(c)
        if (rowId == null || columnId == null) continue
        if (isLocked(store.get(rowId, columnId))) return true
      }
    }
  }
  return false
}

/** Whether the rectangles hold both locked and unlocked cells. */
export function rectsMixLocked(
  store: SheetFormatStore,
  lookup: CellAddressLookup,
  rects: ReadonlyArray<Rect>,
): boolean {
  let locked = false
  let unlocked = false
  for (const [minRow, minCol, maxRow, maxCol] of rects) {
    for (let r = minRow; r <= maxRow; r += 1) {
      for (let c = minCol; c <= maxCol; c += 1) {
        const rowId = lookup.rowIdAt(r)
        const columnId = lookup.columnIdAt(c)
        if (rowId == null || columnId == null) continue
        if (isLocked(store.get(rowId, columnId))) locked = true
        else unlocked = true
        if (locked && unlocked) return true
      }
    }
  }
  return false
}
