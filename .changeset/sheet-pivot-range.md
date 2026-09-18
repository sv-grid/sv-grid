---
"@svgrid/enterprise": minor
---

A PivotTable over a range of cells, on the pivot engine the grid already
has. Insert > PivotTable opens Excel's dialog on the selected block: the
source, where the result goes, and which field is a row, a column or a
measure, summarised by Sum, Average, Count, Distinct count, Min or Max.
The sheet keeps the definition; what it writes is cells, so the result
can be formatted, charted, printed and saved to an .xlsx like any other
block. Insert > Refresh rebuilds it from the source and clears what the
last one wrote, and opening the dialog from a cell inside a pivot edits
that pivot instead of making another. Each write is one undo, cells and
definition together. Definitions are per sheet, ride in `getState()` as
`pivots`, report `{ kind: 'pivots' }`, move with an insert or a delete
and go when their source or target is deleted.
