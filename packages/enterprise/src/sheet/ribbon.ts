/**
 * The ribbon, as data.
 *
 * Same shape of decision as SHEET_BINDINGS: a table that can be read in one
 * screen and tested without mounting anything. `SvSheetRibbon.svelte` is only
 * a renderer for it.
 *
 * Every item that acts on the sheet runs one of the action functions
 * `shortcuts.ts` exports - the same ones the keymap binds. That is the whole
 * point of the indirection: Ctrl+B and the Bold button are literally the same
 * call, so they cannot come to disagree about what "bold the selection" means,
 * and neither can drift when the format store changes underneath them.
 *
 * Items that need chrome the keyboard layer deliberately does not ship (a
 * function picker, a Goal Seek dialog, Text to Columns options) carry no `run`
 * and set `emits` instead. The renderer reports those through `onAction` and
 * the host decides what a dialog looks like, which is the same split
 * `setFormatDialogHandler` already makes.
 *
 * Layout is Excel's, and it is in the data too. A group is a block three
 * rows high: a LARGE button (icon over label) takes a whole column, SMALL
 * buttons stack three to a column, and each small item says which row it
 * sits on. The renderer lays that out on a grid, which is what makes Cut /
 * Copy / Paste Special line up under each other beside a tall Paste, the
 * way they do in Excel, without per-group pixel widths.
 */
import type { GridCommandContext } from '@svgrid/grid/shortcuts'
import {
  applyFormat, toggleFormat, preset, autoSum, structural, clearFormats, newSheet,
  getFormatTarget, getWorkbook, withFormatUndo, nudgeFontSize, activeEntry,
  FONT_SIZES, DEFAULT_FONT_SIZE, applyBorders, formatAllowed, raiseRibbonAction,
  type SheetCommand, type BorderPreset,
} from './shortcuts'
export { FONT_SIZES, applyBorders, type BorderPreset } from './shortcuts'
import { insertRows, deleteRows, insertColumns, deleteColumns, getStructureTarget } from './structure'
import { fillDown, fillRight, targetRect } from './commands'
import type { Rect } from './navigate'
import { FORMAT_PRESETS, FORMAT_CATEGORY_PATTERNS, formatCategory, accountingParts, accountingPattern, formatWithPattern, type FormatPresetName } from './number-format'
import type { CellFormatEntry } from './format-store'
import type { RibbonIconName } from './ribbon-icons'
import { ALL_COLOURS } from './palette'

/** What the host has to render for one control. */
export type RibbonItemKind =
  /** Runs and forgets. */
  | 'button'
  /** Runs, and paints itself on when `isOn` reports true for the selection. */
  | 'toggle'
  /** A dropdown showing the selection's current value; `run` receives the pick. */
  | 'select'
  /**
   * Excel's split button: the face applies the last value picked (or
   * `initial`), the arrow opens a menu of `options`. A `palette` menu is
   * the colour picker; otherwise it is a list, with an icon per entry.
   */
  | 'menu'
  /**
   * Excel's plain menu button (Format, Sort & Filter): the face opens the
   * list and each entry is an action of its own, raised through `emits`
   * or run through `run(cmd, value)`. Entries with `heading` are the
   * section labels Excel prints between the groups.
   */
  | 'dropdown'

export type RibbonOption = {
  value: string
  label: string
  /** List menus: the glyph beside the label. */
  icon?: RibbonIconName
  /** Dropdowns: the entry raises this action rather than running the item. */
  emits?: RibbonActionId
  /** Dropdowns: printed after the label, the way Excel prints Ctrl+1. */
  keys?: string
  /** Dropdowns: a section label, not an entry. */
  heading?: boolean
  /** Dropdowns: the entry is a toggle, lit while its action is active. */
  toggle?: boolean
}


export type RibbonItem = {
  id: string
  /** The button face, or the label under a large button. */
  label: string
  /** Long form for the tooltip and the accessible name. */
  title: string
  /** Drawn on the face. Without one the face prints `label`, which is what
   *  Bold, Italic and the number-format buttons want: B, I, $, %. */
  icon?: RibbonIconName
  /** Shown after the title in the tooltip, the way Excel does it. */
  keys?: string
  kind: RibbonItemKind
  /**
   * Excel's two button sizes. A large button is an icon over a label and
   * fills the group's height; a small one is a 24px strip. Large is the
   * command a group exists for (Paste, Sort & Filter, Text to Columns);
   * everything else is small.
   */
  size?: 'large' | 'small'
  /** Small buttons only: which of the group's three rows this sits on. */
  row?: 1 | 2 | 3
  /** Small buttons only: print the label beside the icon. */
  wide?: boolean
  /** Run the action. Returns false when it declined (nothing selected, no
   *  store attached), which the renderer uses to avoid claiming it worked. */
  run?: (cmd: GridCommandContext, value?: string) => boolean
  /** Toggles only. */
  isOn?: (cmd: GridCommandContext) => boolean
  /**
   * Lit while this action is among the shell's active actions, for an item
   * that runs rather than emits: Merge & Center's face lights while the
   * active cell is merged, as Excel's does.
   */
  lit?: RibbonActionId
  /** Defaults to enabled. Reports false when the action has nothing to act
   *  on, so the button greys out rather than doing nothing on click. */
  isEnabled?: (cmd: GridCommandContext) => boolean
  /** `select` and `menu` only. */
  options?: ReadonlyArray<RibbonOption>
  /** `select` only: the value the selection currently has, so the control
   *  reads "Calibri" or "General" for the active cell rather than a blank. */
  current?: (cmd: GridCommandContext) => string
  /** `menu` only: render `options` as Excel's colour grid. */
  palette?: boolean
  /** Palette menus: the "No Fill" / "Automatic" entry at the top. */
  none?: RibbonOption
  /** Menus: the value the face applies before anything has been picked.
   *  Excel starts Fill Colour on yellow and Font Colour on red. */
  initial?: string
  /** Set instead of `run` when the action needs chrome this layer does not
   *  own. The renderer calls `onAction(emits, cmd)`. */
  emits?: RibbonActionId
  /**
   * Dropdowns only: Excel's split button. The face runs the item (Paste
   * pastes) and the arrow opens the entries, each an action of its own;
   * an entry without `emits` runs the item with its value.
   */
  split?: boolean
}

