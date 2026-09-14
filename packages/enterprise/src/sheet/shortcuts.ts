/**
 * The Excel keymap, as a table rather than an if-chain, so the bindings can be
 * read in one screen and tested as data.
 *
 * Matching is exact on modifiers: a binding that does not ask for shift will
 * not fire when shift is held. Without that, Ctrl+Shift+Arrow would match the
 * Ctrl+Arrow binding and the extend-selection variant would be unreachable.
 */
import type { GridCommandContext } from '@svgrid/grid/shortcuts'
import {
  edgeOfRegion, currentRegion, isWholeSheet, wholeSheet, isBlankValue,
  type Direction, type Grid, type Rect,
} from './navigate'
import {
  fillDown, fillRight, stampDate, copyFromAbove, targetRect,
  guessSumRange, looksNumeric,
} from './commands'
import { FORMAT_PRESETS, type FormatPresetName } from './number-format'
import type { SheetFormatStore, CellAddressLookup, CellFormatEntry } from './format-store'
import { formatA1 } from './address'
import {
  insertRows, deleteRows, insertColumns, deleteColumns,
  axisForSelection, getStructureTarget,
} from './structure'
import { getFindTarget } from './find-replace'
import type { Workbook } from './workbook'

export type SheetCommand = (cmd: GridCommandContext, event: KeyboardEvent) => boolean

/*
 * The action functions below are exported, not private, because the keymap is
 * not the only thing that invokes them: SvSheetRibbon binds the same functions
 * to its buttons. A ribbon that re-implemented "bold the selection" against
 * the format store would be a second code path to keep in step with this one,
 * and the two would drift the first time either changed.
 */

/**
 * What the formatting commands write to, and how they turn a display position
 * into the stable ids the store keys on.
 *
 * Optional because the shortcuts are useful without it: a grid that only wants
 * navigation and fill never sets one up, and the format bindings decline
 * rather than half-working.
 */
export type SheetFormatTarget = {
  store: SheetFormatStore
  lookup: CellAddressLookup
  /** Called after a change so the consumer can re-render. */
  onChange?(): void
}

let formatTarget: SheetFormatTarget | null = null

/** Attach the store the formatting shortcuts write to. */
export function setFormatTarget(target: SheetFormatTarget | null): void {
  formatTarget = target
}

export function getFormatTarget(): SheetFormatTarget | null {
  return formatTarget
}

/**
 * The workbook the sheet-switching keys act on.
 *
 * Optional, like everything else here: a single-sheet grid never sets one and
 * Ctrl+PageDown falls through to the browser's own tab switching, which is
 * what someone with one sheet expects it to do.
 */
let workbook: Workbook | null = null
let onWorkbookChange: (() => void) | null = null

export function setWorkbook(next: Workbook | null, onChange?: () => void): void {
  workbook = next
  onWorkbookChange = onChange ?? null
}

export function getWorkbook(): Workbook | null {
  return workbook
}

/** Move `delta` sheets from the active one. Excel does NOT wrap at the ends,
 *  so neither does this: hitting the last sheet and pressing again should
 *  leave you there rather than teleport you to the first. */
export function switchSheet(delta: number): boolean {
  const wb = workbook
  if (!wb) return false
  const sheets = wb.sheets
  const at = sheets.indexOf(wb.active)
  if (at < 0) return false
  const next = at + delta
  if (next < 0 || next >= sheets.length) return false
  wb.setActive(sheets[next]!)
  onWorkbookChange?.()
  return true
}

/** Called when Ctrl+Shift+V fires, so a consumer can open its own Paste
 *  Special dialog. Same reasoning as the other two: the keyboard layer owns
 *  the key, the consumer owns the chrome. */
let onPasteSpecial: ((cmd: GridCommandContext) => void) | null = null

export function setPasteSpecialHandler(fn: ((cmd: GridCommandContext) => void) | null): void {
  onPasteSpecial = fn
}

/** Called when Ctrl+H fires, so a consumer can open its own Find and Replace
 *  panel. Same reasoning as the Format Cells dialog: the keyboard layer owns
 *  the key, the consumer owns the chrome. */
