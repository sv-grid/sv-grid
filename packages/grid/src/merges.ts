/**
 * Merged cells: a rectangle of cells drawn as one, the way a spreadsheet's
 * Merge & Center does. The grid takes them as `mergedCells`, a list of
 * origins with their spans in display indices, and this module is the
 * pure part: an index over them, the questions the renderer, the
 * selection and the keyboard ask, and nothing that touches the DOM.
 *
 * A merge is drawn by its origin td, which takes `rowspan` and `colspan`;
 * the cells it covers are not emitted. Selection rectangles grow to whole
 * merges (a merge is selected as one), the active cell inside a merge is
 * its origin, and an arrow key moving into a merge lands on the origin
 * and moving out of one steps past its far edge.
 */

export type MergedCell = {
  /** Top-left cell of the merge, display indices. */
  rowIndex: number
  colIndex: number
  /** How many rows and columns it covers, 1 or more. */
  rowSpan: number
  colSpan: number
}

export type MergeIndex = {
  readonly list: ReadonlyArray<MergedCell>
  /** Every cell a merge covers (origin included) -> its merge. */
  readonly byCell: ReadonlyMap<string, MergedCell>
}

export type MergeRect = { minRow: number; maxRow: number; minCol: number; maxCol: number }

const key = (r: number, c: number) => `${r}:${c}`

/** An index over the merges, or null when there are none (the common case). */
export function buildMergeIndex(merges: ReadonlyArray<MergedCell> | undefined | null): MergeIndex | null {
  if (!merges || merges.length === 0) return null
  const byCell = new Map<string, MergedCell>()
  const list: MergedCell[] = []
  for (const raw of merges) {
    const rowSpan = Math.max(1, Math.floor(raw.rowSpan))
    const colSpan = Math.max(1, Math.floor(raw.colSpan))
    if (rowSpan === 1 && colSpan === 1) continue
    const merge = { rowIndex: raw.rowIndex, colIndex: raw.colIndex, rowSpan, colSpan }
    list.push(merge)
    for (let r = merge.rowIndex; r < merge.rowIndex + rowSpan; r += 1) {
      for (let c = merge.colIndex; c < merge.colIndex + colSpan; c += 1) byCell.set(key(r, c), merge)
    }
  }
  return list.length ? { list, byCell } : null
}

/** The merge covering (r, c), origin included, or undefined. */
export function mergeAt(index: MergeIndex | null, r: number, c: number): MergedCell | undefined {
  return index?.byCell.get(key(r, c))
}

/** Whether (r, c) is inside a merge without being its origin. */
export function isCovered(index: MergeIndex | null, r: number, c: number): boolean {
  const m = mergeAt(index, r, c)
  return !!m && (m.rowIndex !== r || m.colIndex !== c)
}

/** The origin of the merge (r, c) sits in, or (r, c) itself. */
export function originOf(index: MergeIndex | null, r: number, c: number): { rowIndex: number; colIndex: number } {
  const m = mergeAt(index, r, c)
  return m ? { rowIndex: m.rowIndex, colIndex: m.colIndex } : { rowIndex: r, colIndex: c }
}

/** The far corner of the merge (r, c) sits in, or (r, c) itself. */
export function endOf(index: MergeIndex | null, r: number, c: number): { rowIndex: number; colIndex: number } {
  const m = mergeAt(index, r, c)
  return m
    ? { rowIndex: m.rowIndex + m.rowSpan - 1, colIndex: m.colIndex + m.colSpan - 1 }
    : { rowIndex: r, colIndex: c }
}

/**
 * The rectangle grown to hold every merge it touches, to a fixed point: a
 * merge that pokes out of the rectangle pulls the edge out, which can
 * reach another merge, and so on, as a spreadsheet's selection does.
 */
