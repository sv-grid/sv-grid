---
title: Multi-Level (Grouped) Column Headers in SvGrid
description: Organize wide grids with grouped, multi-row column headers - nesting child columns under a shared header band.
date: 2026-08-20
category: Columns
tags: column groups, headers, columns, recipe, svelte data grid
author: Victor Vidolov
---

Once a grid has clusters of related columns - the four quarters under a year, several metrics under a category - a flat header row stops helping. Grouped headers add a second row that bands those columns together, and SvGrid does it natively: a column definition can simply contain child columns.

![Multi-level grouped column headers in SvGrid](/blog-media/columns-hierarchy.png)
*Grouped, multi-level column headers in SvGrid.*

## Nest columns

Give a column a `columns` array of children, and SvGrid renders a spanning parent header above them:

```ts
const columns: ColumnDef<{}, Row>[] = [
  { field: 'name', header: 'Name' },
  {
    header: '2026',
    columns: [
      { field: 'q1', header: 'Q1', format: { type: 'currency', currency: 'USD' } },
      { field: 'q2', header: 'Q2', format: { type: 'currency', currency: 'USD' } },
      { field: 'q3', header: 'Q3', format: { type: 'currency', currency: 'USD' } },
      { field: 'q4', header: 'Q4', format: { type: 'currency', currency: 'USD' } },
    ],
  },
]
```

The "2026" band spans Q1-Q4, and the leaf columns behave normally, sortable, filterable, formatted.

## Nest deeper if needed

Children can themselves have children, so you can build three or more header levels (Year > Half > Quarter). Keep it shallow in practice, two levels read well; four become a puzzle.

## Combine with pinning and grouping

Grouped headers pair naturally with [pinned columns](pinned-frozen-columns) (freeze the identity column, group the scrollable metrics) and with [grouping and aggregation](grouping-and-aggregation) for grouped totals beneath grouped headers.

## When to use grouped headers vs separate tables

Reach for grouped headers when columns share a clear parent dimension. If two groups are conceptually separate datasets, two grids (or a master-detail layout) often read better than one very wide grid with many header bands.
