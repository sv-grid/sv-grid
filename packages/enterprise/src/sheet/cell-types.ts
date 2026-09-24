/**
 * What a cell IS, rather than what it holds: a checkbox, a button or a
 * group of radio choices drawn in the cell and driven from it.
 *
 * Excel has one of these, the checkbox its Insert tab puts in a cell, and
 * it is deliberately thin: the cell's value is still `TRUE` or `FALSE`, so
 * every formula over it keeps working and the file carries an ordinary
 * boolean. That is the model here, widened to the two other controls a
 * data-entry sheet actually asks for.
 *
 * The rule that keeps this honest: **a cell type is a rendering, never a
 * second source of truth.** A checkbox is ticked because its cell reads
 * TRUE, not because the checkbox remembers being clicked; a radio is on
 * because the cell holds its choice. Clicking one writes the cell and
 * nothing else, so undo, the formula engine, a paste and the file all keep
 * working without knowing this module exists.
 *
 * Regions are kept and moved the way validation rules are, and the LAST
 * region covering a cell wins, so a narrower one laid over a wider one
 * overrides it.
 */
import { toText } from './coerce'
import type { StructuralEdit } from './refs'
import { rectContains, shiftRects, subtractRect, type Rect } from './rects'

/** Excel writes a ticked box as TRUE and an unticked one as FALSE. */
export const CHECKED = 'TRUE'
export const UNCHECKED = 'FALSE'

export type CellTypeKind = 'checkbox' | 'button' | 'radio'

export type CellTypeRegion = {
  id: string
  rects: ReadonlyArray<Rect>
  kind: CellTypeKind
  /**
   * A checkbox's two values, when the sheet wants something other than
   * Excel's TRUE and FALSE (a Yes / No column, say). Compared as text,
   * ignoring case, the way the engine compares a boolean typed by hand.
   */
  checked?: string
  unchecked?: string
  /** A button's face. The cell's own text when this is absent. */
  label?: string
  /** What a button press reports through `onCellAction`. */
  action?: string
  /** A radio group's choices, in order. */
  choices?: ReadonlyArray<string>
}

let counter = 0
export const newCellTypeId = (): string => `ct${(counter += 1)}`

/** The region that applies at a cell, or null. The last one wins. */
export function cellTypeAt(
  regions: ReadonlyArray<CellTypeRegion>,
  row: number,
  col: number,
): CellTypeRegion | null {
  for (let i = regions.length - 1; i >= 0; i -= 1) {
    const region = regions[i]!
    if (region.rects.some((rect) => rectContains(rect, row, col))) return region
  }
  return null
}

/** The two texts a checkbox toggles between, Excel's by default. */
export const checkboxValues = (region: CellTypeRegion): { on: string; off: string } => ({
  on: region.checked ?? CHECKED,
  off: region.unchecked ?? UNCHECKED,
})

/**
 * Is the cell ticked?
 *
 * Read off the cell's own text so a formula, a paste or a typed TRUE all
 * show the same way. Anything that is not the ticked value reads as
 * unticked, which is what Excel does with a stray entry.
 */
export function isChecked(region: CellTypeRegion, raw: string): boolean {
  const { on } = checkboxValues(region)
  return toText(raw).trim().toLowerCase() === on.trim().toLowerCase()
}

/** What clicking a checkbox should write into its cell. */
export function toggledValue(region: CellTypeRegion, raw: string): string {
  const { on, off } = checkboxValues(region)
  return isChecked(region, raw) ? off : on
}

/** Which radio choice a cell holds, or -1. Compared ignoring case. */
export function radioIndex(region: CellTypeRegion, raw: string): number {
  const choices = region.choices ?? []
  const value = toText(raw).trim().toLowerCase()
  return choices.findIndex((choice) => choice.trim().toLowerCase() === value)
}

/** The regions after an insert or delete, moved the way the rules move. */
export function shiftCellTypes(
  regions: ReadonlyArray<CellTypeRegion>,
  edit: StructuralEdit,
): CellTypeRegion[] {
  return shiftRects(regions, edit)
}

/** The regions with the rectangles cut out: what Clear All removes. */
export function removeCellTypes(
  regions: ReadonlyArray<CellTypeRegion>,
  rects: ReadonlyArray<Rect>,
): CellTypeRegion[] {
  const out: CellTypeRegion[] = []
  for (const region of regions) {
    let kept: Rect[] = [...region.rects]
    for (const hole of rects) kept = kept.flatMap((rect) => subtractRect(rect, hole))
    if (kept.length) out.push({ ...region, rects: kept })
  }
  return out
}

/**
 * Lay a region over some cells, taking those cells out of any region that
 * already claimed them.
 *
 * Without the cut, two regions would overlap and the later one would win
 * silently; cutting makes the model say what the screen shows.
 */
export function applyCellType(
  regions: ReadonlyArray<CellTypeRegion>,
  region: CellTypeRegion,
): CellTypeRegion[] {
  return [...removeCellTypes(regions, region.rects), region]
}

/** A deep-enough copy for the document's snapshot. */
export const copyCellType = (region: CellTypeRegion): CellTypeRegion => ({
  ...region,
  rects: region.rects.map((rect) => [...rect] as unknown as Rect),
  ...(region.choices ? { choices: [...region.choices] } : {}),
})
