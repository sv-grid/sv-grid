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

The examples on this page run against these rows:

```svelte {preamble}
<script lang="ts">
  import { SvGrid, type GridColumns } from '@svgrid/grid'

  type Person = {
    id: number
    name: string
    email: string
    department: string
    age: number
    salary: number
    city: string
    startDate: string
    active: boolean
  }

  const people: Person[] = [
    { id: 1, name: 'Ada Lovelace',   email: 'ada@example.com',   department: 'Engineering', age: 36, salary: 142000, city: 'London',   startDate: '2021-03-01', active: true },
    { id: 2, name: 'Grace Hopper',   email: 'grace@example.com', department: 'Engineering', age: 45, salary: 168000, city: 'New York', startDate: '2019-07-15', active: true },
    { id: 3, name: 'Linus Torvalds', email: 'linus@example.com', department: 'Platform',    age: 54, salary: 155000, city: 'Portland', startDate: '2020-01-20', active: false },
    { id: 4, name: 'Radia Perlman',  email: 'radia@example.com', department: 'Networking',  age: 49, salary: 161000, city: 'Seattle',  startDate: '2022-09-05', active: true },
    { id: 5, name: 'Barbara Liskov', email: 'barbara@example.com', department: 'Platform',  age: 52, salary: 172000, city: 'Boston',   startDate: '2018-11-11', active: true },
  ]

  const columns: GridColumns<Person> = [
    { field: 'name',       header: 'Name',       width: 200 },
    { field: 'department', header: 'Department', width: 150 },
    { field: 'city',       header: 'City',       width: 140 },
    { field: 'age',        header: 'Age',        width: 90 },
    { field: 'salary',     header: 'Salary',     width: 130, format: { type: 'currency', currency: 'USD' } },
  ]
</script>
```

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

## More examples

### Project WBS tree

Phase → task → subtask with % complete that rolls up via effort-weighted average when you edit any leaf.

<div data-docs-demo="29-wbs-project-tree" data-height="460"></div>

### Bill of Materials

Bicycle BOM, 4 levels deep. Edit any leaf part\'s qty or unit cost; subtotals roll up through the assembly chain to the grand total.

<div data-docs-demo="30-bom-tree" data-height="460"></div>

## See also

- [Demo #426 Tree data](https://svgrid.com/demos/426-tree-data/)
- [Grouping & aggregation](../grouping-aggregation.md) - the row-bucketing shape
- [Master / detail](./master-detail.md) - a rich panel under a row, rather than child rows
