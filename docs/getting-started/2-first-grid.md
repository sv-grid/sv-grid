# 2. First grid in 60 seconds

> Step 2 of 6 · [← Install](./1-install.md) · [Next: Data and columns →](./3-data-and-columns.md)

```svelte
<script lang="ts">
  import { SvGrid, type ColumnDef } from 'sv-grid-core'

  type Person = { firstName: string; age: number; status: string }

  const rows: Person[] = [
    { firstName: 'Ada',   age: 36, status: 'active' },
    { firstName: 'Linus', age: 54, status: 'active' },
    { firstName: 'Grace', age: 85, status: 'inactive' },
  ]

  const columns: ColumnDef<{}, Person>[] = [
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
