/**
 * shortcut-registry - the injection seam for keyboard commands the free grid
 * does not implement. `@svgrid/grid` owns cell navigation, copy/paste, undo and
 * find; the Excel command set (Ctrl+Arrow to the edge of a data region, Ctrl+D
 * fill down, Ctrl+Shift+V paste special, Alt+= autosum) is a paid feature in
 * `@svgrid/enterprise`. This holder lets enterprise register a handler at
 * import time; the grid runs the chain before it interprets a key itself.
 *
 * Same shape as `selection-bar-view`, `scheduler-view` and `board-view`, with
 * one difference: those hold a single renderer, this holds a prioritised chain,
 * because several packages may want a key and the first claim has to win
 * deterministically.
 *
 * The chain runs BEFORE `getKeyboardIntent`, which is the whole point. The
 * intent union in `keyboard.ts` is public API and closed, so there is no member
 * that could mean "jump to the edge of the data region" and no way to add one
 * without breaking a consumer that switches on it exhaustively. Running first
 * sidesteps that: a registered handler claims `Ctrl+ArrowDown` and returns
 * true, and the grid never computes an intent for that event at all.
 *
 * ```ts
 * // in @svgrid/enterprise, at module load:
 * import { registerGridShortcuts } from '@svgrid/grid'
 * registerGridShortcuts(handleSheetKey, { id: 'sheet', priority: 100 })
 * ```
 */
import type { SvGridApi } from './index'

/** What a handler gets to read and write. A getter object over controller
 *  state, built only when at least one handler is registered - a free grid
 *  never pays to construct it. Indices are DISPLAY indices, matching
 *  `SelectionPoint`, so they follow sort, filter and pagination. */
export type GridCommandContext = {
  /** The grid's public api. Identity is stable for the life of the grid, so
   *  a handler can key per-grid state on it in a WeakMap. */
  readonly api: SvGridApi<any, any>
  /** True when the event came from the cell editor rather than the grid root.
   *  Handlers that only make sense mid-edit (Alt+Enter) check this. */
  readonly editing: boolean
  /**
   * The open inline editor's element, or null. A binding registered for
   * `editing: true` reads and rewrites the text through it: F4 in a
   * spreadsheet pins the reference under the caret.
   */
  readonly editor: HTMLInputElement | HTMLTextAreaElement | null
  readonly activeCell: { rowIndex: number; colIndex: number; columnId: string | null } | null
  /**
   * The corner the active range grows from: the far end of a Shift+Arrow,
   * Shift+click or drag, which need not be the active cell. Null while
   * nothing is anchored. A command that extends the selection steps from
   * here, not from the active cell, or Ctrl+Shift+Down twice would land
   * on the same edge twice.
   */
  readonly selectionFocus: { rowIndex: number; colIndex: number } | null
  readonly rowCount: number
  readonly colCount: number
  /** Every selected rectangle as [minRow, minCol, maxRow, maxCol], active last. */
  readonly ranges: ReadonlyArray<readonly [number, number, number, number]>
  columnIdAt(colIndex: number): string | null
  getCellValue(rowIndex: number, colIndex: number): unknown
  /** Write a cell and record it in the grid's undo history. Inside `batch`
   *  every write joins one step, so a fill or a replace-all is one Ctrl+Z. */
  setCellValue(rowIndex: number, colIndex: number, value: unknown): void
  setActiveCell(rowIndex: number, colIndex: number): void
  setSelection(rowIndex: number, colIndex: number): void
  extendSelection(rowIndex: number, colIndex: number): void
  scrollIntoView(rowIndex: number, colIndex: number): void
  startEditing(rowIndex: number, colIndex: number, seed?: string): boolean
  /** Run every write inside `fn` as ONE undo step. Returns what `fn` returns. */
  batch<T>(fn: () => T): T
  /**
   * Put something that is not a cell write into the grid's undo history:
   * a format kept in the caller's own store, a structural change the grid
   * cannot see. `undo` and `redo` are what Ctrl+Z and Ctrl+Y will call.
   * Inside `batch` the step joins the batch, so a command that writes cells
   * AND formats is still one press.
   */
  recordUndo(undo: () => void, redo: () => void): void
  /**
   * Put keyboard focus back on the grid, without scrolling.
   *
   * A toolbar button takes focus when it is clicked and a dialog takes it
   * when it opens, so the keystroke after either - Ctrl+Z to undo what the
   * button did, typing into the cell the dialog changed - lands on the button
   * or on `<body>` rather than on the grid. Excel returns focus to the sheet
   * after every ribbon command and every dialog; a command that owns chrome
   * calls this once it is done.
   */
  focus(): void
  /**
   * Paste the system clipboard at the active cell, the way Ctrl+V does:
   * tab-separated text becomes a block of cells, one undo step. Resolves
   * once the paste has been applied, or without doing anything when the
   * clipboard cannot be read (an insecure context, or permission refused),
   * which is the same silence Ctrl+V keeps there.
   */
  paste(): Promise<void>
  /**
   * Copy the selection the way Ctrl+C does: every selected rectangle as
   * tab-separated text, each cell through `processCellForClipboard`. The
   * api's `copyToClipboard` is the export: the displayed rows with their
   * headers, whatever the selection.
   */
  copy(): void
  /**
   * Cut the selection the way Ctrl+X does: the copy above, then the cells
   * cleared as one undo step.
   */
  cut(): Promise<void>
  /**
   * Whether a cell may be written: the column's `editable` predicate as
   * the grid's own editor, fill handle and paste read it. `setCellValue`
   * does not consult it (a command is trusted to know what it writes), so
   * a command that fills or stamps a range asks here and skips the cells
   * that say no. Optional for a context built by hand.
   */
  canEdit?(rowIndex: number, colIndex: number): boolean
}

