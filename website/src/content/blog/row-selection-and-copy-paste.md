---
title: Row Selection and Clipboard Copy-Paste in SvGrid
description: Add checkbox selection, range selection, and Excel-compatible copy-paste to your Svelte data grid.
date: 2026-03-24
category: Selection
tags: selection, copy paste, clipboard, svelte data grid
author: Boyko Markov
---

Selection is the doorway to every bulk action, pick some rows, then delete, export, or update them in one go. SvGrid does both checkbox row selection and click-and-drag cell ranges, and it copies in the tab-separated format Excel and Google Sheets already understand, so paste just works.

![Row and range selection in SvGrid](/blog-media/selection.png)
*Row and range selection with clipboard copy in SvGrid.*

## Checkbox row selection

```svelte
<SvGrid
  data={rows}
  columns={columns}
  features={features}
  selectionMode="row"
  showRowSelection={true}
  onRowSelectionChange={(state, selectedRows) => (selected = selectedRows)}
/>
```

A checkbox column appears. Click to select, Shift-click to extend a range, Ctrl-click to toggle individual rows. The callback hands you the selected row objects, ready for a bulk action.

## Cell range selection

For spreadsheet-style workflows, enable cell selection. Users drag across cells to select a rectangular range:

```svelte
<SvGrid
  data={rows}
  columns={columns}
  selectionMode="cell"
  enableCellSelection={true}
/>
```

Set `selectionMode="both"` to allow row checkboxes and range selection together.

## Copy that pastes cleanly into Excel

When a user copies a selected range, SvGrid writes tab-separated values to the clipboard, the exact format spreadsheets understand. Paste into Excel or Google Sheets and the columns line up. This is the small detail that makes a data grid feel professional.

## Drive bulk actions from selection

Selection is only useful if it leads somewhere. Wire the selected rows to a toolbar:

```svelte
{#if selected.length}
  <div class="bulk-bar">
    {selected.length} selected
    <button onclick={() => archive(selected)}>Archive</button>
    <button onclick={() => exportRows(selected)}>Export</button>
  </div>
{/if}
```

## Select-all and indeterminate state

The header checkbox selects every row on the current page and shows an indeterminate state when only some rows are selected, the behavior users expect from email and file apps. You get it without extra code.