/** Actions the ribbon delegates to the host rather than running itself. */
export type RibbonActionId =
  | 'file-new'
  | 'file-open'
  | 'file-save-xlsx'
  | 'file-export-csv'
  | 'file-save-ods'
  | 'file-save-xls'
  | 'file-print'
  | 'page-portrait'
  | 'page-landscape'
  | 'paper-a4'
  | 'paper-a3'
  | 'paper-a5'
  | 'paper-letter'
  | 'paper-legal'
  | 'paper-tabloid'
  | 'margins-normal'
  | 'margins-narrow'
  | 'margins-wide'
  | 'print-area-set'
  | 'print-area-clear'
  | 'print-titles'
  | 'page-setup'
  | 'print-gridlines'
  | 'print-headings'
  | 'paste-special'
  | 'cut'
  | 'undo'
  | 'redo'
  | 'format-cells'
  | 'find-replace'
  | 'insert-function'
  | 'name-manager'
  | 'text-to-columns'
  | 'remove-duplicates'
  | 'goal-seek'
  | 'insert-chart'
  | 'insert-picture'
  | 'chart-setup'
  | 'delete-object'
  | 'delete-sheet'
  | 'sparkline-line'
  | 'sparkline-column'
  | 'sparkline-winloss'
  | 'sparkline-setup'
  | 'clear-sparklines'
  | 'insert-pivot'
  | 'refresh-pivot'
  | 'insert-link'
  | 'remove-table'
  | 'table-style'
  | 'pivot-details'
  | 'remove-link'
  | 'insert-table'
  | 'recalculate'
  | 'calc-options'
  | 'evaluate-formula'
  | 'error-checking'
  | 'toggle-formulas'
  | 'trace-precedents'
  | 'trace-dependents'
  | 'remove-arrows'
  | 'sort-asc'
  | 'sort-desc'
  | 'sort-custom'
  | 'toggle-filter'
  | 'freeze-panes'
  | 'unfreeze-panes'
  | 'hide-rows'
  | 'hide-columns'
  | 'unhide-rows'
  | 'unhide-columns'
  | 'row-height'
  | 'column-width'
  | 'autofit-rows'
  | 'autofit-columns'
  | 'paste-values'
  | 'paste-formulas'
  | 'paste-formats'
  | 'paste-transpose'
  | 'format-painter'
  | 'protect-sheet'
  | 'unprotect-sheet'
  | 'allow-edit-ranges'
  | 'toggle-lock'
  | 'new-comment'
  | 'edit-comment'
  | 'delete-comment'
  | 'prev-comment'
  | 'next-comment'
  | 'toggle-comments'
  | 'data-validation'
  | 'circle-invalid'
  | 'clear-circles'
  | 'open-list'
  | 'freeze-top-row'
  | 'freeze-first-column'
  | 'toggle-gridlines'
  | 'toggle-formula-bar'
  | 'toggle-headings'
  | 'toggle-ribbon'
  | 'cf-greater' | 'cf-less' | 'cf-between' | 'cf-equal' | 'cf-text' | 'cf-duplicates'
  | 'cf-top10' | 'cf-bottom10' | 'cf-above-average' | 'cf-below-average'
  | 'cf-data-bar' | 'cf-color-scale-3' | 'cf-color-scale-2' | 'cf-icon-set' | 'cf-formula'
  | 'cf-clear-selection' | 'cf-clear-sheet' | 'cf-manage'
  | 'merge-center' | 'merge-across' | 'merge-cells' | 'unmerge-cells'

export type RibbonGroup = {
  id: string
  /** Printed under the group, which is what makes a ribbon a ribbon. */
  label: string
  /** What the group's one button shows once the band has folded it. */
  icon?: RibbonIconName
  /**
   * How the small items are arranged.
   *
   * `grid` (the default) is Excel's column model: items on the same row
   * line up in columns, so a stack of Cut / Copy / Paste Special is one
   * neat column and AutoSum / Fill / Clear another. `flow` lets each row
   * run freely, which is what the Font group needs: a wide font box next
   * to a size box on row one, and a run of narrow B I U buttons under it,
   * with nothing forcing the two rows into shared columns.
   */
  layout?: 'grid' | 'flow'
  /** Excel's dialog box launcher: the small arrow in the group's corner
   *  that opens the full dialog for what the group does. */
  launcher?: RibbonActionId
  items: ReadonlyArray<RibbonItem>
}

export type RibbonTab = { id: string; label: string; groups: ReadonlyArray<RibbonGroup> }

// ---------------------------------------------------------------------------
// Shared predicates
// ---------------------------------------------------------------------------

/** True when there is at least one cell to act on. */
function hasTarget(cmd: GridCommandContext): boolean {
  return targetRect(cmd) !== null
}

/**
 * The rectangles an action should write to: the selection when there is one,
 * otherwise the active cell alone.
 *
 * The same fallback `applyFormat` makes, so a button with nothing
 * range-selected behaves like the key it mirrors rather than declining.
 */
function rectsOf(cmd: GridCommandContext): ReadonlyArray<Rect> {
  if (cmd.ranges.length) return cmd.ranges
  const rect = targetRect(cmd)
  return rect ? [rect] : []
}

/** Formatting needs somewhere to write. Without a store the keyboard
 *  bindings decline, so the buttons grey out for the same reason. */
function canFormat(cmd: GridCommandContext): boolean {
  const target = getFormatTarget()
  if (!target || !hasTarget(cmd)) return false
  return target.guard?.(rectsOf(cmd)) !== false
}

/** Insert and Delete grey out where the sheet refuses structural edits. */
function canRestructure(): boolean {
  const target = getStructureTarget()
  return !target || target.canApply?.({ kind: 'insertRows', at: 0, count: 1 }) !== false
}

/**
 * Whether every cell in the selection already carries `field`.
 *
 * Excel's own rule for a toggle button's pressed state, and the same rule
 * `store.toggle` uses to decide which way the next press goes - so the button
 * lights up exactly when pressing it would turn the attribute OFF.
 */
function everyCellHas(
  cmd: GridCommandContext,
  test: (entry: CellFormatEntry | undefined) => boolean,
): boolean {
  const target = getFormatTarget()
  if (!target) return false
  const rects = rectsOf(cmd)
  if (!rects.length) return false
  let seen = 0
  for (const [minRow, minCol, maxRow, maxCol] of rects) {
    for (let r = minRow; r <= maxRow; r += 1) {
      for (let c = minCol; c <= maxCol; c += 1) {
        const rowId = target.lookup.rowIdAt(r)
        const columnId = target.lookup.columnIdAt(c)
        if (rowId == null || columnId == null) continue
        seen += 1
        if (!test(target.store.get(rowId, columnId))) return false
      }
    }
  }
  return seen > 0
}

function styleToggle(field: 'bold' | 'italic' | 'underline' | 'strike'): Partial<RibbonItem> {
  return {
    kind: 'toggle',
    run: (cmd) => toggleFormat(cmd, field),
    isOn: (cmd) => everyCellHas(cmd, (entry) => entry?.[field] === true),
    isEnabled: canFormat,
  }
}

function alignItem(align: 'left' | 'center' | 'right', title: string): RibbonItem {
  return {
    id: `align-${align}`,
    label: '≡',
    icon: `align-${align}` as RibbonIconName,
    title,
    kind: 'toggle',
    run: (cmd) => applyFormat(cmd, { align }),
    isOn: (cmd) => everyCellHas(cmd, (entry) => entry?.align === align),
    isEnabled: canFormat,
  }
}

/** Excel's Top / Middle / Bottom Align. The middle is the sheet's default,
 *  so its button clears the field rather than storing it, and reads as on
 *  for a cell that has no vertical alignment of its own. */
function valignItem(valign: 'top' | 'center' | 'bottom', title: string): RibbonItem {
  return {
    id: `valign-${valign}`,
    label: '≡',
    icon: `valign-${valign}` as RibbonIconName,
    title,
    kind: 'toggle',
    run: (cmd) => applyFormat(cmd, { valign: valign === 'center' ? undefined : valign }),
    isOn: (cmd) => everyCellHas(cmd, (entry) =>
      valign === 'center' ? entry?.valign === undefined || entry?.valign === 'center' : entry?.valign === valign),
    isEnabled: canFormat,
  }
}

function presetItem(
  id: string, label: string, title: string, name: FormatPresetName, keys?: string,
): RibbonItem {
  const run = preset(name)
  return {
    id,
    label,
    title,
    keys,
    kind: 'toggle',
    run: (cmd) => run(cmd, new KeyboardEvent('keydown')),
    isOn: (cmd) => everyCellHas(cmd, (entry) => entry?.numFmt === FORMAT_PRESETS[name]),
    isEnabled: canFormat,
  }
}

/** A command written for the keymap, adapted to a button. The event is only
 *  there because `SheetCommand` takes one; none of these read it. */
function fromCommand(command: SheetCommand): (cmd: GridCommandContext) => boolean {
  return (cmd) => command(cmd, new KeyboardEvent('keydown'))
}

/**
 * Excel's Increase/Decrease Decimal.
 *
 * Reads the active cell's current pattern rather than assuming one, so
 * pressing it on a currency cell keeps the currency and only moves the point.
 * A cell with no pattern is General, and Excel moves from the decimals the
 * value SHOWS there, not from zero: Increase on 3.14159 goes to six places,
 * not down to one, and Decrease actually trims a place. Only when the cell is
 * empty, or its value is not a number, does General behave like `0`.
 */
