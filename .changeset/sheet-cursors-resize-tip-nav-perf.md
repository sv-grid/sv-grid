---
"@svgrid/enterprise": minor
---

Spreadsheet shell: Excel's cursors, the resize tip, and a faster cursor.

- The cells show Excel's white cross, a column letter a black arrow
  pointing down it, a row number a black arrow pointing along it, the
  corner the plain arrow; the borders, the fill handle and the selection
  border keep their double-headed, crosshair and move cursors.
- Dragging a column or row border shows Excel's tip beside the pointer:
  "Width: 8.43 (64 pixels)" or "Height: 15.00 (20 pixels)", live as the
  border moves, with a dotted guide across the sheet at the new edge.
  Dragging the fill handle shows what the cell under the pointer will get,
  in the source cell's number format; the Name Box reads "3R x 2C" while a
  range is dragged out.
- A column or row selected whole paints its letter or number in the
  accent, white on green as Excel's; a line the selection touches is
  tinted as before.
- A General cell shrinks a number to its column before it hashes, as
  Excel's does: decimals first, then scientific notation.
- The sheet-tab menu opens upward from the click, as Excel's does; it
  ran off the bottom of the window.
- The ribbon's Undo and Redo icons are Excel's curved arrows; they read as
  a refresh glyph.
- Moving the active cell no longer repaints the whole sheet. A selection
  change used to bump the document counter, so every cell re-derived its
  display, rules, hashes and spill width on each arrow key; the per-press
  work drops from about 70 ms to under 10 ms on a 40-row sheet. What
  follows the selection (the ribbon's toggles, the dialogs' headings, the
  status bar) reads the selection state directly.
- The resize tip follows the pointer at the frame rate. It was placed
  from the header's measured rect two frames after each move and drawn
  under the sticky header; it is now computed from the pointer's travel
  the moment it moves, on top of everything the sheet draws, and the
  cells read their column's width from one live map rather than asking
  the grid for every width on every repaint of every cell.
