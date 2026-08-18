# Tool panel (Columns + Filters)

The tool panel is the docked sidebar - standard in enterprise grids - for
managing columns and filters without hunting through a right-click menu. Turn it
on with the `toolPanel` prop:

<div data-docs-demo="146-tool-panel" data-height="480"></div>

```svelte
<SvGrid {data} {columns} {features} toolPanel />
```

A **Columns & Filters** button appears in a toolbar above the grid. Clicking it
opens a panel docked on the right edge with two tabs. Pass `toolPanelDefaultOpen`
to have it open on first render, and `toolPanelDefaultTab="filters"` to start on
the Filters tab:

```svelte
<SvGrid {data} {columns} {features} toolPanel toolPanelDefaultOpen />
```

## Columns tab

For every column:

- a **visibility** checkbox (show / hide the column),
- **â†‘ / â†“** to reorder the column,
- **âŠž** to group / ungroup by that column (when grouping is enabled).

## Filters tab

For every filterable column, an inline filter control:

- an **operator** select (the same operators the column menu offers - text
  columns get `contains` / `equals` / …, number and date columns get
  `greaterThan` / `between` / …; drive these with
  [`cellDataType`](../cells/cell-data-types.md)),
- a **value** input matched to the column type, plus a second **To** input for
  `between`,
- a **âœ•** to clear that column's filter.

The Filters tab writes the **same** filter state as the column menu and the
filter row, so all three surfaces stay in sync - filter from whichever is handy.
It works whenever `columnFilteringFeature` is enabled.

## Notes

- The panel lists **all** columns, including hidden ones, in the current
  display order, so you can bring a hidden column back.
- Visibility, order, and grouping changes go through the same engine state as
  the column menu and the imperative API (`setColumnVisible`,
  `setColumnOrder`, `setGroupBy`) - so they round-trip with `getState()` /
  `setState()` and [named views](../state/named-views.md).
- Grouping a column whose other columns declare an
  [`aggregate`](../grouping/aggregators.md) rolls those values up in the group
  header automatically.

See the live [Columns tool panel](https://svgrid.com/demos/146-tool-panel/)
demo.