function nudgeDecimals(delta: number): (cmd: GridCommandContext) => boolean {
  return (cmd) => {
    const target = getFormatTarget()
    const active = cmd.activeCell
    if (!target || !active) return false
    const rowId = target.lookup.rowIdAt(active.rowIndex)
    const columnId = target.lookup.columnIdAt(active.colIndex)
    const current = rowId != null && columnId != null
      ? target.store.get(rowId, columnId)?.numFmt
      : undefined
    let next: string | null
    if (current) {
      next = withDecimals(current, delta)
    } else {
      // General: start from what the value displays, so the point moves the
      // way Excel's does rather than resetting to a single place.
      const count = generalDecimals(active.rowIndex, active.colIndex) + delta
      next = count < 0 || count > 30 ? null : count === 0 ? '0' : `0.${'0'.repeat(count)}`
    }
    return next === null ? false : applyFormat(cmd, { numFmt: next })
  }
}

/** The decimals a General cell currently shows, so Increase/Decrease Decimal
 *  moves from there. Zero for a blank cell or a non-numeric value. */
function generalDecimals(row: number, col: number): number {
  const wb = getWorkbook()
  if (!wb) return 0
  const value = wb.getValue(wb.active, row, col)
  if (typeof value !== 'number' || !Number.isFinite(value)) return 0
  const dot = formatWithPattern(value, 'General').indexOf('.')
  return dot < 0 ? 0 : formatWithPattern(value, 'General').length - dot - 1
}

/**
 * Move the decimal count of a number-format pattern by `delta`.
 *
 * Exported because it is the fiddly part and deserves its own tests: the
 * pattern can have a prefix and a suffix (`$#,##0.00`, `0.0%`), can have no
 * decimal section at all, and must not go below zero or run away past the 30
 * places Excel allows.
 */
export function withDecimals(pattern: string, delta: number): string | null {
  // Every section moves together. The currency preset is
  // '$#,##0.00;($#,##0.00)' - positives and negatives - and moving only the
  // first half would leave a sheet where -1234.5 printed to a different
  // precision than 1234.5. Excel moves both, so this does too.
  //
  // An accounting pattern is rebuilt from its parts rather than edited:
  // its zero section carries a `"-"??` whose question marks count the
  // decimals too.
  const accounting = accountingParts(pattern)
  if (accounting) {
    const next = accounting.decimals + delta
    return next < 0 || next > 30 ? null : accountingPattern(accounting.symbol, next)
  }
  // A quoted literal can contain a semicolon, which would make splitting on
  // ';' cut a section in half, so a pattern with quotes declines instead of
  // being mangled. Nothing else in FORMAT_PRESETS has one.
  if (pattern.includes('"')) return null
  const sections = pattern.split(';')
  const moved: string[] = []
  for (const section of sections) {
    const next = sectionWithDecimals(section, delta)
    // All or nothing: a partial rewrite is the very thing this guards.
    if (next === null) return null
    moved.push(next)
  }
  return moved.join(';')
}

function sectionWithDecimals(section: string, delta: number): string | null {
  const dot = section.indexOf('.')
  const places = dot < 0 ? 0 : countLeading(section.slice(dot + 1), '0')
  const next = places + delta
  if (next < 0 || next > 30) return null
  const head = dot < 0 ? section : section.slice(0, dot)
  const tail = dot < 0 ? '' : section.slice(dot + 1 + places)
  return next === 0 ? head + tail : `${head}.${'0'.repeat(next)}${tail}`
}

function countLeading(text: string, ch: string): number {
  let n = 0
  while (n < text.length && text[n] === ch) n += 1
  return n
}

// ---------------------------------------------------------------------------
// Fonts, sizes, borders
// ---------------------------------------------------------------------------

/**
 * The fonts a spreadsheet user reaches for, with the stacks that make each
 * render on a machine that lacks it. The empty value is the theme's own
 * font, which is what "Default" means here and what a fresh cell has.
 */
export const FONT_FAMILIES: ReadonlyArray<{ value: string; label: string }> = [
  { value: '', label: 'Default' },
  { value: 'Aptos, "Aptos Narrow", "Segoe UI", sans-serif', label: 'Aptos' },
  { value: 'Calibri, Carlito, "Segoe UI", sans-serif', label: 'Calibri' },
  { value: 'Arial, Helvetica, sans-serif', label: 'Arial' },
  { value: '"Segoe UI", system-ui, sans-serif', label: 'Segoe UI' },
  { value: 'Verdana, Geneva, sans-serif', label: 'Verdana' },
  { value: 'Georgia, "Times New Roman", serif', label: 'Georgia' },
  { value: '"Times New Roman", Times, serif', label: 'Times New Roman' },
  { value: '"Courier New", Courier, monospace', label: 'Courier New' },
  { value: 'ui-monospace, Menlo, Consolas, monospace', label: 'Consolas' },
]

const NUMBER_FORMATS: ReadonlyArray<{ value: FormatPresetName; label: string }> = [
  { value: 'general', label: 'General' },
  { value: 'number', label: 'Number' },
  { value: 'currency', label: 'Currency' },
  { value: 'accounting', label: 'Accounting' },
  { value: 'percent', label: 'Percentage' },
  { value: 'date', label: 'Date' },
  { value: 'time', label: 'Time' },
  { value: 'scientific', label: 'Scientific' },
]


const BORDER_OPTIONS: ReadonlyArray<{ value: BorderPreset; label: string; icon: RibbonIconName }> = [
  { value: 'bottom', label: 'Bottom Border', icon: 'border-bottom' },
  { value: 'top', label: 'Top Border', icon: 'border-top' },
  { value: 'left', label: 'Left Border', icon: 'border-left' },
  { value: 'right', label: 'Right Border', icon: 'border-right' },
  { value: 'none', label: 'No Border', icon: 'border-none' },
  { value: 'all', label: 'All Borders', icon: 'border-all' },
  { value: 'outside', label: 'Outside Borders', icon: 'border-outside' },
  { value: 'thick-bottom', label: 'Thick Bottom Border', icon: 'border-thick-bottom' },
]


// ---------------------------------------------------------------------------
// The tabs
// ---------------------------------------------------------------------------

const small = (row: 1 | 2 | 3, item: Omit<RibbonItem, 'row'>): RibbonItem => ({ ...item, row })

/**
 * Excel's File tab, the part of it a document in a page can do: New, Open
 * an .xlsx from disk, Save as .xlsx, and the active sheet as CSV. Every
 * entry is raised for the shell, and through it for the host, so an app
 * that keeps its workbooks on a server takes Open and Save over with
 * `onAction` and the buttons still read as Excel's.
 */
const FILE: RibbonTab = {
  id: 'file',
  label: 'File',
  groups: [
    {
      id: 'file-new',
      icon: 'file-new',
      label: 'New',
      items: [
        { id: 'file-new', label: 'New', title: 'New: start an empty workbook', icon: 'file-new', kind: 'button', size: 'large', emits: 'file-new' },
      ],
    },
    {
      id: 'file-open',
      icon: 'file-open',
      label: 'Open',
      items: [
        { id: 'file-open', label: 'Open', title: 'Open an .xlsx, .xls, .ods or .csv file', keys: 'Ctrl+O', icon: 'file-open', kind: 'button', size: 'large', emits: 'file-open' },
      ],
    },
    {
      id: 'file-save',
      icon: 'file-save',
      label: 'Save',
      items: [
        { id: 'file-save-xlsx', label: 'Save As', title: 'Save the workbook as an .xlsx file', keys: 'Ctrl+S', icon: 'file-save', kind: 'button', size: 'large', emits: 'file-save-xlsx' },
        { id: 'file-save-ods', label: 'Save As ODS', title: 'Save the workbook as an .ods file, which LibreOffice Calc opens', icon: 'file-save', kind: 'button', size: 'large', emits: 'file-save-ods' },
        { id: 'file-save-xls', label: 'Save As XLS', title: 'Save the workbook as an .xls file, which Excel 97-2003 opens', icon: 'file-save', kind: 'button', size: 'large', emits: 'file-save-xls' },
        { id: 'file-export-csv', label: 'Export CSV', title: 'Export the active sheet as CSV', icon: 'file-csv', kind: 'button', size: 'large', emits: 'file-export-csv' },
      ],
    },
    {
      id: 'file-print',
      icon: 'print',
      label: 'Print',
      items: [
        { id: 'file-print', label: 'Print', title: 'Print the active sheet as its Page Layout says', keys: 'Ctrl+P', icon: 'print', kind: 'button', size: 'large', emits: 'file-print' },
      ],
    },
  ],
}

