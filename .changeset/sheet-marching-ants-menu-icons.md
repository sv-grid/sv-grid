---
"@svgrid/enterprise": minor
---

Spreadsheet shell: marching ants, icons on the cell menu, and the ribbon's Copy and Cut fixed.

- Ctrl+C and Ctrl+X outline the block they took with Excel's marching
  ants: a walking dashed line on the cells at the block's edges, so a
  block half scrolled out of view shows the part of the outline in view.
  They go on Escape, a typed entry, a structural edit, the paste of a cut
  or the next copy; a paste of a copy keeps them so the block can be
  pasted again. Off under `prefers-reduced-motion`.
- The cell, column and row menus carry the ribbon's icons: Cut, Copy,
  Paste, Paste Special, Insert, Delete, Clear Contents, Clear Formats,
  Merge & Center, Unmerge, the comment entries, Format Cells, Column
  Width, Row Height, Hide and Unhide (five glyphs are new to the set).
- The ribbon's Copy and Cut buttons copied the whole sheet: they went
  through the api's `copyToClipboard`, which exports the displayed rows
  with their column letters, whatever was selected, and Cut then blanked
  the selection by hand. Both now run the selection copy and cut that
  Ctrl+C and Ctrl+X run (`cmd.copy()`, `cmd.cut()`), so the sheet's own
  clipboard block, the formulas it carries and the ants follow.