let onFindReplace: ((cmd: GridCommandContext) => void) | null = null

export function setFindReplaceHandler(fn: ((cmd: GridCommandContext) => void) | null): void {
  onFindReplace = fn
}

/** Called when Ctrl+1 fires, so a consumer can open its own dialog. The
 *  shortcut layer does not ship one: what a Format Cells dialog should look
 *  like is a design decision, not a keyboard one. */
let onFormatDialog: ((cmd: GridCommandContext) => void) | null = null

export function setFormatDialogHandler(fn: ((cmd: GridCommandContext) => void) | null): void {
  onFormatDialog = fn
}

export type SheetBinding = {
  /** Matched case-insensitively against `event.key`. */
  key: string
  /**
   * Matched against `event.code` INSTEAD of `key`, for bindings where shift
   * changes the character. Pressing Ctrl+Shift+1 reports `event.key` as '!'
   * on a US layout, ':' for Ctrl+Shift+; and '~' for Ctrl+Shift+`, so a
   * binding spelling the unshifted character can never fire in a browser.
   * `code` is the physical key and does not move.
   */
  code?: string
  /** Ctrl on Windows/Linux, Cmd on macOS. Both are accepted for either. */
  mod?: boolean
  shift?: boolean
  alt?: boolean
  run: SheetCommand
  /** For docs and the demo's cheat sheet. */
  label: string
}

/** Read the grid through the command context as a blank-aware matrix. */
export function gridOf(cmd: GridCommandContext): Grid {
  return {
    rowCount: cmd.rowCount,
    colCount: cmd.colCount,
    isBlank: (r, c) => isBlankValue(cmd.getCellValue(r, c)),
  }
}

export function move(dir: Direction, extend: boolean): SheetCommand {
  return (cmd) => {
    const active = cmd.activeCell
    if (!active) return false
    const to = edgeOfRegion(gridOf(cmd), { row: active.rowIndex, col: active.colIndex }, dir)
    cmd.setActiveCell(to.row, to.col)
    cmd.scrollIntoView(to.row, to.col)
    if (extend) cmd.extendSelection(to.row, to.col)
    else cmd.setSelection(to.row, to.col)
    return true
  }
}

/** Ctrl+A: the current region, then the whole sheet on a second press. */
export const selectRegion: SheetCommand = (cmd) => {
  const active = cmd.activeCell
  if (!active) return false
  const g = gridOf(cmd)
  const current = targetRect(cmd)
  const region = currentRegion(g, { row: active.rowIndex, col: active.colIndex })
  const already =
    current !== null &&
    current[0] === region[0] && current[1] === region[1] &&
    current[2] === region[2] && current[3] === region[3]
  const next = already && !isWholeSheet(g, region) ? wholeSheet(g) : region
  cmd.setSelection(next[0], next[1])
  cmd.extendSelection(next[2], next[3])
  return true
}

/** Ctrl+Space / Shift+Space: the active cell's whole column or row. */
export function selectLine(axis: 'column' | 'row'): SheetCommand {
  return (cmd) => {
    const active = cmd.activeCell
    if (!active) return false
    if (axis === 'column') {
      cmd.setSelection(0, active.colIndex)
      cmd.extendSelection(Math.max(cmd.rowCount - 1, 0), active.colIndex)
    } else {
      cmd.setSelection(active.rowIndex, 0)
      cmd.extendSelection(active.rowIndex, Math.max(cmd.colCount - 1, 0))
    }
    return true
  }
}

/** Apply a patch to the selection through the attached store. */
export function applyFormat(cmd: GridCommandContext, patch: CellFormatEntry): boolean {
  const target = formatTarget
  if (!target) return false
  const rects = cmd.ranges.length ? cmd.ranges : rectOfActive(cmd)
  if (!rects.length) return false
  target.store.set(rects, patch, target.lookup)
  target.onChange?.()
  return true
}

