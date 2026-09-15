---
"@svgrid/enterprise": minor
---

Spreadsheet shell: View > Show and a polish pass over the new dialogs.

- View > Show carries Excel's Gridlines, Formula Bar and Headings toggles
  (`toggle-gridlines`, `toggle-formula-bar`, `toggle-headings`). They are
  view settings of the component, not of the document.
- Data bars measure from zero, as Excel's have since 2010: 10, 20 and 40
  draw a quarter, a half and the full width, so the smallest value keeps a
  bar. A range with negatives still runs from its minimum.
- The Data Validation, Highlight Cells / Top-Bottom and Rules Manager
  dialogs were wider than their modal and clipped their right edge (the
  Allow select, the "with" style, Stop If True). They size their modal now.
- A refused entry leaves the cursor on the cell that refused it, as Excel
  does; the grid's Enter had moved it one row down under the alert.
- Merge & Center lights while the active cell is merged, and the column
  letters of a merged selection are all shaded.
- The AutoFilter menu applies its search results, as Excel does: with a
  search typed, OK or Enter keeps the ticked matches and nothing else.
  Alt+Down on a header cell drops the menu; Enter applies the Data
  Validation dialog.
- The sheet-tab scroll arrows grey out until the strip has somewhere to
  scroll, as Excel's do; they looked live on a one-sheet workbook.
- The merge warning lost the status-bar band the shell's own style painted
  across its first line; the comment box says that Ctrl+Enter saves.
