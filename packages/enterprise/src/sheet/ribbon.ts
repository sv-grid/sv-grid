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
 */
import type { GridCommandContext } from '@svgrid/grid/shortcuts'
import {
  applyFormat, toggleFormat, preset, autoSum, structural,
  getFormatTarget, getWorkbook,
  type SheetCommand,
} from './shortcuts'
import { fillDown, fillRight, targetRect } from './commands'
import type { Rect } from './navigate'
import { freezeAtActiveCell, unfreeze } from './freeze'
import { FORMAT_PRESETS, type FormatPresetName } from './number-format'
import type { CellFormatEntry } from './format-store'

/** What the host has to render for one control. */
export type RibbonItemKind =
  /** Runs and forgets. */
  | 'button'
  /** Runs, and paints itself on when `isOn` reports true for the selection. */
  | 'toggle'
  /** A dropdown; `run` receives the chosen value. */
  | 'select'
  /** A row of colour chips; `run` receives the chosen colour. */
  | 'swatches'

export type RibbonItem = {
  id: string
  /** The button face. Kept to text and typographic glyphs on purpose: the
   *  grid ships no icon set, and a ribbon of emoji reads as a toy. */
  label: string
  /** Long form for the tooltip and the accessible name. */
  title: string
  /**
   * Draw a shape instead of printing `label`.
   *
   * Only the alignment controls need one: three identical `≡` glyphs are
   * indistinguishable, and the obvious arrow characters have patchy font
   * coverage. The renderer draws these as CSS bars, so they look the same
   * everywhere without an icon font. `label` stays as the fallback.
   */
  icon?: 'align-left' | 'align-center' | 'align-right'
  /** Shown after the title in the tooltip, the way Excel does it. */
  keys?: string
  kind: RibbonItemKind
  /** Wider face for a text label that will not fit a square button. */
  wide?: boolean
  /** Run the action. Returns false when it declined (nothing selected, no
   *  store attached), which the renderer uses to avoid claiming it worked. */
  run?: (cmd: GridCommandContext, value?: string) => boolean
  /** Toggles only. */
  isOn?: (cmd: GridCommandContext) => boolean
  /** Defaults to enabled. Reports false when the action has nothing to act
   *  on, so the button greys out rather than doing nothing on click. */
  isEnabled?: (cmd: GridCommandContext) => boolean
  /** `select` and `swatches` only. */
  options?: ReadonlyArray<{ value: string; label: string }>
  /** Set instead of `run` when the action needs chrome this layer does not
   *  own. The renderer calls `onAction(emits, cmd)`. */
  emits?: RibbonActionId
}

/** Actions the ribbon delegates to the host rather than running itself. */
export type RibbonActionId =
  | 'paste'
  | 'paste-special'
  | 'format-cells'
  | 'find-replace'
  | 'insert-function'
  | 'name-manager'
  | 'text-to-columns'
  | 'remove-duplicates'
  | 'goal-seek'
  | 'insert-chart'
  | 'insert-table'
  | 'recalculate'
  | 'toggle-formulas'
  | 'sort-asc'
  | 'sort-desc'
  | 'toggle-filter'

export type RibbonGroup = {
  id: string
  /** Printed under the group, which is what makes a ribbon a ribbon. */
  label: string
  /**
   * How wide the control block may grow before it wraps, in px.
   *
   * Left to the renderer this is one width for every group, and the controls
   * then wrap wherever that happens to fall: the Clipboard group breaks after
   * "Paste Cut" and drops "Copy" onto a line of its own. Excel's groups are
   * each sized to their contents, so each one says how wide it wants to be.
   */
  width?: number
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
  return getFormatTarget() !== null && hasTarget(cmd)
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
    icon: `align-${align}`,
    title,
    kind: 'toggle',
    run: (cmd) => applyFormat(cmd, { align }),
    isOn: (cmd) => everyCellHas(cmd, (entry) => entry?.align === align),
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
 * A cell with no pattern starts from General, which Excel treats as 0 decimals.
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
    const next = withDecimals(current ?? '0', delta)
    return next === null ? false : applyFormat(cmd, { numFmt: next })
  }
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
  // A quoted literal can contain a semicolon, which would make splitting on
  // ';' cut a section in half, so a pattern with quotes declines instead of
  // being mangled. Nothing in FORMAT_PRESETS has one.
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

