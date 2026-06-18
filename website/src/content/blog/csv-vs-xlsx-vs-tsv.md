---
title: CSV vs XLSX vs TSV - Which Export Format?
description: The trade-offs between CSV, XLSX, and TSV when exporting grid data - encoding, types, formulas, and which to offer your users.
date: 2026-07-18
category: Concepts
tags: export, csv, xlsx, tsv, concepts
author: Victor Vidolov
---

The moment you add export to a grid, someone has to choose a format, and CSV, TSV, and XLSX each come with their own strengths and their own ways to bite you. Here is how to pick, and why the honest answer is often "offer more than one."

![Exporting a SvGrid grid to Excel, PDF, and more.](/blog-media/export.png)
*Exporting a SvGrid grid to Excel, PDF, and more.*

## CSV - universal, lossy

Comma-separated values: plain text, opens everywhere, tiny files.

- **Pros:** universal, human-readable, trivial to generate and parse, great for data pipelines and re-import.
- **Cons:** no types (everything is text), no formatting, and the comma is a landmine, values containing commas must be quoted, and locales that use commas as decimal separators cause chaos. Encoding (UTF-8 with BOM) matters for non-ASCII.

## TSV - CSV's safer cousin

Tab-separated values: same idea, tabs instead of commas.

- **Pros:** tabs rarely appear inside data, so quoting issues are far fewer. This is why it is the **clipboard** format, copy a range and it pastes into Excel cleanly. See [copy cell range](copy-cell-range-to-clipboard).
- **Cons:** still typeless and unformatted; less common as a download than CSV.

## XLSX - rich, heavier

A real Excel workbook (zipped XML).

- **Pros:** typed cells (numbers are numbers, dates are dates), formatting, multiple sheets, even formulas. The spreadsheet looks like your grid. Best for reports a human opens in Excel.
- **Cons:** larger files, needs a library to generate, not as friction-free for pipelines as plain text.

## Which to offer

| Use case | Format |
| --- | --- |
| Re-import / data pipeline | CSV |
| Clipboard copy-paste | TSV |
| A report a human opens in Excel | XLSX |
| Quick, universal download | CSV |

Many grids offer all three, they are cheap to add and different users want different things. SvGrid's [Enterprise export](export-to-excel-csv-pdf) covers XLSX, CSV, TSV, and HTML, applying your column formatters so the output matches the grid.

## The encoding footnote

For CSV/TSV with non-English text, export UTF-8 with a BOM, or Excel may mangle accented characters. It is the most common "my export looks broken" bug, and a one-line fix.

## Frequently asked questions

### Should I export grid data as CSV or XLSX?

Use CSV for re-import and data pipelines (universal, but typeless), and XLSX for reports a human opens in Excel (typed cells, formatting, multiple sheets). TSV is best for clipboard copy-paste because tabs rarely clash with data.

### Why does my CSV export show garbled characters in Excel?

Almost always an encoding issue. Export CSV as UTF-8 with a byte-order mark (BOM) so Excel reads accented and non-Latin characters correctly.
