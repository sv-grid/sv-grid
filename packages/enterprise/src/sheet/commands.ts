/**
 * The keyboard commands themselves, written against `GridCommandContext` so
 * they stay testable without mounting a grid.
 *
 * Every one that writes more than one cell runs inside `cmd.batch()`, so the
 * whole action is a single Ctrl+Z. That is the seam added in @svgrid/grid;
 * without it a Ctrl+D down a hundred rows would take a hundred presses to undo
 * and would evict the history behind it.
 *
 * Phase 1 fills VALUES. Excel also translates relative references as it fills,
 * so `=A1*2` in the source row becomes `=A2*2` one row down; that needs the
 * formula engine's AST and lands with it in phase 2. Until then a formula
 * fills as literal text, which is wrong for formulas and right for everything
 * else, and is why `fillDown` routes through one `translateForFill` hook
 * rather than inlining the copy.
 */
import type { GridCommandContext } from '@svgrid/grid/shortcuts'
import { isBlankValue, type Rect } from './navigate'

/**
 * How a value copied from (srcRow, srcCol) to (dstRow, dstCol) is rewritten.
 * Phase 1 is identity. Phase 2 swaps in the engine's `translateFormula`, which
 * is why every fill path calls it rather than copying the value directly.
 */
export type FillTranslator = (
  value: unknown,
  delta: { rows: number; cols: number },
) => unknown

const identity: FillTranslator = (value) => value

let translator: FillTranslator = identity

/** Install the formula-aware translator. The engine calls this in phase 2. */
export function setFillTranslator(fn: FillTranslator | null): void {
  translator = fn ?? identity
}

/** The rectangle a command should act on: the active range, or the active cell
 *  alone when nothing is selected. Returns null when there is no active cell. */
export function targetRect(cmd: GridCommandContext): Rect | null {
  const last = cmd.ranges[cmd.ranges.length - 1]
  if (last) return last
  const active = cmd.activeCell
  if (!active) return null
  return [active.rowIndex, active.colIndex, active.rowIndex, active.colIndex]
}

/**
 * Ctrl+D. Copies the TOP row of the selection into every row below it.
 *
 * Excel has a second behaviour here: with only one cell selected it fills from
 * the cell directly above instead, which is what makes Ctrl+D useful while
 * typing down a column. Both are implemented.
 */
export function fillDown(cmd: GridCommandContext): boolean {
  const rect = targetRect(cmd)
  if (!rect) return false
  const [minRow, minCol, maxRow, maxCol] = rect

  if (minRow === maxRow) {
    // Single row selected: pull from the row above.
    if (minRow === 0) return false
    return cmd.batch(() => {
      for (let c = minCol; c <= maxCol; c += 1) {
        const value = cmd.getCellValue(minRow - 1, c)
        cmd.setCellValue(minRow, c, translator(value, { rows: 1, cols: 0 }))
      }
      return true
    })
  }

  return cmd.batch(() => {
    for (let c = minCol; c <= maxCol; c += 1) {
      const source = cmd.getCellValue(minRow, c)
      for (let r = minRow + 1; r <= maxRow; r += 1) {
        cmd.setCellValue(r, c, translator(source, { rows: r - minRow, cols: 0 }))
      }
    }
    return true
  })
}

/** Ctrl+R. The same shape as fillDown, across instead of down. */
export function fillRight(cmd: GridCommandContext): boolean {
  const rect = targetRect(cmd)
  if (!rect) return false
  const [minRow, minCol, maxRow, maxCol] = rect

  if (minCol === maxCol) {
    if (minCol === 0) return false
    return cmd.batch(() => {
      for (let r = minRow; r <= maxRow; r += 1) {
        const value = cmd.getCellValue(r, minCol - 1)
        cmd.setCellValue(r, minCol, translator(value, { rows: 0, cols: 1 }))
      }
      return true
    })
  }

  return cmd.batch(() => {
    for (let r = minRow; r <= maxRow; r += 1) {
      const source = cmd.getCellValue(r, minCol)
      for (let c = minCol + 1; c <= maxCol; c += 1) {
        cmd.setCellValue(r, c, translator(source, { rows: 0, cols: c - minCol }))
      }
    }
    return true
  })
}

/** Write one value into every cell of the selection. Excel's Ctrl+Enter. */
export function fillSelection(cmd: GridCommandContext, value: unknown): boolean {
  const rect = targetRect(cmd)
  if (!rect) return false
  const [minRow, minCol, maxRow, maxCol] = rect
  return cmd.batch(() => {
    for (let r = minRow; r <= maxRow; r += 1) {
      for (let c = minCol; c <= maxCol; c += 1) cmd.setCellValue(r, c, value)
    }
    return true
  })
}

/** Ctrl+; and Ctrl+Shift+;. ISO rather than locale-formatted, because the
 *  value goes into the data and a column's own `format` decides how it reads;
 *  stamping a localised string would put display text in the model. */
export function stampNow(kind: 'date' | 'time' | 'datetime', now = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  const date = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
  const time = `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`
  if (kind === 'date') return date
  if (kind === 'time') return time
  return `${date} ${time}`
}

export function stampDate(
  cmd: GridCommandContext,
  kind: 'date' | 'time' | 'datetime',
  now?: Date,
): boolean {
  return fillSelection(cmd, stampNow(kind, now))
}

/**
 * Ctrl+'. Copies the cell above VERBATIM - no reference translation, which is
 * the whole point of the shortcut: it is how you get a copy of the formula
 * above to edit, rather than one that has already shifted.
 */
export function copyFromAbove(cmd: GridCommandContext): boolean {
  const active = cmd.activeCell
  if (!active || active.rowIndex === 0) return false
  const value = cmd.getCellValue(active.rowIndex - 1, active.colIndex)
  cmd.setCellValue(active.rowIndex, active.colIndex, value)
  return true
}

/**
 * Alt+=. The range Excel guesses for a SUM anchored at the active cell: the
 * run of numbers directly above, or directly to the left when there is nothing
 * above. Returns null when neither direction has numbers to add.
 */
export function guessSumRange(
  cmd: GridCommandContext,
  isNumeric: (value: unknown) => boolean,
): Rect | null {
  const active = cmd.activeCell
  if (!active) return null
  const { rowIndex: row, colIndex: col } = active

  let top = row
  while (top > 0 && isNumeric(cmd.getCellValue(top - 1, col))) top -= 1
  if (top < row) return [top, col, row - 1, col]

  let left = col
  while (left > 0 && isNumeric(cmd.getCellValue(row, left - 1))) left -= 1
  if (left < col) return [row, left, row, col - 1]

  return null
}

/** Default numeric test for AutoSum: a finite number, or a string that parses
 *  as one. A blank is not a number, so a gap ends the run. */
export function looksNumeric(value: unknown): boolean {
  if (isBlankValue(value)) return false
  if (typeof value === 'number') return Number.isFinite(value)
  if (typeof value === 'string') {
    const n = Number(value.trim())
    return value.trim() !== '' && Number.isFinite(n)
  }
  return false
}