export function toggleFormat(
  cmd: GridCommandContext,
  field: 'bold' | 'italic' | 'underline' | 'strike',
): boolean {
  const target = formatTarget
  if (!target) return false
  const rects = cmd.ranges.length ? cmd.ranges : rectOfActive(cmd)
  if (!rects.length) return false
  target.store.toggle(rects, field, target.lookup)
  target.onChange?.()
  return true
}

function rectOfActive(cmd: GridCommandContext): ReadonlyArray<Rect> {
  const rect = targetRect(cmd)
  return rect ? [rect] : []
}

export function preset(name: FormatPresetName): SheetCommand {
  return (cmd) => applyFormat(cmd, { numFmt: FORMAT_PRESETS[name] })
}

/** Alt+=. Inserts =SUM(range) over the run Excel would guess. */
export const autoSum: SheetCommand = (cmd) => {
  const active = cmd.activeCell
  if (!active) return false
  const range = guessSumRange(cmd, looksNumeric)
  if (!range) return false
  const [minRow, minCol, maxRow, maxCol] = range
  const ref = (r: number, c: number) =>
    formatA1({ col: c, colAbs: false, row: r, rowAbs: false, sheet: null })
  cmd.setCellValue(
    active.rowIndex,
    active.colIndex,
    `=SUM(${ref(minRow, minCol)}:${ref(maxRow, maxCol)})`,
  )
  return true
}

export const SHEET_BINDINGS: ReadonlyArray<SheetBinding> = [
  // Navigation
  { key: 'ArrowUp', mod: true, run: move('up', false), label: 'Jump to the edge of the data region' },
  { key: 'ArrowDown', mod: true, run: move('down', false), label: 'Jump to the edge of the data region' },
  { key: 'ArrowLeft', mod: true, run: move('left', false), label: 'Jump to the edge of the data region' },
  { key: 'ArrowRight', mod: true, run: move('right', false), label: 'Jump to the edge of the data region' },
  { key: 'ArrowUp', mod: true, shift: true, run: move('up', true), label: 'Extend the selection to the edge' },
  { key: 'ArrowDown', mod: true, shift: true, run: move('down', true), label: 'Extend the selection to the edge' },
  { key: 'ArrowLeft', mod: true, shift: true, run: move('left', true), label: 'Extend the selection to the edge' },
  { key: 'ArrowRight', mod: true, shift: true, run: move('right', true), label: 'Extend the selection to the edge' },

  // Selection
  { key: 'a', mod: true, run: selectRegion, label: 'Select the current region, then the sheet' },
  { key: ' ', mod: true, run: selectLine('column'), label: 'Select the column' },
  { key: ' ', shift: true, run: selectLine('row'), label: 'Select the row' },

  // Fill and entry
  { key: 'd', mod: true, run: (cmd) => fillDown(cmd), label: 'Fill down' },
  { key: 'r', mod: true, run: (cmd) => fillRight(cmd), label: 'Fill right' },
  { key: ';', mod: true, run: (cmd) => stampDate(cmd, 'date'), label: "Insert today's date" },
  { key: ';', code: 'Semicolon', mod: true, shift: true, run: (cmd) => stampDate(cmd, 'time'), label: 'Insert the current time' },
  { key: "'", mod: true, run: (cmd) => copyFromAbove(cmd), label: 'Copy the cell above, unchanged' },
  { key: '=', alt: true, run: autoSum, label: 'AutoSum the run above or to the left' },

  // Formatting. These decline when no format store is attached, so the key
  // falls through instead of looking broken.
  { key: 'b', mod: true, run: (cmd) => toggleFormat(cmd, 'bold'), label: 'Bold' },
  { key: 'i', mod: true, run: (cmd) => toggleFormat(cmd, 'italic'), label: 'Italic' },
  { key: 'u', mod: true, run: (cmd) => toggleFormat(cmd, 'underline'), label: 'Underline' },
  { key: '5', mod: true, run: (cmd) => toggleFormat(cmd, 'strike'), label: 'Strikethrough' },
  { key: '1', mod: true, run: (cmd) => {
    if (!onFormatDialog) return false
    onFormatDialog(cmd)
    return true
  }, label: 'Open Format Cells' },
  { key: '1', code: 'Digit1', mod: true, shift: true, run: preset('number'), label: 'Number format' },
  { key: '2', code: 'Digit2', mod: true, shift: true, run: preset('time'), label: 'Time format' },
  { key: '3', code: 'Digit3', mod: true, shift: true, run: preset('date'), label: 'Date format' },
  { key: '4', code: 'Digit4', mod: true, shift: true, run: preset('currency'), label: 'Currency format' },
  { key: '5', code: 'Digit5', mod: true, shift: true, run: preset('percent'), label: 'Percent format' },
  { key: '6', code: 'Digit6', mod: true, shift: true, run: preset('scientific'), label: 'Scientific format' },
  { key: '`', code: 'Backquote', mod: true, shift: true, run: preset('general'), label: 'General format' },

  // Structure. Like the format bindings, these decline when nothing is
  // attached. Excel opens a dialog for an ambiguous selection; deciding what
  // that looks like is the consumer's, so an ambiguous selection declines and
  // the consumer can bind its own dialog.
  { key: '+', code: 'Equal', mod: true, shift: true, run: (cmd) => structural(cmd, 'insert'), label: 'Insert rows or columns' },
  { key: '-', mod: true, run: (cmd) => structural(cmd, 'delete'), label: 'Delete rows or columns' },
  { key: 'h', mod: true, run: (cmd) => {
    if (!onFindReplace || !getFindTarget()) return false
    onFindReplace(cmd)
    return true
  }, label: 'Find and Replace' },
  { key: 'v', mod: true, shift: true, run: (cmd) => {
    if (!onPasteSpecial) return false
    onPasteSpecial(cmd)
    return true
  }, label: 'Paste Special' },

  // Workbook. These decline without a workbook attached, so a single-sheet
  // grid leaves Ctrl+PageDown to the browser.
  { key: 'PageDown', mod: true, run: () => switchSheet(1), label: 'Next sheet' },
  { key: 'PageUp', mod: true, run: () => switchSheet(-1), label: 'Previous sheet' },
  { key: 'F11', shift: true, run: () => {
    const wb = workbook
    if (!wb) return false
    wb.addSheet()
    onWorkbookChange?.()
    return true
  }, label: 'New sheet' },
]

