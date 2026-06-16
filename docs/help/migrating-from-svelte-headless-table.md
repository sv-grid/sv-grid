# Migrating from svelte-headless-table

svelte-headless-table popularised the headless-table pattern in the
Svelte ecosystem. It is built on Svelte 4 stores and plugins
(`addSortBy`, `addColumnFilters`, `addPagination`, ...), and it leaves
the markup to you. SvGrid keeps the same headless idea but runs on
Svelte 5 runes and ships a render component, so the port mostly
*removes* the table you used to hand-author.

> Estimated effort: **1-3 hours** per grid. Most of the time is deleting
> the `<table>` markup and `Subscribe` blocks you no longer need.

## Vocabulary cheat sheet

| svelte-headless-table                     | sv-grid                                   |
| ----------------------------------------- | ----------------------------------------- |
| `createTable(data, plugins)`              | `createSvGrid({...})` or `<SvGrid>`        |
| `table.createColumns((t) => [...])`       | `columns: ColumnDef[]`                     |
| `t.column({ accessor: 'x', header })`     | `{ field: 'x', header }`                   |
| `t.column({ accessor: (r) => ... })`      | `{ id, accessorFn: (r) => ... }`           |
| `t.group({ header, columns })`            | `{ header, columns: [...] }` (column group) |
| `addSortBy()`                             | `rowSortingFeature`                        |
| `addColumnFilters()` / `addTableFilter()` | `columnFilteringFeature`                   |
| `addPagination()`                         | Built in; toggle `showPagination`          |
| `addExpandedRows()` / `addSubRows()`      | `rowExpandingFeature`                      |
| `addGroupBy()`                            | `columnGroupingFeature` + `api.setGroupBy()` |
| `addSelectedRows()`                       | `rowSelectionFeature`                      |
| `addDataExport()`                         | `@svgrid/enterprise` export pack                  |
| `createViewModel(columns)` + `Subscribe`  | `<SvGrid>` (no view model to wire)         |
| `pluginStates.sort.sortKeys`              | `api.setSort(id, dir)` / `onSortingChange` |

## Before / after

```diff
- <script>
-   import { createTable } from 'svelte-headless-table'
-   import { addSortBy, addColumnFilters, addPagination } from 'svelte-headless-table/plugins'
-   import { readable } from 'svelte/store'
-
-   const table = createTable(readable(data), {
-     sort: addSortBy(), filter: addColumnFilters(), page: addPagination(),
-   })
-   const columns = table.createColumns((t) => [
-     t.column({ accessor: 'name',   header: 'Name' }),
-     t.column({ accessor: 'amount', header: 'Amount' }),
-   ])
-   const { headerRows, rows, tableAttrs, tableBodyAttrs } = table.createViewModel(columns)
- </script>
-
- <table {...$tableAttrs}>
-   <thead> ...Subscribe over headerRows... </thead>
-   <tbody {...$tableBodyAttrs}> ...Subscribe over rows... </tbody>
- </table>

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

## What you get for free

- **The renderer.** No `createViewModel`, no `Subscribe`, no hand-built
  `<table>`. SvGrid ships virtualization, sticky headers, column
  resize, keyboard nav, and ARIA.
- **Excel-style filter menu** and **cell-range selection + TSV copy**,
  which are BYO in svelte-headless-table.
- **Inline editing** with typed editors and validation hooks.
- **Enterprise features** - export, import, pivot, AI - in one paid add-on.

## What changes

- **Stores → runes.** Reactive data is `$state` / a plain array, not a
  Svelte store you pass to `createTable`.
- **Plugins → features.** Register `rowSortingFeature` etc. in
  `tableFeatures({...})` instead of `addSortBy()` in the plugin bag.
- **View model → component.** You stop owning the markup; style through
  `--sg-*` tokens (and Tailwind) instead of `tableAttrs`.

## See also

- [SvGrid vs svelte-headless-table](https://svgrid.com/compare/svelte-headless-table) - the side-by-side comparison
- [Migrating from TanStack Table](./migrating-from-tanstack-table.md) - sibling headless guide
- [Why headless?](../why-headless.md) - the design rationale
- [Architecture](./architecture.md) - the engine + render-component split

## Frequently asked questions

### How hard is it to move from svelte-headless-table to SvGrid?

Usually 1-3 hours per grid. The plugin-to-feature mapping is almost one-to-one;
most of the work is deleting the `createViewModel` + `Subscribe` + `<table>`
markup, because SvGrid renders that for you.

### Does SvGrid use Svelte 5 runes instead of stores?

Yes. svelte-headless-table is built on Svelte 4 stores; SvGrid is Svelte-5
native (`$state` / `$derived` / `$effect`) with snippets for custom cells.

### Is SvGrid still headless like svelte-headless-table?

Yes - `createSvGrid` plus the row-model factories is a headless engine you can
drive with your own markup. The difference is that SvGrid *also* ships a
batteries-included `<SvGrid>` component so you usually do not have to.