/**
 * Excel's Page Layout tab, the part with something behind it: Page Setup
 * (Margins, Orientation, Size, Print Area, Print Titles, with the dialog
 * on the launcher) and Sheet Options (whether gridlines and headings
 * print). Raised rather than run here: the shell keeps the setup per
 * sheet in the document, and File > Print reads it.
 */
const PAGE_LAYOUT: RibbonTab = {
  id: 'page-layout',
  label: 'Page Layout',
  groups: [
    {
      id: 'page-setup',
      icon: 'page-setup',
      label: 'Page Setup',
      launcher: 'page-setup',
      items: [
        {
          id: 'margins', label: 'Margins', title: 'Margins', icon: 'margins', kind: 'dropdown', size: 'large',
          options: [
            { value: 'normal', label: 'Normal', emits: 'margins-normal', toggle: true },
            { value: 'narrow', label: 'Narrow', emits: 'margins-narrow', toggle: true },
            { value: 'wide', label: 'Wide', emits: 'margins-wide', toggle: true },
          ],
        },
        {
          id: 'orientation', label: 'Orientation', title: 'Orientation', icon: 'orientation', kind: 'dropdown', size: 'large',
          options: [
            { value: 'portrait', label: 'Portrait', emits: 'page-portrait', toggle: true },
            { value: 'landscape', label: 'Landscape', emits: 'page-landscape', toggle: true },
          ],
        },
        {
          id: 'paper', label: 'Size', title: 'Page Size', icon: 'paper', kind: 'dropdown', size: 'large',
          options: [
            { value: 'letter', label: 'Letter', emits: 'paper-letter', toggle: true },
            { value: 'legal', label: 'Legal', emits: 'paper-legal', toggle: true },
            { value: 'tabloid', label: 'Tabloid', emits: 'paper-tabloid', toggle: true },
            { value: 'a3', label: 'A3', emits: 'paper-a3', toggle: true },
            { value: 'a4', label: 'A4', emits: 'paper-a4', toggle: true },
            { value: 'a5', label: 'A5', emits: 'paper-a5', toggle: true },
          ],
        },
        {
          id: 'print-area', label: 'Print Area', title: 'Print Area', icon: 'print-area', kind: 'dropdown', size: 'large',
          options: [
            { value: 'set', label: 'Set Print Area', emits: 'print-area-set' },
            { value: 'clear', label: 'Clear Print Area', emits: 'print-area-clear' },
          ],
        },
        { id: 'print-titles', label: 'Print Titles', title: 'Print Titles: rows to repeat at the top of every page', icon: 'print-titles', kind: 'button', size: 'large', emits: 'print-titles' },
      ],
    },
    {
      id: 'sheet-options',
      icon: 'gridlines',
      label: 'Sheet Options',
      items: [
        small(1, { id: 'print-gridlines', label: 'Print Gridlines', title: 'Print the gridlines', icon: 'gridlines', kind: 'toggle', wide: true, emits: 'print-gridlines' }),
        small(2, { id: 'print-headings', label: 'Print Headings', title: 'Print the row numbers and column letters', icon: 'headings', kind: 'toggle', wide: true, emits: 'print-headings' }),
      ],
    },
  ],
}

