# Tree data

Nest rows into an expandable hierarchy with the `treeData` prop.

<div data-docs-demo="426-tree-data" data-height="520"></div>

Tree rows are **real data rows**. They keep their own cells, formatting,
editing and selection, and only gain an expander plus indentation in the tree
column. That is the difference from row grouping, where the parent is a
synthetic full-width banner standing in for its children.

## Flat data (parent id)

The model nests by parent id, so data that already carries one needs no
preparation:

```svelte
<script lang="ts">
  import { SvGrid } from '@svgrid/grid'

  const people = [
    { id: 1, managerId: null, name: 'Ada',   title: 'CEO' },
    { id: 2, managerId: 1,    name: 'Grace', title: 'VP Engineering' },
    { id: 3, managerId: 2,    name: 'Alan',  title: 'Principal Engineer' },
  ]
</script>

<SvGrid
  data={people}
  {columns}
  treeData={{ parentField: 'managerId', column: 'name' }}
/>
```

| Option | Meaning |
| --- | --- |
| `parentField` | Field holding each row's parent id. Required. |
| `idField` | Field holding the row's own id. Defaults to `'id'`. |
| `column` | Column that carries the expander + indent. Defaults to the first visible column. |
| `indentPx` | Indent per depth level, in px. Default `12`. |

## Nested data (children arrays)

The grid only builds rows for the objects in `data`, so children nested inside
a parent are never rows. Flatten them first:

```svelte
<script lang="ts">
  import { SvGrid, flattenTreeData } from '@svgrid/grid'

  const tree = [
    { id: 1, name: 'src', children: [
      { id: 2, name: 'components', children: [{ id: 3, name: 'Grid.svelte' }] },
    ] },
  ]

  // Stamps `__parentId` on every child and returns one flat list, children
  // directly after their parent.
  const rows = flattenTreeData(tree, { childrenField: 'children' })
</script>

<SvGrid data={rows} {columns} treeData={{ parentField: '__parentId', column: 'name' }} />
```

`flattenTreeData` takes `childrenField`, plus optional `idField` (default
`'id'`) and `parentField` (default `'__parentId'`) if you want a different link
field.

## Accessibility

Turning on `treeData` puts the grid in the `treegrid` role. Every row gets
`aria-level`, and expandable rows get `aria-expanded`. Keyboard:

| Key | Action |
| --- | --- |
| <kbd>→</kbd> | Expand the focused row |
| <kbd>←</kbd> | Collapse the focused row |
| <kbd>Enter</kbd> / click | Toggle via the expander button |

Rows without children render a spacer where the chevron would be, so values
stay aligned with their expandable siblings.

## Edge cases

- **Missing parent.** A row whose `parentField` points at an id that is not in
  the data becomes a root rather than disappearing. Losing rows silently is
  worse than a shallower tree - this matters when a filter removes a parent but
  keeps a child.
- **Self-parenting.** A row that names itself as its parent is treated as a root.
- **Cycles.** A loop in the parent chain is detected and stops the walk instead
  of recursing forever.
- **Grouping.** `treeData` replaces row grouping - a row cannot be both a
  hierarchy node and bucketed under a group banner.

## Server-side trees

For hierarchies too large to send at once, load children on demand with
`serverGroup` and `ServerDataSource` instead - see
[Server-side data](../server-side-data.md). The two share the same treegrid
keyboard and ARIA contract.

## See also

- [Demo #426 Tree data](https://svgrid.com/demos/426-tree-data/)
- [Grouping & aggregation](../grouping-aggregation.md) - the row-bucketing shape
- [Master / detail](./master-detail.md) - a rich panel under a row, rather than child rows