export function structural(cmd: GridCommandContext, kind: 'insert' | 'delete'): boolean {
  if (!getStructureTarget()) return false
  const axis = axisForSelection(cmd)
  if (axis === 'ambiguous') return false
  if (kind === 'insert') {
    return axis === 'rows' ? insertRows(cmd) : insertColumns(cmd)
  }
  return axis === 'rows' ? deleteRows(cmd) : deleteColumns(cmd)
}

function matches(binding: SheetBinding, event: KeyboardEvent): boolean {
  if (binding.code) {
    // Fall back to `key` when `code` is absent, which is how synthesized
    // events in tests and some assistive tech behave.
    const seen = event.code || ''
    if (seen ? seen !== binding.code : event.key.toLowerCase() !== binding.key.toLowerCase()) {
      return false
    }
  } else if (event.key.toLowerCase() !== binding.key.toLowerCase()) {
    return false
  }
  const mod = event.ctrlKey || event.metaKey
  if (mod !== (binding.mod ?? false)) return false
  if (event.shiftKey !== (binding.shift ?? false)) return false
  if (event.altKey !== (binding.alt ?? false)) return false
  return true
}

/**
 * The handler registered with the grid. Returns true when a binding ran, which
 * is what tells the grid to stop and not interpret the key itself.
 *
 * Mid-edit keys are left alone for now: every phase-1 binding acts on the
 * selection, and claiming Ctrl+D while someone is typing in a cell would eat a
 * keystroke they meant for the editor. Alt+Enter and F4 arrive with the editor
 * work and will check `cmd.editing` themselves.
 */
export function handleSheetKey(event: KeyboardEvent, cmd: GridCommandContext): boolean {
  if (cmd.editing) return false
  for (const binding of SHEET_BINDINGS) {
    if (!matches(binding, event)) continue
    if (!binding.run(cmd, event)) return false
    event.preventDefault()
    return true
  }
  return false
}
