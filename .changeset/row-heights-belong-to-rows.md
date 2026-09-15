---
"@svgrid/grid": minor
---

Row heights belong to their rows; `api.getRowHeight` / `setRowHeight`; the fill handle undoes; a multiline text editor with Alt+Enter; `cmd.editor`.

A height dragged with `rowResize` was keyed by row index and thrown away
whenever the data changed, on the reasoning that index 3 is a different row
after a filter. In a spreadsheet the data changes on every keystroke, so a
row dragged taller snapped back the moment the next cell was typed. Heights
are keyed by row id now: the height follows its row through a sort or a
filter and survives the data being replaced, and a row that leaves the data
takes its height with it. `api.getRowHeight(rowIndex)` reads a row's height
(its own, else the declared one) and `api.setRowHeight(rowIndex, px | null)`
sets or clears it, with or without the grips; both are ignored under
`autoRowHeight`, where the content decides.

Dragging the fill handle wrote through the raw writer in a loop and recorded
nothing, so a drag over twenty rows was invisible to Ctrl+Z. It records one
grouped history entry for the cells it changed. An inline commit runs inside
one history group too, so what a consumer records from `onCellValueChange`
(a spreadsheet giving a typed `12%` its percent format) undoes with the
value.

`editorMultiline: true` on a text column renders the editor as a textarea
that grows a line per break: Alt+Enter inserts a line break, Enter still
commits. In a single-line editor Alt+Enter is just Enter, as before.

`cmd.editor` on the command context is the open inline editor's element, so
a shortcut registered for `editing: true` can read and rewrite the draft; a
sheet's F4 turns the reference at the caret through its anchorings with it.

The fill handle asks `processCellForFill` before its own pattern rules,
handing it the source value and how far the target sits from it; a
consumer returns the value to write or `undefined` to let the pattern
decide. The spreadsheet shell moves a formula's references by that
distance, which the pattern rules used to mangle: `=A1+B1` read as
"Item 1" and filled as `=A1+B2`. A lone number held as text (`'5'`)
repeats when filled, as a numeric 5 does, instead of counting 6, 7, 8.
Double-clicking the fill handle fills down as far as the column beside the
selection has data, as Excel's does.

`frozenRows={N}` freezes the first N rows: they stay under the header
while the body scrolls, and unlike `pinnedTopRows` they are the grid's own
rows, numbered, editable and selectable. Under `virtualization` the frozen
rows are always rendered and the window skips them; the virtualizer's
offsets stay in row-index space, so nothing downstream translates. The
band sits above pinned cells and below the header, `scroll-padding-top`
grows by its height so a row scrolled into view clears it, and
`api.setOption('frozenRows', n)` changes it at runtime.

The virtualized window and the plain full-list body used to carry a copy
each of the row markup, and the two had drifted: cell tooltips and the
visually-hidden validation message were on the plain path only, the fill
handle and its preview on the virtualized path only. One `bodyRow` snippet
renders both, and the frozen rows, so every row has all of it.

A column width dragged or double-clicked and a row height dragged are one
undo step each, recorded at the end of the gesture; `onColumnResize` and
`onRowResize` report them. The api's own setters record and report
nothing. Double-clicking a row's resize grip takes the row back to its
declared height (`onRowResize` with `height: null`), as double-clicking a
column's edge fits the column.

`api.openContextMenu(event, rowIndex, colIndex)` opens the `contextMenu`
at the pointer from an element of your own, which is how a spreadsheet's
column letters and row numbers offer the cell menu for what they select.
