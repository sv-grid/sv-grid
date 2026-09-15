---
"@svgrid/enterprise": minor
---

Cell comments in the spreadsheet shell: Review > Comments, Shift+F2 and
the cell menu.

Excel's notes: a text on a cell, marked by a red corner and read by
hovering the cell. New Comment opens the note box beside the active cell
(Edit Comment when there is one); Ctrl+Enter or Save closes it, and so does
Escape or a click elsewhere, keeping what was typed, as Excel keeps a note.
Delete removes it, Previous and Next walk the sheet's comments and wrap,
Show All Comments lists them under the formula bar with a jump to each.
Every change is one undo. Comments are per sheet, move with an insert or
delete, ride in `getState()` as `comments` and report `comments` on
`onChange`. `commentAt`, `withComment`, `listComments` and `nextComment`
are exported from `@svgrid/enterprise/sheet`. There are no threads or
authors: one text per cell.
