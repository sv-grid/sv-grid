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
