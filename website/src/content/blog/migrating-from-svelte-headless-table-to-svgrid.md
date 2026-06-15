---
title: Migrating from svelte-headless-table to SvGrid
description: Move from svelte-headless-table's store-and-plugin model to SvGrid's runes-native engine and render component, with a clear concept mapping.
date: 2026-08-16
category: Comparisons
tags: migration, svelte-headless-table, comparison, svelte data grid
author: Victor Vidolov
---

svelte-headless-table is a Svelte-native headless table built on stores and a plugin system. If you are moving to SvGrid, you gain a Svelte-5 runes data flow, a ready-made render component, and built-in virtualization. Here is the mapping.

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

svelte-headless-table renders via `<Subscribe>` and header/cell stores. With SvGrid you either let `<SvGrid>` render the table, or use `createSvGrid` and read its reactive row model directly - no `.subscribe` ceremony, because runes are reactive by default.

## What you gain

- Built-in row and column virtualization for large datasets.
- A complete render component with Excel-style filters, inline editing, and selection if you want them.
- Svelte 5 runes throughout.

## Frequently asked questions

### Is SvGrid a drop-in for svelte-headless-table?

Not literally, but the concepts map directly: columns, plugins-to-features, and a headless core. The main change is moving from stores and `<Subscribe>` to Svelte 5 runes, plus the option to use a ready-made render component.

### Does SvGrid have a plugin system like svelte-headless-table?

It has a feature system - `tableFeatures({ ... })` - where you register only the capabilities you use (sorting, filtering, pagination, grouping, selection, expansion), which keeps the bundle small.
