# Migrating from @vincjo/datatables

`@vincjo/datatables` is a small, ergonomic Svelte datatable helper: you
wrap your data in a handler and it gives you reactive sorting,
filtering, and pagination while you keep your own table markup. SvGrid
covers the same job and then keeps going - virtualization, an
Excel-style filter menu, inline editing, and a render component - so the
port is mostly about deciding how much markup you want to keep.

> Estimated effort: **30 min - 2 hours** per table. A simple list is a
> 30-minute swap; a feature-heavy one trends toward two hours.

## Vocabulary cheat sheet

| @vincjo/datatables                         | sv-grid                                   |
| ------------------------------------------ | ----------------------------------------- |
| `new TableHandler(data, { rowsPerPage })`  | `createSvGrid({...})` or `<SvGrid>`        |
| `<ThSort {table} field="name">`            | `rowSortingFeature` (header sort built in) |
| `<ThFilter {table} field="name">`          | `columnFilteringFeature`                   |
| `table.global.set(query)` (search)         | `api.setState({ globalFilter: query })`    |
| `<Pagination {table} />` / `<RowCount>`    | Built in; toggle `showPagination`          |
| `table.rows` (current page rows)           | `api.getDisplayedRows()`                   |
| Server mode (`table.load(...)`)            | `externalSort` / `externalFilter` + refetch |
| Your own `<table>` + `{#each table.rows}`  | `<SvGrid>` render component                 |

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
- <script>
-   import { TableHandler, ThSort, ThFilter, Pagination } from '@vincjo/datatables'
-   const table = new TableHandler(rows, { rowsPerPage: 25 })
- </script>
-
- <table>
-   <thead><tr>
-     <ThSort {table} field="name">Name</ThSort>
-     <ThSort {table} field="amount">Amount</ThSort>
-   </tr></thead>
-   <tbody>
-     {#each table.rows as row}
-       <tr><td>{row.name}</td><td>{row.amount}</td></tr>
-     {/each}
-   </tbody>
- </table>
- <Pagination {table} />

+ <script lang="ts">
+   import {
+     SvGrid, tableFeatures, rowSortingFeature, columnFilteringFeature,
+     type ColumnDef,
+   } from '@svgrid/grid'
+
+   const features = tableFeatures({ rowSortingFeature, columnFilteringFeature })
+   const columns: ColumnDef<typeof features, Row>[] = [
+     { field: 'name',   header: 'Name' },
+     { field: 'amount', header: 'Amount', format: { type: 'currency', currency: 'USD' } },
+   ]
+ </script>
+
+ <SvGrid data={rows} columns={columns} features={features} showPagination />
```

## Server-side data

```diff
- // @vincjo/datatables: drive a server with the handler's load hook
- const table = new TableHandler(rows, { rowsPerPage: 25 })
- table.load((state) => fetchRows(state)) // sort/filter/page sent to your API

+ <SvGrid
+   data={rows} columns={columns} features={features}
+   externalSort={true} externalFilter={true}
+   onSortingChange={(clauses) => refetch({ sort: clauses })}
+   onFiltersChange={(f)       => refetch({ filters: f.columns })}
+ />
```

## What you get for free

- **A render component** with virtualization - you stop authoring the
  `<table>` and the `{#each}`.
- **Excel-style filter menu**, **cell-range selection + copy**, and
  **inline editing** with typed editors.
- **Grouping, tree data, and master/detail** when the table grows up.
- **Enterprise features** - export, import, pivot, AI.

## What you give up

- **The tiny footprint.** If all you ever need is sort / filter /
  paginate over a small list, `@vincjo/datatables` stays smaller.
- **Total markup control.** SvGrid renders the table; you theme it with
  `--sg-*` tokens and Tailwind rather than writing every `<td>`.

## Frequently asked questions

### Should I move from @vincjo/datatables to SvGrid?

Move when a hand-rolled table stops being enough - when you need virtualization
for large datasets, an Excel-style filter menu, inline editing, grouping, or
tree data. For a small sort/filter/paginate list, `@vincjo/datatables` is a fine,
lighter choice.

### Is SvGrid also MIT-licensed like @vincjo/datatables?

Yes. `@svgrid/grid` is MIT, like `@vincjo/datatables`. SvGrid adds an
optional paid `@svgrid/enterprise` pack (export, import, pivot, AI).

### Can I keep my own table markup after switching?

Yes. SvGrid has a headless core (`createSvGrid` + row-model factories) you can
drive with your own markup, the same way `@vincjo/datatables` lets you. Most
teams use the `<SvGrid>` component instead because it removes the boilerplate.

## What you end up with

Sorting, filtering and pagination without the hand-written table around it.

```svelte {runnable}
<SvGrid data={rows} {columns} sortable filterable pageable pageSize={3} />
```

## See also

- [SvGrid vs @vincjo/datatables](https://svgrid.com/compare/vincjo-datatables/) - the side-by-side comparison
- [Migrating from svelte-headless-table](./migrating-from-svelte-headless-table.md) - sibling Svelte guide
- [Why headless?](../why-headless.md) - keep your own markup if you want to
