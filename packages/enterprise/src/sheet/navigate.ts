/**
 * Excel's jump-to-edge navigation, as pure functions over a cell-value lookup.
 *
 * `Ctrl+Arrow` is not "move a long way". It is a run-boundary search, and the
 * rule flips depending on what you are standing on:
 *
 *   - Standing on a FILLED cell with a filled neighbour: run to the LAST filled
 *     cell before the next blank. This is how you get from the top of a column
 *     to its bottom in one press.
 *   - Standing on a FILLED cell whose neighbour is blank: skip the blank run
 *     and land on the NEXT filled cell. This is how you hop between blocks.
 *   - Standing on a BLANK cell: skip to the next filled cell.
 *   - Nothing filled ahead in either case: land on the last cell of the sheet
 *     in that direction, which is what Ctrl+Down does on an empty column.
 *
 * Getting this wrong in the obvious way (always run to the end of the filled
 * block) means the shortcut stops working the moment there is a gap, which is
 * most real spreadsheets.
 */

/** What counts as empty. Excel treats a cell holding an empty string as blank
 *  for navigation, and so does this: a column of `''` should not trap the
 *  cursor. A zero, a `false` and a whitespace-only string are all content. */
export function isBlankValue(value: unknown): boolean {
  return value === null || value === undefined || value === ''
}

export type Direction = 'up' | 'down' | 'left' | 'right'

export type Grid = {
  rowCount: number
  colCount: number
  isBlank(row: number, col: number): boolean
}

export type Cell = { row: number; col: number }

const STEP: Record<Direction, Cell> = {
  up: { row: -1, col: 0 },
  down: { row: 1, col: 0 },
  left: { row: 0, col: -1 },
  right: { row: 0, col: 1 },
}

function inBounds(grid: Grid, row: number, col: number): boolean {
  return row >= 0 && row < grid.rowCount && col >= 0 && col < grid.colCount
}

/** The last cell in `dir` that is still on the sheet. */
function lastInDirection(grid: Grid, from: Cell, dir: Direction): Cell {
  switch (dir) {
    case 'up': return { row: 0, col: from.col }
    case 'down': return { row: Math.max(grid.rowCount - 1, 0), col: from.col }
    case 'left': return { row: from.row, col: 0 }
    case 'right': return { row: from.row, col: Math.max(grid.colCount - 1, 0) }
  }
}

/**
 * Where `Ctrl+Arrow` lands from `from`, going `dir`. Never returns a cell off
 * the sheet, and returns `from` unchanged when it is already on the edge.
 */
export function edgeOfRegion(grid: Grid, from: Cell, dir: Direction): Cell {
  if (grid.rowCount === 0 || grid.colCount === 0) return from
  const step = STEP[dir]
  const first = { row: from.row + step.row, col: from.col + step.col }
  if (!inBounds(grid, first.row, first.col)) return from

  const startFilled = !grid.isBlank(from.row, from.col)
  const nextFilled = !grid.isBlank(first.row, first.col)

  if (startFilled && nextFilled) {
    // Run to the last filled cell before the next blank.
    let cur = first
    for (;;) {
      const ahead = { row: cur.row + step.row, col: cur.col + step.col }
      if (!inBounds(grid, ahead.row, ahead.col) || grid.isBlank(ahead.row, ahead.col)) return cur
      cur = ahead
    }
  }

  // Otherwise skip ahead to the next filled cell.
  let cur = first
  for (;;) {
    if (!grid.isBlank(cur.row, cur.col)) return cur
    const ahead = { row: cur.row + step.row, col: cur.col + step.col }
    // Nothing filled the whole way: Excel parks you on the last cell.
    if (!inBounds(grid, ahead.row, ahead.col)) return lastInDirection(grid, from, dir)
    cur = ahead
  }
}

export type Rect = readonly [minRow: number, minCol: number, maxRow: number, maxCol: number]

/**
 * Excel's `Ctrl+A` first press: the contiguous block of non-blank cells around
 * `from`, grown outward until every bounding edge is blank.
 *
 * Grown as a rectangle rather than flood-filled, because that is what Excel
 * selects: a block with a notch in it still comes back as the rectangle that
 * encloses it. Returns the single cell when `from` sits alone in white space.
 */
export function currentRegion(grid: Grid, from: Cell): Rect {
  if (grid.rowCount === 0 || grid.colCount === 0) return [0, 0, 0, 0]
  let minRow = from.row
  let maxRow = from.row
  let minCol = from.col
  let maxCol = from.col

  const edgeHasContent = (
    r0: number, r1: number, c0: number, c1: number,
  ): boolean => {
    for (let r = r0; r <= r1; r += 1) {
      for (let c = c0; c <= c1; c += 1) {
        if (inBounds(grid, r, c) && !grid.isBlank(r, c)) return true
      }
    }
    return false
  }

  // Keep growing while any bounding edge still touches content. One side
  // growing can expose content on another, so this repeats until stable.
  for (let grew = true; grew; ) {
    grew = false
    if (minRow > 0 && edgeHasContent(minRow - 1, minRow - 1, minCol, maxCol)) {
      minRow -= 1
      grew = true
    }
    if (maxRow < grid.rowCount - 1 && edgeHasContent(maxRow + 1, maxRow + 1, minCol, maxCol)) {
      maxRow += 1
      grew = true
    }
    if (minCol > 0 && edgeHasContent(minRow, maxRow, minCol - 1, minCol - 1)) {
      minCol -= 1
      grew = true
    }
    if (maxCol < grid.colCount - 1 && edgeHasContent(minRow, maxRow, maxCol + 1, maxCol + 1)) {
      maxCol += 1
      grew = true
    }
  }
  return [minRow, minCol, maxRow, maxCol]
}

/** Whether `rect` already covers every cell, so `Ctrl+A` should stop growing. */
export function isWholeSheet(grid: Grid, rect: Rect): boolean {
  return (
    rect[0] === 0 && rect[1] === 0 &&
    rect[2] === Math.max(grid.rowCount - 1, 0) &&
    rect[3] === Math.max(grid.colCount - 1, 0)
  )
}

/** The whole sheet as a rectangle. */
export function wholeSheet(grid: Grid): Rect {
  return [0, 0, Math.max(grid.rowCount - 1, 0), Math.max(grid.colCount - 1, 0)]
}
