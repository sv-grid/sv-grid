---
title: Spreadsheet-Style Cell Range Selection in SvGrid
description: Let users drag to select rectangular cell ranges, then copy, sum, or act on them - the spreadsheet interaction your Svelte grid needs.
date: 2026-01-20
category: Selection
tags: range selection, cell selection, spreadsheet, svelte data grid
author: Kamelia M
---

Spend a day next to a spreadsheet power user and you notice they think in ranges, not rows, drag a block, copy it, sum it, clear it, never touching the mouse menu. Cell range selection brings that muscle memory to your Svelte app.

![Spreadsheet-style cell range selection in SvGrid](/blog-media/range-selection.png)
*Drag-to-select cell ranges in SvGrid.*

## Enable range selection

```svelte
<SvGrid
  data={rows}
  columns={columns}
  selectionMode="cell"
  enableCellSelection={true}
/>
```

Users click and drag to select a rectangular range. Shift-click extends it; arrow keys with Shift grow or shrink it from the keyboard.

## Copy a range to the clipboard

A selected range copies as tab-separated values, so it pastes cleanly into Excel or Google Sheets with rows and columns intact. This is the interaction that makes a grid feel like a real data tool rather than a styled list.

## Combine cell and row selection

Set `selectionMode="both"` to allow checkbox row selection and range selection in the same grid. Users can tick whole rows for bulk actions and still drag a range of cells to copy, the two modes coexist.

```svelte
<SvGrid
  data={rows}
  columns={columns}
  selectionMode="both"
  showRowSelection={true}
  enableCellSelection={true}
/>
```

## Show a live aggregate

A nice touch borrowed from spreadsheets: show the sum, average, and count of the selected numeric cells in a status bar. Read the selected range, pull the values, and render the rollup in your own footer, so dragging across a column of numbers instantly shows their total.

## Keyboard-first ranges

Range selection is not mouse-only. With the active cell in place, holding Shift and pressing the arrow keys extends the selection, and Ctrl+C copies it. Keyboard users get the same range workflow as mouse users, which keeps the grid accessible.