const HOME: RibbonTab = {
  id: 'home',
  label: 'Home',
  groups: [
    {
      id: 'clipboard',
      icon: 'paste',
      label: 'Clipboard',
      launcher: 'paste-special',
      items: [
        // Excel's Clipboard group: the large Paste, and beside it Cut, Copy and
        // Format Painter as icons alone, which is how Excel draws them at
        // every width but the widest. Paste is a split button: the face
        // pastes, the arrow opens the paste kinds with Paste Special... last.
        {
          id: 'paste', label: 'Paste', title: 'Paste', keys: 'Ctrl+V', icon: 'paste',
          kind: 'dropdown', split: true, size: 'large',
          run: (cmd) => { void cmd.paste(); return true },
          options: [
            { value: 'paste', label: 'Paste', keys: 'Ctrl+V', icon: 'paste' },
            { value: 'paste-formulas', label: 'Formulas', emits: 'paste-formulas' },
            { value: 'paste-values', label: 'Values', emits: 'paste-values' },
            { value: 'paste-formats', label: 'Formatting', emits: 'paste-formats' },
            { value: 'paste-transpose', label: 'Transpose', emits: 'paste-transpose' },
            { value: 'paste-special', label: 'Paste Special...', keys: 'Ctrl+Shift+V', emits: 'paste-special' },
          ],
        },
        // The same copy and cut as Ctrl+C and Ctrl+X: the selection, cell
        // by cell through the sheet's clipboard hook. They went through the
        // api's copyToClipboard, which is the export, and put the whole
        // sheet with its column letters on the clipboard whatever was
        // selected; Cut then blanked the selection by hand.
        small(1, {
          id: 'cut', label: 'Cut', title: 'Cut', keys: 'Ctrl+X', icon: 'cut', kind: 'button',
          isEnabled: hasTarget,
          // Raised, so a spreadsheet shell can give it Excel's meaning: the
          // cells stay where they are until the paste lands. A host that
          // answers nothing falls back to the grid's cut, which clears now.
          run: (cmd) => {
            if (raiseRibbonAction('cut', cmd)) return true
            void cmd.cut()
            return true
          },
        }),
        small(2, {
          id: 'copy', label: 'Copy', title: 'Copy', keys: 'Ctrl+C', icon: 'copy', kind: 'button',
          isEnabled: hasTarget,
          run: (cmd) => { cmd.copy(); return true },
        }),
        // Raised: the shell holds the copied formats and paints them onto the
        // next selection. The button reads pressed while it is armed.
        small(3, {
          id: 'format-painter', label: 'Format Painter', title: 'Format Painter',
          icon: 'format-painter', kind: 'button', emits: 'format-painter',
        }),
      ],
    },
    {
      id: 'font',
      icon: 'font',
      label: 'Font',
      layout: 'flow',
      launcher: 'format-cells',
      items: [
        small(1, {
          id: 'font-family', label: 'Font', title: 'Font', kind: 'select',
          options: FONT_FAMILIES, isEnabled: canFormat,
          current: (cmd) => activeEntry(cmd)?.fontFamily ?? '',
          run: (cmd, value) => applyFormat(cmd, { fontFamily: value || undefined }),
        }),
        small(1, {
          id: 'font-size', label: 'Size', title: 'Font Size', kind: 'select',
          options: FONT_SIZES.map((n) => ({ value: String(n), label: String(n) })),
          isEnabled: canFormat,
          current: (cmd) => String(activeEntry(cmd)?.fontSize ?? DEFAULT_FONT_SIZE),
          run: (cmd, value) =>
            applyFormat(cmd, { fontSize: Number(value) === DEFAULT_FONT_SIZE ? undefined : Number(value) }),
        }),
        small(1, {
          id: 'font-grow', label: 'A', title: 'Increase Font Size', keys: 'Ctrl+Shift+>',
          icon: 'font-grow', kind: 'button', isEnabled: canFormat, run: fromCommand(nudgeFontSize(1)),
        }),
        small(1, {
          id: 'font-shrink', label: 'A', title: 'Decrease Font Size', keys: 'Ctrl+Shift+<',
          icon: 'font-shrink', kind: 'button', isEnabled: canFormat, run: fromCommand(nudgeFontSize(-1)),
        }),
        small(2, { id: 'bold', label: 'B', title: 'Bold', keys: 'Ctrl+B', ...styleToggle('bold') } as RibbonItem),
        small(2, { id: 'italic', label: 'I', title: 'Italic', keys: 'Ctrl+I', ...styleToggle('italic') } as RibbonItem),
        small(2, { id: 'underline', label: 'U', title: 'Underline', keys: 'Ctrl+U', ...styleToggle('underline') } as RibbonItem),
        small(2, { id: 'strike', label: 'S', title: 'Strikethrough', keys: 'Ctrl+5', ...styleToggle('strike') } as RibbonItem),
        small(2, {
          id: 'borders', label: 'Borders', title: 'Borders', icon: 'borders', kind: 'menu',
          options: BORDER_OPTIONS, isEnabled: canFormat,
          run: (cmd, value) => applyBorders(cmd, (value || 'bottom') as BorderPreset),
        }),
        small(2, {
          id: 'fill', label: 'Fill Color', title: 'Fill Color', icon: 'fill-colour', kind: 'menu',
          palette: true, none: { value: 'transparent', label: 'No Fill' }, initial: '#FFFF00',
          options: ALL_COLOURS, isEnabled: canFormat,
          run: (cmd, value) =>
            applyFormat(cmd, { fill: !value || value === 'transparent' ? undefined : value }),
        }),
        small(2, {
          id: 'text-colour', label: 'A', title: 'Font Color', icon: 'font-colour', kind: 'menu',
          palette: true, none: { value: 'inherit', label: 'Automatic' }, initial: '#FF0000',
          options: ALL_COLOURS, isEnabled: canFormat,
          run: (cmd, value) =>
            applyFormat(cmd, { color: !value || value === 'inherit' ? undefined : value }),
        }),
      ],
    },
    {
      id: 'alignment',
      icon: 'align-center',
      label: 'Alignment',
      layout: 'flow',
      launcher: 'format-cells',
      items: [
        small(1, valignItem('top', 'Top Align')),
        small(1, valignItem('center', 'Middle Align')),
        small(1, valignItem('bottom', 'Bottom Align')),
        small(1, {
          id: 'wrap', label: 'Wrap Text', title: 'Wrap Text', icon: 'wrap', kind: 'toggle', wide: true,
          run: (cmd) => toggleWrap(cmd),
          isOn: (cmd) => everyCellHas(cmd, (entry) => entry?.wrap === true),
          isEnabled: canFormat,
        }),
        small(2, alignItem('left', 'Align Left')),
        small(2, alignItem('center', 'Center')),
        small(2, alignItem('right', 'Align Right')),
        // Excel's split button: the face merges and centres, the arrow
        // opens the kinds. Raised for the shell, which keeps the merges
        // per sheet and hands them to the grid.
        small(3, {
          id: 'merge', label: 'Merge & Center', title: 'Merge & Center', icon: 'merge',
          kind: 'dropdown', split: true, wide: true, lit: 'merge-center',
          // Greyed on a protected sheet, as Excel's is: merging is a format.
          isEnabled: canFormat,
          run: (cmd) => raiseRibbonAction('merge-center', cmd),
          options: [
            { value: 'merge-center', label: 'Merge & Center', icon: 'merge', emits: 'merge-center' },
            { value: 'merge-across', label: 'Merge Across', emits: 'merge-across' },
            { value: 'merge-cells', label: 'Merge Cells', emits: 'merge-cells' },
            { value: 'unmerge-cells', label: 'Unmerge Cells', icon: 'unmerge', emits: 'unmerge-cells' },
          ],
        }),
      ],
    },
    {
      id: 'number',
      icon: 'number',
      label: 'Number',
      layout: 'flow',
      launcher: 'format-cells',
      items: [
        small(1, {
          id: 'num-format', label: 'General', title: 'Number Format', kind: 'select',
          options: NUMBER_FORMATS, isEnabled: canFormat,
          // The category, not the exact pattern: a typed 12% carries 0%,
          // and Excel's combo calls that Percentage too. A pattern outside
          // every category shows as itself.
          current: (cmd) => {
            const fmt = activeEntry(cmd)?.numFmt
            const { category } = formatCategory(fmt)
            return category === 'custom' || category === 'special' ? fmt ?? 'general' : category
          },
          run: (cmd, value) =>
            applyFormat(cmd, { numFmt: FORMAT_CATEGORY_PATTERNS[value as FormatPresetName] }),
        }),
        // Excel's $ button applies Accounting; Ctrl+Shift+4 is Currency.
        small(2, presetItem('fmt-currency', '$', 'Accounting Number Format', 'accounting')),
        small(2, presetItem('fmt-percent', '%', 'Percent Style', 'percent', 'Ctrl+Shift+5')),
        small(2, presetItem('fmt-number', ',', 'Comma Style', 'number', 'Ctrl+Shift+1')),
        small(2, {
          id: 'dec-more', label: '.00', title: 'Increase Decimal', icon: 'dec-more', kind: 'button',
          isEnabled: canFormat, run: nudgeDecimals(1),
        }),
        small(2, {
          id: 'dec-less', label: '.0', title: 'Decrease Decimal', icon: 'dec-less', kind: 'button',
          isEnabled: canFormat, run: nudgeDecimals(-1),
        }),
      ],
    },
    {
      id: 'cells',
      icon: 'table',
      label: 'Cells',
      items: [
        // Excel's split buttons: the face takes the selection's axis (a
        // whole column inserts columns, anything else rows, which is what
        // Excel does with a cell selected), and the arrow spells the axis
        // out, so a column can be inserted from a cell without selecting
        // the column first.
        small(1, {
          id: 'insert', label: 'Insert', title: 'Insert Cells', keys: 'Ctrl+Shift++',
          icon: 'insert-cells', kind: 'dropdown', split: true, wide: true,
          run: (cmd, value) =>
            value === 'rows' ? insertRows(cmd)
              : value === 'columns' ? insertColumns(cmd)
                : value === 'sheet' ? newSheet()
                  : structural(cmd, 'insert') || insertRows(cmd),
          options: [
            { value: 'rows', label: 'Insert Sheet Rows' },
            { value: 'columns', label: 'Insert Sheet Columns' },
            { value: 'sheet', label: 'Insert Sheet', keys: 'Shift+F11' },
          ],
          isEnabled: canRestructure,
        }),
        small(2, {
          id: 'delete', label: 'Delete', title: 'Delete Cells', keys: 'Ctrl+-',
          icon: 'delete-cells', kind: 'dropdown', split: true, wide: true,
          run: (cmd, value) =>
            value === 'rows' ? deleteRows(cmd)
              : value === 'columns' ? deleteColumns(cmd)
                : structural(cmd, 'delete') || deleteRows(cmd),
          options: [
            { value: 'rows', label: 'Delete Sheet Rows' },
            { value: 'columns', label: 'Delete Sheet Columns' },
            { value: 'sheet', label: 'Delete Sheet', emits: 'delete-sheet' },
          ],
          isEnabled: canRestructure,
        }),
        // Excel's Format menu: Cell Size, Visibility, and Format Cells at
        // the end. Each entry is raised for the shell, which owns the size
        // dialogs and keeps hidden lines per sheet.
        small(3, {
          id: 'format', label: 'Format', title: 'Format', icon: 'format-cells', kind: 'dropdown', wide: true,
          options: [
            { value: 'cell-size', label: 'Cell Size', heading: true },
            { value: 'row-height', label: 'Row Height...', emits: 'row-height' },
            { value: 'autofit-rows', label: 'AutoFit Row Height', emits: 'autofit-rows' },
            { value: 'column-width', label: 'Column Width...', emits: 'column-width' },
            { value: 'autofit-columns', label: 'AutoFit Column Width', emits: 'autofit-columns' },
            { value: 'visibility', label: 'Visibility', heading: true },
            { value: 'hide-rows', label: 'Hide Rows', keys: 'Ctrl+9', emits: 'hide-rows' },
            { value: 'hide-columns', label: 'Hide Columns', keys: 'Ctrl+0', emits: 'hide-columns' },
            { value: 'unhide-rows', label: 'Unhide Rows', keys: 'Ctrl+Shift+9', emits: 'unhide-rows' },
            { value: 'unhide-columns', label: 'Unhide Columns', keys: 'Ctrl+Shift+0', emits: 'unhide-columns' },
            { value: 'protection', label: 'Protection', heading: true },
            { value: 'lock-cell', label: 'Lock Cell', icon: 'lock', emits: 'toggle-lock', toggle: true },
            { value: 'format-cells', label: 'Format Cells...', keys: 'Ctrl+1', emits: 'format-cells' },
          ],
        }),
      ],
    },
    {
      // Excel's Styles group, the part with something behind it: one large
      // Conditional Formatting dropdown. Its entries are raised for the
      // shell, which owns the small dialogs and the rules per sheet; the
      // headings are Excel's submenus, flattened.
      id: 'styles',
      icon: 'cf',
      label: 'Styles',
      items: [
        {
          id: 'conditional-formatting', label: 'Conditional Formatting', title: 'Conditional Formatting',
          icon: 'cf', kind: 'dropdown', size: 'large',
          options: [
            { value: 'h', label: 'Highlight Cells Rules', heading: true },
            { value: 'cf-greater', label: 'Greater Than...', icon: 'cf-greater', emits: 'cf-greater' },
            { value: 'cf-less', label: 'Less Than...', icon: 'cf-less', emits: 'cf-less' },
            { value: 'cf-between', label: 'Between...', icon: 'cf-between', emits: 'cf-between' },
            { value: 'cf-equal', label: 'Equal To...', icon: 'cf-equal', emits: 'cf-equal' },
            { value: 'cf-text', label: 'Text that Contains...', icon: 'cf-text', emits: 'cf-text' },
            { value: 'cf-duplicates', label: 'Duplicate Values...', icon: 'cf-duplicates', emits: 'cf-duplicates' },
            { value: 't', label: 'Top/Bottom Rules', heading: true },
            { value: 'cf-top10', label: 'Top 10 Items...', icon: 'cf-top', emits: 'cf-top10' },
            { value: 'cf-bottom10', label: 'Bottom 10 Items...', icon: 'cf-bottom', emits: 'cf-bottom10' },
            { value: 'cf-above-average', label: 'Above Average...', icon: 'cf-above', emits: 'cf-above-average' },
            { value: 'cf-below-average', label: 'Below Average...', icon: 'cf-below', emits: 'cf-below-average' },
            { value: 'b', label: 'Data Bars, Color Scales, Icon Sets', heading: true },
            { value: 'cf-data-bar', label: 'Data Bar', icon: 'cf-bar', emits: 'cf-data-bar' },
            { value: 'cf-color-scale-3', label: 'Green - Yellow - Red Color Scale', icon: 'cf-scale', emits: 'cf-color-scale-3' },
            { value: 'cf-color-scale-2', label: 'Green - White Color Scale', icon: 'cf-scale', emits: 'cf-color-scale-2' },
            { value: 'cf-icon-set', label: 'Icon Set (3 Arrows)', icon: 'cf-icons', emits: 'cf-icon-set' },
            { value: 'n', label: 'New Rule', heading: true },
            { value: 'cf-formula', label: 'Use a Formula...', icon: 'cf-formula', emits: 'cf-formula' },
            { value: 'c', label: 'Clear Rules', heading: true },
            { value: 'cf-clear-selection', label: 'Clear Rules from Selected Cells', emits: 'cf-clear-selection' },
            { value: 'cf-clear-sheet', label: 'Clear Rules from Entire Sheet', emits: 'cf-clear-sheet' },
            { value: 'm', label: 'Manage', heading: true },
            { value: 'cf-manage', label: 'Manage Rules...', emits: 'cf-manage' },
          ],
        },
      ],
    },
    {
      id: 'editing',
      icon: 'find',
      label: 'Editing',
      items: [
        // Undo and Redo open the group as a column of two small icons, the
        // way Cut and Copy stand beside Paste; the owner wanted them here
        // rather than in a group of their own.
        // Raised rather than run: a step made on another sheet is undone
        // THERE, which means switching sheets first, and only the shell can.
        small(1, {
          id: 'undo', label: 'Undo', title: 'Undo', keys: 'Ctrl+Z', icon: 'undo', kind: 'button',
          isEnabled: (cmd) => cmd.api.canUndo(),
          emits: 'undo',
        }),
        small(2, {
          id: 'redo', label: 'Redo', title: 'Redo', keys: 'Ctrl+Y', icon: 'redo', kind: 'button',
          isEnabled: (cmd) => cmd.api.canRedo(),
          emits: 'redo',
        }),
        small(1, {
          id: 'autosum', label: 'AutoSum', title: 'AutoSum', keys: 'Alt+=',
          icon: 'autosum', kind: 'button', wide: true, run: fromCommand(autoSum),
        }),
        small(2, {
          id: 'fill-down', label: 'Fill Down', title: 'Fill Down', keys: 'Ctrl+D',
          icon: 'fill-down', kind: 'button', wide: true, run: (cmd) => fillDown(cmd),
        }),
        small(3, {
          id: 'fill-right', label: 'Fill Right', title: 'Fill Right', keys: 'Ctrl+R',
          icon: 'fill-right', kind: 'button', wide: true, run: (cmd) => fillRight(cmd),
        }),
        small(1, {
          id: 'clear-formats', label: 'Clear', title: 'Clear Formats (keeps values)',
          icon: 'clear', kind: 'button', wide: true, isEnabled: canFormat,
          run: clearFormats,
        }),
        small(2, {
          id: 'filter', label: 'Filter', title: 'Filter', keys: 'Ctrl+Shift+L',
          icon: 'filter', kind: 'toggle', wide: true, emits: 'toggle-filter',
        }),
        small(3, {
          id: 'find', label: 'Find & Select', title: 'Find and Replace', keys: 'Ctrl+H',
          icon: 'find', kind: 'button', wide: true, emits: 'find-replace',
        }),
      ],
    },
  ],
}

