# `@svgrid/grid` · `dock-model.ts`

Auto-generated. Source: `packages\grid\src\dock-model.ts`.

### `type DockPane`

One dockable pane: its id, title, and the state a tab needs to render. */

```ts
export type DockPane = {
  id: string
  title: string
  /** Show a close (x) affordance on the tab. Default true. */
  closable?: boolean
  /** Minimum size (px) for this pane's leaf along the split axis. */
  minSize?: number
}
```

### `type DockTabs`

A leaf: a stack of panes rendered as tabs (`active` is the visible one). */

```ts
export type DockTabs = {
  type: 'tabs'
  id: string
  panes: DockPane[]
  active: number
}
```

### `type DockGroup`

A row (side-by-side) or column (stacked) of children with per-child sizes. */

```ts
export type DockGroup = {
  type: 'group'
  id: string
  direction: 'row' | 'column'
  children: DockNode[]
  /** Size weight per child; parallel to `children`, normalized to sum ~1. */
  sizes: number[]
}
```

### `type DockNode`

A node in the layout tree - either a split group or a tabbed leaf. */

```ts
export type DockNode = DockGroup | DockTabs
```

### `type DockZone`

Where a dragged pane lands relative to a target leaf. */

```ts
export type DockZone = 'left' | 'right' | 'top' | 'bottom' | 'center'
```

### `type IdGen`

Supplies ids for newly created nodes, so layouts stay deterministic in tests. */

```ts
export type IdGen = () => string
```

### `function pane`

Build a {@link DockPane}. */

```ts
export function pane(id: string, title: string, closable = true): DockPane {
  return { id, title, closable }
}
```

### `function leafMinSize`

Largest per-pane `minSize` in a leaf (0 if none). Used by splitter clamping. */

```ts
export function leafMinSize(node: DockTabs): number {
  return node.panes.reduce((m, p) => Math.max(m, p.minSize ?? 0), 0)
}
```

### `function tabs`

Build a tabbed leaf holding the given panes. */

```ts
export function tabs(genId: IdGen, panes: DockPane[], active = 0): DockTabs {
  return { type: 'tabs', id: genId(), panes, active: clampIndex(active, panes.length) }
}
```

### `function group`

Build a split group: panes or nested groups laid out in a row or column. */

```ts
export function group(
  genId: IdGen,
  direction: 'row' | 'column',
  children: DockNode[],
  sizes?: number[],
): DockGroup {
  return { type: 'group', id: genId(), direction, children, sizes: normalizeSizes(sizes, children.length) }
}
```

### `function normalizeSizes`

Return sizes summing to 1, padded/trimmed to `count`. Even split when absent. */

```ts
export function normalizeSizes(sizes: number[] | undefined, count: number): number[] {
  if (count <= 0) return []
  const src = sizes && sizes.length === count ? sizes.slice() : new Array(count).fill(1)
  const total = src.reduce((a, b) => a + (b > 0 ? b : 0), 0)
  if (total <= 0) return new Array(count).fill(1 / count)
  return src.map((s) => (s > 0 ? s : 0) / total)
}
```

### `function findTabsWithPane`

The tabs leaf that holds `paneId`, or null. */

```ts
export function findTabsWithPane(root: DockNode, paneId: string): DockTabs | null {
  if (root.type === 'tabs') return root.panes.some((p) => p.id === paneId) ? root : null
  for (const c of root.children) {
    const hit = findTabsWithPane(c, paneId)
    if (hit) return hit
  }
  return null
}
```

### `function allPaneIds`

Every pane id in the tree, in document order. */

```ts
export function allPaneIds(root: DockNode): string[] {
  if (root.type === 'tabs') return root.panes.map((p) => p.id)
  return root.children.flatMap(allPaneIds)
}
```

### `function normalize`

Collapse the tree after edits: drop empty tabs and empty groups, unwrap a
group that has a single child, and flatten a child group into its parent when
they share a direction (so repeated docking never nests infinitely deep).
Returns the tidied node, or null when nothing is left.

