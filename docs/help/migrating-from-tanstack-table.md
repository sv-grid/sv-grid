# Migrating from TanStack Table

TanStack Table (formerly React Table) is the closest conceptual
sibling to sv-grid - both are "headless data grid" libraries with
explicit row-model pipelines, and the v9 Svelte adapter,
`@tanstack/svelte-table`, targets Svelte 5 with the same runes-first
shape. If you already think in `createTable()` + a features object,
this is a half-day port; the vocabulary below covers the v8 names too.

> Estimated effort: **30 min** per grid for read-only views, **2-4
> hours** for editing-heavy grids.

<!-- facts:start tanstack-table -->
> **Facts, checked 12 Sep 2026.** `@tanstack/svelte-table` 9.2.4, MIT, last published 28 Aug 2026, 231,000 npm downloads in the 30 days to 10 Sep 2026. `@svgrid/grid` 3.0.3, MIT, last published 11 Sep 2026, 16,900 npm downloads in the same window. Bundle, minified and gzipped, each package built alone with Svelte external: SvGrid 3.0.4 97.6 KB JS + 10.5 KB CSS (measured 22 Sep 2026); `@tanstack/svelte-table` 9.2.4 36.3 KB JS, no separate stylesheet, svelte external (measured 12 Sep 2026). TanStack Table pricing, as its site states it: TanStack Table is MIT and free; tanstack.com is sponsor-supported and offers Enterprise Support as private consulting and expert support, with no licence sold for the table (https://tanstack.com/table/latest, read 12 Sep 2026). SvGrid: MIT core; @svgrid/enterprise from $599 per developer per year. Side by side, with sources: [SvGrid vs TanStack Table (Svelte)](https://svgrid.com/compare/tanstack-table/).
<!-- facts:end -->

> **On v9?** SvGrid exports the same feature vocabulary, so most of this
> page is automated. Run `npx @svgrid/migrate src` to preview the port, and
> see [Migrating from the shadcn-svelte data table](./migrating-from-shadcn-data-table.md)
> if that is where your table came from.

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
- import {
-   useReactTable, getCoreRowModel, getSortedRowModel, getFilteredRowModel,
-   flexRender, createColumnHelper,
- } from '@tanstack/react-table'

+ import {
+   SvGrid, tableFeatures, rowSortingFeature, columnFilteringFeature,
+   renderSnippet,
+ } from '@svgrid/grid'
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

The `fieldFn` form is the same:

```diff
- columnHelper.accessor((row) => row.profile.name, { id: 'name', header: 'Name' })

+ { id: 'name', fieldFn: (row) => row.profile.name, header: 'Name' }
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

Or hand the fetching to a controller and pass it as one prop:
`createServerDataSource(source, { mode: 'infinite' })` owns the blocks,
the sort and filter round trips and the placeholder rows, and the
manual-flag wiring above disappears. TanStack Table has no server row
model; per-group fetching is yours to write, where the Enterprise
`createServerRowModel` does it over the same contract.

<div data-docs-demo="148-server-row-model" data-height="480"></div>

## What you get for free vs TanStack Table

- **Renderer**. TanStack is headless-only; you draw the `<table>`.
  Sv-grid ships an opinionated, fast renderer with virtualization,
  scroll, sticky headers, column resize, keyboard nav, ARIA.
- **Inline editing**. `editorType: 'text' | 'number' | 'date' |
  'list' | ...` - built-in editors with parsing + validation hooks.
- **CSP-clean**. No `eval`. The shipped tests confirm.
- **In-grid AI helpers**. Natural-language filter, smart fill, summarise
  and classify, free in `@svgrid/grid` against a model you register.
- **Enterprise features**. Excel and PDF export, print, import and pivot
  in one paid add-on; CSV, TSV and JSON export are free.

The headless demo below is the shape a TanStack app has today - a plain
`<table>` driven by the engine - running on `createSvGrid`:

<div data-docs-demo="186-headless-table" data-height="520"></div>

## What you give up

- **One engine across frameworks.** TanStack has adapters for React,
  Vue, Solid, Qwik, Lit and Svelte; sv-grid is Svelte 5-native and has
  no React wrapper.
- **The smallest engine-only bundle.** The facts box at the top of the
  page has both packages measured the same way; the difference is the
  renderer, virtualizer, filter UI and editors you would otherwise write.
- **TanStack Virtual and the shadcn-svelte data table recipe.** Sv-grid
  virtualizes on its own and has its own
  [shadcn-svelte guide](./migrating-from-shadcn-data-table.md).
- **`meta` for arbitrary side-channel state.** Pass props directly.
- **`@tanstack/match-sorter-utils` integration**. The grid's filter
  has a `contains` operator; if you need fuzzy match, plug your
  matcher in via the column's `cell` snippet or use
  `externalFilter={true}` and run the matcher yourself.

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

Yes - `@svgrid/grid` is MIT-licensed, like TanStack Table. SvGrid
additionally offers an optional paid `@svgrid/enterprise` pack for Excel and
PDF export, print, pivot and import, which TanStack Table does not provide at
all; TanStack sells Enterprise Support as consulting instead, as the facts box
above notes.

### Does the TanStack Svelte adapter support Svelte 5?

Yes. The v9 line of `@tanstack/svelte-table` declares a Svelte 5 peer range
and reads rune data through getters; the version in the facts box above is
the one read from npm. If you are on the v8 adapter with Svelte 4 stores,
the port to sv-grid is the same work as the port to v9, minus the markup.

## What you end up with

The same model you had, with the rendering already written.

```svelte {runnable}
<SvGrid data={rows} {columns} sortable filterable pageable pageSize={3} selectable />
```

## See also

- [SvGrid vs TanStack Table](https://svgrid.com/compare/tanstack-table/) -
  the side-by-side comparison, with a source and date for every claim
- [Comparison: SvGrid vs AG Grid vs TanStack Table](./comparison.md) -
  the measured benchmark, TanStack column included
- [Architecture](./architecture.md) - the headless engine + render
  component split
- [Migrating from AG Grid](./migrating-from-ag-grid.md) - sibling guide
- [Why headless?](../why-headless.md) - the design rationale
