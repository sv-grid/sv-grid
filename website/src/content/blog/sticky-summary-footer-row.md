---
title: A Sticky Summary / Footer Row in SvGrid
description: Show always-visible totals at the bottom of your data grid - column footers with sums and averages that stay pinned while rows scroll.
date: 2026-06-13
category: Rows
tags: footer, summary row, aggregation, rows, recipe
author: Victor Vidolov
---

A summary row - the totals and averages that stay pinned while the rows scroll past - is what turns a table into a report. SvGrid gives columns a `footer`, and paired with aggregation you get that pinned summary for almost no code. Here is the recipe, including the bit everyone gets wrong about filtered totals.

![Group footers and totals in SvGrid](/blog-media/grouping.png)
*Aggregated footers and totals in SvGrid.*

## Column footers

Each column can declare a `footer`, rendered in a pinned footer row beneath the body:

```ts
const columns: ColumnDef<{}, Row>[] = [
  { field: 'product', header: 'Product', footer: 'Total' },
  { field: 'units', header: 'Units', footer: (ctx) => sum(ctx, 'units') },
  { field: 'revenue', header: 'Revenue', format: { type: 'currency', currency: 'USD' },
    footer: (ctx) => fmtUsd(sum(ctx, 'revenue')) },
]
```

The footer stays visible while rows scroll, so the totals are always on screen.

## Use aggregation for grouped totals

If you are grouping, the same aggregation that powers group footers can feed the grand total. Set `aggregate: 'sum'` (or `avg`, `min`, `max`, `count`) on the column and each group rolls up; the footer shows the overall figure. See [grouping and aggregation](grouping-and-aggregation).

## Totals over the filtered set

The number users expect is the total of what they are *looking at*, the filtered rows, not the entire dataset. Compute footer values from the grid's current (post-filter) rows so the summary updates as filters change. A sum that ignores the active filter is a common and confusing bug.

## Server-side totals

When data lives on the server, the visible page is not the whole story. Return aggregate totals from your API alongside the page and render them in the footer, so "Total revenue" reflects all matching rows, not just the 50 on screen.

## Frequently asked questions

### How do I add a totals row to a Svelte data grid?

Set a `footer` on each column, a static label or a function that computes a sum/average from the current rows. SvGrid renders a pinned footer row that stays visible while the body scrolls.

### Should the summary reflect filters?

Yes. Compute footer totals from the grid's filtered rows so the summary matches what the user sees. For server-side data, return aggregate totals from your API so the footer covers all matching rows, not just the current page.
