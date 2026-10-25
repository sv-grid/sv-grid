# `@svgrid/grid` · `createTree.svelte.ts`

Auto-generated. Source: `packages\grid\src\createTree.svelte.ts`.

### `type TreeNode`

createTree - the HEADLESS core behind <SvTree>, in the same spirit as
`createSvGrid` for the grid: a runes-based state machine (expand/collapse,
single-select highlight, cascading tri-state checkboxes, full keyboard) with
**prop-getters** you spread onto YOUR OWN markup. The visible tree is
flattened into `rows` so roving-focus keyboard nav stays a flat index walk.

```svelte
<script lang="ts">
  import { createTree } from '@svgrid/grid'
  let selected = $state<string | null>(null)
  const tree = createTree({ nodes: () => nodes, selected: () => selected, onSelect: (id) => (selected = id) })
</script>
<div {...tree.treeProps()}>
  {#each tree.rows as row (row.node.id)}
    <div {...tree.itemProps(row)}>{row.node.label}</div>
  {/each}
</div>
```

The styled <SvTree> is just one renderer over this core. The cascade math
(`treeDescendantIds`, `treeCheckState`) is exported as pure functions.

```ts
export type TreeNode = {
  id: string
  label: string
  children?: TreeNode[]
  disabled?: boolean
  /** Marks a node whose children are loaded on demand (shows an expand arrow
   *  even with no children yet; the renderer loads them on first expand). */
  lazy?: boolean
}
```

### `type CheckState`

A node's checkbox state. `'indeterminate'` means some but not all descendants are checked.

```ts
export type CheckState = 'checked' | 'indeterminate' | 'unchecked'
```

### `type TreeRow`

A single visible (flattened) tree row.

```ts
export type TreeRow = {
  node: TreeNode
  depth: number
  hasChildren: boolean
  open: boolean
  parentId: string | null
  index: number
}
```

### `function treeDescendantIds`

All descendant ids of `node` (pure, depth-first).

```ts
export function treeDescendantIds(node: TreeNode): string[]
```

### `function treeCheckState`

Tri-state check status of `node` given the set of checked ids (pure).

```ts
export function treeCheckState(node: TreeNode, checked: ReadonlySet<string>): CheckState
```

### `type TreeDropPosition`

Where a dragged node lands relative to the drop target.

```ts
export type TreeDropPosition = 'before' | 'after' | 'inside'
```

### `function treeContains`

True if `id` is inside `node`'s subtree (used to block invalid drops).

```ts
export function treeContains(node: TreeNode, id: string): boolean
```

### `function moveTreeNode`

Return a NEW node tree with `dragId` moved before/after/inside `targetId`
(pure - the caller sets it back as the controlled `nodes`). No-ops on invalid
moves (self, or into own descendant).

```ts
export function moveTreeNode(
  nodes: ReadonlyArray<TreeNode>,
  dragId: string,
  targetId: string,
  position: TreeDropPosition,
): TreeNode[]
```

### `function sortTreeNodes`

Sort siblings (recursively) by a comparator (pure).

```ts
export function sortTreeNodes(
  nodes: ReadonlyArray<TreeNode>,
  compare: (a: TreeNode, b: TreeNode) => number,
): TreeNode[]
```

### `type TreeConfig`

Reactive inputs are passed as getters so the core tracks live prop changes.

```ts
export type TreeConfig = {
  nodes: () => ReadonlyArray<TreeNode>
  selected?: () => string | null
  onSelect?: (id: string) => void
  /** Seed the internally-managed expanded set (read once). */
  expandedIds?: () => string[] | undefined
  onToggle?: (id: string, expanded: boolean) => void
  checkable?: () => boolean
  checked?: () => string[]
  onCheck?: (ids: string[]) => void
  ariaLabel?: () => string | undefined
  /** Text direction; under `'rtl'` the Left/Right expand/collapse keys swap. */
  dir?: () => import('./editor-contract').EditorDir | undefined
  /** Filter query: show only matching nodes + their ancestors, auto-expanded. */
  filter?: () => string | undefined
}
```

### `function createTree`

Build the headless tree model: expansion, selection and checkbox cascading, with no markup.

```ts
export function createTree(config: TreeConfig)
```

### `type Tree`

The headless tree instance returned by {@link createTree}.

```ts
export type Tree = ReturnType<typeof createTree>
```