/** Excel's default fill palette, trimmed to one readable row. */
const FILL_COLOURS = [
  { value: 'transparent', label: 'No fill' },
  { value: '#fee2e2', label: 'Red' },
  { value: '#ffedd5', label: 'Orange' },
  { value: '#fef9c3', label: 'Yellow' },
  { value: '#dcfce7', label: 'Green' },
  { value: '#dbeafe', label: 'Blue' },
  { value: '#ede9fe', label: 'Purple' },
  { value: '#e5e7eb', label: 'Grey' },
] as const

const TEXT_COLOURS = [
  { value: 'inherit', label: 'Automatic' },
  { value: '#b91c1c', label: 'Red' },
  { value: '#c2410c', label: 'Orange' },
  { value: '#15803d', label: 'Green' },
  { value: '#1d4ed8', label: 'Blue' },
  { value: '#6d28d9', label: 'Purple' },
  { value: '#64748b', label: 'Grey' },
] as const

const FONT_SIZES = [10, 11, 12, 13, 14, 16, 18, 24].map((n) => ({
  value: String(n), label: String(n),
}))

const FONT_FAMILIES = [
  { value: '', label: 'Default' },
  { value: 'ui-sans-serif, system-ui, sans-serif', label: 'Sans' },
  { value: 'ui-serif, Georgia, serif', label: 'Serif' },
  { value: 'ui-monospace, Menlo, monospace', label: 'Mono' },
]

const NUMBER_FORMATS: ReadonlyArray<{ value: FormatPresetName; label: string }> = [
  { value: 'general', label: 'General' },
  { value: 'number', label: 'Number' },
  { value: 'currency', label: 'Currency' },
  { value: 'percent', label: 'Percent' },
  { value: 'date', label: 'Date' },
  { value: 'time', label: 'Time' },
  { value: 'scientific', label: 'Scientific' },
]

// ---------------------------------------------------------------------------
// The tabs
// ---------------------------------------------------------------------------

