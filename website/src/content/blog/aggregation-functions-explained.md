---
title: Aggregation Functions Explained (Sum, Avg, Min, Max, Count)
description: What grid aggregations do, when to use each, and the gotchas - filtered totals, weighted averages, and server-side aggregation.
date: 2026-07-02
category: Concepts
tags: aggregation, grouping, concepts, data grid
author: Kamelia M
---

Aggregations are how a pile of rows becomes an answer: total revenue, average score, how many orders this quarter. In a grid they drive the group footers and the summary row. The functions themselves are simple; the ways they go subtly wrong are where this post earns its place.

## The common aggregations

- **Sum**: total of a numeric column. Revenue, units, hours.
- **Average (avg)**: the mean. Score, rating, response time.
- **Min / Max**: smallest and largest. Earliest date, highest price.
- **Count**: how many rows. Orders, tickets, items in a group.

In SvGrid you declare one on a column and it rolls up per group and in the footer:

```ts
{ field: 'revenue', header: 'Revenue', aggregate: 'sum', format: { type: 'currency', currency: 'USD' } }
```

See [grouping and aggregation](grouping-and-aggregation) and [summary footer row](sticky-summary-footer-row).

## The gotchas

**Aggregate the filtered set.** The number users expect is the total of what they see. A sum that ignores the active filter (totalling all data while showing a filtered subset) is a classic, confusing bug. Compute aggregates over the current rows.

**Average of averages is wrong.** You cannot average per-group averages to get the overall average, that ignores group sizes. For a correct grand mean, sum the values and divide by the count, or use a weighted average.

**Count what you mean.** "Count" can mean rows, or non-empty values, or distinct values. Be explicit; distinct counts especially need their own logic.

## Server-side aggregation

When data lives on the server, the visible page is not the whole dataset, so you cannot compute true totals client-side. Return aggregates from your API alongside the page (a `SELECT SUM(...) ... GROUP BY` next to the paged query) so the footer reflects all matching rows, not just the 50 on screen. See [server-side data](server-side-data).

## Custom aggregations

Beyond the built-ins, real reporting needs custom rollups: weighted average, median, percentile, ratio. These you compute yourself over the group's rows and render in the footer, the built-ins cover the common 80%, custom logic the rest.

## Frequently asked questions

### What aggregation functions does a data grid support?

The common ones are sum, average, min, max, and count, declared per column and rolled up in group footers and the summary row. Custom aggregations (weighted average, median, percentile) you compute yourself over each group's rows.
