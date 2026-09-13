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
  readonly activeCell: { rowIndex: number; colIndex: number; columnId: string | null } | null
  readonly rowCount: number
  readonly colCount: number
  /** Every selected rectangle as [minRow, minCol, maxRow, maxCol], active last. */
  readonly ranges: ReadonlyArray<readonly [number, number, number, number]>
  columnIdAt(colIndex: number): string | null
  getCellValue(rowIndex: number, colIndex: number): unknown
  setCellValue(rowIndex: number, colIndex: number, value: unknown): void
  setActiveCell(rowIndex: number, colIndex: number): void
  setSelection(rowIndex: number, colIndex: number): void
  extendSelection(rowIndex: number, colIndex: number): void
  scrollIntoView(rowIndex: number, colIndex: number): void
  startEditing(rowIndex: number, colIndex: number, seed?: string): boolean
  /** Run every write inside `fn` as ONE undo step. Returns what `fn` returns. */
  batch<T>(fn: () => T): T
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
