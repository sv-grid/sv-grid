# Full-width rows

"Full-width rows" are rows whose content takes the entire grid width
instead of being cell-by-cell - useful for inline editors, banner ads,
section dividers, and detail-row expansions.
<div data-docs-demo="08-tree-and-master-detail" data-height="540"></div>

## Status

Built-in support - through `enableRowSummaries={true}` for a single
sticky footer row - exists; arbitrary mid-table full-width rows are
**not** built in.

For inline master/detail (where expanding a row reveals a child) see
[demos/08-tree-and-master-detail.svelte](../../../examples/src/demos/08-tree-and-master-detail.svelte):
the demo expands a row to mount a second `<SvGrid>` underneath, with the
detail keyed to the parent.

## Workaround - render a divider between groups

When you only need a visual band (no editing, no nested grid), render a
plain DOM band above the grid for sticky banners, or use
[grouping](./row-data.md) to get a "group label" row that visually spans
the row width through the indented label column.

## Tracked at

[Missing features](../missing-features.md) - first-class full-width rows
and detail-row API.

## See also

- [Master / detail demo](../../../examples/src/demos/08-tree-and-master-detail.svelte)
- [Grouping](./row-data.md)
