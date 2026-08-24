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
 * Note the existing column-filter and facet stages do test banners directly.
 * That is a separate pre-existing inconsistency; this helper is written to be
 * reusable if those are ever brought in line, but changing them is deliberately
 * not bundled into the advanced filter.
 */

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

  // One reverse pass. `survivorsBelow` counts leaves kept since we last closed
  // out a banner, so a banner is kept when anything after it survived.
  const keepFlags = new Array<boolean>(rows.length).fill(false)
  let survivorsSinceBanner = 0
  for (let i = rows.length - 1; i >= 0; i -= 1) {
    const row = rows[i]!
    if (isGroup(row)) {
      if (survivorsSinceBanner > 0) {
        keepFlags[i] = true
        // The banner itself counts as surviving content for any banner above
        // it, so nested groups keep their ancestors.
        survivorsSinceBanner = 1
      } else {
        keepFlags[i] = false
      }
    } else if (keep(row)) {
      keepFlags[i] = true
      survivorsSinceBanner += 1
    }
  }

  const out: TRow[] = []
  for (let i = 0; i < rows.length; i += 1) if (keepFlags[i]) out.push(rows[i]!)
  return out
}
