---
title: Migrating from Kendo UI Grid to a Svelte Data Grid
description: Move a Kendo UI Grid to SvGrid in Svelte 5 - mapping columns, data sources, server operations, and editing to a native, MIT-core grid.
date: 2026-08-15
category: Comparisons
tags: migration, kendo grid, comparison, svelte data grid
author: Boyko Markov
---

Kendo UI Grid is mature and capable, and it is also commercial and usually reached through jQuery or a framework wrapper. Moving to SvGrid trades that for a native Svelte 5 component on an MIT-licensed core. The good news for the migration: the data and column concepts line up almost directly.

## Concept mapping

| Kendo UI Grid | SvGrid |
| --- | --- |
| `dataSource` (kendo.data.DataSource) | `data` (array) or external mode |
| `columns: [{ field, title }]` | `columns: [{ field, header }]` |
| `template` / `format` | `cell` / `format` |
| `editor` + `editable` | `editorType` + `enableInlineEditing` |
| `sortable` / `filterable` | `rowSortingFeature` / `columnFilteringFeature` |
| `pageable` | `rowPaginationFeature` |
| `group` | `columnGroupingFeature` |
| `serverPaging` / `serverSorting` | external mode |
| Excel/PDF export | @svgrid/enterprise |

## DataSource to data

Kendo's `DataSource` abstracts transport, paging, and sorting. In SvGrid, in-memory data is just an array; server-driven data uses external mode where you own the fetch:

```svelte
<SvGrid
  data={pageRows} columns={columns} features={features}
  showPagination rowCount={total}
  onSortingChange={(s) => load({ sort: s })}
  onFiltersChange={(f) => load({ filters: f.columns })}
  onPaginationChange={(p) => load({ page: p.pageIndex })}
/>
```

## Columns and editing

```ts
// Kendo
columns: [{ field: 'name', title: 'Name' }, { field: 'salary', format: '{0:c}', editor: numericEditor }]

// SvGrid
const columns: ColumnDef<{}, Row>[] = [
  { field: 'name', header: 'Name' },
  { field: 'salary', header: 'Salary', format: { type: 'currency', currency: 'USD' }, editorType: 'number' },
]
```

## Licensing and exports

Kendo is a commercial suite; SvGrid's core is MIT-licensed and free for commercial use, with export, import, and pivot in the optional Enterprise pack. See [pricing](/pricing).
