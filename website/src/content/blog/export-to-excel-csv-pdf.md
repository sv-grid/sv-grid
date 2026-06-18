---
title: Export a Svelte Data Grid to Excel, CSV, and PDF
description: Let users download grid data as XLSX, CSV, or PDF with @svgrid/enterprise, respecting the current sort, filter, and selection.
date: 2026-02-10
category: Export
tags: export, excel, csv, pdf, svelte data grid
author: Kamelia M
---

"Can I get this in Excel?" is, hands down, the most common thing anyone asks of a data grid. The `@svgrid/enterprise` pack answers it: export to Excel (XLSX), CSV, TSV, HTML, and PDF, plus printing, and crucially it exports what is on screen, honoring the current sort, filter, and selection rather than dumping the raw data.

![Exporting a SvGrid grid to Excel and PDF](/blog-media/export.png)
*Exporting a SvGrid grid (@svgrid/enterprise) to Excel, PDF, and more.*

## Export formats

- **XLSX**: a real Excel workbook with typed cells and formatting.
- **CSV / TSV**: portable text for any spreadsheet or data pipeline.
- **HTML**: a styled table you can email or embed.
- **PDF**: a print-ready document.

## A simple export button

```svelte
<script lang="ts">
  import { SvGrid } from '@svgrid/enterprise'
  let api

  function exportExcel() {
    api.exportData({ format: 'xlsx', fileName: 'report.xlsx' })
  }
</script>

<button onclick={exportExcel}>Export to Excel</button>
<SvGrid data={rows} columns={columns} bind:api />
```

The export reads the grid's current view, so a user who filtered to "active" customers and sorted by revenue gets exactly those rows in that order.

## Export selection only

A frequent need is exporting just the selected rows. Combine row selection with the export call so a user can tick a handful of records and download only those, useful for sharing a subset without leaking the whole dataset.

## Respect formatting

Export uses your column formatters, so a currency column lands in Excel as a properly formatted number, and a date column as a date, not as a raw ISO string. That means the exported file looks like the grid, which is what users expect.

## Printing

The same Enterprise pack adds a print view that lays the grid out for paper - repeating headers, page breaks, and a clean monochrome style - so "File > Print" produces something usable instead of a clipped screenshot.
