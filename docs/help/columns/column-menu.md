# Column menu

Every column header carries a menu button (⋮). By default it's a flat list of
actions plus a "Choose columns" submenu. Opt into the **tabbed** layout
with `columnMenuTabs`:

<div data-docs-demo="185-column-menu-tabs" data-height="480"></div>

```svelte
<SvGrid {data} {columns} {features} columnMenuTabs />
```

The tabbed menu has three tabs:

- **General** - sort ascending / descending / clear, pin left / right / unpin,
  autosize this / all columns, group / ungroup by the column, reset columns.
- **Filter** - the column's filter UI (operator + value, a second AND/OR
  condition, and the value checklist). Shown only when filtering is enabled for
  the column. This is the same UI the header's funnel icon opens, so the two
  stay in sync.
- **Columns** - a quick visibility checklist for every column, without leaving
  the menu.

The menu opens on the **General** tab. The **Filter** tab is omitted for columns
that aren't filterable (`filterable: false` or no `field`).

```svelte
<!-- The menu appears automatically; filtering enables the Filter tab. -->
<SvGrid {data} {columns} features={tableFeatures({ rowSortingFeature, columnFilteringFeature })} />
```

For a docked, always-visible version of the Columns and Filters lists, see the
[tool panel](./tool-panel.md).

## What the menu carries

The header menu holds sort, the filter for that column, and visibility. Pair
it with `toolPanel` when people need to see every column at once rather than
hunting through headers.

```svelte {runnable}
<script lang="ts">
  import { SvGrid, type GridColumns, type SvGridApi } from '@svgrid/grid'

  type Person = {
    id: number
    name: string
    email: string
    city: string
    age: number
    salary: number
  }

  const seed: Person[] = [
    { id: 1, name: 'Ada Lovelace',   email: 'ada@example.com',   city: 'London',   age: 36, salary: 142000 },
    { id: 2, name: 'Grace Hopper',   email: 'grace@example.com', city: 'New York', age: 45, salary: 168000 },
    { id: 3, name: 'Linus Torvalds', email: 'linus@example.com', city: 'Portland', age: 54, salary: 155000 },
  ]

  const columns: GridColumns<Person> = [
    { field: 'name',   header: 'Name',   width: 180 },
    { field: 'city',   header: 'City',   width: 140 },
    { field: 'age',    header: 'Age',    width: 90, editorType: 'number' },
    { field: 'salary', header: 'Salary', width: 140,
      format: { type: 'currency', currency: 'USD' } },
  ]
</script>

<SvGrid data={seed} {columns} sortable filterable filterMode="menu" toolPanel />
```

## Menu without the filter row

`filterMode="menu"` keeps the header compact - the operators live behind the
header button instead of taking a permanent row. Worth it when the grid is
short and vertical space is the scarce thing.

```svelte {runnable}
<script lang="ts">
  import { SvGrid, type GridColumns, type SvGridApi } from '@svgrid/grid'

  type Person = {
    id: number
    name: string
    email: string
    city: string
    age: number
    salary: number
  }

  const seed: Person[] = [
    { id: 1, name: 'Ada Lovelace',   email: 'ada@example.com',   city: 'London',   age: 36, salary: 142000 },
    { id: 2, name: 'Grace Hopper',   email: 'grace@example.com', city: 'New York', age: 45, salary: 168000 },
    { id: 3, name: 'Linus Torvalds', email: 'linus@example.com', city: 'Portland', age: 54, salary: 155000 },
  ]

  const columns: GridColumns<Person> = [
    { field: 'name',  header: 'Name',  width: 180 },
    { field: 'email', header: 'Email', width: 210 },
    { field: 'city',  header: 'City',  width: 140 },
  ]
</script>

<SvGrid data={seed} {columns} sortable filterable filterMode="menu" />
```

## See also

- [Filter conditions](../filtering/filter-conditions.md)
- [Tool panel](./tool-panel.md)
- [Column groups](./column-groups.md)
