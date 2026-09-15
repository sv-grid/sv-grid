---
"@svgrid/grid": minor
---

`mergedCells`: merged cells drawn by the grid itself.

A list of origins with their spans, in display indices. The origin's td
takes the `rowspan` / `colspan` and shows the origin's value; the covered
cells are not drawn, so there is nothing to hide after the fact. A
selection grows to whole merges (a merged cell is one cell), the active
cell inside a merge is its origin, the arrow keys, Enter and Tab step over
a merge as one cell, the range's edges and the fill handle sit on the td
that draws the merge, and `api.getMergedCells()` reads the list back.
Under row virtualization a merge whose origin has scrolled out of the
rendered window is drawn from its first rendered row with the rows that
remain, and one that crosses the frozen boundary is drawn in two parts, so
no span ever reaches rows the table has not drawn. The grid does not write
into covered cells on its own; a consumer keeps them empty or marks them
read-only through the column's `editable`. `spreadsheetLayout` and the
value-driven `colSpan` / `rowSpan` stay as they were.
