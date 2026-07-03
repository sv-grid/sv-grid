---
title: CSV vs XLSX vs TSV - Which Export Format?
description: A practical breakdown of CSV, XLSX, and TSV for data grid exports - when each format earns its keep, what each one silently loses, and how to wire all three in SvGrid.
date: 2026-07-18
updated: "2026-07-02"
category: Concepts
tags: export, csv, xlsx, tsv, concepts
author: Victor Vidolov
---

Picking an export format feels like a solved problem until you get a support ticket that says "the numbers in your CSV export are wrong" and you realize the user is in Germany, where Excel interprets commas as decimal separators. That one support ticket is worth more than any feature comparison table.

![Exporting a SvGrid grid to Excel, PDF, and more.](/blog-media/export.png)
*Exporting a SvGrid grid to Excel, PDF, and more.*

Here is the honest breakdown of all three formats, what each one silently drops, and a working SvGrid setup that lets users pick what they need.

## What each format actually preserves

The formats differ not in what they store, but in what they throw away.

**CSV** keeps the raw values and nothing else. A price column formatted as `$1,234.00` becomes the string `"$1,234.00"` or possibly `1234` depending on whether you strip the formatter first. There are no column types in the file itself. A downstream script parsing your CSV has to guess whether `42` is a number, a product code, or a postal code. Every value is text.

**TSV** is identical to CSV in every meaningful way except the delimiter. Tabs replace commas. The benefit is narrow but real: tab characters almost never appear inside cell values, so the quoting mess that makes CSV parsers fragile mostly goes away. That is why your browser and Excel both use TSV for clipboard copy-paste. It is the format you get when you select a range in Excel and hit Ctrl+C.

**XLSX** is the only one that actually preserves types. A number is stored as a number, a date as a date serial, a boolean as a boolean. The file is a zip archive containing XML, which makes it unreadable without a library but means the output can include column formatting, multiple sheets, frozen rows, and even formulas. When a user opens an XLSX export in Excel, it looks like a spreadsheet, not a dump of raw text.

The quick summary: CSV and TSV are for machines and pipelines; XLSX is for humans opening things in Excel.

## The encoding problem nobody warns you about

CSV and TSV will silently mangle non-ASCII text unless you add a UTF-8 BOM (byte-order mark) to the start of the file. Excel on Windows uses the BOM to decide which encoding to use. Without it, accented characters, Japanese, Arabic, anything outside plain ASCII renders as garbage.

The fix is a single line - prepend `﻿` before the CSV string before turning it into a Blob. Easy to miss, expensive when a customer in France or Japan reports broken exports.

```ts
function downloadCSV(filename: string, csvString: string) {
  // ﻿ is the UTF-8 BOM - without this, Excel mangles non-ASCII on Windows
  const blob = new Blob(['﻿' + csvString, { type: 'text/csv;charset=utf-8;' }])
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
```

The same BOM trick applies to TSV. XLSX sidesteps the issue entirely because the format specifies UTF-8 in the XML declaration.

## Wiring export in SvGrid

SvGrid's enterprise package exposes `exportToCSV`, `exportToXLSX`, and `exportToTSV` on the grid API, and they apply your column formatters automatically so the exported values match what the user sees in the grid - not the raw underlying data.

Here is a complete export toolbar wired to the grid API:

