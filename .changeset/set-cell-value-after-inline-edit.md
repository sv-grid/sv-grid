---
"@svgrid/grid": patch
---

`api.setCellValue` now shows on a cell the user has just edited inline. The
inline edit keeps the committed value in an override that the cell reads
before the row, so a later `setCellValue` on the same cell changed the data
and `getCellValue`, but the cell kept drawing the edited value. The common
case was a rejected save: `onCellValueChange` awaits the server, the server
says no, the handler writes `oldValue` back, and the screen kept the value
the server refused. The "Rolling back a failed save" example in the editing
docs mutated `e.row`, which the grid never redraws from; it now calls
`api.setCellValue(e.rowIndex, e.columnId, e.oldValue)`.
