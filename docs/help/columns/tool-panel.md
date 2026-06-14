# Columns tool panel

The tool panel is the docked sidebar - standard in enterprise grids - for
managing columns without hunting through a right-click menu. Turn it on with
the `toolPanel` prop:

```svelte
<SvGrid {data} {columns} {features} toolPanel />
```

A columns button appears at the grid's top-right. Clicking it opens a panel
docked on the right edge with, for every column:

- a **visibility** checkbox (show / hide the column),
- **↑ / ↓** to reorder the column,
- **⊞** to group / ungroup by that column (when grouping is enabled).

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

See the live [Columns tool panel](https://sv-grid.com/demos/146-tool-panel)
demo.
