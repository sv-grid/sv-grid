---
"@svgrid/grid": minor
---

Rows are laid out as flex lines of fixed-width cells instead of by the
table algorithm. A horizontal scroll adds and removes a column of cells
every frame; a table re-lays every row for that, a flex row only its own
cells. Measured on the 503 big-data demo (production build, 100K rows,
10,000 columns), horizontal-scroll layout drops from 2.7 ms to 1.0 ms a
frame and stays the same at 1,000 and 10,000 columns.

The rendered pixels match table layout, except for content taller than its
row (below): a body cell's content now sits in
`<span class="sv-grid-cell-line">`, which carries the cell's `text-align`
and ellipsis, and the row-number cells use the same span. Cells centre their
content with `align-items: center` at zero specificity, so
`.my-grid .sv-grid-cell { align-items: flex-start }` overrides it;
`vertical-align` on a cell no longer has an effect.

A row is exactly `rowHeight` tall. A table row's height is only a minimum,
so content taller than `rowHeight` used to grow the row while the
virtualizer still placed every row at `rowHeight`: the rows drifted and
jumped during a vertical scroll (the 1M-row demo drew 25 px rows where it
placed 18 px ones). Taller content is now clipped by its cell. Raise
`rowHeight` for it, or set `autoRowHeight` to let each row grow to fit.

New prop `rowLayout?: "flex" | "table"` (default `"flex"`). The grid uses
table layout on its own when `mergedCells` holds a merge with `rowSpan`
above 1, and the `spreadsheetLayout` action keeps it too. The table's
`min-width` now includes the row-number, selection and detail-toggle
columns.
