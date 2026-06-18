---
title: Copy a Cell Range to the Clipboard in SvGrid
description: Copy a selected range as tab-separated values that paste cleanly into Excel and Google Sheets - plus copying with headers and programmatic copy.
date: 2026-07-16
category: Selection
tags: clipboard, copy, cell range, selection, recipe
author: Boyko Markov
---

Select a block of cells, hit copy, paste into a spreadsheet, users do it without thinking, and they notice immediately when it does not work. SvGrid's cell range selection makes it work, and the detail that decides whether paste lands in neat columns is the clipboard *format*: tab-separated values.

![Spreadsheet-style cell range selection in SvGrid.](/blog-media/range-selection.png)
*Spreadsheet-style cell range selection in SvGrid.*

## Enable range selection and copy

Turn on cell selection; selecting a range and pressing Ctrl/Cmd+C copies it as TSV:

```svelte
<SvGrid data={rows} columns={columns} selectionMode="cell" enableCellSelection={true} />
```

The copied payload is rows of values joined by tabs, lines joined by newlines, the exact format spreadsheets parse, so a paste lands in aligned columns. See [cell range selection](cell-range-selection) for the selection UX.

## Why tab-separated

The clipboard can hold multiple formats, but TSV (`text/plain` with tabs) is the lingua franca every spreadsheet understands. CSV is riskier because commas appear inside values; tabs rarely do. That is why grids - and Excel itself - use tabs for clipboard transfer.

## Copy with headers

A common need is including the column headers so the pasted block is self-describing. Build the payload yourself from the selected range when you want headers:

```ts
function copyWithHeaders(range: { rows: Row[]; cols: string[] }) {
  const header = range.cols.join('\t')
  const body = range.rows.map((r) => range.cols.map((c) => r[c]).join('\t')).join('\n')
  navigator.clipboard.writeText(`${header}\n${body}`)
}
```

Wire it to a toolbar button or a "Copy with headers" context-menu item.

## Programmatic copy

Beyond the keyboard shortcut, you can copy on demand, a "Copy" button, copy the whole filtered set, or copy a single column. The pattern is the same: assemble TSV and call `navigator.clipboard.writeText`. Note the Clipboard API requires a secure context (HTTPS or localhost) and a user gesture.

## Copy the value, not the markup

Copy the underlying values, not rendered HTML, a badge cell should copy "Active", not its `<span>`. Because SvGrid keeps the raw value, the default copy already does this; preserve that when you build custom copy logic.
