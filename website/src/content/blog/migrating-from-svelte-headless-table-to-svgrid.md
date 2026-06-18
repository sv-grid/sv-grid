---
title: Migrating from svelte-headless-table to SvGrid
description: Move from svelte-headless-table's store-and-plugin model to SvGrid's runes-native engine and render component, with a clear concept mapping.
date: 2026-08-16
category: Comparisons
tags: migration, svelte-headless-table, comparison, svelte data grid
author: Victor Vidolov
---

svelte-headless-table did Svelte-native headless tables right for the store era, plugins, a clean view model, the works. Moving to SvGrid swaps the stores-and-`<Subscribe>` model for runes, and throws in a ready-made render component and virtualization you would otherwise build yourself.

![Group aggregators in SvGrid.](/blog-media/group-aggregators.png)
*Group aggregators in SvGrid.*

## Concept mapping

| svelte-headless-table | SvGrid |
| --- | --- |
| `createTable(data, plugins)` | `createSvGrid(...)` or `<SvGrid>` |
| `table.createColumns(...)` | `columns` array |
| `table.column({ accessor, header })` | `{ field/accessorFn, header }` |
| `addSortBy()` plugin | `rowSortingFeature` |
| `addColumnFilters()` plugin | `columnFilteringFeature` |
| `addPagination()` plugin | `rowPaginationFeature` |
| `addGroupBy()` plugin | `columnGroupingFeature` |
| `addSelectedRows()` plugin | `rowSelectionFeature` |
| `<Subscribe>` + stores | runes (`$state` / `$derived`) |

## Columns

```ts
// svelte-headless-table
const columns = table.createColumns([
  table.column({ header: 'Name', accessor: 'name' }),
  table.column({ header: 'Full', accessor: r => `${r.first} ${r.last}`, id: 'full' }),
])

// SvGrid
const columns: ColumnDef<{}, Row>[] = [
  { field: 'name', header: 'Name' },
  { id: 'full', header: 'Full', accessorFn: r => `${r.first} ${r.last}` },
]
```

## Plugins to features

Both libraries are composable. Where you registered plugins, you now register features:

```ts
const features = tableFeatures({
  rowSortingFeature, columnFilteringFeature, rowPaginationFeature,
})
```

## Stores to runes, Subscribe to markup

svelte-headless-table renders via `<Subscribe>` and header/cell stores. With SvGrid you either let `<SvGrid>` render the table, or use `createSvGrid` and read its reactive row model directly, no `.subscribe` ceremony, because runes are reactive by default.

## What you gain

- Built-in row and column virtualization for large datasets.
- A complete render component with Excel-style filters, inline editing, and selection if you want them.
- Svelte 5 runes throughout.
