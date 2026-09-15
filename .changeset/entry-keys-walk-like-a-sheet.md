---
"@svgrid/grid": minor
---

Enter and Tab step the way a sheet's data entry expects, and the active cell
stays at the anchor while a range grows.

**The Enter that ends a run of Tabs goes back to the run's first column.**
Typing across A1, B1 and C1 with Tab and pressing Enter left the cursor on
C2, so every record after the first started with three Shift+Tabs or a
click. The grid now remembers the column a run of Tabs began in and the
Enter that ends the run goes down from there, so the cursor lands on A2
ready for the next record. An arrow key, a click or any other move ends
the run; typing into the cell the cursor is on does not. Both the key on
the grid root and the commit from an editor step the same way.

**Enter and Tab stay inside a selected block.** With B2:C5 selected, Enter
walks down column B, wraps to the top of column C and comes back to B2
after C5; Tab walks along a row and wraps to the next; Shift reverses
either; and the block stays selected throughout, so a block can be filled
from the keyboard alone. Typing into the active cell of a block used to
collapse the block to that one cell, which made the walk impossible; an
edit now leaves a selection that already contains its cell standing.

**Shift+Enter no longer grows the range.** It shares the moveUp intent
with Shift+ArrowUp and was treated like the arrow, so a Shift+Enter to go
back up a column painted a selection behind the cursor. It reverses Enter
and nothing more, as in Excel.

**The active cell stays at the anchor.** A drag, a Shift+click or a
Shift+Arrow moved the active cell to the range's far corner, so a drag to
select B2:D5 followed by typing wrote into D5, and a formula bar showed D5.
The active cell now stays where the range started, the way Excel's does; the
next Shift+Arrow or Ctrl+Shift+Arrow continues from the far corner, which a
command reads as `selectionFocus` on its command context. A grid without
cell selection still moves the active cell on Shift+Arrow.

**Ctrl+Enter fills the block.** The entry goes into every editable cell of
the selected block through the ordinary commit, so each column's parser,
the history and `onCellValueChange` see every cell, the block is one undo,
and the cursor stays where it is. With one cell selected it is a commit that
does not move.

`getEntryStep` is exported for anyone who needs the same stepping outside
the grid's own handlers.