```ts
export function normalize(node: DockNode): DockNode | null {
  if (node.type === 'tabs') {
    if (node.panes.length === 0) return null
    return { ...node, active: clampIndex(node.active, node.panes.length) }
  }

  // Normalize children first, dropping the empties.
  const kept: DockNode[] = []
  const keptSizes: number[] = []
  node.children.forEach((child, i) => {
    const n = normalize(child)
    if (n) {
      kept.push(n)
      keptSizes.push(node.sizes[i] ?? 1)
    }
  })

  if (kept.length === 0) return null
  if (kept.length === 1) return kept[0]! // unwrap single-child group

  // Flatten same-direction child groups into this one.
  const flatChildren: DockNode[] = []
  const flatSizes: number[] = []
  kept.forEach((child, i) => {
    if (child.type === 'group' && child.direction === node.direction) {
      const share = keptSizes[i]!
      child.children.forEach((gc, j) => {
        flatChildren.push(gc)
        flatSizes.push(share * (child.sizes[j] ?? 1 / child.children.length))
      })
    } else {
      flatChildren.push(child)
      flatSizes.push(keptSizes[i]!)
    }
  })

  return { ...node, children: flatChildren, sizes: normalizeSizes(flatSizes, flatChildren.length) }
}
```

### `function setActive`

Set the active tab index of a tabs leaf. */

```ts
export function setActive(root: DockNode, tabsId: string, active: number): DockNode {
  return mapNodes(root, (n) =>
    n.type === 'tabs' && n.id === tabsId ? { ...n, active: clampIndex(active, n.panes.length) } : n,
  )
}
```

### `function setSizes`

Replace a group's size weights (e.g. after a splitter drag). */

```ts
export function setSizes(root: DockNode, groupId: string, sizes: number[]): DockNode {
  return mapNodes(root, (n) =>
    n.type === 'group' && n.id === groupId ? { ...n, sizes: normalizeSizes(sizes, n.children.length) } : n,
  )
}
```

### `function reorderPane`

Reorder a pane WITHIN its tabs leaf (dragging a tab along the strip). `active`
follows the pane that was showing. No-op if the indices are out of range.

```ts
export function reorderPane(root: DockNode, tabsId: string, from: number, to: number): DockNode {
  return mapNodes(root, (n) => {
    if (n.type !== 'tabs' || n.id !== tabsId) return n
    if (from < 0 || from >= n.panes.length) return n
    const showing = n.panes[n.active]?.id
    const panes = n.panes.slice()
    const [moved] = panes.splice(from, 1)
    if (!moved) return n
    // `to` is an insertion point in [0, length] (length = append), not a select
    // index - clampIndex would wrongly cap it at length-1.
    panes.splice(Math.max(0, Math.min(to, panes.length)), 0, moved)
    const active = panes.findIndex((p) => p.id === showing)
    return { ...n, panes, active: active < 0 ? 0 : active }
  })
}
```

### `function removePane`

Remove a pane. Returns the tidied tree (or null if it emptied) plus the pane
that was pulled out, so a caller can re-dock it elsewhere.

```ts
export function removePane(root: DockNode, paneId: string): { root: DockNode | null; pane: DockPane | null } {
  let removed: DockPane | null = null
  const strip = (node: DockNode): DockNode => {
    if (node.type === 'tabs') {
      const idx = node.panes.findIndex((p) => p.id === paneId)
      if (idx < 0) return node
      removed = node.panes[idx]!
      const panes = node.panes.filter((_, i) => i !== idx)
      return { ...node, panes, active: clampIndex(node.active > idx ? node.active - 1 : node.active, panes.length) }
    }
    return { ...node, children: node.children.map(strip) }
  }
  const stripped = strip(root)
  return { root: normalize(stripped), pane: removed }
}
```

### `function dockInto`

Dock `movingPane` relative to the leaf `targetTabsId`. `center` adds it as a
tab; an edge splits: the target is wrapped in (or extended into) a group whose
direction matches the edge, with the new pane on the requested side.

