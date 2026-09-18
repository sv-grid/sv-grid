---
"@svgrid/enterprise": minor
---

Sheet tabs: Hide, Unhide and Duplicate on the tab menu, and Delete asks
first when the sheet holds anything.

A hidden sheet keeps its cells and every reference to it, Ctrl+PageUp and
PageDown step over it, and the flag rides in the document as
`sheetHidden`. `wb.copySheet(from, to?)` copies a sheet's cells into a new
sheet named "Name (2)" and `doc.duplicate(name)` carries formats, sizes,
hidden lines, panes, comments, merges, rules and the filter across with
it. The strip takes `hidden`, `onHide`, `onUnhide` and `onDuplicate`;
`setWorkbook` takes a third argument naming the hidden sheets for the
keys.
