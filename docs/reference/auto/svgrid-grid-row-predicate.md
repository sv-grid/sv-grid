# `@svgrid/grid` · `filtering/row-predicate.ts`

Auto-generated. Source: `packages\grid\src\filtering\row-predicate.ts`.

### `function applyRowPredicate`

Apply `keep` to leaf rows, dropping banners left with no surviving child.

```ts
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
```
