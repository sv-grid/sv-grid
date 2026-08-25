# @svgrid/migrate

Codemod that ports a [svelte-headless-table](https://www.npmjs.com/package/svelte-headless-table)
component to [SvGrid](https://svgrid.com).

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
