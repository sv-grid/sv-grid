# Migrating from Grid.js

Grid.js is a small vanilla-JS table for search, sort, and pagination
that you render into a DOM element. SvGrid does the same in a
Svelte-5-native component and keeps going - virtualization, Excel-style
filters, editing, grouping - when you outgrow the basics.

> Estimated effort: **30 min - 1 hour** per table.

## Vocabulary cheat sheet

| Grid.js                                   | sv-grid                                   |
| ----------------------------------------- | ----------------------------------------- |
| `new Grid({ ... }).render(el)`            | `<SvGrid ... />`                           |
| `columns: ['Name', 'Amount']`             | `columns: [{ field, header }]`             |
| `columns: [{ name, formatter }]`          | `{ header, cell: (c) => renderSnippet(...) }` |
| `sort: true`                              | `rowSortingFeature`                        |
| `search: true`                            | `api.setState({ globalFilter: query })` / filter feature |
| `pagination: { limit: 25 }`               | `showPagination` (+ page size)             |
| `server: { url, then }`                   | `externalSort` / `externalFilter` + refetch |

## Before / after

The example at the end of this page runs against these rows:

```svelte {preamble}
<script lang="ts">
  import { SvGrid, type GridColumns } from '@svgrid/grid'

  type Person = {
    id: number
    name: string
    department: string
    city: string
    age: number
    salary: number
  }

  const people: Person[] = [
    { id: 1, name: 'Ada Lovelace',   department: 'Engineering', city: 'London',   age: 36, salary: 142000 },
    { id: 2, name: 'Grace Hopper',   department: 'Engineering', city: 'New York', age: 45, salary: 168000 },
    { id: 3, name: 'Linus Torvalds', department: 'Platform',    city: 'Portland', age: 54, salary: 155000 },
    { id: 4, name: 'Radia Perlman',  department: 'Networking',  city: 'Seattle',  age: 49, salary: 161000 },
    { id: 5, name: 'Barbara Liskov', department: 'Platform',    city: 'Boston',   age: 52, salary: 172000 },
  ]

  let rows = $state<Person[]>(people)

  const columns: GridColumns<Person> = [
    { field: 'name',       header: 'Name',       width: 200, editorType: 'text' },
    { field: 'department', header: 'Department', width: 150, editorType: 'text' },
    { field: 'city',       header: 'City',       width: 140, editorType: 'text' },
    { field: 'age',        header: 'Age',        width: 90,  editorType: 'number' },
    { field: 'salary',     header: 'Salary',     width: 130, editorType: 'number', format: { type: 'currency', currency: 'USD' } },
  ]
</script>
```

```diff
- import { Grid } from 'gridjs'
- import 'gridjs/dist/theme/mermaid.css'
-
- new Grid({
-   data: rows,
-   columns: ['Name', 'Amount'],
-   sort: true, search: true,
-   pagination: { limit: 25 },
- }).render(document.getElementById('grid'))

+ <script lang="ts">
+   import {
+     SvGrid, tableFeatures, rowSortingFeature, columnFilteringFeature,
+     type ColumnDef,
+   } from '@svgrid/grid'
+   const features = tableFeatures({ rowSortingFeature, columnFilteringFeature })
+   const columns: ColumnDef<typeof features, Row>[] = [
+     { field: 'name',   header: 'Name' },
+     { field: 'amount', header: 'Amount', format: { type: 'currency', currency: 'USD' } },
+   ]
+ </script>
+
+ <SvGrid data={rows} columns={columns} features={features} showPagination />
```

## What you gain

- **Virtualization** for large datasets (Grid.js renders the page).
- **Excel-style filter menu**, **inline editing**, **grouping**, and
  **tree / master-detail** when you need them.
- **Reactive data** - no `.render(el)` re-instantiation.
- A **headless engine** and an **imperative API** plus `@svgrid/mcp`.

## Frequently asked questions

### When should I move from Grid.js to SvGrid?

When you need more than search / sort / paginate - virtualization for big
datasets, inline editing, Excel-style filters, grouping, or tree data. For a
small table, Grid.js stays lighter.

### Is SvGrid MIT-licensed like Grid.js?

Yes. `@svgrid/grid` is MIT. Only the optional `@svgrid/enterprise` add-on is paid.

### Does SvGrid support server-side data like Grid.js?

Yes. Set `externalSort` / `externalFilter` and refetch on the
`onSortingChange` / `onFiltersChange` events.

## What you end up with

Search, sort and pagination - the whole Grid.js surface, plus editing.

```svelte {runnable}
<SvGrid data={rows} {columns} sortable filterable pageable pageSize={3} editable />
```

## See also

- [SvGrid vs Grid.js](https://svgrid.com/compare/gridjs/) - the side-by-side comparison
- [Getting started](../getting-started.md) - a working grid in ~15 lines
- [Server-side data](./server-side-data.md) - the external-data pattern
