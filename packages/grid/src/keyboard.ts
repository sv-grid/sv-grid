import type { ActiveCellState } from './core'

export type GridKeyboardIntent =
  | 'moveLeft'
  | 'moveRight'
  | 'moveUp'
  | 'moveDown'
  | 'tabNext'
  | 'tabPrev'
  | 'rowStart'
  | 'rowEnd'
  | 'gridStart'
  | 'gridEnd'
  | 'pageUp'
  | 'pageDown'
  | 'activate'
  | 'clearCells'
  | 'noop'

export function getKeyboardIntent(event: KeyboardEvent): GridKeyboardIntent {
  // Ctrl+Home / Ctrl+End come before plain Home / End so the modifier wins.
  if (event.ctrlKey && event.key === 'Home') return 'gridStart'
  if (event.ctrlKey && event.key === 'End') return 'gridEnd'

  // Ctrl/Cmd + arrow is Excel's "jump to the edge of the data region". The
  // grid does not implement that itself - it is a paid command registered
  // through `registerGridShortcuts`, which runs before this function is ever
  // called. If we get here the key was NOT claimed, and the right answer is to
  // do nothing: moving one cell is a silently wrong response to a shortcut
  // every spreadsheet user presses. Alt is excluded so a browser or OS
  // combination still falls through untouched.
  if ((event.ctrlKey || event.metaKey) && !event.altKey) {
    if (
      event.key === 'ArrowLeft' || event.key === 'ArrowRight' ||
      event.key === 'ArrowUp' || event.key === 'ArrowDown'
    ) return 'noop'
  }

  if (event.key === 'ArrowLeft') return 'moveLeft'
  if (event.key === 'ArrowRight') return 'moveRight'
  if (event.key === 'ArrowUp') return 'moveUp'
  if (event.key === 'ArrowDown') return 'moveDown'
  if (event.key === 'Home') return 'rowStart'
  if (event.key === 'End') return 'rowEnd'
  if (event.key === 'PageUp') return 'pageUp'
  if (event.key === 'PageDown') return 'pageDown'

  // Excel-style data-entry navigation:
  //   Enter      → move down (Shift+Enter → up)
  //   Tab        → move right (Shift+Tab → left), wraps at row boundaries
  //   Delete     → clear contents of the selected cells
  //   F2 / Space → start editing the active cell
  // Ctrl+Enter acts on the row rather than moving: a group opens or closes,
  // a row with a detail panel shows or hides it (see the activate branch).
  if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) return 'activate'
  if (event.key === 'Enter') return event.shiftKey ? 'moveUp' : 'moveDown'
  if (event.key === 'Tab') return event.shiftKey ? 'tabPrev' : 'tabNext'
  if (event.key === 'F2') return 'activate'
  if (event.key === ' ') return 'activate'
  if (event.key === 'Delete') return 'clearCells'

  return 'noop'
}

export function getNextActiveCell(
  current: ActiveCellState,
  intent: GridKeyboardIntent,
  bounds: { maxRow: number; maxCol: number; pageSize?: number },
): ActiveCellState {
  const pageSize = bounds.pageSize ?? 10
  let rowIndex = current.rowIndex
  let colIndex = current.colIndex

  if (intent === 'moveLeft') colIndex -= 1
  if (intent === 'moveRight') colIndex += 1
  if (intent === 'moveUp') rowIndex -= 1
  if (intent === 'moveDown') rowIndex += 1
  if (intent === 'tabNext') {
    // Right one column; if we fall off the right edge, wrap to the
    // first column of the next row - Excel's "data entry" behavior.
    colIndex += 1
    if (colIndex > bounds.maxCol) {
      colIndex = 0
      rowIndex += 1
    }
  }
  if (intent === 'tabPrev') {
    colIndex -= 1
    if (colIndex < 0) {
      colIndex = bounds.maxCol
      rowIndex -= 1
    }
  }
  if (intent === 'rowStart') colIndex = 0
  if (intent === 'rowEnd') colIndex = bounds.maxCol
  if (intent === 'gridStart') {
    rowIndex = 0
    colIndex = 0
  }
  if (intent === 'gridEnd') {
    rowIndex = bounds.maxRow
    colIndex = bounds.maxCol
  }
  if (intent === 'pageUp') rowIndex -= pageSize
  if (intent === 'pageDown') rowIndex += pageSize

  rowIndex = Math.min(Math.max(rowIndex, 0), Math.max(bounds.maxRow, 0))
  colIndex = Math.min(Math.max(colIndex, 0), Math.max(bounds.maxCol, 0))
  return {
    rowIndex,
    colIndex,
    cellId: current.cellId,
  }
}

export type Collapsed = {
  isRowCollapsed: (rowIndex: number) => boolean
  isColumnCollapsed: (colIndex: number) => boolean
}

/**
 * Where a move lands once collapsed rows and columns are stepped over.
 *
 * A sheet's arrow keys never rest on a hidden row or column: the cursor
 * goes on in the direction of travel to the next one that shows, and when
 * nothing shows in that direction it comes back to the nearest one before
 * the landing, which for End on a sheet whose last columns are hidden is the
 * last visible column. An axis the move did not touch is left alone, so a
 * cursor sitting on a row the user has just hidden still moves sideways.
 * With every cell in the direction of travel hidden the cursor stays put.
 */
