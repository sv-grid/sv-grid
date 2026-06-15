---
title: Paste from Excel into a Svelte Data Grid
description: Let users paste a block of cells from Excel or Google Sheets into SvGrid - parsing tab-separated clipboard data and writing it into your rows.
date: 2026-08-24
category: Editing
tags: paste, clipboard, excel, editing, recipe
author: Kamelia M
---

Copying out is half the story; pasting in is what makes a grid feel like a spreadsheet for data entry. When a user copies cells from Excel and pastes into your grid, the clipboard holds tab-separated text. Parse it and write it into your rows. Here is the recipe.

![A spreadsheet-style SvGrid with a ribbon](/blog-media/spreadsheet.png)
*A spreadsheet-style SvGrid - paste tabular data straight in.*

## The clipboard format

Excel and Google Sheets put a TSV block on the clipboard: rows separated by newlines, cells by tabs. So pasting is: read the text, split it, and map it onto the target cells starting at the active cell.

```ts
function parseClipboard(text: string): string[][] {
  return text.replace(/\r/g, '').split('\n').filter(Boolean).map((line) => line.split('\t'))
}
```

## Handle the paste

Listen for paste on the grid, parse the matrix, and write it into your `data` from the active cell down and to the right:

```svelte
<script lang="ts">
  function onPaste(e: ClipboardEvent, startRow: number, startCol: number, cols: string[]) {
    const matrix = parseClipboard(e.clipboardData?.getData('text/plain') ?? '')
    matrix.forEach((line, r) => {
      const row = rows[startRow + r]
      if (!row) return
      const next = { ...row }
      line.forEach((val, c) => {
        const field = cols[startCol + c]
        if (field) next[field] = coerce(field, val)
      })
      rows[startRow + r] = next
    })
    rows = [...rows]
    e.preventDefault()
  }
</script>
```

Coerce values to the column's type (numbers, dates) as you write, so a pasted "42" becomes a number and the column keeps sorting numerically.

## Validate on paste

A paste can drop hundreds of values at once, so validate before committing: reject or flag cells that fail rules, and surface a summary ("3 of 40 cells invalid") rather than silently writing bad data. Reuse the same rules as your [inline editing validation](inline-editing-with-validation).

## Grow the grid if needed

If the pasted block is taller than the remaining rows, decide your policy: clip to existing rows, or append new rows for the overflow. Appending is what spreadsheet users expect when pasting into the last row.

## Frequently asked questions

### How do I let users paste Excel data into a Svelte grid?

Listen for the paste event, read `text/plain` from the clipboard, split it into a matrix by newlines and tabs, and write the values into your `data` starting at the active cell - coercing each to its column's type.

### How do I validate pasted data?

Run the same validation you use for inline editing as you write each pasted value, reject or flag invalid cells, and show a summary of how many failed instead of silently committing bad data.
