---
title: Building a SaaS Billing and Usage Table in Svelte
description: A blueprint for a billing/usage grid - metered usage, currency and percentage formatting, grouped totals, and CSV/PDF export.
date: 2026-09-03
category: Use cases
tags: saas, billing, usage, use case, svelte data grid
author: Victor Vidolov
---

A SaaS billing or usage table shows customers what they consumed and what it costs. It lives or dies on correct formatting and trustworthy totals.

![A billing grid exported from SvGrid](/blog-media/export.png)
*A billing/usage grid, formatted, totalled, and exportable.*

## The columns

- **Item / metric**: the line (seats, API calls, storage).
- **Usage**: a number, often with a unit; consider a [progress bar](progress-bar-cells) against a quota.
- **Unit price** and **amount**, [currency columns](locale-aware-formatting) (`format: { type: 'currency' }`).
- **% of plan**: a [percent column](locale-aware-formatting).
- **Period**: a date or date range.

Formatting on the column (not in an accessor) keeps amounts sorting numerically and displaying consistently, critical when the numbers are money.

## Totals that must be right

Billing totals cannot be approximate. Use a [summary footer](sticky-summary-footer-row) with summed amounts, and [grouped subtotals](grouping-and-aggregation) per category (by product, by team). Compute totals over the filtered set so a filtered view shows the matching total, and beware the [average-of-averages trap](aggregation-functions-explained) for blended rates.

## Locale and currency

Bills go to a global audience. Use locale-aware currency formatting so the same amount renders correctly per region, and be explicit about the currency code. See [locale-aware formatting](locale-aware-formatting).

## Export

Finance teams want the numbers out: [CSV for spreadsheets, XLSX/PDF for statements](export-to-excel-csv-pdf). Export respects the current filters and your column formatters, so the exported invoice matches the screen, see [CSV vs XLSX vs TSV](csv-vs-xlsx-vs-tsv).

## Read-only, mostly

Unlike an inventory grid, billing is usually read-only, the numbers come from your metering system. Keep it that way; make it scannable and exportable rather than editable, and link out to the source for adjustments.