const HOME: RibbonTab = {
  id: 'home',
  label: 'Home',
  groups: [
    {
      id: 'clipboard',
      width: 118,
      label: 'Clipboard',
      items: [
        {
          id: 'paste', label: 'Paste', title: 'Paste', keys: 'Ctrl+V',
          kind: 'button', wide: true, emits: 'paste',
        },
        {
          id: 'cut', label: 'Cut', title: 'Cut', keys: 'Ctrl+X', kind: 'button',
          isEnabled: hasTarget,
          run: (cmd) => {
            const rect = targetRect(cmd)
            if (!rect) return false
            // Copy first, then blank: a cut that cleared before the clipboard
            // write landed would lose the cells outright.
            void cmd.api.copyToClipboard()
            return cmd.batch(() => {
              const [minRow, minCol, maxRow, maxCol] = rect
              for (let r = minRow; r <= maxRow; r += 1) {
                for (let c = minCol; c <= maxCol; c += 1) cmd.setCellValue(r, c, '')
              }
              return true
            })
          },
        },
        {
          id: 'copy', label: 'Copy', title: 'Copy', keys: 'Ctrl+C', kind: 'button',
          isEnabled: hasTarget,
          run: (cmd) => { void cmd.api.copyToClipboard(); return true },
        },
        {
          id: 'paste-special', label: 'Paste Special', title: 'Paste Special',
          keys: 'Ctrl+Shift+V', kind: 'button', wide: true, emits: 'paste-special',
        },
      ],
    },
    {
      id: 'font',
      width: 190,
      label: 'Font',
      items: [
        {
          id: 'font-family', label: 'Font', title: 'Font family', kind: 'select',
          options: FONT_FAMILIES, isEnabled: canFormat,
          run: (cmd, value) => applyFormat(cmd, { fontFamily: value || undefined }),
        },
        {
          id: 'font-size', label: 'Size', title: 'Font size', kind: 'select',
          options: FONT_SIZES, isEnabled: canFormat,
          run: (cmd, value) => applyFormat(cmd, { fontSize: value ? Number(value) : undefined }),
        },
        { id: 'bold', label: 'B', title: 'Bold', keys: 'Ctrl+B', ...styleToggle('bold') } as RibbonItem,
        { id: 'italic', label: 'I', title: 'Italic', keys: 'Ctrl+I', ...styleToggle('italic') } as RibbonItem,
        { id: 'underline', label: 'U', title: 'Underline', keys: 'Ctrl+U', ...styleToggle('underline') } as RibbonItem,
        { id: 'strike', label: 'S', title: 'Strikethrough', keys: 'Ctrl+5', ...styleToggle('strike') } as RibbonItem,
        {
          id: 'fill', label: 'Fill', title: 'Fill colour', kind: 'swatches',
          options: FILL_COLOURS as unknown as RibbonItem['options'],
          isEnabled: canFormat,
          run: (cmd, value) =>
            applyFormat(cmd, { fill: value === 'transparent' ? undefined : value }),
        },
        {
          id: 'text-colour', label: 'A', title: 'Text colour', kind: 'swatches',
          options: TEXT_COLOURS as unknown as RibbonItem['options'],
          isEnabled: canFormat,
          run: (cmd, value) =>
            applyFormat(cmd, { color: value === 'inherit' ? undefined : value }),
        },
      ],
    },
    {
      id: 'alignment',
      width: 108,
      label: 'Alignment',
      items: [
        alignItem('left', 'Align left'),
        alignItem('center', 'Center'),
        alignItem('right', 'Align right'),
        {
          id: 'wrap', label: 'Wrap', title: 'Wrap text', kind: 'toggle', wide: true,
          run: (cmd) => toggleWrap(cmd),
          isOn: (cmd) => everyCellHas(cmd, (entry) => entry?.wrap === true),
          isEnabled: canFormat,
        },
      ],
    },
    {
      id: 'number',
      width: 176,
      label: 'Number',
      items: [
        {
          id: 'num-format', label: 'Format', title: 'Number format', kind: 'select',
          options: NUMBER_FORMATS, isEnabled: canFormat,
          run: (cmd, value) =>
            applyFormat(cmd, { numFmt: FORMAT_PRESETS[value as FormatPresetName] }),
        },
        presetItem('fmt-currency', '$', 'Currency format', 'currency', 'Ctrl+Shift+4'),
        presetItem('fmt-percent', '%', 'Percent format', 'percent', 'Ctrl+Shift+5'),
        presetItem('fmt-number', ',', 'Thousands format', 'number', 'Ctrl+Shift+1'),
        {
          id: 'dec-more', label: '.0→', title: 'Increase decimal', kind: 'button',
          isEnabled: canFormat, run: nudgeDecimals(1),
        },
        {
          id: 'dec-less', label: '←.0', title: 'Decrease decimal', kind: 'button',
          isEnabled: canFormat, run: nudgeDecimals(-1),
        },
        {
          id: 'format-cells', label: 'Format Cells', title: 'Format Cells',
          keys: 'Ctrl+1', kind: 'button', wide: true, emits: 'format-cells',
        },
      ],
    },
    {
      id: 'cells',
      width: 128,
      label: 'Cells',
      items: [
        {
          id: 'insert', label: 'Insert', title: 'Insert rows or columns',
          keys: 'Ctrl+Shift++', kind: 'button', wide: true,
          run: (cmd) => structural(cmd, 'insert'),
        },
        {
          id: 'delete', label: 'Delete', title: 'Delete rows or columns',
          keys: 'Ctrl+-', kind: 'button', wide: true,
          run: (cmd) => structural(cmd, 'delete'),
        },
        {
          id: 'freeze', label: 'Freeze', title: 'Freeze panes at the active cell',
          kind: 'button', wide: true,
          run: (cmd) => { freezeAtActiveCell(cmd); return true },
        },
        {
          id: 'unfreeze', label: 'Unfreeze', title: 'Unfreeze panes',
          kind: 'button', wide: true,
          run: (cmd) => { unfreeze(cmd); return true },
        },
      ],
    },
    {
      id: 'editing',
      width: 132,
      label: 'Editing',
      items: [
        {
          id: 'autosum', label: 'Σ', title: 'AutoSum', keys: 'Alt+=',
          kind: 'button', run: fromCommand(autoSum),
        },
        {
          id: 'fill-down', label: 'Fill ↓', title: 'Fill down', keys: 'Ctrl+D',
          kind: 'button', wide: true, run: (cmd) => fillDown(cmd),
        },
        {
          id: 'fill-right', label: 'Fill →', title: 'Fill right', keys: 'Ctrl+R',
          kind: 'button', wide: true, run: (cmd) => fillRight(cmd),
        },
        {
          id: 'clear-formats', label: 'Clear', title: 'Clear formatting (keeps values)',
          kind: 'button', wide: true, isEnabled: canFormat,
          run: (cmd) => {
            const target = getFormatTarget()
            if (!target) return false
            const rects = rectsOf(cmd)
            if (!rects.length) return false
            target.store.clear(rects, target.lookup)
            target.onChange?.()
            return true
          },
        },
        {
          id: 'find', label: 'Find', title: 'Find and Replace', keys: 'Ctrl+H',
          kind: 'button', wide: true, emits: 'find-replace',
        },
      ],
    },
  ],
}