```ts
export function dockInto(
  root: DockNode,
  targetTabsId: string,
  movingPane: DockPane,
  zone: DockZone,
  genId: IdGen,
): DockNode {
  const dir: 'row' | 'column' = zone === 'left' || zone === 'right' ? 'row' : 'column'
  const before = zone === 'left' || zone === 'top'

  const transform = (node: DockNode): DockNode => {
    if (node.type === 'tabs') {
      if (node.id !== targetTabsId) return node
      if (zone === 'center') {
        const panes = [...node.panes, movingPane]
        return { ...node, panes, active: panes.length - 1 }
      }
      // Edge on a bare leaf: wrap it in a new group with the new leaf beside it.
      const leaf = tabs(genId, [movingPane], 0)
      const kids = before ? [leaf, node] : [node, leaf]
      return group(genId, dir, kids)
    }

    // Group: if it directly contains the target leaf and matches the edge
    // direction, insert a sibling in place (keeps the tree flat).
    const idx = node.children.findIndex((c) => c.type === 'tabs' && c.id === targetTabsId)
    if (idx >= 0 && zone !== 'center' && node.direction === dir) {
      const leaf = tabs(genId, [movingPane], 0)
      const children = node.children.slice()
      const sizes = node.sizes.slice()
      const half = (node.sizes[idx] ?? 1 / node.children.length) / 2
      const insertAt = before ? idx : idx + 1
      children.splice(insertAt, 0, leaf)
      sizes.splice(idx, 1, half, half) // split the target's slot in two
      // splice above replaced 1 with 2 at idx; the new leaf takes `before`/after
      if (before) {
        // children: [..., leaf, target, ...]; sizes already [half(leaf), half(target)]
      } else {
        // we inserted leaf AFTER target but sizes are [half, half] at idx/idx+1 - correct
      }
      return { ...node, children, sizes: normalizeSizes(sizes, children.length) }
    }

    return { ...node, children: node.children.map(transform) }
  }

  return normalize(transform(root)) ?? root
}
```

### `function removeLeaf`

Pull a whole tabs leaf out of the tree (for auto-hide). Returns the tidied
 tree (or null) plus the extracted leaf. */

```ts
export function removeLeaf(root: DockNode, tabsId: string): { root: DockNode | null; leaf: DockTabs | null } {
  let taken: DockTabs | null = null
  const strip = (node: DockNode): DockNode | null => {
    if (node.type === 'tabs') {
      if (node.id === tabsId) { taken = node; return null }
      return node
    }
    const kids: DockNode[] = []
    const sizes: number[] = []
    node.children.forEach((c, i) => {
      const n = strip(c)
      if (n) { kids.push(n); sizes.push(node.sizes[i] ?? 1) }
    })
    if (kids.length === 0) return null
    return { ...node, children: kids, sizes: normalizeSizes(sizes, kids.length) }
  }
  const stripped = strip(root)
  return { root: stripped ? normalize(stripped) : null, leaf: taken }
}
```

### `function dockLeafToEdge`

Dock a whole leaf against an EDGE of the entire tree (for pinning an
 auto-hidden panel back in). Wraps the root in a new group as needed; the
 pinned leaf takes `fraction` of that axis (clamped 0.1..0.6), the rest keeps
 the existing content. */

```ts
export function dockLeafToEdge(
  root: DockNode | null,
  leaf: DockTabs,
  side: Exclude<DockZone, 'center'>,
  genId: IdGen,
  fraction = 0.25,
): DockNode {
  if (!root) return leaf
  const dir: 'row' | 'column' = side === 'left' || side === 'right' ? 'row' : 'column'
  const before = side === 'left' || side === 'top'
  const f = Math.min(0.6, Math.max(0.1, fraction))
  const kids = before ? [leaf, root] : [root, leaf]
  const sizes = before ? [f, 1 - f] : [1 - f, f]
  return normalize(group(genId, dir, kids, sizes)) ?? leaf
}
```

### `function movePane`

Move an existing pane to a new dock position (remove then dock). */

```ts
export function movePane(
  root: DockNode,
  paneId: string,
  targetTabsId: string,
  zone: DockZone,
  genId: IdGen,
): DockNode {
  const { root: without, pane: moved } = removePane(root, paneId)
  if (!without || !moved) return root
  // If removing the pane dissolved the target leaf (it was the pane's own
  // single-pane leaf), there is nothing to dock against - leave the tree as-is.
  if (!containsTabs(without, targetTabsId)) return root
  return dockInto(without, targetTabsId, moved, zone, genId)
}
```

### `function dockPane`

A pane (tab). Alias of `pane`, named for the public builder set. */

```ts
export function dockPane(
  id: string,
  title: string,
  opts?: boolean | { closable?: boolean; minSize?: number },
): DockPane {
  const o = typeof opts === 'boolean' ? { closable: opts } : (opts ?? {})
  return { id, title, closable: o.closable ?? true, ...(o.minSize != null ? { minSize: o.minSize } : {}) }
}
```

### `function dockTabs`

A tab-leaf holding one or more panes. */

```ts
export function dockTabs(panes: DockPane[], active = 0): DockTabs {
  return tabs(autoId, panes, active)
}
```

### `function dockGroup`

A row (side-by-side) or column (stacked) of children. */

```ts
export function dockGroup(
  direction: 'row' | 'column',
  children: DockNode[],
  sizes?: number[],
): DockGroup {
  return group(autoId, direction, children, sizes)
}
```