export function pastCollapsed(
  from: ActiveCellState,
  next: ActiveCellState,
  bounds: { maxRow: number; maxCol: number },
  collapsed: Collapsed,
): ActiveCellState {
  const axis = (fromIdx: number, nextIdx: number, max: number, isCollapsed: (i: number) => boolean) => {
    if (nextIdx === fromIdx) return nextIdx
    const dir = nextIdx > fromIdx ? 1 : -1
    let i = nextIdx
    while (i >= 0 && i <= max && isCollapsed(i)) i += dir
    if (i >= 0 && i <= max) return i
    i = nextIdx - dir
    while (i !== fromIdx && isCollapsed(i)) i -= dir
    return i
  }
  const rowIndex = axis(from.rowIndex, next.rowIndex, bounds.maxRow, collapsed.isRowCollapsed)
  const colIndex = axis(from.colIndex, next.colIndex, bounds.maxCol, collapsed.isColumnCollapsed)
  return rowIndex === next.rowIndex && colIndex === next.colIndex ? next : { rowIndex, colIndex, cellId: next.cellId }
}

export type EntryIntent = 'moveDown' | 'moveUp' | 'tabNext' | 'tabPrev'

export type EntryRect = { minRow: number; maxRow: number; minCol: number; maxCol: number }

export type EntryStep = {
  cell: ActiveCellState
  /** The move stayed inside a multi-cell selection, which is kept. */
  withinRange: boolean
  /** The column a run of Tabs began in, for the Enter that ends it. */
  tabOrigin: number | null
}

/**
 * Where Enter and Tab put the cursor, the way a sheet's data entry expects.
 *
 * Two rules on top of `getNextActiveCell`. A run of Tabs remembers the
 * column it started in, and the Enter that ends the run goes down from
 * THAT column, not from the last cell: type across A1, B1, C1 with Tab and
 * Enter lands on A2, ready for the next record. Any other move clears the
 * memory, which the callers do by resetting `tabOrigin` on every plain
 * `setActiveCell`. And inside a selection of more than one cell the cursor
 * stays inside it: Enter walks down a column and wraps to the top of the
 * next, Tab walks along a row and wraps to the start of the next, both
 * back to the first cell after the last, and the selection is left
 * standing, so a block can be filled without ever reaching for the mouse.
 * Arrow keys are not entry keys and never come here.
 */
export function getEntryStep(
  current: ActiveCellState,
  intent: EntryIntent,
  opts: { maxRow: number; maxCol: number; tabOrigin: number | null; range: EntryRect | null; collapsed?: Collapsed },
): EntryStep {
  const step = entryStep(current, intent, opts)
  const collapsed = opts.collapsed
  if (!collapsed) return step
  const hidden = (c: ActiveCellState) => collapsed.isRowCollapsed(c.rowIndex) || collapsed.isColumnCollapsed(c.colIndex)
  if (!hidden(step.cell)) return step
  if (!step.withinRange) return { ...step, cell: pastCollapsed(current, step.cell, opts, collapsed) }
  // Walking a block: the same step again from the hidden cell, until one
  // shows. A block with nothing showing leaves the cursor where it is.
  let cell = step.cell
  for (let guard = (opts.range!.maxRow - opts.range!.minRow + 1) * (opts.range!.maxCol - opts.range!.minCol + 1); guard > 0 && hidden(cell); guard -= 1) {
    cell = entryStep(cell, intent, opts).cell
  }
  return { ...step, cell: hidden(cell) ? current : cell }
}

function entryStep(
  current: ActiveCellState,
  intent: EntryIntent,
  opts: { maxRow: number; maxCol: number; tabOrigin: number | null; range: EntryRect | null },
): EntryStep {
  const range = opts.range
  const inRange =
    range !== null &&
    (range.maxRow > range.minRow || range.maxCol > range.minCol) &&
    current.rowIndex >= range.minRow && current.rowIndex <= range.maxRow &&
    current.colIndex >= range.minCol && current.colIndex <= range.maxCol
  if (inRange) {
    let { rowIndex, colIndex } = current
    if (intent === 'moveDown') {
      rowIndex += 1
      if (rowIndex > range.maxRow) { rowIndex = range.minRow; colIndex += 1 }
      if (colIndex > range.maxCol) colIndex = range.minCol
    } else if (intent === 'moveUp') {
      rowIndex -= 1
      if (rowIndex < range.minRow) { rowIndex = range.maxRow; colIndex -= 1 }
      if (colIndex < range.minCol) colIndex = range.maxCol
    } else if (intent === 'tabNext') {
      colIndex += 1
      if (colIndex > range.maxCol) { colIndex = range.minCol; rowIndex += 1 }
      if (rowIndex > range.maxRow) rowIndex = range.minRow
    } else {
      colIndex -= 1
      if (colIndex < range.minCol) { colIndex = range.maxCol; rowIndex -= 1 }
      if (rowIndex < range.minRow) rowIndex = range.maxRow
    }
    return { cell: { rowIndex, colIndex, cellId: current.cellId }, withinRange: true, tabOrigin: null }
  }
  const bounds = { maxRow: opts.maxRow, maxCol: opts.maxCol }
  if (intent === 'tabNext' || intent === 'tabPrev') {
    return {
      cell: getNextActiveCell(current, intent, bounds),
      withinRange: false,
      tabOrigin: opts.tabOrigin ?? current.colIndex,
    }
  }
  const from = opts.tabOrigin === null ? current : { ...current, colIndex: opts.tabOrigin }
  return { cell: getNextActiveCell(from, intent, bounds), withinRange: false, tabOrigin: null }
}
