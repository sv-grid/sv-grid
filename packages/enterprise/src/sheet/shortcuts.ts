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
  type Direction, type Grid,
} from './navigate'
import {
  fillDown, fillRight, stampDate, copyFromAbove, targetRect,
} from './commands'

export type SheetCommand = (cmd: GridCommandContext, event: KeyboardEvent) => boolean

export type SheetBinding = {
  /** Matched case-insensitively against `event.key`. */
  key: string
  /** Ctrl on Windows/Linux, Cmd on macOS. Both are accepted for either. */
  mod?: boolean
  shift?: boolean
  alt?: boolean
  run: SheetCommand
  /** For docs and the demo's cheat sheet. */
  label: string
}

/** Read the grid through the command context as a blank-aware matrix. */
function gridOf(cmd: GridCommandContext): Grid {
  return {
    rowCount: cmd.rowCount,
    colCount: cmd.colCount,
    isBlank: (r, c) => isBlankValue(cmd.getCellValue(r, c)),
  }
}

function move(dir: Direction, extend: boolean): SheetCommand {
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
const selectRegion: SheetCommand = (cmd) => {
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
function selectLine(axis: 'column' | 'row'): SheetCommand {
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
  { key: ';', mod: true, shift: true, run: (cmd) => stampDate(cmd, 'time'), label: 'Insert the current time' },
  { key: "'", mod: true, run: (cmd) => copyFromAbove(cmd), label: 'Copy the cell above, unchanged' },
]

function matches(binding: SheetBinding, event: KeyboardEvent): boolean {
  if (event.key.toLowerCase() !== binding.key.toLowerCase()) return false
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
