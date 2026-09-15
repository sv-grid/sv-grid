---
"@svgrid/grid": minor
---

`cmd.canEdit(rowIndex, colIndex)` on the command context.

`setCellValue` trusts its caller, so a registered command that fills a
range had no way to know a cell was read-only short of reading the column
definition itself. `canEdit` is the grid's own editability answer (the
column's `editable`, in display index space), the one the inline editor,
the fill handle and paste already use, so a command can skip what the grid
would have refused.