```svelte
<script lang="ts">
  import SvGrid from '@svgrid/grid'
  import type { SvGridApi, ColumnDef } from '@svgrid/grid'

  let api: SvGridApi | undefined = $state()

  const columns: ColumnDef[] = [
    { id: 'id',       field: 'id',       header: 'ID',       width: 60 },
    { id: 'name',     field: 'name',     header: 'Name',     width: 200 },
    { id: 'price',    field: 'price',    header: 'Price',    width: 110, type: 'number',
      format: (v) => `$${Number(v).toFixed(2)}` },
    { id: 'quantity', field: 'quantity', header: 'Qty',      width: 80,  type: 'number' },
    { id: 'category', field: 'category', header: 'Category', width: 130 },
    { id: 'inStock',  field: 'inStock',  header: 'In Stock', width: 90,  type: 'boolean',
      format: (v) => v ? 'Yes' : 'No' },
  ]

  const data = $state([
    { id: 1, name: 'Widget A', price: 29.99, quantity: 120, category: 'Parts', inStock: true },
    { id: 2, name: 'Widget B', price: 9.49,  quantity: 0,   category: 'Parts', inStock: false },
    { id: 3, name: 'Gadget X', price: 149.0, quantity: 35,  category: 'Electronics', inStock: true },
  ])

  function exportCSV()  { api?.exportToCSV('export.csv')  }
  function exportTSV()  { api?.exportToTSV('export.tsv')  }
  function exportXLSX() { api?.exportToXLSX('export.xlsx') }
</script>

<div class="toolbar">
  <button onclick={exportCSV}>CSV</button>
  <button onclick={exportTSV}>TSV</button>
  <button onclick={exportXLSX}>Excel</button>
</div>

<SvGrid
  {data}
  {columns}
  sortable
  filterable
  onApiReady={(a) => { api = a }}
/>
```

A few things worth knowing about how this works: the `format` function on the price column controls both how the cell renders and what ends up in CSV and TSV exports. For XLSX, SvGrid uses the raw numeric value and applies an Excel number format string so the cell is truly a number in Excel, not a string that looks like a number. That distinction matters when users try to SUM a column after export.

## When your export should only include visible rows

By default, `exportToCSV` exports everything in the dataset. If the user has filtered the grid down to 50 rows, they probably want 50 rows in the file, not 10,000.

```ts
// Export only what the user currently sees (respects filters, sort, and grouping)
function exportVisible() {
  const rows = api?.getDisplayedRows() ?? []
  const headers = columns
    .filter(col => col.field)
    .map(col => col.header ?? col.field)
    .join(',')

  const lines = rows.map(row =>
    columns
      .filter(col => col.field)
      .map(col => {
        const raw = row[col.field as string]
        const val = col.format ? col.format(raw, row) : String(raw ?? '')
        // Escape values containing commas, quotes, or newlines
        return /[,"\n]/.test(val) ? `"${val.replace(/"/g, '""')}"` : val
      })
      .join(',')
  )

  const csv = [headers, ...lines].join('\n')
  downloadCSV('filtered-export.csv', csv)
}
```

The built-in `exportToCSV` on SvGrid's API does this automatically when you pass `{ visibleOnly: true }`. The manual version above is useful when you need tighter control over which columns appear or how values are serialized.

## Which format to actually offer

The formats are cheap to add. Most production grids end up shipping all three because different users have different downstream tools:

| Who is downloading | Best format |
|---|---|
| A developer who will re-import it | CSV |
| A data analyst running scripts | CSV or TSV |
| A manager opening it in Excel | XLSX |
| A user copying a range to paste into Sheets | TSV (or let the grid handle clipboard natively) |

My default recommendation: ship CSV and XLSX. Add TSV if you have power users who mention pipelines. Skip PDF unless you have a real reporting requirement - it is a one-way door and adds significant bundle weight.

The one format to avoid for anything data-related is PDF. It looks good in a browser and becomes useless the moment someone tries to copy a column of numbers out of it.

## The locale trap

One more practical issue: if your users are outside North America, CSV becomes risky because many European locales use a comma as the decimal separator. A price of `1,234.50` in a German locale becomes genuinely ambiguous in a CSV file. Some exporters solve this by switching the delimiter to semicolons when the user locale is detected as comma-decimal. XLSX sidesteps this entirely because numbers are stored as true numerics in the XML.

TSV also sidesteps it. Another quiet advantage of the lesser-used format.

If you export CSV and you know your users might be in locales with comma decimals, either use semicolon as the delimiter or switch to XLSX by default for anything numerical.
