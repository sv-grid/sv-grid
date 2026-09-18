# Migrating from svelte-headless-table

svelte-headless-table popularised the headless-table pattern in the
Svelte ecosystem. It is built on Svelte 4 stores and plugins
(`addSortBy`, `addColumnFilters`, `addPagination`, ...), and it leaves
the markup to you. SvGrid keeps the same headless idea but runs on
Svelte 5 runes and ships a render component, so the port mostly
*removes* the table you used to hand-author.

> Estimated effort: **1-3 hours** per grid. Most of the time is deleting
> the `<table>` markup and `Subscribe` blocks you no longer need.

<!-- facts:start svelte-headless-table pkg:@humanspeak/svelte-headless-table -->
> **Facts, checked 12 Sep 2026.** `svelte-headless-table` 0.18.3, MIT, last published 28 Oct 2024, 90,100 npm downloads in the 30 days to 10 Sep 2026. `@humanspeak/svelte-headless-table` 6.2.0, MIT, last published 27 Aug 2026, 8,640 npm downloads in the same window. `@svgrid/grid` 3.0.3, MIT, last published 11 Sep 2026, 16,900 npm downloads in the same window. Bundle, minified and gzipped, each package built alone with Svelte external: SvGrid 4.0.0 93.0 KB JS + 10.1 KB CSS (measured 17 Sep 2026); `svelte-headless-table` 0.18.3 5.7 KB JS, no separate stylesheet, svelte external (measured 12 Sep 2026). svelte-headless-table pricing, as its site states it: svelte-headless-table is MIT and free; no paid licence or support is offered, and the author states there are no plans for a Svelte 5 port (https://github.com/bryanmylee/svelte-headless-table, read 12 Sep 2026). SvGrid: MIT core; @svgrid/enterprise from $599 per developer per year. Side by side, with sources: [SvGrid vs svelte-headless-table](https://svgrid.com/compare/svelte-headless-table/).
<!-- facts:end -->

## Know your options first

The original package's last release and its Svelte 4 peer range are in the
facts box above, and its README states there are no current plans for a
Svelte 5 port, so a Svelte 5 upgrade forces a decision. There are three
honest answers and you should know all of them:

1. **`@humanspeak/svelte-headless-table`** - a maintained fork on Svelte 5 with
   the same API; its version, publish date and downloads are in the facts box
   too. Changing one package name is the cheapest path by a wide margin. If
   your table works and you only need Svelte 5, do that.
2. **TanStack Table v9** - its Svelte adapter declares a Svelte 5 peer range.
   Still headless-only, so you keep writing and maintaining the markup.
3. **SvGrid** - this page. A different trade: you delete the markup and take a
   renderer instead.

Pick SvGrid when the markup is the part you are tired of. Note that the blocker
is the peer range, not the syntax: `svelte-headless-table@0.18.3` declares
`svelte@^4`, so installing it beside Svelte 5 is a peer conflict. Slots and
`let:` themselves still work in Svelte 5 - they are deprecated in favour of
snippets, not removed - so the `Subscribe` blocks below keep rendering. What you
cannot do is pass slotted content to a component that renders with
`{@render ...}`, which is why the pattern grates in a runes codebase.

## Run the codemod

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

```bash
npx @svgrid/migrate             # preview the result
npx @svgrid/migrate src --write # apply it
```

It translates column definitions and plugin config, deletes the
`Subscribe`/`Render` scaffolding, and reports anything it cannot map rather than
dropping it silently. It previews by default. See
[`@svgrid/migrate`](https://www.npmjs.com/package/@svgrid/migrate) for the full
mapping and its limits.

## Vocabulary cheat sheet

| svelte-headless-table                     | sv-grid                                   |
| ----------------------------------------- | ----------------------------------------- |
| `createTable(data, plugins)`              | `createSvGrid({...})` or `<SvGrid>`        |
| `table.createColumns((t) => [...])`       | `columns: ColumnDef[]`                     |
| `t.column({ accessor: 'x', header })`     | `{ field: 'x', header }`                   |
| `t.column({ accessor: (r) => ... })`      | `{ id, fieldFn: (r) => ... }`           |
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

### The shortcut form

That table maps plugins onto the headless *features*, which is what you want if
you keep driving the engine yourself. If you are moving to the `<SvGrid>`
component, every capability also has a boolean prop, and that is what the
codemod emits:

| Plugin | `<SvGrid>` prop |
| --- | --- |
| `addSortBy()` | `sortable` |
| `addTableFilter()` | `filterable showGlobalFilter` |
| `addColumnFilters()` | `filterable showColumnFilters` |
| `addPagination({ initialPageSize: 25 })` | `pageable pageSize={25}` |
| `addSelectedRows()` | `showRowSelection` |
| `addGroupBy()` | `groupable` |
| `addSubRows()` | `treeData` |
| `addColumnOrder()` | `enableColumnReorder` |
| `addResizedColumns()` | nothing - resizing is built in |
| `addHiddenColumns()` | `visible: false` on the column |
| `addExpandedRows()` | `treeData`, or `isDetailRow` + `renderDetailRow` |
| `addGridLayout()` | nothing - SvGrid owns its layout |

Every capability is off by default and turned on by its prop; there is no
plugin registration step.

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

Type the column array against your row type. `GridColumns<(typeof data)[number]>`
is the shortest form; a bare `GridColumns` widens the row to
`Record<string, unknown>` and stops checking `field` against your real keys.

## What you get for free

- **The renderer.** No `createViewModel`, no `Subscribe`, no hand-built
  `<table>`. SvGrid ships virtualization, sticky headers, column
  resize, keyboard nav, and ARIA.
- **Excel-style filter menu** and **cell-range selection + TSV copy**,
  which are BYO in svelte-headless-table.
- **Inline editing** with typed editors and validation hooks.
- **In-grid AI helpers** - natural-language filter, smart fill, summarise -
  free in `@svgrid/grid` against a model you register.
- **Enterprise features** - Excel and PDF export, print, import and pivot -
  in one paid add-on; CSV, TSV and JSON export are free.

If you would rather keep driving your own `<table>`, the headless demo
below does exactly that on `createSvGrid`, plugins replaced by features:

<div data-docs-demo="186-headless-table" data-height="520"></div>

## What changes

- **Stores → runes.** Reactive data is `$state` / a plain array, not a
  Svelte store you pass to `createTable`. If your rows came from a `derived`
  store, read it with `$` at the call site or move it to `$derived`.
- **Plugins → features.** Register `rowSortingFeature` etc. in
  `tableFeatures({...})` instead of `addSortBy()` in the plugin bag.
- **View model → component.** You stop owning the markup; style through
  `--sg-*` tokens (and Tailwind) instead of `tableAttrs`.

## What does not come across

- **Custom `cell` renderers.** `createRender(MyComponent, props)` has no direct
  equivalent; SvGrid uses a `cell` snippet. The codemod preserves yours as a
  `// TODO port:` comment.
- **Your own plugins.** There is no plugin system to port them into.
- **`tableAttrs` / `attrs()` spreading.** The component owns its attributes.

## When not to migrate

- You need control of the exact DOM. Use the fork, or SvGrid's
  [headless core](../why-headless.md) at `@svgrid/grid/core`.
- Your table is a handful of rows with no interaction. A plain `{#each}` is
  less code than either library.
- You depend on custom plugins. That is a rewrite, not a migration.
- You only need Svelte 5 support. Use the fork.

## Frequently asked questions

### How hard is it to move from svelte-headless-table to SvGrid?

Usually 1-3 hours per grid, and `npx @svgrid/migrate` does the mechanical part.
The plugin-to-feature mapping is almost one-to-one; most of the work is deleting
the `createViewModel` + `Subscribe` + `<table>` markup, because SvGrid renders
that for you.

### Does SvGrid use Svelte 5 runes instead of stores?

Yes. svelte-headless-table is built on Svelte 4 stores; SvGrid is Svelte-5
native (`$state` / `$derived` / `$effect`) with snippets for custom cells.

### Is SvGrid still headless like svelte-headless-table?

Yes - `createSvGrid` plus the row-model factories is a headless engine you can
drive with your own markup, importable on its own from `@svgrid/grid/core`. The
difference is that SvGrid *also* ships a batteries-included `<SvGrid>` component
so you usually do not have to.

### Is svelte-headless-table still maintained?

The original's last publish date and Svelte 4 peer range are in the facts box
at the top of the page, read from npm on the date shown, and its README says
there are no current plans for a Svelte 5 port. A community fork,
`@humanspeak/svelte-headless-table`, is maintained and runs on Svelte 5 with
the same API; the facts box has its release line too. The fork is the
lowest-effort option if you are happy with the library and only need Svelte 5.

## What you end up with

Sorting, filtering and selection, on a library that still ships for Svelte 5.

```svelte {runnable}
<SvGrid data={rows} {columns} sortable filterable selectable />
```

## See also

- [SvGrid vs svelte-headless-table](https://svgrid.com/compare/svelte-headless-table/) - the side-by-side comparison, with a source and date for every claim
- [Headless: build a table](./headless/build-a-table.md) - the demo above, step by step
- [Migrating from TanStack Table](./migrating-from-tanstack-table.md) - sibling headless guide
- [Why headless?](../why-headless.md) - the design rationale
- [Architecture](./architecture.md) - the engine + render-component split
