---
"@svgrid/grid": minor
---

`GridCommandContext.focus()`, `paste()` and `recordUndo()`.

A toolbar button takes focus when it is clicked and a dialog takes it when
it opens, so the keystroke after either - `Ctrl+Z` to undo what the button
did, typing into the cell a dialog just changed - landed on the button or on
`<body>` rather than on the grid. A command that owns chrome calls
`cmd.focus()` once it is done; it focuses the grid root with
`preventScroll`, so a `scrollIntoView` the command just asked for is not
undone by the focus.

`paste()` pastes the system clipboard at the active cell the way Ctrl+V
does, one undo step, so a toolbar's Paste button can do what its label says.

Delete and Backspace over a selection, the context menu's Clear and Cut all
went through `clearSelectedCells`, which recorded nothing: the values were
gone and Ctrl+Z skipped past them to whatever edit came before. It now
records one grouped step per cleared cell, so a cleared block is one undo.

`recordUndo(undo, redo)` puts something that is not a cell write into the
grid's undo history - a format kept in the caller's own store, a structural
change the grid cannot see. Inside `batch` the step joins the batch, so a
command that writes cells and formats is still one Ctrl+Z. The history step
carries the two functions as `custom` and is never serialised.
