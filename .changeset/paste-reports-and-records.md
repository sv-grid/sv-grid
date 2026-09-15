---
"@svgrid/grid": minor
---

A paste is one undo step and reports every cell it changed; `editOnSecondClick`.

Ctrl+V swapped the pasted rows into the grid's data and stopped there: Ctrl+Z
did not know a paste had happened, and `onCellValueChange` was never fired
for the pasted cells, so a consumer keeping its own model behind the grid (a
formula engine, a server save) was never told. The spreadsheet shell showed
it plainly: a paste landed on screen and vanished on the next recalculation.
The paste now records one grouped history entry for everything it wrote and
fires `onCellValueChange` per changed cell, after the rows are in. Cells the
paste did not change (same value) get neither. The whole paste runs inside
one history group, so anything a `processCellFromClipboard` hook records
alongside the values (a format, through `recordUndo`) comes back with them
on a single Ctrl+Z.

`editOnSecondClick={false}` stops a click on the already-active cell from
opening its editor. On by default, as it has always been; a spreadsheet
turns it off, since Excel edits on double-click or F2 only and a user
clicking the cell they are on after a dialog would otherwise find the next
shortcut typed into an editor.
