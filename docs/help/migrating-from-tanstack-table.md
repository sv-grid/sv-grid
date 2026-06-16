# Migrating from TanStack Table

TanStack Table (formerly React Table v8) is the closest conceptual
sibling to sv-grid - both are "headless data grid" libraries with
explicit row-model pipelines. If you already think in
`createTable()` + `getCoreRowModel()`, this is a half-day port.

> Estimated effort: **30 min** per grid for read-only views, **2-4
> hours** for editing-heavy grids.

## Vocabulary cheat sheet

| TanStack Table                  | sv-grid                                  |
| ------------------------------- | ---------------------------------------- |
| `useReactTable({...})`          | `createSvGrid({...})` or `<SvGrid>`       |
| `getCoreRowModel()`             | `createCoreRowModel()`                    |
| `getSortedRowModel()`           | Auto-registered by `rowSortingFeature`    |
| `getFilteredRowModel()`         | Auto-registered by `columnFilteringFeature` |
| `getPaginationRowModel()`       | Built in; toggle with `showPagination`    |
| `getGroupedRowModel()`          | `columnGroupingFeature` + `api.setGroupBy()` |
| `getExpandedRowModel()`         | `rowExpandingFeature`                     |
| `flexRender(col.cell, ctx)`     | `renderSnippet(MyCell, props)` OR string field |
| `columnHelper.accessor('field')` | `{ field: 'field' }` directly             |
| `table.getRowModel().rows`      | `api.getDisplayedRows()`                   |
| `table.setColumnFilters(...)`   | `api.setFilter(id, {...})` per column      |
| `meta` (column / table)         | n/a - use column `cellClass` / `cell` instead |

## Imports

```diff
- import {
-   useReactTable, getCoreRowModel, getSortedRowModel, getFilteredRowModel,
-   flexRender, createColumnHelper,
- } from '@tanstack/react-table'

+ import {
+   SvGrid, tableFeatures, rowSortingFeature, columnFilteringFeature,
+   renderSnippet, type ColumnDef,
+ } from 'sv-grid-core'
```

## Column definitions

```diff
- const columnHelper = createColumnHelper<Order>()
- const columns = [
-   columnHelper.accessor('orderId',  { header: 'Order ID' }),
-   columnHelper.accessor('amount',   { header: 'Amount', cell: ({ getValue }) => fmt(getValue<number>()) }),
- ]

+ const columns: ColumnDef<typeof features, Order>[] = [
+   { field: 'orderId', header: 'Order ID' },
+   { field: 'amount',  header: 'Amount', format: { type: 'currency', currency: 'USD' } },
+ ]
```

The `accessorFn` form is the same:

```diff
- columnHelper.accessor((row) => row.profile.name, { id: 'name', header: 'Name' })

+ { id: 'name', accessorFn: (row) => row.profile.name, header: 'Name' }
```

## Mounting

```diff
- const table = useReactTable({
-   data, columns,
-   getCoreRowModel:       getCoreRowModel(),
-   getSortedRowModel:     getSortedRowModel(),
-   getFilteredRowModel:   getFilteredRowModel(),
- })
- return (
-   <table>
-     <thead>{table.getHeaderGroups().map(/* ... */)}</thead>
-     <tbody>{table.getRowModel().rows.map(/* ... */)}</tbody>
-   </table>
- )

+ const features = tableFeatures({ rowSortingFeature, columnFilteringFeature })
+
+ <SvGrid data={rows} columns={columns} features={features} />
```

Sv-grid bundles the render + virtualization. No `<table>` you have
to author yourself.

## Imperative state

| TanStack Table                              | sv-grid                                  |
| ------------------------------------------- | ---------------------------------------- |
| `table.setColumnFilters([{id, value}])`     | `api.setFilter(id, { operator: 'contains', value })` |
| `table.getColumn('id')?.setFilterValue(v)`  | `api.setFilter(id, { operator: 'contains', value: v })` |
| `table.setSorting([{id, desc}])`            | `api.setSort(id, desc ? 'desc' : 'asc')`  |
| `table.setRowSelection(state)`              | n/a - use `api.clearRowSelection()` + UI events |
| `table.toggleAllRowsExpanded()`             | `api.expandAllGroups()`                   |
| `table.getColumn('x').toggleVisibility()`   | `api.setColumnVisible('x', false)`        |
| `table.options.meta?.foo`                   | Pass through component props / `$state`   |

## Custom cells

```diff
- {
-   header: 'Status',
-   cell: ({ row }) => <Badge tone={row.original.status} />,
- }

+ {
+   field: 'status', header: 'Status',
+   cell: (ctx) => renderSnippet(StatusCell, { tone: ctx.row.original.status }),
+ }
```

`renderSnippet` accepts any Svelte 5 snippet; `renderComponent`
accepts a regular component if you prefer SFCs.

## Server-side data

```diff
- const [pagination, setPagination] = useState({pageIndex: 0, pageSize: 25})
- const [sorting, setSorting]       = useState([])
- const table = useReactTable({
-   data, columns, manualPagination: true, manualSorting: true,
-   state: { pagination, sorting },
-   onPaginationChange: setPagination,
-   onSortingChange:    setSorting,
- })

+ <SvGrid
+   data={rows} columns={columns} features={features}
+   externalSort={true}
+   externalFilter={true}
+   onSortingChange={(clauses) => refetch({ sort: clauses })}
+   onFiltersChange={(f)       => refetch({ filters: f.columns })}
+ />
```

## What you get for free vs TanStack Table

- **Renderer**. TanStack is headless-only; you draw the `<table>`.
  Sv-grid ships an opinionated, fast renderer with virtualization,
  scroll, sticky headers, column resize, keyboard nav, ARIA.
- **Inline editing**. `editorType: 'text' | 'number' | 'date' |
  'list' | ...` - built-in editors with parsing + validation hooks.
- **CSP-clean**. No `eval`. The shipped tests confirm.
- **Pro features**. Export, import, pivot, AI - in one paid add-on.

## What you give up

- **React-first ecosystem.** Sv-grid is Svelte 5-native. There's no
  React wrapper.
- **`meta` for arbitrary side-channel state.** Pass props directly.
- **`@tanstack/match-sorter-utils` integration**. The grid's filter
  has a `contains` operator; if you need fuzzy match, plug your
  matcher in via the column's `cell` snippet or use
  `externalFilter={true}` and run the matcher yourself.

## See also

- [Architecture](./architecture.md) - the headless engine + render
  component split
- [Migrating from AG Grid](./migrating-from-ag-grid.md) - sibling guide
- [Why headless?](../why-headless.md) - the design rationale

## Frequently asked questions

### How long does it take to migrate from TanStack Table to SvGrid?

About 30 minutes per read-only grid and 2-4 hours for editing-heavy grids.
Both libraries use explicit row-model pipelines, so `createTable()` +
`getCoreRowModel()` maps almost directly onto `createSvGrid()` +
`createCoreRowModel()`.

### Why switch from TanStack Table to SvGrid on Svelte 5?

TanStack Table is headless-only and multi-framework, so you build the entire
DOM, virtualization, filter UI, and editing layer yourself. SvGrid keeps the
headless core but ships a batteries-included `<SvGrid>` render component -
virtualization, Excel-style filters, cell selection, and inline editing work
in one prop pass.

### Is SvGrid free like TanStack Table?

Yes - `sv-grid-core` is MIT-licensed, like TanStack Table. SvGrid
additionally offers an optional paid `sv-grid-pro` pack for export, pivot, and
import, which TanStack Table does not provide at all.