const INSERT: RibbonTab = {
  id: 'insert',
  label: 'Insert',
  groups: [
    {
      id: 'tables',
      icon: 'table',
      label: 'Tables',
      items: [
        // Excel's Tables group leads with PivotTable, and Refresh sits beside
        // the pair for the pivot the cursor is in.
        { id: 'pivot-table', label: 'PivotTable', title: 'Summarise the selected block', icon: 'pivot', kind: 'button', size: 'large', emits: 'insert-pivot' },
        { id: 'table', label: 'Table', title: 'Format the selection as a table', keys: 'Ctrl+T', icon: 'table', kind: 'button', size: 'large', emits: 'insert-table' },
        small(1, { id: 'pivot-refresh', label: 'Refresh', title: 'Rebuild the PivotTable here from its source', icon: 'calculate', kind: 'button', wide: true, emits: 'refresh-pivot' }),
        small(1, { id: 'pivot-details', label: 'Show Details', title: 'Show Details: the source rows behind the number in this PivotTable cell, on a sheet of their own', icon: 'pivot', kind: 'button', wide: true, emits: 'pivot-details' }),
        small(2, { id: 'table-remove', label: 'To Range', title: 'Convert the table here back to ordinary cells', icon: 'delete-cells', kind: 'button', wide: true, emits: 'remove-table' }),
        small(3, { id: 'table-style', label: 'Table Styles', title: 'Pick the look of the table the cursor is in', icon: 'table', kind: 'button', wide: true, emits: 'table-style' }),
      ],
    },
    {
      id: 'charts',
      icon: 'chart',
      label: 'Charts',
      items: [
        { id: 'chart', label: 'Chart', title: 'Chart the selected range', icon: 'chart', kind: 'button', size: 'large', emits: 'insert-chart' },
        small(1, { id: 'chart-setup', label: 'Setup', title: 'Chart: type, title, labels and series', icon: 'chart-setup', kind: 'button', wide: true, emits: 'chart-setup' }),
        small(2, { id: 'delete-object', label: 'Delete', title: 'Delete the selected chart or picture', icon: 'delete-cells', kind: 'button', wide: true, emits: 'delete-object' }),
      ],
    },
    {
      // Excel's Sparklines group: the three kinds, each opening the Create
      // Sparklines dialog on the selection, and Clear for the group under it.
      id: 'sparklines',
      icon: 'sparkline-line',
      label: 'Sparklines',
      items: [
        { id: 'sparkline-line', label: 'Line', title: 'A line sparkline in each cell of a range', icon: 'sparkline-line', kind: 'button', size: 'large', emits: 'sparkline-line' },
        { id: 'sparkline-column', label: 'Column', title: 'A column sparkline in each cell of a range', icon: 'sparkline-column', kind: 'button', size: 'large', emits: 'sparkline-column' },
        { id: 'sparkline-winloss', label: 'Win/Loss', title: 'A win/loss sparkline in each cell of a range', icon: 'sparkline-winloss', kind: 'button', size: 'large', emits: 'sparkline-winloss' },
        small(1, { id: 'sparkline-setup', label: 'Edit', title: 'The sparkline group here: its ranges, kind and colours', icon: 'chart-setup', kind: 'button', wide: true, emits: 'sparkline-setup' }),
        small(2, { id: 'sparkline-clear', label: 'Clear', title: 'Clear the sparklines in the selection', icon: 'delete-cells', kind: 'button', wide: true, emits: 'clear-sparklines' }),
      ],
    },
    {
      // Excel's Links group: one dialog for the address, the text and the tip,
      // and Remove Link beside it.
      id: 'links',
      icon: 'link',
      label: 'Links',
      items: [
        { id: 'link', label: 'Link', title: 'Link this cell to a page or an address', keys: 'Ctrl+K', icon: 'link', kind: 'button', size: 'large', emits: 'insert-link' },
        small(1, { id: 'unlink', label: 'Remove', title: 'Remove the link from the selection', icon: 'unlink', kind: 'button', wide: true, emits: 'remove-link' }),
      ],
    },
    {
      id: 'illustrations',
      icon: 'picture',
      label: 'Illustrations',
      items: [
        { id: 'picture', label: 'Picture', title: 'Put a picture on the sheet', icon: 'picture', kind: 'button', size: 'large', emits: 'insert-picture' },
      ],
    },
    {
      id: 'insert-cells',
      icon: 'insert-cells',
      label: 'Cells',
      items: [
        small(1, {
          id: 'insert-rows', label: 'Insert', title: 'Insert rows or columns', icon: 'insert-cells', kind: 'button', wide: true,
          run: (cmd) => structural(cmd, 'insert') || insertRows(cmd),
          isEnabled: canRestructure,
        }),
        small(2, {
          id: 'delete-rows', label: 'Delete', title: 'Delete rows or columns', icon: 'delete-cells', kind: 'button', wide: true,
          run: (cmd) => structural(cmd, 'delete') || deleteRows(cmd),
          isEnabled: canRestructure,
        }),
      ],
    },
    {
      id: 'insert-function',
      icon: 'function',
      label: 'Functions',
      items: [
        { id: 'function', label: 'Insert Function', title: 'Insert Function', keys: 'Shift+F3', icon: 'function', kind: 'button', size: 'large', emits: 'insert-function' },
      ],
    },
    {
      id: 'insert-sheet',
      icon: 'new-sheet',
      label: 'Sheets',
      items: [
        {
          id: 'new-sheet', label: 'New Sheet', title: 'New sheet', keys: 'Shift+F11',
          icon: 'new-sheet', kind: 'button', size: 'large',
          isEnabled: () => getWorkbook() !== null,
          run: () => {
            const wb = getWorkbook()
            if (!wb) return false
            wb.addSheet()
            return true
          },
        },
      ],
    },
  ],
}

