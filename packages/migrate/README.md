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

Anything hand-written in the original `<script>` beyond the table wiring is not
carried across. Preview first, and move that code over yourself.

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
