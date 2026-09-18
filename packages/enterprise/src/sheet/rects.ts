/**
 * Rectangles of cells, and how they move when rows or columns are inserted
 * or deleted.
 *
 * A sheet keys more than its formats by position: validation rules,
 * conditional formats, merges and an AutoFilter range are all rectangles,
 * and every one of them has to move with the cells it covers, the way the
 * format store's entries do. This is the one place that rule lives, so a
 * band on rows 5-8 and a rule on rows 5-8 cannot disagree about where an
 * insert above them put them.
 */
import type { Rect } from './navigate'
import type { StructuralEdit } from './refs'
import { colToLetters, lettersToCol } from './address'

export type { Rect }

/**
 * Where `rect` is after `edit`, or null when the edit deleted all of it.
 *
 * An insert above a range moves it; an insert inside it grows it, the way
 * a reference to the range would grow. A delete above it moves it up, a
 * delete overlapping an edge shrinks it to what survives, and a delete of
 * every line it covers removes it.
 */
export function shiftRect(rect: Rect, edit: StructuralEdit): Rect | null {
  const [r1, c1, r2, c2] = rect
  const { at, count } = edit
  const rows = edit.kind === 'insertRows' || edit.kind === 'deleteRows'
  const lo = rows ? r1 : c1
  const hi = rows ? r2 : c2
  let nlo: number
  let nhi: number
  if (edit.kind === 'insertRows' || edit.kind === 'insertCols') {
    nlo = lo >= at ? lo + count : lo
    nhi = hi >= at ? hi + count : hi
  } else {
    const end = at + count
    if (lo >= at && hi < end) return null
    nlo = lo >= end ? lo - count : lo >= at ? at : lo
    nhi = hi >= end ? hi - count : hi >= at ? at - 1 : hi
  }
  if (nhi < nlo) return null
  return rows ? [nlo, c1, nhi, c2] : [r1, nlo, r2, nhi]
}

/** Every item's rectangles moved; an item left with none is dropped. */
export function shiftRects<T extends { rects: ReadonlyArray<Rect> }>(
  items: ReadonlyArray<T>,
  edit: StructuralEdit,
): T[] {
  const out: T[] = []
  for (const item of items) {
    const rects: Rect[] = []
    for (const rect of item.rects) {
      const moved = shiftRect(rect, edit)
      if (moved) rects.push(moved)
    }
    if (rects.length) out.push({ ...item, rects })
  }
  return out
}

export function rectContains(rect: Rect, row: number, col: number): boolean {
  return row >= rect[0] && row <= rect[2] && col >= rect[1] && col <= rect[3]
}

export function rectsIntersect(a: Rect, b: Rect): boolean {
  return a[0] <= b[2] && b[0] <= a[2] && a[1] <= b[3] && b[1] <= a[3]
}

/**
 * `rect` with `hole` cut out of it: up to four rectangles (above, below,
 * left and right of the hole), or the rect itself when they do not meet.
 * Clear Rules on a selection takes the selection out of every rule this way.
 */
export function subtractRect(rect: Rect, hole: Rect): Rect[] {
  if (!rectsIntersect(rect, hole)) return [rect]
  const [r1, c1, r2, c2] = rect
  const [h1, hc1, h2, hc2] = hole
  const out: Rect[] = []
  if (h1 > r1) out.push([r1, c1, h1 - 1, c2])
  if (h2 < r2) out.push([h2 + 1, c1, r2, c2])
  const top = Math.max(r1, h1)
  const bottom = Math.min(r2, h2)
  if (hc1 > c1) out.push([top, c1, bottom, hc1 - 1])
  if (hc2 < c2) out.push([top, hc2 + 1, bottom, c2])
  return out
}

/** The grid's notes shape: row id (`r4`) to column id (`B`) to text. */
export type NotesMap = Record<string, Record<string, string>>

/**
 * Notes moved along with their rows or columns. `shift` says where line i
 * is after the edit, or null when the edit deleted it, which drops its
 * notes with it.
 */
export function remapNotes<T = string>(
  notes: Record<string, Record<string, T>>,
  axis: 'rows' | 'cols',
  shift: (index: number) => number | null,
): Record<string, Record<string, T>> {
  const out: Record<string, Record<string, T>> = {}
  for (const [rowId, line] of Object.entries(notes)) {
    if (axis === 'rows') {
      const index = Number(rowId.slice(1))
      const next = Number.isInteger(index) ? shift(index) : index
      if (next === null) continue
      out[`r${next}`] = { ...line }
      continue
    }
    const moved: Record<string, T> = {}
    for (const [columnId, text] of Object.entries(line)) {
      const index = lettersToCol(columnId)
      const next = index < 0 ? index : shift(index)
      if (next === null) continue
      moved[index < 0 ? columnId : colToLetters(next)] = text
    }
    if (Object.keys(moved).length) out[rowId] = moved
  }
  return out
}

/** The shift function a structural edit implies, shared by every keyed part. */
export function lineShift(edit: StructuralEdit): (index: number) => number | null {
  const { at, count } = edit
  if (edit.kind === 'insertRows' || edit.kind === 'insertCols') return (i) => (i >= at ? i + count : i)
  return (i) => (i >= at + count ? i - count : i >= at ? null : i)
}
