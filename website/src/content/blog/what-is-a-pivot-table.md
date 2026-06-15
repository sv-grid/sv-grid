---
title: What Is a Pivot Table?
description: A plain-language explanation of pivot tables - rows, columns, and aggregated values - and how they turn flat data into a cross-tab summary.
date: 2026-09-21
category: Concepts
tags: pivot table, aggregation, concepts, data grid
author: Kamelia M
---

"Pivot table" sounds like spreadsheet jargon, but the idea is simple and powerful: reshape a flat list into a summary grouped two ways at once. Here is a clear, plain-language explanation.

![A pivot table in SvGrid](/blog-media/pivot.png)
*A pivot table: rows, columns, and aggregated values.*

## The core idea

A flat table has one row per record - one row per order, say. A pivot table summarizes those records across two dimensions at the same time, with aggregated numbers in the cells. "Revenue by region (down) and quarter (across)" is a pivot.

It is defined by three choices:

- **Rows** - the categories down the side (region, product).
- **Columns** - the categories across the top (quarter, status).
- **Values** - the numbers in the cells, with an aggregation (sum of revenue, count of orders).

## A concrete example

Flat data: thousands of orders, each with a region, a quarter, and an amount.

Pivot: regions down the left, quarters across the top, and each cell is the summed revenue for that region-and-quarter. Add row and column totals and you can read the whole business at a glance - which a flat list of thousands of orders never lets you do.

## Pivot vs grouping

Grouping summarizes along one dimension (revenue per region). A pivot summarizes along two at once (revenue per region per quarter). A pivot is, loosely, grouping by rows and columns simultaneously, with aggregated values where they intersect. See [aggregation functions](aggregation-functions-explained).

## Why do it in the app

Traditionally you export to a spreadsheet to pivot. Doing it in your app keeps the analysis next to the data: it updates live as records change, respects the filters already applied, and needs no download or separate tool. In SvGrid, pivot tables are part of the [sv-grid-pro](pivot-tables) pack.

## When you do not need one

If you only summarize along one axis, grouping with aggregation is simpler and enough. Reach for a pivot when the question is genuinely two-dimensional ("by X and by Y").

## Frequently asked questions

### What is a pivot table in simple terms?

It is a summary that groups flat data two ways at once - categories down the side and across the top - with aggregated numbers (like summed revenue) in each cell. It turns a long list of records into a readable cross-tab.

### What is the difference between a pivot table and grouping?

Grouping summarizes along one dimension (totals per region). A pivot summarizes along two dimensions simultaneously (totals per region per quarter), placing an aggregated value at each intersection.