const INSERT: RibbonTab = {
  id: 'insert',
  label: 'Insert',
  groups: [
    {
      id: 'insert-cells',
      width: 92,
      label: 'Cells',
      items: [
        {
          id: 'insert-rows', label: 'Rows', title: 'Insert rows', kind: 'button', wide: true,
          run: (cmd) => structural(cmd, 'insert'),
        },
        {
          id: 'delete-rows', label: 'Delete', title: 'Delete rows or columns',
          kind: 'button', wide: true, run: (cmd) => structural(cmd, 'delete'),
        },
      ],
    },
    {
      id: 'insert-objects',
      width: 92,
      label: 'Objects',
      items: [
        { id: 'chart', label: 'Chart', title: 'Chart the selected range', kind: 'button', wide: true, emits: 'insert-chart' },
        { id: 'table', label: 'Table', title: 'Format the selection as a table', keys: 'Ctrl+T', kind: 'button', wide: true, emits: 'insert-table' },
        { id: 'function', label: 'Function', title: 'Insert function', keys: 'Shift+F3', kind: 'button', wide: true, emits: 'insert-function' },
      ],
    },
    {
      id: 'insert-sheet',
      width: 92,
      label: 'Sheets',
      items: [
        {
          id: 'new-sheet', label: 'New sheet', title: 'New sheet', keys: 'Shift+F11',
          kind: 'button', wide: true,
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
      width: 124,
      label: 'Function Library',
      items: [
        { id: 'f-autosum', label: 'Σ AutoSum', title: 'AutoSum', keys: 'Alt+=', kind: 'button', wide: true, run: fromCommand(autoSum) },
        { id: 'f-insert', label: 'Insert Function', title: 'Insert function', keys: 'Shift+F3', kind: 'button', wide: true, emits: 'insert-function' },
      ],
    },
    {
      id: 'defined-names',
      width: 110,
      label: 'Defined Names',
      items: [
        { id: 'name-manager', label: 'Name Manager', title: 'Name Manager', keys: 'Ctrl+F3', kind: 'button', wide: true, emits: 'name-manager' },
      ],
    },
    {
      id: 'auditing',
      width: 118,
      label: 'Formula Auditing',
      items: [
        { id: 'show-formulas', label: 'Show Formulas', title: 'Show formulas instead of their results', keys: 'Ctrl+`', kind: 'toggle', wide: true, emits: 'toggle-formulas' },
      ],
    },
    {
      id: 'calculation',
      width: 116,
      label: 'Calculation',
      items: [
        { id: 'recalc', label: 'Calculate Now', title: 'Recalculate the workbook', keys: 'F9', kind: 'button', wide: true, emits: 'recalculate' },
        { id: 'goal-seek-f', label: 'Goal Seek', title: 'Goal Seek', kind: 'button', wide: true, emits: 'goal-seek' },
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
      width: 108,
      label: 'Sort & Filter',
      items: [
        { id: 'sort-asc', label: 'A→Z', title: 'Sort ascending', kind: 'button', emits: 'sort-asc' },
        { id: 'sort-desc', label: 'Z→A', title: 'Sort descending', kind: 'button', emits: 'sort-desc' },
        { id: 'filter', label: 'Filter', title: 'Toggle the filter row', keys: 'Ctrl+Shift+L', kind: 'toggle', wide: true, emits: 'toggle-filter' },
      ],
    },
    {
      id: 'data-tools',
      width: 132,
      label: 'Data Tools',
      items: [
        { id: 'text-to-columns', label: 'Text to Columns', title: 'Split the selected column on a delimiter', kind: 'button', wide: true, emits: 'text-to-columns' },
        { id: 'remove-duplicates', label: 'Remove Duplicates', title: 'Remove duplicate rows', kind: 'button', wide: true, emits: 'remove-duplicates' },
      ],
    },
    {
      id: 'forecast',
      width: 96,
      label: 'Forecast',
      items: [
        { id: 'goal-seek', label: 'Goal Seek', title: 'Change one input until a formula hits a target', kind: 'button', wide: true, emits: 'goal-seek' },
      ],
    },
  ],
}

function toggleWrap(cmd: GridCommandContext): boolean {
  const target = getFormatTarget()
  if (!target) return false
  const rects = rectsOf(cmd)
  if (!rects.length) return false
  target.store.toggle(rects, 'wrap', target.lookup)
  target.onChange?.()
  return true
}

export const RIBBON_TABS: ReadonlyArray<RibbonTab> = [HOME, INSERT, FORMULAS, DATA]

/** Every item across every tab, for tests and for a command palette. */
export function ribbonItems(): ReadonlyArray<RibbonItem> {
  return RIBBON_TABS.flatMap((tab) => tab.groups.flatMap((group) => group.items))
}
