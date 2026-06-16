---
title: Migrating from Kendo UI Grid to a Svelte Data Grid
description: Move a Kendo UI Grid to SvGrid in Svelte 5 - mapping columns, data sources, server operations, and editing to a native, MIT-core grid.
date: 2026-08-15
category: Comparisons
tags: migration, kendo grid, comparison, svelte data grid
author: Boyko Markov
---

Kendo UI Grid is a mature commercial grid, typically used via jQuery or a framework wrapper. Moving to SvGrid gives you a native Svelte 5 component with an MIT-licensed core. The data and column concepts translate directly.

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

## Frequently asked questions

### How do I replace Kendo UI Grid in Svelte?

Map `columns` directly (`title` to `header`, `format` to the `format` option, `editor` to `editorType`), replace the Kendo `DataSource` with a plain `data` array or SvGrid's external mode for server operations, and use the free MIT core plus Enterprise for export.

### Does SvGrid have Excel and PDF export like Kendo?

Yes, in the @svgrid/enterprise pack, which adds Excel, PDF, CSV, TSV, and HTML export plus print and pivot. The core covers sorting, filtering, grouping, virtualization, and editing.
