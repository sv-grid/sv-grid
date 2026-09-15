---
"@svgrid/grid": minor
---

Enter commits an edit and moves down a row; Shift+Enter moves up.

Enter on a cell that was being edited committed the value and left the
cursor on the same cell, so typing a column of numbers took an arrow key or
a click between every value. Every spreadsheet moves down on Enter, Tab
already moved right, and the accessibility page has said since it was
written that Enter while editing commits "and moves to the next row"; the
grid now does what the page says. At the last row the cursor stays where it
is, as it does at the last column for Tab. A shortcut registered with
`editing: true` still sees Enter first, so a sheet's Alt+Enter is untouched.
