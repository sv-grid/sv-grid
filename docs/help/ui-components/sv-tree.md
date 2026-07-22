# SvTree

A WAI-ARIA tree view: expand/collapse, single-select highlight, cascading
tri-state checkboxes, keyboard navigation, and - for large or remote data -
fixed-row virtualization and lazy loading.

`SvTree` renders hierarchical data (file explorers, org charts, category pickers).
The behavior - flattening, cascade math, keyboard, and ARIA - lives in the
headless `createTree` core; the component owns the DOM concerns: windowing, focus,
inline rename, drag-drop reorder, and merging lazily-loaded children. Turn on
`virtual` to scale to tens of thousands of nodes, or `loadChildren` to fetch each
folder's children on first expand. Colors come from the `--sg-*` tokens.

<div data-docs-demo="321-tree" data-height="440"></div>

## Basic usage

```svelte
<script lang="ts">
  import { SvTree, type TreeNode } from '@svgrid/grid'
  let selected = $state<string | null>(null)
  const nodes: TreeNode[] = [
    { id: 'src', label: 'src', children: [
      { id: 'app', label: 'App.svelte' },
      { id: 'main', label: 'main.ts' },
    ] },
  ]
</script>

<SvTree {nodes} bind:selected onSelect={(id) => open(id)} />
```

## Props

| Prop              | Type                                                    | Default        | Description                                                    |
| ----------------- | ------------------------------------------------------- | -------------- | -------------------------------------------------------------- |
| `nodes`           | `ReadonlyArray<TreeNode>`                               | -              | The tree data.                                                 |
| `selected`        | `string \| null`                                        | `null`         | Selected node id (single-select highlight).                    |
| `onSelect`        | `(id: string) => void`                                  | -              | Fires when a node is selected.                                 |
| `expandedIds`     | `string[]`                                              | -              | Controlled/initial expanded ids.                               |
| `onToggle`        | `(id: string, expanded: boolean) => void`              | -              | Fires on expand/collapse.                                      |
| `checkable`       | `boolean`                                               | `false`        | Show cascading tri-state checkboxes.                           |
| `checked`         | `string[]`                                              | `[]`           | The set of checked ids.                                        |
| `onCheck`         | `(ids: string[]) => void`                              | -              | Fires with the new checked set.                                |
| `ariaLabel`       | `string`                                                | -              | Accessible name for the tree.                                  |
| `dir`             | `EditorDir`                                             | -              | Text direction; `rtl` mirrors indentation and flips arrows.    |
| `virtual`         | `boolean`                                               | `false`        | Window rows (render only the visible slice). Needs `height`.   |
| `rowHeight`       | `number`                                                | `30`           | Fixed row height in px (must match the CSS).                   |
| `height`          | `number`                                                | -              | Scroll-viewport height in px. Required for `virtual`.          |
| `loadChildren`    | `(node: TreeNode) => Promise<TreeNode[]>`              | -              | Lazy-load a `lazy` node's children on first expand.            |
| `filter`          | `string`                                                | -              | Show only matching nodes and their ancestors, auto-expanded.   |
| `searchable`      | `boolean`                                               | `false`        | Render a built-in search box that drives the filter.           |
| `searchPlaceholder` | `string`                                              | `Search...`    | Placeholder for the search box.                                |
| `sort`            | `asc` \| `desc` \| `(a, b) => number`                  | -              | Sort siblings by label or a custom comparator.                 |
| `editable`        | `boolean`                                               | `false`        | Allow inline rename (double-click or F2); fires `onRename`.    |
| `onRename`        | `(id: string, label: string) => void`                 | -              | Fires with the new label after an inline edit.                 |
| `reorderable`     | `boolean`                                               | `false`        | Allow drag-drop reorder; fires `onMove`.                        |
| `onMove`          | `(dragId, targetId, position) => void`                | -              | Drop event; apply with the exported `moveTreeNode` helper.     |

`TreeNode` (exported): `{ id: string; label: string; children?: TreeNode[]; disabled?: boolean; lazy?: boolean }`.
Set `lazy: true` on a node to show an expand arrow before its children exist and
load them via `loadChildren`.

## Patterns

### Cascading checkboxes

Turn on `checkable` and hold the checked set yourself; parent/child state cascades
tri-state automatically:

```svelte
<SvTree {nodes} checkable checked={checked} onCheck={(ids) => (checked = ids)} />
```

### Scaling with virtualization

For thousands of nodes, set `virtual` with a `height` so only the visible rows
render:

```svelte
<SvTree {nodes} virtual height={400} rowHeight={30} />
```

### Lazy loading

Mark nodes `lazy` and fetch on first expand:

```svelte
<SvTree {nodes} loadChildren={async (node) => await api.children(node.id)} />
```

### Drag-drop reorder

Enable `reorderable` and apply the drop with `moveTreeNode`:

```svelte
<script lang="ts">
  import { SvTree, moveTreeNode } from '@svgrid/grid'
</script>

<SvTree {nodes} reorderable onMove={(d, t, pos) => (nodes = moveTreeNode(nodes, d, t, pos))} />
```

### A remote file explorer

Seed the tree with the top-level folders you know up front, mark each `lazy`, and
resolve its children from an API on first expand. Any child that is itself a
folder is returned `lazy` too, so the tree fills in level by level. A `searchable`
box filters what has loaded so far:

```svelte
<script lang="ts">
  import { SvTree, type TreeNode } from '@svgrid/grid'

  let nodes = $state<TreeNode[]>([
    { id: 'docs', label: 'Documents', lazy: true },
    { id: 'media', label: 'Media', lazy: true },
  ])
  let selected = $state<string | null>(null)

  async function loadChildren(node: TreeNode): Promise<TreeNode[]> {
    const res = await fetch(`/api/fs?dir=${node.id}`)
    const entries: { id: string; name: string; folder: boolean }[] = await res.json()
    return entries.map((e) => ({ id: e.id, label: e.name, lazy: e.folder }))
  }
</script>

<SvTree
  {nodes}
  bind:selected
  {loadChildren}
  searchable
  searchPlaceholder="Find a file..."
  onSelect={(id) => openFile(id)}
/>
```

Tip: `loadChildren` runs once per node, on its first expand; the returned nodes
are merged in and cached, so re-collapsing and re-expanding will not refetch.
Reach for `virtual` with a `height` only when a single loaded level can hold
thousands of rows.

## Accessibility

- Emits WAI-ARIA `tree` / `treeitem` roles with roving focus.
- Arrow Up / Down move between rows; Left / Right collapse / expand (mirrored in
  RTL); Enter / Space select.
- Checkboxes expose their tri-state; disabled nodes are not focusable.
- Inline rename opens on F2 and commits on Enter, cancels on Escape.

## See also

- [Navigation overview](navigation.md) - the wayfinding family at a glance.
- [SvNavPane](sv-nav-pane.md) - a flatter app-shell sidebar.
- [SvTreeSelect](sv-tree-select.md) - a tree inside a select dropdown.
