---
title: Grouping and Aggregation in a Svelte Data Grid
description: Group rows by a column and show sums, averages, and counts in footer summaries with SvGrid's columnGroupingFeature.
date: 2026-04-21
category: Grouping
tags: grouping, aggregation, summaries, svelte data grid
author: SvGrid Team
---

When a table has natural categories - region, status, owner - grouping turns a flat list into a collapsible summary. SvGrid's `columnGroupingFeature` groups rows by a column and shows aggregated footers per group.

## Turn on grouping

```svelte
<script lang="ts">
  import { SvGrid, tableFeatures, columnGroupingFeature } from 'sv-grid-community'
  const features = tableFeatures({ columnGroupingFeature })
</script>

<SvGrid data={rows} columns={columns} features={features} />
```

Group headers are collapsible, so users can drill into one category at a time without losing the overview.

## Aggregations that make sense per column

A grouped grid is only useful with the right summaries. Sum a revenue column, average a score, count rows in a status column. Define the aggregation on the column so each group footer rolls up its rows:

```ts
const columns = [
  { field: 'region',  header: 'Region' },
  { field: 'revenue', header: 'Revenue', format: { type: 'currency', currency: 'USD' }, aggregate: 'sum' },
  { field: 'score',   header: 'Score',   aggregate: 'avg' },
]
```

Common aggregations are `sum`, `avg`, `min`, `max`, and `count`. Because the formatter runs on the aggregated value, your group totals get the same currency or number formatting as the cells.

## Multi-level grouping

Group by more than one column to build a hierarchy - region, then status within region. Each level gets its own collapsible header and its own rolled-up footer, so a sales table becomes a pivotable summary without leaving the grid.

## Combine with sorting and filtering

Grouping composes with the other features. Filter first to narrow the set, then group the survivors; sort within groups to surface the biggest contributors. Register only the features you need:

```ts
const features = tableFeatures({
  columnGroupingFeature,
  rowSortingFeature,
  columnFilteringFeature,
})
```

## Frequently asked questions

### How do I group rows in a Svelte data grid?

Register `columnGroupingFeature` and group by a column. SvGrid renders collapsible group headers and aggregated footers.

### Can I show sums and averages per group?

Yes. Set an `aggregate` such as `sum` or `avg` on the column and SvGrid rolls up each group, applying your column formatter to the total.
