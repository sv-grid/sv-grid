# Full-width rows

"Full-width rows" are rows whose content takes the entire grid width
instead of being cell-by-cell - useful for inline editors, banner ads,
section dividers, and detail-row expansions.
<div data-docs-demo="08-tree-and-master-detail" data-height="540"></div>

## Detail-row API (shipped)

Full-width rows are built in via `isDetailRow` + `renderDetailRow`: mark a row as
a detail row and it renders as a real full-width `colspan` cell hosting your
snippet - a nested grid, a form, timelines, anything.

```svelte
<SvGrid
  {data} {columns}
  isDetailRow={(row) => row.kind === 'detail'}
  renderDetailRow={DetailPanel}
/>
```

See [Master / detail (nested grids)](./master-detail.md) for the full
expand/collapse pattern, and demo `106-detail-rows` for a multi-panel detail.

A single sticky footer row is also available via `summary` (off by default):

```svelte
<SvGrid {data} {columns} summary />
```

It sums a numeric column and counts the rest. Pick a different aggregate per
column with that column's own `summary` option (`'avg'`, `'min'`, `'max'`,
`'count'`, a custom function), or `summary: false` to leave the cell blank.

## See also

- [Master / detail (nested grids)](./master-detail.md)
- [Grouping](./row-data.md)
