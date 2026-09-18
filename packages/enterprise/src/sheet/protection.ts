/**
 * Sheet protection, the way Excel has it: every cell is locked by default,
 * Format Cells > Protection unlocks the ones that may change, and Protect
 * Sheet turns the flags on. Until then a locked cell is an ordinary cell.
 *
 * Two refinements ride beside the flag, as they do in Excel. The "allow
 * all users of this worksheet to" list of the Protect Sheet dialog says
 * which kinds of change stay open while the sheet is protected (format
 * cells, size and hide lines, insert and delete, sort, filter); and Allow
 * Edit Ranges names blocks that take an edit on a protected sheet whether
 * their cells are locked or not. There is no password.
 *
 * The rules live here so the shell, the ribbon and the commands agree on
 * them without each reading the format entry its own way.
 */
import type { CellAddressLookup, CellFormatEntry, Rect, SheetFormatStore } from './format-store'
import { colToLetters, parseA1 } from './address'

/** What the sheet says when a protected cell is asked to change. */
export const PROTECTED_MESSAGE =
  "The cell you're trying to change is on a protected sheet. To make a change, unprotect the sheet."

/**
 * What stays allowed on a protected sheet: Excel's Protect Sheet list, the
 * entries the shell has something behind. An absent key is not allowed.
 */
export type ProtectionAllow = {
  /** Format Cells, the Home > Font / Alignment / Number buttons, merges, Lock Cell. */
  formatCells?: boolean
  /** Column width, AutoFit, hide and unhide columns, the resize handle. */
  formatColumns?: boolean
  /** Row height, AutoFit, hide and unhide rows, the resize handle. */
  formatRows?: boolean
  insertColumns?: boolean
  insertRows?: boolean
  deleteColumns?: boolean
  deleteRows?: boolean
  /** Sort, of a block with no locked cell: Excel refuses one with, whatever this says. */
  sort?: boolean
  /** Filter on and off, and the arrows' menus. */
  autoFilter?: boolean
}

export type ProtectionPermission = keyof ProtectionAllow

/** The list in the order Excel's dialog shows it. */
export const PROTECTION_PERMISSIONS: ReadonlyArray<ProtectionPermission> = [
  'formatCells', 'formatColumns', 'formatRows', 'insertColumns', 'insertRows', 'deleteColumns', 'deleteRows', 'sort', 'autoFilter',
]

/** Excel's Allow Users to Edit Ranges entry: a name over some cells. */
export type EditRange = { id: string; title: string; rects: Rect[] }

/** What a sheet keeps beside its `protected` flag. */
export type SheetProtection = { allow: ProtectionAllow; ranges: EditRange[] }

export const defaultProtection = (): SheetProtection => ({ allow: {}, ranges: [] })

/** A cell is locked unless its format says otherwise. */
export function isLocked(entry: CellFormatEntry | undefined): boolean {
  return entry?.locked !== false
}

/** Whether (r, c) lies in one of the ranges that stay editable. */
export function inEditRange(ranges: ReadonlyArray<EditRange>, r: number, c: number): boolean {
  for (const range of ranges) {
    for (const [r1, c1, r2, c2] of range.rects) if (r >= r1 && r <= r2 && c >= c1 && c <= c2) return true
  }
  return false
}

/** Whether the cell holds on a protected sheet: locked, and in no edit range. */
export function cellLocked(entry: CellFormatEntry | undefined, ranges: ReadonlyArray<EditRange>, r: number, c: number): boolean {
  return isLocked(entry) && !inEditRange(ranges, r, c)
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
  ranges: ReadonlyArray<EditRange> = [],
): boolean {
  for (const [minRow, minCol, maxRow, maxCol] of rects) {
    for (let r = minRow; r <= maxRow; r += 1) {
      for (let c = minCol; c <= maxCol; c += 1) {
        const rowId = lookup.rowIdAt(r)
        const columnId = lookup.columnIdAt(c)
        if (rowId == null || columnId == null) continue
        if (cellLocked(store.get(rowId, columnId), ranges, r, c)) return true
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

/** A copy safe to hand out or save. */
export function copyProtection(protection: SheetProtection): SheetProtection {
  return {
    allow: { ...protection.allow },
    ranges: protection.ranges.map((range) => ({ ...range, rects: range.rects.map(([r1, c1, r2, c2]) => [r1, c1, r2, c2] as const) })),
  }
}

let nextRangeId = 1
/** An id no other range of this session carries. */
export const newEditRangeId = (): string => `range-${Date.now().toString(36)}-${(nextRangeId += 1).toString(36)}`

/** `B2:B10, A1 C3:C5` as rectangles; null when any piece is not a cell or a range. */
export function parseRangeText(text: string): Rect[] | null {
  const pieces = text.split(/[,\s]+/).map((p) => p.trim().replace(/^=/, '')).filter(Boolean)
  if (!pieces.length) return null
  const out: Rect[] = []
  for (const piece of pieces) {
    const [first, last] = piece.split(':')
    const a = parseA1(first ?? '')
    const b = last === undefined ? a : parseA1(last)
    if (!a || !b || a.row === null || b.row === null) return null
    out.push([Math.min(a.row, b.row), Math.min(a.col, b.col), Math.max(a.row, b.row), Math.max(a.col, b.col)])
  }
  return out
}

/** Rectangles as `B2:B10, A1`, the way the dialog lists them. */
export function rangeText(rects: ReadonlyArray<Rect>): string {
  return rects.map(([r1, c1, r2, c2]) => {
    const a = `${colToLetters(c1)}${r1 + 1}`
    const b = `${colToLetters(c2)}${r2 + 1}`
    return a === b ? a : `${a}:${b}`
  }).join(', ')
}
