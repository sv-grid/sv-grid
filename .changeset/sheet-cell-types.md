---
"@svgrid/enterprise": minor
---

Cells drawn as a control: a checkbox, a button or a group of radio choices,
laid over a block of cells from Insert > Controls.

The rule that keeps this honest is that a cell type is a rendering and never
a second source of truth. A checkbox is ticked because its cell reads TRUE,
not because the checkbox remembers being clicked, so `=COUNTIF(A1:A9, TRUE)`
counts the ticks, undo undoes one, a paste sets one and the file carries an
ordinary boolean. Excel's own cell checkbox works the same way, which is why
the default pair is TRUE and FALSE; a sheet that wants Yes and No says so.

A button reports its press through `onCellAction` with the region's own
action name, so one column of buttons can be told from another.
