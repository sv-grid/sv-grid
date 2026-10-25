# `@svgrid/grid` · `dock-model.ts`

Auto-generated. Source: `packages\grid\src\dock-model.ts`.

### `type DockPane`

One dockable pane: its id, title, and the state a tab needs to render.

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

A leaf: a stack of panes rendered as tabs (`active` is the visible one).

```ts
export type DockTabs = {
  type: 'tabs'
  id: string
  panes: DockPane[]
  active: number
}
```

### `type DockGroup`

A row (side-by-side) or column (stacked) of children with per-child sizes.

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

A node in the layout tree - either a split group or a tabbed leaf.

```ts
export type DockNode = DockGroup | DockTabs
```

### `type DockZone`

Where a dragged pane lands relative to a target leaf.

```ts
export type DockZone = 'left' | 'right' | 'top' | 'bottom' | 'center'
```

### `type IdGen`

Supplies ids for newly created nodes, so layouts stay deterministic in tests.

```ts
export type IdGen = () => string
```

### `function pane`

Build a {@link DockPane}.

```ts
export function pane(id: string, title: string, closable = true): DockPane
```

### `function leafMinSize`

Largest per-pane `minSize` in a leaf (0 if none). Used by splitter clamping.

```ts
export function leafMinSize(node: DockTabs): number
```

### `function tabs`

Build a tabbed leaf holding the given panes.

```ts
export function tabs(genId: IdGen, panes: DockPane[], active = 0): DockTabs
```

### `function group`

Build a split group: panes or nested groups laid out in a row or column.

```ts
export function group(
  genId: IdGen,
  direction: 'row' | 'column',
  children: DockNode[],
  sizes?: number[],
): DockGroup
```

### `function normalizeSizes`

Return sizes summing to 1, padded/trimmed to `count`. Even split when absent.

```ts
export function normalizeSizes(sizes: number[] | undefined, count: number): number[]
```

### `function findTabsWithPane`

The tabs leaf that holds `paneId`, or null.

```ts
export function findTabsWithPane(root: DockNode, paneId: string): DockTabs | null
```

### `function allPaneIds`

Every pane id in the tree, in document order.

```ts
export function allPaneIds(root: DockNode): string[]
```

### `function normalize`

Collapse the tree after edits: drop empty tabs and empty groups, unwrap a
group that has a single child, and flatten a child group into its parent when
they share a direction (so repeated docking never nests infinitely deep).
Returns the tidied node, or null when nothing is left.

```ts
export function normalize(node: DockNode): DockNode | null
```

### `function setActive`

Set the active tab index of a tabs leaf.

```ts
export function setActive(root: DockNode, tabsId: string, active: number): DockNode
```

### `function setSizes`

Replace a group's size weights (e.g. after a splitter drag).

```ts
export function setSizes(root: DockNode, groupId: string, sizes: number[]): DockNode
```

### `function reorderPane`

Reorder a pane WITHIN its tabs leaf (dragging a tab along the strip). `active`
follows the pane that was showing. No-op if the indices are out of range.

```ts
export function reorderPane(root: DockNode, tabsId: string, from: number, to: number): DockNode
```

### `function removePane`

Remove a pane. Returns the tidied tree (or null if it emptied) plus the pane
that was pulled out, so a caller can re-dock it elsewhere.

```ts
export function removePane(root: DockNode, paneId: string): { root: DockNode | null; pane: DockPane | null }
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
): DockNode
```

### `function removeLeaf`

Pull a whole tabs leaf out of the tree (for auto-hide). Returns the tidied
 tree (or null) plus the extracted leaf.

```ts
export function removeLeaf(root: DockNode, tabsId: string): { root: DockNode | null; leaf: DockTabs | null }
```

### `function dockLeafToEdge`

Dock a whole leaf against an EDGE of the entire tree (for pinning an
 auto-hidden panel back in). Wraps the root in a new group as needed; the
 pinned leaf takes `fraction` of that axis (clamped 0.1..0.6), the rest keeps
 the existing content.

```ts
export function dockLeafToEdge(
  root: DockNode | null,
  leaf: DockTabs,
  side: Exclude<DockZone, 'center'>,
  genId: IdGen,
  fraction = 0.25,
): DockNode
```

### `function movePane`

Move an existing pane to a new dock position (remove then dock).

```ts
export function movePane(
  root: DockNode,
  paneId: string,
  targetTabsId: string,
  zone: DockZone,
  genId: IdGen,
): DockNode
```

### `function dockPane`

A pane (tab). Alias of `pane`, named for the public builder set.

```ts
export function dockPane(
  id: string,
  title: string,
  opts?: boolean | { closable?: boolean; minSize?: number },
): DockPane
```

### `function dockTabs`

A tab-leaf holding one or more panes.

```ts
export function dockTabs(panes: DockPane[], active = 0): DockTabs
```

### `function dockGroup`

A row (side-by-side) or column (stacked) of children.

```ts
export function dockGroup(
  direction: 'row' | 'column',
  children: DockNode[],
  sizes?: number[],
): DockGroup
```
