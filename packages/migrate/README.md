# @svgrid/migrate

Codemod that ports a table to [SvGrid](https://svgrid.com), from either
[svelte-headless-table](https://www.npmjs.com/package/svelte-headless-table)
or [TanStack Table v9](https://www.npmjs.com/package/@tanstack/svelte-table) -
including the shadcn-svelte data-table recipe, which is built on it.

```bash
npx @svgrid/migrate            # preview what would change (default)
npx @svgrid/migrate src --write # apply it
```

It previews by default and only writes with `--write`. A codemod that silently
rewrites a file it half-understood is worse than no codemod.

## What it does

| Source | Becomes |
| --- | --- |
| `table.column({ header, accessor: 'x' })` | `{ header, field: 'x' }` |
| `table.column({ accessor: (row) => ... })` | `{ fieldFn: (row) => ... }` |
| `table.group({ header, columns: [...] })` | `{ header, columns: [...] }` |
| `readable([...])` | a plain array |
| `addSortBy()` | `sortable` |
| `addTableFilter()` | `filterable showGlobalFilter` |
| `addColumnFilters()` | `filterable showColumnFilters` |
| `addPagination({ initialPageSize: 25 })` | `pageable pageSize={25}` |
| `addSelectedRows()` | `showRowSelection` |
| `addGroupBy()` | `groupable` |
| `addSubRows()` | `treeData` |
| `addColumnOrder()` | `enableColumnReorder` |
| the whole `<table>` block, `<Subscribe>`, `<Render>` | `<SvGrid {data} {columns} ... />` |

The template scaffolding is deleted rather than translated. It exists only to
read stores, and SvGrid ships a renderer, so there is nothing to translate it
into. Column resizing, keyboard navigation and ARIA grid semantics come with
the component.

## What it will not do

These are reported as warnings, never silently dropped:

- **Custom `cell` renderers.** SvGrid renders cells with a snippet rather than
  `createRender`, so these are preserved as `// TODO port:` comments.
- **`addGridLayout`.** No counterpart; SvGrid owns its layout.
- **`addResizedColumns`.** Needs no prop, resizing is built in.
- **`addHiddenColumns`.** Maps to `visible: false` per column, not a grid prop.
- **`addExpandedRows`.** Maps to `treeData` or `isDetailRow` + `renderDetailRow`
  depending on what you were doing.
- **Unrecognised plugins**, including your own.

What carries across from the `<script>`: the column definitions and plugin
config (translated), your `export let` props or `$props()` block, and every
import that is not the table library or `svelte/store` (row types above all).
When `createTable` took a store over a prop, the grid binds to the prop
directly (`data={people}`). The table, the view model, the store and the `$:`
statements over them are gone, and anything else hand-written in the script
is not carried across: preview first, and move that code over yourself.

Two more things it names rather than fixes, because they sit outside the
`<table>` it replaces: markup that still reads the view model (a pager on
`pluginStates.page`, a `$: shown = $pageRows.length`), and events the rows
dispatched (`dispatch('select', row.original)`), which become
`onRowClick={({ row }) => ...}` on `<SvGrid>`.

## Svelte 5 upgrade checklist

If the codemod is part of a Svelte 4 to 5 upgrade, this order keeps each
step's diagnostics readable on their own. The whole sequence, with every line
the tools print, is captured in
[docs/help/svelte-5-upgrade-data-tables.md](https://svgrid.com/docs/help/svelte-5-upgrade-data-tables/).

1. `npm install svelte@5`. On npm 11 the `svelte@^4` peer range of
   svelte-headless-table is overridden with a warning; older npm needs
   `--legacy-peer-deps`.
2. `npx svelte-check`. The untouched component still type-checks in legacy
   mode; if it does not, that is not the table.
3. `npx @svgrid/migrate src`, read the preview and the warnings, then
   `npx @svgrid/migrate src --write`.
4. `npm install @svgrid/grid && npm uninstall svelte-headless-table`.
5. `npx svelte-check` again. What is left is what the warnings named.

## From TanStack Table v9 (and the shadcn-svelte data table)

This port is unusually shallow, because `@svgrid/grid` exports the same v9
vocabulary: `tableFeatures`, `rowSortingFeature`, `columnFilteringFeature`,
`rowPaginationFeature`, `rowSelectionFeature`, `rowExpandingFeature` and
`columnGroupingFeature`. Your `features` object is not translated at all - its
import is re-pointed and the features SvGrid does not have are removed.

| Source | Becomes |
| --- | --- |
| `accessorKey: 'x'` | `field: 'x'` |
| `accessorFn: (row) => ...` | `fieldFn: (row) => ...` |
| `columnHelper.accessor('x', { ... })` | `{ field: 'x', ... }` |
| `columnHelper.accessor(fn, { id, ... })` | `{ fieldFn: fn, id, ... }` |
| `columnHelper.display({ ... })` / `.group({ ... })` | the plain object it built |
| `createColumnHelper<Row>()` | deleted - SvGrid columns are plain objects |
| `size: 140` | `width: 140` |
| `enableSorting: false` | `sortable: false` |
| `enableColumnFilter: false` | `filterable: false` |
| `ColumnDef<Row>[]` | `GridColumns<Row>` (SvGrid's takes two type params) |
| `rowSortingFeature` | kept, plus `sortable` on the element |
| `rowPaginationFeature` | kept, plus `pageable showPagination` |
| `rowSelectionFeature` | kept, plus `showRowSelection` |
| `columnVisibilityFeature` | removed - use `visible: false` per column |
| `columnResizingFeature` | removed - resizing is built in |
| `let sorting = $state([])` + `onSortingChange` | deleted; SvGrid owns that state |
| `createSvelteTable(...)`, `<Table.Root>`, `FlexRender` | deleted |

Because the shadcn layout keeps `features` in its own module, the codemod
follows that import to work out which props the component needs. Point it at
the whole route directory, not just the `.svelte` file:

```bash
npx @svgrid/migrate src/routes/payments
```

`meta` is dropped (no equivalent), and custom `cell` / `header` render
functions are kept and reported rather than guessed at.

## After running it

Run your type-checker. The markup is regenerated rather than edited, so
`svelte-check` is the fastest way to see what still needs attention.

The emitted columns are typed `GridColumns<(typeof data)[number]>`, which binds
`field` to your real keys and gives a `fieldFn` row parameter a type. If your
data comes from a prop or a load function rather than a literal, swap that for
your own row type.

## Also handles the fork

`@humanspeak/svelte-headless-table` (the maintained Svelte 5 fork) uses the same
API and is recognised too.

## License

MIT. See [LICENSE](./LICENSE).