/** Return true to consume the event. The grid stops there and does not
 *  interpret the key itself. Return false to let it fall through. */
export type GridShortcutHandler = (
  event: KeyboardEvent,
  cmd: GridCommandContext,
) => boolean

type Entry = { handler: GridShortcutHandler; id: string | undefined; priority: number }

// Module-level, not $state: the chain is written at import time by whoever
// installs a feature pack and read inside an event handler. Nothing renders
// from it, so reactivity would cost a proxy for no benefit.
let entries: Entry[] = []

/**
 * Register a keyboard handler. Higher `priority` runs first; ties keep
 * registration order. Passing an `id` that is already registered replaces that
 * entry rather than stacking a second copy, so an enable* function stays
 * idempotent. Returns an unregister function.
 */
export function registerGridShortcuts(
  handler: GridShortcutHandler,
  opts?: { id?: string; priority?: number },
): () => void {
  const entry: Entry = {
    handler,
    id: opts?.id,
    priority: opts?.priority ?? 0,
  }
  const next = entry.id ? entries.filter((e) => e.id !== entry.id) : entries.slice()
  next.push(entry)
  // Stable sort by descending priority: Array.prototype.sort is stable per
  // spec, so equal priorities keep the order they were pushed in.
  next.sort((a, b) => b.priority - a.priority)
  entries = next
  return () => {
    entries = entries.filter((e) => e !== entry)
  }
}

/** Run the chain. Returns true when a handler consumed the event. */
export function runGridShortcuts(
  event: KeyboardEvent,
  cmd: GridCommandContext,
): boolean {
  for (const entry of entries) {
    if (entry.handler(event, cmd)) return true
  }
  return false
}

/** Whether anything is registered. The grid checks this before building a
 *  command context, so an unregistered grid pays one array-length read. */
export function hasGridShortcuts(): boolean {
  return entries.length > 0
}

/** Drop every handler. Tests use this; production code should keep the
 *  unregister function `registerGridShortcuts` returns. */
export function clearGridShortcuts(): void {
  entries = []
}
