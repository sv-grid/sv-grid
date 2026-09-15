/**
 * Merged cells in the sheet: Excel's Merge & Center, Merge Across, Merge
 * Cells and Unmerge Cells over the document's per-sheet `merges`, which
 * are rectangles `[minRow, minCol, maxRow, maxCol]`. The grid draws them
 * through its `mergedCells` prop; this module is the pure part: what a
 * command does to the rectangles and to the cells under them.
 *
 * As in Excel, a merge keeps the top-left cell's value and drops the
 * rest, so `mergePlan` says which cells to clear; the shell writes them
 * through the command context so the merge and the clears are one undo.
 */
import { rectContains, rectsIntersect, type Rect } from './rects'

export type MergeKind = 'center' | 'across' | 'cells'

export type MergePlan = {
  /** The rectangles after the command. */
  merges: Rect[]
  /** Cells to clear, top-left cells of each new merge excluded. */
  clear: Array<[row: number, col: number]>
  /** Whether Merge & Center also centres: the shell sets `align`. */
  center: boolean
  /** The new merges' top-left cells, where the centre alignment goes. */
  origins: Array<[row: number, col: number]>
}

/** Normalise a rectangle to top-left / bottom-right. */
export function normalRect(rect: Rect): Rect {
  return [Math.min(rect[0], rect[2]), Math.min(rect[1], rect[3]), Math.max(rect[0], rect[2]), Math.max(rect[1], rect[3])]
}

/** The merges touching any of the rectangles. */
export function mergesIn(merges: ReadonlyArray<Rect>, rects: ReadonlyArray<Rect>): Rect[] {
  return merges.filter((m) => rects.some((r) => rectsIntersect(m, normalRect(r))))
}

/** The merge covering (r, c), or undefined. */
export function mergeAt(merges: ReadonlyArray<Rect>, r: number, c: number): Rect | undefined {
  return merges.find((m) => rectContains(m, r, c))
}

/** Whether (r, c) is inside a merge without being its top-left cell. */
export function isCoveredCell(merges: ReadonlyArray<Rect>, r: number, c: number): boolean {
  const m = mergeAt(merges, r, c)
  return !!m && (m[0] !== r || m[1] !== c)
}

/**
 * Merge the selection: one merge per rectangle (Merge & Center, Merge
 * Cells) or one per row of each rectangle (Merge Across). Merges already
 * inside the selection are replaced, as Excel replaces them. A single
 * cell merges nothing.
 */
export function mergePlan(
  merges: ReadonlyArray<Rect>,
  rects: ReadonlyArray<Rect>,
  kind: MergeKind,
  isBlank: (r: number, c: number) => boolean,
): MergePlan {
  const targets: Rect[] = []
  for (const raw of rects) {
    const rect = normalRect(raw)
    if (kind === 'across') {
      if (rect[1] === rect[3]) continue
      for (let r = rect[0]; r <= rect[2]; r += 1) targets.push([r, rect[1], r, rect[3]])
    } else if (rect[0] !== rect[2] || rect[1] !== rect[3]) {
      targets.push(rect)
    }
  }
  const kept = merges.filter((m) => !targets.some((t) => rectsIntersect(m, t)))
  const clear: Array<[number, number]> = []
  const origins: Array<[number, number]> = []
  for (const t of targets) {
    origins.push([t[0], t[1]])
    for (let r = t[0]; r <= t[2]; r += 1) {
      for (let c = t[1]; c <= t[3]; c += 1) {
        if (r === t[0] && c === t[1]) continue
        if (!isBlank(r, c)) clear.push([r, c])
      }
    }
  }
  return { merges: [...kept, ...targets], clear, center: kind === 'center', origins }
}

/**
 * Whether merging the selection would drop a value: Excel warns that
 * "merging cells only keeps the upper-left value". The shell asks before
 * it merges.
 */
export function mergeDropsValues(rects: ReadonlyArray<Rect>, kind: MergeKind, isBlank: (r: number, c: number) => boolean): boolean {
  return mergePlan([], rects, kind, isBlank).clear.length > 0
}

/** Unmerge: every merge the selection touches goes. */
export function unmergePlan(merges: ReadonlyArray<Rect>, rects: ReadonlyArray<Rect>): Rect[] {
  const touched = mergesIn(merges, rects)
  return merges.filter((m) => !touched.includes(m))
}

/**
 * A rectangle grown to hold every merge it touches, to a fixed point: the
 * grid selects this way (a click on a merged cell takes the whole merge),
 * so the header shading and anything else that reads the selection's
 * columns and rows has to see the same rectangle.
 */
export function expandToMerges(merges: ReadonlyArray<Rect>, rect: Rect): Rect {
  let out = normalRect(rect)
  for (let guard = 0; guard < 64; guard += 1) {
    let grown = false
    for (const m of merges) {
      if (!rectsIntersect(m, out)) continue
      const next: Rect = [Math.min(out[0], m[0]), Math.min(out[1], m[1]), Math.max(out[2], m[2]), Math.max(out[3], m[3])]
      if (next[0] !== out[0] || next[1] !== out[1] || next[2] !== out[2] || next[3] !== out[3]) { out = next; grown = true }
    }
    if (!grown) break
  }
  return out
}

/** Whether the selection holds a merge, for the button's state. */
export function selectionMerged(merges: ReadonlyArray<Rect>, rects: ReadonlyArray<Rect>): boolean {
  return mergesIn(merges, rects).length > 0
}

/** The merges as the grid takes them. */
export function toGridMerges(merges: ReadonlyArray<Rect>): Array<{ rowIndex: number; colIndex: number; rowSpan: number; colSpan: number }> {
  return merges.map((m) => ({ rowIndex: m[0], colIndex: m[1], rowSpan: m[2] - m[0] + 1, colSpan: m[3] - m[1] + 1 }))
}

/**
 * Whether a sort of `rect` can go ahead: Excel refuses when a merge
 * crosses the range's edge ("all merged cells need to be the same size"),
 * and the shell moves whole merges with their rows only when every merge
 * in the range is one row tall and sits inside it.
 */
export function sortBlockedByMerges(merges: ReadonlyArray<Rect>, rect: Rect): boolean {
  const range = normalRect(rect)
  for (const m of merges) {
    if (!rectsIntersect(m, range)) continue
    const inside = m[0] >= range[0] && m[2] <= range[2] && m[1] >= range[1] && m[3] <= range[3]
    if (!inside || m[0] !== m[2]) return true
  }
  return false
}

/** The merges of a sorted region, each moved with the row it sat on. */
export function reorderMerges(merges: ReadonlyArray<Rect>, rect: Rect, rowFor: (oldRow: number) => number): Rect[] {
  const range = normalRect(rect)
  return merges.map((m) => {
    if (!rectsIntersect(m, range)) return m
    const row = rowFor(m[0])
    return [row, m[1], row, m[3]] as const
  })
}
