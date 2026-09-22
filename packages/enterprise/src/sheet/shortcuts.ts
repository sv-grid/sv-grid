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
  type Direction, type Grid, type Rect, type Cell,
} from './navigate'
import {
  fillDown, fillRight, stampDate, copyFromAbove, copyValueFromAbove, targetRect,
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
import { cycleReference } from './edit-keys'
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
  /**
   * Whether the rectangles may be formatted. A protected sheet says no for
   * a selection with a locked cell in it; the ribbon greys its buttons on
   * the same answer, so it must be cheap and must not talk to the user.
   */
  guard?(rects: ReadonlyArray<Rect>): boolean
  /** Called when a change was refused by `guard`: the place to say why. */
  refused?(): void
}

/** The guard's answer, with the refusal reported when it is no. */
export function formatAllowed(target: SheetFormatTarget, rects: ReadonlyArray<Rect>): boolean {
  if (target.guard?.(rects) === false) {
    target.refused?.()
    return false
  }
  return true
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
/** Which sheets are hidden, so Ctrl+PageUp and PageDown step over them. */
let sheetHidden: ((name: string) => boolean) | null = null

export function setWorkbook(next: Workbook | null, onChange?: () => void, isHidden?: (name: string) => boolean): void {
  workbook = next
  onWorkbookChange = onChange ?? null
  sheetHidden = isHidden ?? null
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
  // The next sheet that shows; a hidden one is stepped over, as in Excel.
  let next = at + delta
  while (next >= 0 && next < sheets.length && sheetHidden?.(sheets[next]!)) next += delta
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
/**
 * Ribbon actions a key raises: F9 recalculates, Ctrl+` shows formulas,
 * Ctrl+Shift+L toggles the filter, Shift+F3 and Ctrl+F3 open Insert
 * Function and the Name Manager, Ctrl+T formats as a table. The shell
 * answers them the way it answers the ribbon button; returning false means
 * nothing is behind the action and the key falls through.
 */
export type RibbonKeyAction =
  | 'file-open' | 'file-save-xlsx' | 'file-print'
  | 'recalculate' | 'toggle-formulas' | 'toggle-filter'
  | 'insert-function' | 'name-manager' | 'insert-table'
  | 'hide-rows' | 'hide-columns' | 'unhide-rows' | 'unhide-columns'
  | 'edit-comment' | 'open-list' | 'toggle-ribbon' | 'insert-link'
  | 'merge-center' | 'merge-across' | 'merge-cells' | 'unmerge-cells'
  | 'cut'
let onRibbonAction: ((action: RibbonKeyAction, cmd: GridCommandContext) => boolean) | null = null

export function setRibbonActionHandler(
  fn: ((action: RibbonKeyAction, cmd: GridCommandContext) => boolean) | null,
): void {
  onRibbonAction = fn
}

const raise = (action: RibbonKeyAction): SheetCommand => (cmd) => onRibbonAction?.(action, cmd) ?? false

/** Raise a ribbon action from a button whose face is not an entry of its own. */
export function raiseRibbonAction(action: RibbonKeyAction, cmd: GridCommandContext): boolean {
  return onRibbonAction?.(action, cmd) ?? false
}

/** Excel's size ladder. Pixels here, since that is what the cell renders. */
export const FONT_SIZES = [8, 9, 10, 11, 12, 13, 14, 16, 18, 20, 22, 24, 26, 28, 36, 48, 72]
/** A cell with no size of its own renders at the grid's 13px. */
export const DEFAULT_FONT_SIZE = 13

/** The format entry under the active cell, or undefined. */
export function activeEntry(cmd: GridCommandContext): CellFormatEntry | undefined {
  const target = formatTarget
  const active = cmd.activeCell
  if (!target || !active) return undefined
  const rowId = target.lookup.rowIdAt(active.rowIndex)
  const columnId = target.lookup.columnIdAt(active.colIndex)
  return rowId != null && columnId != null ? target.store.get(rowId, columnId) : undefined
}

/** Excel's Increase / Decrease Font Size: the next rung of the ladder. */
export function nudgeFontSize(direction: 1 | -1): SheetCommand {
  return (cmd) => {
    const current = activeEntry(cmd)?.fontSize ?? DEFAULT_FONT_SIZE
    const larger = FONT_SIZES.filter((s) => s > current)
    const smaller = FONT_SIZES.filter((s) => s < current)
    const next = direction > 0 ? larger[0] : smaller[smaller.length - 1]
    if (next === undefined) return false
    return applyFormat(cmd, { fontSize: next === DEFAULT_FONT_SIZE ? undefined : next })
  }
}

let onFormatDialog: ((cmd: GridCommandContext) => void) | null = null

export function setFormatDialogHandler(fn: ((cmd: GridCommandContext) => void) | null): void {
  onFormatDialog = fn
}

/**
 * Which component the targets above belong to. Every one of them is a
 * module-level singleton, so with two sheets on a page (a collaboration
 * demo, a docs page with an example per section) the keys, the ribbon's
 * buttons and its pressed states all went to whichever sheet mounted last:
 * Ctrl+B bolded a cell three examples down. A sheet claims the targets when
 * the pointer or the focus lands in it, and on unmount lets go only of what
 * is still its own, so tearing one sheet down cannot disarm another.
 */
let owner: object | null = null

export function setShortcutOwner(token: object | null): void {
  owner = token
}

export function getShortcutOwner(): object | null {
  return owner
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
  /**
   * Runs while a cell is being edited, and only then. The other bindings
   * act on the selection and stay out of the editor, where Ctrl+D is a
   * keystroke the user meant for the text.
   */
  editing?: boolean
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

/**
 * Ctrl+End: the bottom-right corner of what has been typed, as in Excel,
 * rather than the grid's last cell. A sheet has thousands of empty rows
 * below the data, and the last of them is never where the user wanted to
 * go. Ctrl+Home is the grid's own and already lands on A1.
 */
export function lastUsedCell(cmd: GridCommandContext): { row: number; col: number } {
  let row = -1
  let col = -1
  for (let r = 0; r < cmd.rowCount; r += 1) {
    for (let c = 0; c < cmd.colCount; c += 1) {
      if (isBlankValue(cmd.getCellValue(r, c))) continue
      if (r > row) row = r
      if (c > col) col = c
    }
  }
  return row < 0 ? { row: 0, col: 0 } : { row, col }
}

export const goToLastUsed: SheetCommand = (cmd) => {
  const { row, col } = lastUsedCell(cmd)
  cmd.setActiveCell(row, col)
  cmd.setSelection(row, col)
  cmd.scrollIntoView(row, col)
  return true
}

/** Ctrl+Shift+End / Home: extend the selection to the last used cell, or to A1. */
function extendTo(where: 'end' | 'home'): SheetCommand {
  return (cmd) => {
    if (!cmd.activeCell) return false
    const { row, col } = where === 'end' ? lastUsedCell(cmd) : { row: 0, col: 0 }
    cmd.extendSelection(row, col)
    cmd.scrollIntoView(row, col)
    return true
  }
}

/** F4 while editing: turn the reference at the caret through its anchorings. */
export const pinReference: SheetCommand = (cmd) => {
  const el = cmd.editor
  if (!el) return false
  const edit = cycleReference(el.value, el.selectionStart ?? el.value.length)
  if (!edit) return false
  el.value = edit.text
  el.setSelectionRange(edit.caret, edit.caret)
  // The grid keeps its own copy of the draft and reads it from input events.
  el.dispatchEvent(new Event('input', { bubbles: true }))
  return true
}

export function move(dir: Direction, extend: boolean): SheetCommand {
  return (cmd) => {
    const active = cmd.activeCell
    if (!active) return false
    if (extend) {
      // The range grows from its far corner and the active cell stays put,
      // as in Excel; stepping from the active cell would reach the same
      // edge on every press.
      const from = cmd.selectionFocus ?? { rowIndex: active.rowIndex, colIndex: active.colIndex }
      const to = pastHidden(cmd, { row: from.rowIndex, col: from.colIndex }, edgeOfRegion(gridOf(cmd), { row: from.rowIndex, col: from.colIndex }, dir), dir)
      cmd.extendSelection(to.row, to.col)
      // Along the axis of the key only, as Excel scrolls: a sideways jump
      // keeps the rows where they are.
      const sideways = dir === 'left' || dir === 'right'
      cmd.scrollIntoView(sideways ? active.rowIndex : to.row, sideways ? to.col : active.colIndex)
      return true
    }
    const to = pastHidden(cmd, { row: active.rowIndex, col: active.colIndex }, edgeOfRegion(gridOf(cmd), { row: active.rowIndex, col: active.colIndex }, dir), dir)
    cmd.setActiveCell(to.row, to.col)
    cmd.scrollIntoView(to.row, to.col)
    cmd.setSelection(to.row, to.col)
    return true
  }
}

/**
 * A jump never rests on a hidden row or column, as Excel's does not. The
 * edge it found is the end of a run of data, or the first cell of the next
 * run; a hidden edge stands in for the nearest cell of the same run that
 * shows, which lies back toward the start when the run continues behind
 * the landing, and further on when the landing began a new run. With no
 * such cell the cursor goes on to the next line that shows at all. Only the
 * grid's api knows what is hidden; a context without one (a test's fake)
 * hides nothing.
 */
function pastHidden(cmd: GridCommandContext, from: Cell, to: Cell, dir: Direction): Cell {
  const api = cmd.api as { isRowCollapsed?: (i: number) => boolean; isColumnCollapsed?: (id: string) => boolean } | undefined
  const vertical = dir === 'up' || dir === 'down'
  const hidden = vertical
    ? (i: number) => api?.isRowCollapsed?.(i) ?? false
    : (i: number) => { const id = cmd.columnIdAt(i); return id != null && (api?.isColumnCollapsed?.(id) ?? false) }
  const at = vertical ? to.row : to.col
  if (!hidden(at)) return to
  const grid = gridOf(cmd)
  const count = vertical ? cmd.rowCount : cmd.colCount
  const step = dir === 'down' || dir === 'right' ? 1 : -1
  const cell = (i: number): Cell => (vertical ? { row: i, col: to.col } : { row: to.row, col: i })
  const blank = (i: number) => i < 0 || i >= count || grid.isBlank(cell(i).row, cell(i).col)
  const origin = vertical ? from.row : from.col
  // The run continues back toward the start: the last of it that shows,
  // unless that is where the jump began, in which case the run is done and
  // the jump goes on from its hidden end to the next run.
  if (!blank(at - step)) {
    for (let i = at - step; i !== origin && i >= 0 && i < count; i -= step) {
      if (blank(i)) break
      if (!hidden(i)) return cell(i)
    }
    const next = edgeOfRegion(grid, to, dir)
    if (next.row !== to.row || next.col !== to.col) return pastHidden(cmd, to, next, dir)
  }
  // The landing began a run: the first of it that shows.
  for (let i = at + step; i >= 0 && i < count && !blank(i); i += step) {
    if (!hidden(i)) return cell(i)
  }
  // Nothing of the run shows: the next line that shows at all, else stay.
  for (let i = at + step; i >= 0 && i < count; i += step) if (!hidden(i)) return cell(i)
  for (let i = at - step; i !== origin - step && i >= 0 && i < count; i -= step) if (!hidden(i)) return cell(i)
  return to
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

/**
 * Ctrl+Space / Shift+Space: the whole columns or rows the selection
 * touches (B2:C3 gives rows 2:3), as in Excel; the active cell stays.
 */
export function selectLine(axis: 'column' | 'row'): SheetCommand {
  return (cmd) => {
    const rect = targetRect(cmd)
    if (!rect) return false
    const [r1, c1, r2, c2] = rect
    if (axis === 'column') {
      cmd.setSelection(0, c1)
      cmd.extendSelection(Math.max(cmd.rowCount - 1, 0), c2)
    } else {
      cmd.setSelection(r1, 0)
      cmd.extendSelection(r2, Math.max(cmd.colCount - 1, 0))
    }
    return true
  }
}

/** Ctrl+Shift+8 (Ctrl+*): the current region, and only that. */
export const selectCurrentRegion: SheetCommand = (cmd) => {
  const active = cmd.activeCell
  if (!active) return false
  const region = currentRegion(gridOf(cmd), { row: active.rowIndex, col: active.colIndex })
  cmd.setSelection(region[0], region[1])
  cmd.extendSelection(region[2], region[3])
  return true
}

/**
 * Run a format change over `rects` as ONE undo step.
 *
 * The format store is not the grid's data, so a write to it is invisible
 * to Ctrl+Z on its own: Bold would land and the Undo button would stay
 * grey, which is not how a spreadsheet behaves. This snapshots every cell
 * the change touches before and after, and hands the grid a step that puts
 * either snapshot back. A cell's whole entry is restored rather than the
 * one field, so undoing "bold" on a cell that was also made red does not
 * have to know which of the two the press was about.
 */
export function withFormatUndo(
  cmd: GridCommandContext,
  target: SheetFormatTarget,
  rects: ReadonlyArray<Rect>,
  mutate: () => void,
): void {
  const snapshot = () => {
    const cells: Array<{ r: number; c: number; entry: CellFormatEntry | undefined }> = []
    for (const [minRow, minCol, maxRow, maxCol] of rects) {
      for (let r = minRow; r <= maxRow; r += 1) {
        for (let c = minCol; c <= maxCol; c += 1) {
          const rowId = target.lookup.rowIdAt(r)
          const columnId = target.lookup.columnIdAt(c)
          if (rowId == null || columnId == null) continue
          const entry = target.store.get(rowId, columnId)
          cells.push({ r, c, entry: entry ? { ...entry, border: entry.border ? { ...entry.border } : undefined } : undefined })
        }
      }
    }
    return cells
  }
  const restore = (cells: ReturnType<typeof snapshot>) => () => {
    for (const { r, c, entry } of cells) {
      target.store.clear([[r, c, r, c]], target.lookup)
      if (entry) target.store.set([[r, c, r, c]], entry, target.lookup)
    }
    target.onChange?.()
  }
  const before = snapshot()
  mutate()
  const after = snapshot()
  // Optional at runtime: a context built by hand (a demo, an older integration)
  // may predate the seam, and a format that cannot be undone is still a
  // format that landed.
  cmd.recordUndo?.(restore(before), restore(after))
}

/** Apply a patch to the selection through the attached store. */
export function applyFormat(cmd: GridCommandContext, patch: CellFormatEntry): boolean {
  const target = formatTarget
  if (!target) return false
  const rects = cmd.ranges.length ? cmd.ranges : rectOfActive(cmd)
  if (!rects.length) return false
  if (!formatAllowed(target, rects)) return false
  withFormatUndo(cmd, target, rects, () => target.store.set(rects, patch, target.lookup))
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
  if (!formatAllowed(target, rects)) return false
  withFormatUndo(cmd, target, rects, () => target.store.toggle(rects, field, target.lookup))
  target.onChange?.()
  return true
}

export type BorderPreset =
  | 'none' | 'bottom' | 'top' | 'left' | 'right' | 'all' | 'outside' | 'thick-bottom'

type Side = 'top' | 'right' | 'bottom' | 'left'

/**
 * Excel's Borders menu, applied the way Excel applies it: "Bottom Border"
 * puts a line under the bottom edge of the SELECTION, not under every
 * cell; "All Borders" lines every cell; "Outside" frames the block. Sides
 * merge with what a cell already has, so a top border does not erase a
 * bottom one, and "No Border" clears all four.
 */
export function applyBorders(cmd: GridCommandContext, preset: BorderPreset): boolean {
  const target = formatTarget
  if (!target) return false
  const rects = cmd.ranges.length ? cmd.ranges : rectOfActive(cmd)
  if (!rects.length) return false
  if (!formatAllowed(target, rects)) return false
  const line = { width: preset === 'thick-bottom' ? 2 : 1 }
  const { store, lookup } = target
  withFormatUndo(cmd, target, rects, () => {
  for (const [minRow, minCol, maxRow, maxCol] of rects) {
    for (let r = minRow; r <= maxRow; r += 1) {
      for (let c = minCol; c <= maxCol; c += 1) {
        const rowId = lookup.rowIdAt(r)
        const columnId = lookup.columnIdAt(c)
        if (rowId == null || columnId == null) continue
        const sides = new Set<Side>()
        if (preset === 'all') { sides.add('top'); sides.add('right'); sides.add('bottom'); sides.add('left') }
        if (preset === 'outside' || preset === 'top') { if (r === minRow) sides.add('top') }
        if (preset === 'outside' || preset === 'bottom' || preset === 'thick-bottom') { if (r === maxRow) sides.add('bottom') }
        if (preset === 'outside' || preset === 'left') { if (c === minCol) sides.add('left') }
        if (preset === 'outside' || preset === 'right') { if (c === maxCol) sides.add('right') }
        if (preset === 'none') {
          store.set([[r, c, r, c]], { border: undefined }, lookup)
          continue
        }
        if (sides.size === 0) continue
        const border = { ...(store.get(rowId, columnId)?.border ?? {}) }
        for (const side of sides) border[side] = line
        store.set([[r, c, r, c]], { border }, lookup)
      }
    }
  }
  })
  target.onChange?.()
  return true
}

/** Excel's Clear Formats: drop every format on the selection, keep the values. */
export function clearFormats(cmd: GridCommandContext): boolean {
  const target = formatTarget
  if (!target) return false
  const rects = cmd.ranges.length ? cmd.ranges : rectOfActive(cmd)
  if (!rects.length) return false
  if (!formatAllowed(target, rects)) return false
  withFormatUndo(cmd, target, rects, () => target.store.clear(rects, target.lookup))
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

/**
 * Alt+=. Proposes =SUM(range) over the run Excel would guess. With one cell
 * selected the formula is opened in the cell's editor rather than written,
 * as Excel's AutoSum does: the guess is often a row short, and the editor is
 * where it gets corrected before Enter takes it. A wider selection has the
 * sum written into the active cell outright.
 */
export const autoSum: SheetCommand = (cmd) => {
  const active = cmd.activeCell
  if (!active) return false
  const range = guessSumRange(cmd, looksNumeric)
  if (!range) return false
  if (cmd.canEdit?.(active.rowIndex, active.colIndex) === false) return false
  const [minRow, minCol, maxRow, maxCol] = range
  const ref = (r: number, c: number) =>
    formatA1({ col: c, colAbs: false, row: r, rowAbs: false, sheet: null })
  const formula = `=SUM(${ref(minRow, minCol)}:${ref(maxRow, maxCol)})`
  const last = cmd.ranges[cmd.ranges.length - 1]
  const oneCell = !last || (last[0] === last[2] && last[1] === last[3])
  if (oneCell && cmd.startEditing(active.rowIndex, active.colIndex, formula)) return true
  cmd.setCellValue(active.rowIndex, active.colIndex, formula)
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
  { key: 'End', mod: true, run: goToLastUsed, label: 'Go to the last used cell' },
  { key: 'End', mod: true, shift: true, run: extendTo('end'), label: 'Extend the selection to the last used cell' },
  { key: 'Home', mod: true, shift: true, run: extendTo('home'), label: 'Extend the selection to A1' },

  // While editing
  { key: 'F4', editing: true, run: pinReference, label: 'Pin the reference at the caret ($A$1, A$1, $A1)' },

  // Selection
  { key: 'a', mod: true, run: selectRegion, label: 'Select the current region, then the sheet' },
  { key: ' ', mod: true, shift: true, run: selectRegion, label: 'Select the current region, then the sheet' },
  { key: '*', code: 'Digit8', mod: true, shift: true, run: selectCurrentRegion, label: 'Select the current region' },
  { key: ' ', mod: true, run: selectLine('column'), label: 'Select the column' },
  { key: ' ', shift: true, run: selectLine('row'), label: 'Select the row' },

  // Fill and entry
  { key: 'd', mod: true, run: (cmd) => fillDown(cmd), label: 'Fill down' },
  { key: 'r', mod: true, run: (cmd) => fillRight(cmd), label: 'Fill right' },
  { key: ';', mod: true, run: (cmd) => stampDate(cmd, 'date'), label: "Insert today's date" },
  { key: ';', code: 'Semicolon', mod: true, shift: true, run: (cmd) => stampDate(cmd, 'time'), label: 'Insert the current time' },
  { key: "'", mod: true, run: (cmd) => copyFromAbove(cmd), label: 'Copy the cell above, unchanged' },
  { key: '"', code: 'Quote', mod: true, shift: true, run: (cmd) => copyValueFromAbove(cmd), label: 'Copy the value of the cell above' },
  { key: '&', code: 'Digit7', mod: true, shift: true, run: (cmd) => applyBorders(cmd, 'outside'), label: 'Outline border' },
  { key: '_', code: 'Minus', mod: true, shift: true, run: (cmd) => applyBorders(cmd, 'none'), label: 'Remove borders' },
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
  { key: '>', code: 'Period', mod: true, shift: true, run: nudgeFontSize(1), label: 'Increase font size' },
  { key: '<', code: 'Comma', mod: true, shift: true, run: nudgeFontSize(-1), label: 'Decrease font size' },

  // What the ribbon's tooltips promise: the same actions from the keyboard.
  { key: 'F9', run: raise('recalculate'), label: 'Recalculate' },
  { key: '`', code: 'Backquote', mod: true, run: raise('toggle-formulas'), label: 'Show formulas' },
  { key: 'l', mod: true, shift: true, run: raise('toggle-filter'), label: 'Filter' },
  { key: 'F3', shift: true, run: raise('insert-function'), label: 'Insert Function' },
  { key: 'F2', shift: true, run: raise('edit-comment'), label: 'Insert or edit the comment on the active cell' },
  { key: 'k', mod: true, run: raise('insert-link'), label: 'Insert or edit the link on the active cell' },
  { key: 'ArrowDown', alt: true, run: raise('open-list'), label: 'Open the list a validated cell offers' },
  { key: 'F1', mod: true, run: raise('toggle-ribbon'), label: 'Collapse or expand the ribbon' },
  { key: 'F3', mod: true, run: raise('name-manager'), label: 'Name Manager' },
  { key: 't', mod: true, run: raise('insert-table'), label: 'Format as Table' },
  // The File tab's keys. The browser's own Open and Save are what they
  // replace, as in Excel; with no shell to answer them they fall through.
  { key: 'o', mod: true, run: raise('file-open'), label: 'Open' },
  { key: 's', mod: true, run: raise('file-save-xlsx'), label: 'Save As' },
  { key: 'p', mod: true, run: raise('file-print'), label: 'Print' },

  // Structure. Like the format bindings, these decline when nothing is
  // attached. Excel opens a dialog for an ambiguous selection; deciding what
  // that looks like is the consumer's, so an ambiguous selection declines and
  // the consumer can bind its own dialog.
  { key: '+', code: 'Equal', mod: true, shift: true, run: (cmd) => structural(cmd, 'insert'), label: 'Insert rows or columns' },
  { key: '-', mod: true, run: (cmd) => structural(cmd, 'delete'), label: 'Delete rows or columns' },
  // Hide and Unhide are raised, as Freeze is: the sheet shell keeps what
  // is hidden per sheet and moves it with an insert or delete.
  { key: '9', code: 'Digit9', mod: true, run: raise('hide-rows'), label: 'Hide the selected rows' },
  { key: '0', code: 'Digit0', mod: true, run: raise('hide-columns'), label: 'Hide the selected columns' },
  { key: '(', code: 'Digit9', mod: true, shift: true, run: raise('unhide-rows'), label: 'Unhide rows in the selection' },
  { key: ')', code: 'Digit0', mod: true, shift: true, run: raise('unhide-columns'), label: 'Unhide columns in the selection' },
  // Ctrl+H is Excel's Replace and Ctrl+F its Find; the shell has one dialog
  // for both, so both open it. Ctrl+F is the browser's find otherwise, and a
  // spreadsheet user who presses it wants the cells searched, as in Excel
  // and Sheets; the browser's is a keystroke away with the sheet unfocused.
  { key: 'h', mod: true, run: (cmd) => {
    if (!onFindReplace || !getFindTarget()) return false
    onFindReplace(cmd)
    return true
  }, label: 'Find and Replace' },
  { key: 'f', mod: true, run: (cmd) => {
    if (!onFindReplace || !getFindTarget()) return false
    onFindReplace(cmd)
    return true
  }, label: 'Find' },
  { key: 'v', mod: true, shift: true, run: (cmd) => {
    if (!onPasteSpecial) return false
    onPasteSpecial(cmd)
    return true
  }, label: 'Paste Special' },

  // Workbook. These decline without a workbook attached, so a single-sheet
  // grid leaves Ctrl+PageDown to the browser.
  { key: 'PageDown', mod: true, run: () => switchSheet(1), label: 'Next sheet' },
  { key: 'PageUp', mod: true, run: () => switchSheet(-1), label: 'Previous sheet' },
  { key: 'F11', shift: true, run: () => newSheet(), label: 'New sheet' },
]

/** Shift+F11 and the ribbon's Insert Sheet: a new sheet after the last, made active. */
export function newSheet(): boolean {
  const wb = workbook
  if (!wb) return false
  wb.addSheet()
  onWorkbookChange?.()
  return true
}

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
 * A binding marked `editing` runs only inside the editor and the others
 * only outside it: Ctrl+D while someone is typing in a cell is a keystroke
 * they meant for the text, and F4 on the grid root has nothing to pin.
 * Alt+Enter needs no binding: the grid's multiline text editor takes it as
 * a line break itself.
 */
export function handleSheetKey(event: KeyboardEvent, cmd: GridCommandContext): boolean {
  for (const binding of SHEET_BINDINGS) {
    if ((binding.editing ?? false) !== cmd.editing) continue
    if (!matches(binding, event)) continue
    if (!binding.run(cmd, event)) return false
    event.preventDefault()
    return true
  }
  return false
}