export function expandRectToMerges(index: MergeIndex | null, rect: MergeRect): MergeRect {
  if (!index) return rect
  let { minRow, maxRow, minCol, maxCol } = rect
  for (let guard = 0; guard < 64; guard += 1) {
    let grew = false
    for (const m of index.list) {
      const r2 = m.rowIndex + m.rowSpan - 1
      const c2 = m.colIndex + m.colSpan - 1
      const touches = m.rowIndex <= maxRow && r2 >= minRow && m.colIndex <= maxCol && c2 >= minCol
      if (!touches) continue
      if (m.rowIndex < minRow) { minRow = m.rowIndex; grew = true }
      if (r2 > maxRow) { maxRow = r2; grew = true }
      if (m.colIndex < minCol) { minCol = m.colIndex; grew = true }
      if (c2 > maxCol) { maxCol = c2; grew = true }
    }
    if (!grew) break
  }
  return minRow === rect.minRow && maxRow === rect.maxRow && minCol === rect.minCol && maxCol === rect.maxCol
    ? rect
    : { minRow, maxRow, minCol, maxCol }
}

/**
 * Where a move from `from` to `next` really lands. A step into a merge
 * lands on its origin; a step that stays inside the merge the move started
 * in carries on past its far edge (right from a three-wide merge reaches
 * the column after it), clamped to the bounds; a step that then lands in
 * another merge takes that one's origin.
 */
export function stepPastMerge(
  index: MergeIndex | null,
  from: { rowIndex: number; colIndex: number },
  next: { rowIndex: number; colIndex: number },
  bounds: { maxRow: number; maxCol: number },
): { rowIndex: number; colIndex: number } {
  if (!index) return next
  const target = mergeAt(index, next.rowIndex, next.colIndex)
  if (!target) return next
  const source = mergeAt(index, from.rowIndex, from.colIndex)
  if (source !== target) return { rowIndex: target.rowIndex, colIndex: target.colIndex }
  // Still inside the merge the move began in: keep going in that direction.
  const dr = Math.sign(next.rowIndex - from.rowIndex)
  const dc = Math.sign(next.colIndex - from.colIndex)
  if (dr === 0 && dc === 0) return { rowIndex: target.rowIndex, colIndex: target.colIndex }
  let rowIndex = next.rowIndex
  let colIndex = next.colIndex
  if (dr > 0) rowIndex = target.rowIndex + target.rowSpan
  else if (dr < 0) rowIndex = target.rowIndex - 1
  if (dc > 0) colIndex = target.colIndex + target.colSpan
  else if (dc < 0) colIndex = target.colIndex - 1
  if (rowIndex < 0 || rowIndex > bounds.maxRow || colIndex < 0 || colIndex > bounds.maxCol) {
    // Nowhere further to go: the merge itself stays current.
    return { rowIndex: target.rowIndex, colIndex: target.colIndex }
  }
  const landed = mergeAt(index, rowIndex, colIndex)
  return landed ? { rowIndex: landed.rowIndex, colIndex: landed.colIndex } : { rowIndex, colIndex }
}

/**
 * How a td at (r, c) draws inside a rendered window of rows and columns.
 * A merge is drawn once per window, by the top-left cell of the part of it
 * the window holds: the origin when the origin is in the window (`origin`),
 * else the first covered cell the window shows (`continuation`, which
 * draws the origin's content itself), with the spans clamped to the window
 * so a table never spans into rows it has not drawn. Every other cell of
 * the merge is `skip`: no td, the drawn one covers its slot.
 */
export type MergeDraw =
  | { kind: 'skip' }
  | { kind: 'origin' | 'continuation'; merge: MergedCell; rowSpan: number; colSpan: number }

export function mergeDrawAt(
  index: MergeIndex | null,
  r: number,
  c: number,
  window: { firstRow: number; lastRow: number; firstCol: number; lastCol: number },
): MergeDraw | null {
  const m = mergeAt(index, r, c)
  if (!m) return null
  const anchorRow = Math.max(m.rowIndex, window.firstRow)
  const anchorCol = Math.max(m.colIndex, window.firstCol)
  if (r !== anchorRow || c !== anchorCol) return { kind: 'skip' }
  const isOrigin = anchorRow === m.rowIndex && anchorCol === m.colIndex
  const rowSpan = Math.max(1, Math.min(m.rowIndex + m.rowSpan - r, window.lastRow - r + 1))
  const colSpan = Math.max(1, Math.min(m.colIndex + m.colSpan - c, window.lastCol - c + 1))
  return { kind: isOrigin ? 'origin' : 'continuation', merge: m, rowSpan, colSpan }
}
