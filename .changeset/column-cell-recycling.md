---
"@svgrid/grid": minor
---

Body cells are reused across the column window. With column virtualization
on, the body cells' `{#each}` is keyed by a slot instead of the column id: a
column keeps its `<td>` while it stays in the window, and a column entering
the window takes the `<td>` of one that left, in the order those cells sat in
the row. A thumb drag that jumps to columns far away now updates the cells in
place; it used to destroy every cell in the window and create new ones.
Measured on the 503 big-data demo (production build, 1M rows, 1,000
columns, 60 far jumps): about a third less work per jump, and one-column
steps cost the same as before.

A cell renderer of your own (`cell` returning `renderComponent` or
`renderSnippet`) is re-created when its `<td>` moves to another column, so it
never receives another column's props with its old state. Built-in cell
content (text, checkboxes, chips, sparklines, conditional formats) is
updated in place. `cellFlash` resets when a cell changes column, so a reused
cell does not flash. Pinned columns, and every column with column
virtualization off, are still keyed by id.

The header row, the filter row, the summary row and the loading placeholder
rows reuse their cells across the column window too, so a far jump updates
the header in place instead of rebuilding it (an app's own header renderer
is re-created per column, as body cell renderers are). In flex layout the
trailing spacer cell after the column window is no longer drawn: the row is
as wide as the table without it, and its width changed on every column
crossing, restyling a cell in every row. The grid watches its table for the
spreadsheetLayout action's table-layout marker and keeps the spacer then.
Cell notes set from the context menu are held as a plain object, so a cell
without a note no longer allocates a reactive entry asking for one.
