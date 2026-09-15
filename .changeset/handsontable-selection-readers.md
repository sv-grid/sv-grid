---
"@svgrid/grid": minor
---

`getSelectedLast()`, `getSelectedRange()`, `getSelectedRangeLast()`: Handsontable's selection readers.

`api.getSelected()` was already there, though the Handsontable migration
guide said otherwise (it told readers to combine two callbacks instead; the
row is corrected). What was missing was the rest of that family, and the
orientation: `getSelected()` normalises every rectangle to its top-left and
bottom-right corners, which is the right thing for a loop but loses where
the selection started.

- `getSelectedLast()` returns the most recent rectangle as `[startRow,
  startCol, endRow, endCol]` with the orientation kept, so a range dragged
  upwards has `startRow > endRow`, exactly as Handsontable reports it.
- `getSelectedRange()` and `getSelectedRangeLast()` return `{ from, to,
  highlight }` per rectangle, the three fields of Handsontable's `CellRange`,
  as plain data. `highlight` is the active cell inside that rectangle.
- All three return `undefined` when nothing is selected, as Handsontable's
  do; `getSelected()` keeps returning `[]` so `getSelected()[0]` never throws.
  With cell selection off (`selectable={false}`) that is what every reader
  says, whatever cell has focus: the focused cell is `getActiveCell()`.