const FORMULAS: RibbonTab = {
  id: 'formulas',
  label: 'Formulas',
  groups: [
    {
      id: 'function-library',
      icon: 'function',
      label: 'Function Library',
      items: [
        { id: 'f-insert', label: 'Insert Function', title: 'Insert Function', keys: 'Shift+F3', icon: 'function', kind: 'button', size: 'large', emits: 'insert-function' },
        { id: 'f-autosum', label: 'AutoSum', title: 'AutoSum', keys: 'Alt+=', icon: 'autosum', kind: 'button', size: 'large', run: fromCommand(autoSum) },
      ],
    },
    {
      id: 'defined-names',
      icon: 'name-manager',
      label: 'Defined Names',
      items: [
        { id: 'name-manager', label: 'Name Manager', title: 'Name Manager', keys: 'Ctrl+F3', icon: 'name-manager', kind: 'button', size: 'large', emits: 'name-manager' },
      ],
    },
    {
      id: 'auditing',
      icon: 'show-formulas',
      label: 'Formula Auditing',
      items: [
        small(1, { id: 'trace-precedents', label: 'Trace Precedents', title: 'Trace Precedents: arrows from the cells the active formula reads; again for the next level', icon: 'trace-precedents', kind: 'button', wide: true, emits: 'trace-precedents' }),
        small(2, { id: 'trace-dependents', label: 'Trace Dependents', title: 'Trace Dependents: arrows to the formulas that read the active cell; again for the next level', icon: 'trace-dependents', kind: 'button', wide: true, emits: 'trace-dependents' }),
        small(3, { id: 'remove-arrows', label: 'Remove Arrows', title: 'Remove Arrows', icon: 'remove-arrows', kind: 'button', wide: true, emits: 'remove-arrows' }),
        small(1, { id: 'show-formulas', label: 'Show Formulas', title: 'Show formulas instead of their results', keys: 'Ctrl+`', icon: 'show-formulas', kind: 'toggle', wide: true, emits: 'toggle-formulas' }),
        small(2, { id: 'evaluate-formula', label: 'Evaluate Formula', title: 'Evaluate Formula: work the active cell out one part at a time', icon: 'evaluate-formula', kind: 'button', wide: true, emits: 'evaluate-formula' }),
        small(3, { id: 'error-checking', label: 'Error Checking', title: 'Error Checking: walk the cells on this sheet that report an error, and the formulas that break their column\'s pattern', icon: 'error-checking', kind: 'button', wide: true, emits: 'error-checking' }),
      ],
    },
    {
      id: 'calculation',
      icon: 'calculate',
      label: 'Calculation',
      items: [
        { id: 'recalc', label: 'Calculate Now', title: 'Recalculate the workbook', keys: 'F9', icon: 'calculate', kind: 'button', size: 'large', emits: 'recalculate' },
        small(1, { id: 'goal-seek-f', label: 'Goal Seek', title: 'Goal Seek', icon: 'goal-seek', kind: 'button', wide: true, emits: 'goal-seek' }),
        small(2, { id: 'calc-options', label: 'Calculation Options', title: 'Iterative calculation: let a circular reference settle instead of showing #CYCLE!', icon: 'calculate', kind: 'button', wide: true, emits: 'calc-options' }),
      ],
    },
  ],
}

