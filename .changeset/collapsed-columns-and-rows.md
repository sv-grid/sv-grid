---
"@svgrid/grid": minor
---

Collapsed columns and rows: `api.setColumnCollapsed` and `api.setRowCollapsed`.

A spreadsheet hides a column by folding it to nothing: the letters read A,
B, D, every formula that names C still holds, and Unhide brings C back at
the width it had. The grid could only take a column out of the model
(`setColumnVisible(id, false)`), which moves every column after it up an
index; anything that addresses cells by position, a sheet's formulas and
formats first of all, could not follow that.

`api.setColumnCollapsed(columnId, collapsed)` folds a column: it keeps its
index, its cells and its width, resolves to 0px, stops painting so its
neighbours' borders meet at the seam, and is left out of `fitColumns`.
`api.setRowCollapsed(rowIndex, collapsed)` is the row-side twin: the row
keeps its index and its cells, `getRowHeight` reads 0, and it leaves the
flow; the fold belongs to the row (its id), so it follows the row through a
sort. `isColumnCollapsed` and `isRowCollapsed` read the state.

The cursor never rests on a collapsed line: the arrow keys, Tab and Enter
step over it in the direction of travel (`pastCollapsed`, exported), and
End on a sheet whose last columns are hidden lands on the last one that
shows. `setActiveCell` still can, which is how a sheet's Name Box reaches a
hidden cell.

The virtualizer used to floor every item at one pixel, which left a hidden
column a one-pixel sliver; a size of 0 is a real size now and both window
searches stay monotonic over it.
