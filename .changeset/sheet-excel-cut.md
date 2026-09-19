---
'@sv-grid/enterprise': patch
---

Ctrl+X in the sheet marks the block instead of emptying it

The shell took the grid's cut, which clears the cells in the same keystroke:
pressing Escape after a cut left the data gone, and undoing a cut and paste
took two Ctrl+Z with the values nowhere in between. The spreadsheet shell now
implements Excel's cut for Ctrl+X, the ribbon's Cut and the context menu's -
the block is marked, the cells leave when the paste lands, and the move,
including the reference rewrites it owes the rest of the workbook, is one undo
step. The ribbon's Cut raises a `cut` action, so a host can answer it; one
that does not still gets the grid's own cut.