const DATA: RibbonTab = {
  id: 'data',
  label: 'Data',
  groups: [
    {
      id: 'sort-filter',
      icon: 'filter',
      label: 'Sort & Filter',
      items: [
        small(1, { id: 'sort-asc', label: 'Sort A to Z', title: 'Sort A to Z', icon: 'sort-asc', kind: 'button', emits: 'sort-asc' }),
        small(2, { id: 'sort-desc', label: 'Sort Z to A', title: 'Sort Z to A', icon: 'sort-desc', kind: 'button', emits: 'sort-desc' }),
        { id: 'sort-custom', label: 'Sort', title: 'Sort: by several columns, each its own way', icon: 'sort', kind: 'button', size: 'large', emits: 'sort-custom' },
        { id: 'filter-data', label: 'Filter', title: 'Filter', keys: 'Ctrl+Shift+L', icon: 'filter', kind: 'toggle', size: 'large', emits: 'toggle-filter' },
      ],
    },
    {
      id: 'data-tools',
      icon: 'text-to-columns',
      label: 'Data Tools',
      items: [
        { id: 'text-to-columns', label: 'Text to Columns', title: 'Split the selected column on a delimiter', icon: 'text-to-columns', kind: 'button', size: 'large', emits: 'text-to-columns' },
        { id: 'remove-duplicates', label: 'Remove Duplicates', title: 'Remove duplicate rows', icon: 'remove-duplicates', kind: 'button', size: 'large', emits: 'remove-duplicates' },
        // Excel's menu: the dialog, then Circle Invalid Data and Clear
        // Validation Circles, each raised for the shell.
        {
          id: 'data-validation', label: 'Data Validation', title: 'Data Validation: what may be typed into the selected cells',
          icon: 'validation', kind: 'dropdown', size: 'large',
          options: [
            { value: 'data-validation', label: 'Data Validation...', emits: 'data-validation' },
            { value: 'circle-invalid', label: 'Circle Invalid Data', emits: 'circle-invalid' },
            { value: 'clear-circles', label: 'Clear Validation Circles', emits: 'clear-circles' },
          ],
        },
      ],
    },
    {
      id: 'forecast',
      icon: 'goal-seek',
      label: 'Forecast',
      items: [
        { id: 'goal-seek', label: 'Goal Seek', title: 'Change one input until a formula hits a target', icon: 'goal-seek', kind: 'button', size: 'large', emits: 'goal-seek' },
      ],
    },
  ],
}

function toggleWrap(cmd: GridCommandContext): boolean {
  const target = getFormatTarget()
  if (!target) return false
  const rects = rectsOf(cmd)
  if (!rects.length) return false
  if (!formatAllowed(target, rects)) return false
  withFormatUndo(cmd, target, rects, () => target.store.toggle(rects, 'wrap', target.lookup))
  target.onChange?.()
  return true
}

/**
 * Excel's Review tab, the parts with something behind them. Comments are
 * the sheet's notes: New Comment opens the editor on the active cell (and
 * edits the one there), Delete, Previous and Next walk them, Show All
 * Comments lists them. Protect Sheet and Unprotect Sheet are one slot, the
 * shell leaving off whichever does not apply; Protect Sheet opens Excel's
 * dialog with its "allow all users to" list, and Allow Edit Ranges names
 * the blocks that stay editable. There is no password, as the sheet
 * documents.
 */
const REVIEW: RibbonTab = {
  id: 'review',
  label: 'Review',
  groups: [
    {
      id: 'comments',
      icon: 'comment',
      label: 'Comments',
      items: [
        { id: 'new-comment', label: 'New Comment', title: 'New Comment', keys: 'Shift+F2', icon: 'comment', kind: 'button', size: 'large', emits: 'new-comment' },
        small(1, { id: 'delete-comment', label: 'Delete', title: 'Delete Comment', icon: 'comment-delete', kind: 'button', wide: true, emits: 'delete-comment' }),
        small(2, { id: 'prev-comment', label: 'Previous', title: 'Previous Comment', icon: 'comment-prev', kind: 'button', wide: true, emits: 'prev-comment' }),
        small(3, { id: 'next-comment', label: 'Next', title: 'Next Comment', icon: 'comment-next', kind: 'button', wide: true, emits: 'next-comment' }),
        { id: 'toggle-comments', label: 'Show All Comments', title: 'Show All Comments', icon: 'comments-all', kind: 'toggle', size: 'large', emits: 'toggle-comments' },
      ],
    },
    {
      id: 'protect',
      icon: 'protect',
      label: 'Protect',
      items: [
        {
          id: 'protect-sheet', label: 'Protect Sheet', title: 'Protect Sheet: locked cells can no longer be changed',
          icon: 'protect', kind: 'button', size: 'large', emits: 'protect-sheet',
        },
        {
          id: 'unprotect-sheet', label: 'Unprotect Sheet', title: 'Unprotect Sheet',
          icon: 'unprotect', kind: 'button', size: 'large', emits: 'unprotect-sheet',
        },
        {
          id: 'allow-edit-ranges', label: 'Allow Edit Ranges', title: 'Allow Users to Edit Ranges: blocks that take an edit while the sheet is protected',
          icon: 'edit-ranges', kind: 'button', size: 'large', emits: 'allow-edit-ranges',
        },
      ],
    },
  ],
}

/**
 * Excel's View tab, the part with something behind it: Window > Freeze
 * Panes, Excel's dropdown of Freeze Panes / Freeze Top Row / Freeze First
 * Column / Unfreeze Panes. Raised rather than run here: the sheet shell
 * keeps the freeze per sheet and puts it back when the sheet comes up
 * again.
 */
const VIEW: RibbonTab = {
  id: 'view',
  label: 'View',
  groups: [
    {
      id: 'show',
      icon: 'gridlines',
      label: 'Show',
      items: [
        small(1, { id: 'gridlines', label: 'Gridlines', title: 'Show or hide the gridlines', icon: 'gridlines', kind: 'toggle', wide: true, emits: 'toggle-gridlines' }),
        small(2, { id: 'formula-bar', label: 'Formula Bar', title: 'Show or hide the formula bar', icon: 'formula-bar', kind: 'toggle', wide: true, emits: 'toggle-formula-bar' }),
        small(3, { id: 'headings', label: 'Headings', title: 'Show or hide the row numbers and column letters', icon: 'headings', kind: 'toggle', wide: true, emits: 'toggle-headings' }),
      ],
    },
    {
      id: 'window',
      icon: 'freeze',
      label: 'Window',
      items: [
        {
          id: 'freeze', label: 'Freeze Panes', title: 'Freeze Panes', icon: 'freeze', kind: 'dropdown', size: 'large',
          options: [
            { value: 'freeze-panes', label: 'Freeze Panes', icon: 'freeze', emits: 'freeze-panes' },
            { value: 'freeze-top-row', label: 'Freeze Top Row', emits: 'freeze-top-row' },
            { value: 'freeze-first-column', label: 'Freeze First Column', emits: 'freeze-first-column' },
            { value: 'unfreeze-panes', label: 'Unfreeze Panes', icon: 'unfreeze', emits: 'unfreeze-panes' },
          ],
        },
      ],
    },
  ],
}

export const RIBBON_TABS: ReadonlyArray<RibbonTab> = [FILE, HOME, INSERT, PAGE_LAYOUT, FORMULAS, DATA, REVIEW, VIEW]

/** Every item across every tab, for tests and for a command palette. */
export function ribbonItems(): ReadonlyArray<RibbonItem> {
  return RIBBON_TABS.flatMap((tab) => tab.groups.flatMap((group) => group.items))
}
