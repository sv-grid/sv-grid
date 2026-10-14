/**
 * Apply a row predicate across a depth-ordered row list, keeping group banners
 * consistent with what survives beneath them.
 *
 * The row list interleaves group banners with their descendants, banner first.
 * A predicate written by a user is about DATA, so it is only tested against
 * leaf rows; a banner then survives only if something under it did. Testing a
 * banner directly would drop whole groups because its cells are aggregates, not
 * row values.
 *
 * A collapsed banner has no descendants in the list, so its own `subRows` are
 * tested instead: a closed group of matching rows stays, closed.
 *
 * Note the existing column-filter and facet stages do test banners directly.
 * That is a separate pre-existing inconsistency; this helper is written to be
 * reusable if those are ever brought in line, but changing them is deliberately
 * not bundled into the advanced filter.
 */

type Tree<TRow> = { depth?: number; subRows?: ReadonlyArray<TRow> }
const depthOf = (row: unknown): number => (row as Tree<unknown>).depth ?? 0

/** Apply `keep` to leaf rows, dropping banners left with no surviving child. */
export function applyRowPredicate<TRow>(
  rows: ReadonlyArray<TRow>,
  keep: (row: TRow) => boolean,
  isGroup: (row: TRow) => boolean,
): TRow[] {
  // Fast path: no grouping in play, so every row is a leaf.
  let hasGroup = false
  for (const row of rows) {
    if (isGroup(row)) {
      hasGroup = true
      break
    }
  }
  if (!hasGroup) return rows.filter(keep)

  // Any leaf under a banner, through its subRows (the banner is collapsed).
  const anyLeaf = (row: TRow): boolean =>
    ((row as Tree<TRow>).subRows ?? []).some((sub) => (isGroup(sub) ? anyLeaf(sub) : keep(sub)))

  // One forward pass. `open` holds the banners above the current row; a kept
  // row keeps every one of them, and only them.
  const keepFlags = new Array<boolean>(rows.length).fill(false)
  const open: number[] = []
  const keepOpen = () => {
    for (let k = open.length - 1; k >= 0 && !keepFlags[open[k]!]; k -= 1) keepFlags[open[k]!] = true
  }
  for (let i = 0; i < rows.length; i += 1) {
    const row = rows[i]!
    const depth = depthOf(row)
    while (open.length && depthOf(rows[open[open.length - 1]!]) >= depth) open.pop()
    if (isGroup(row)) {
      open.push(i)
      const next = rows[i + 1]
      const collapsed = next === undefined || depthOf(next) <= depth
      if (collapsed && anyLeaf(row)) keepOpen()
    } else if (keep(row)) {
      keepFlags[i] = true
      keepOpen()
    }
  }

  const out: TRow[] = []
  for (let i = 0; i < rows.length; i += 1) if (keepFlags[i]) out.push(rows[i]!)
  return out
}
