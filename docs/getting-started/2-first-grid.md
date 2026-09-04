# 2. First grid in 60 seconds

> Step 2 of 6 · [← Install](./1-install.md) · [Next: Data and columns →](./3-data-and-columns.md)

![Anatomy of the minimal example: a data rows array and a columns ColumnDef array flow into a SvGrid element that renders a small table with a header row and three body rows.](/docs-media/gs-first-grid.svg)

```svelte {runnable}
<script lang="ts">
  import { SvGrid, type GridColumns } from '@svgrid/grid'

  type Person = { firstName: string; age: number; status: string }

  const rows: Person[] = [
    { firstName: 'Ada',   age: 36, status: 'active' },
    { firstName: 'Linus', age: 54, status: 'active' },
    { firstName: 'Grace', age: 85, status: 'inactive' },
  ]

  const columns: GridColumns<Person> = [
    { field: 'firstName', header: 'First name' },
    { field: 'age',       header: 'Age' },
    { field: 'status',    header: 'Status' },
  ]
</script>

<SvGrid data={rows} columns={columns} />
```

That's a complete, working grid.

## What you got out of the box

- A semantic `<table>` with WAI-ARIA `role="grid"` / `role="row"` /
  `role="columnheader"` / `role="gridcell"` on every node.
- Keyboard navigation: arrow keys move the active cell, Home/End jump
  to row edges, Page Up/Down move by a page, Ctrl+Home / Ctrl+End jump
  to the grid corners.
- A focus ring on the active cell. Selection on click. F2 / double-click
  to edit (no-op here because no column has `editorType`).
- Auto-sized columns; explicit `width` on the column def overrides.
- The default `--sg-*` theme: borders, header background, zebra rows,
  hover, selection - all on tokens you can swap.

## What you didn't get yet

Sort, filter, pagination, grouping, expansion, selection are **off**
until you register the matching features. That's the next step.

```svelte
<!-- after registering rowSortingFeature + columnFilteringFeature -->
<SvGrid
  data={rows}
  columns={columns}
  features={features}
  filterMode="menu"
/>
```

[Step 3 →](./3-data-and-columns.md) covers how `data` and `columns`
work in detail; [step 4 →](./4-features.md) lights up everything else.

## See it run

The quick-start demo is a slightly fancier version (more columns,
inline editing, range selection):

<div data-docs-demo="01-quick-start" data-height="440"></div>

Source: [examples/src/demos/01-quick-start.svelte](../../examples/src/demos/01-quick-start.svelte).

## Adding the three common features

Each capability is one boolean. Turn on what the screen needs and nothing
else ships - which is why the first grid stays small.

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
    { field: 'age',    header: 'Age',    width: 90 },
    { field: 'salary', header: 'Salary', width: 140,
      format: { type: 'currency', currency: 'USD' } },
  ]
</script>

<SvGrid data={seed} {columns} sortable filterable pageable pageSize={2} />
```
