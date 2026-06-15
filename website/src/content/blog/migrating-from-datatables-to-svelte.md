---
title: Migrating from DataTables.net to a Svelte Data Grid
description: Move a jQuery DataTables setup to SvGrid in Svelte 5 - replacing the jQuery plugin, ajax/serverSide config, and column definitions with a native grid.
date: 2026-08-12
category: Comparisons
tags: migration, datatables, jquery, comparison, svelte data grid
author: Victor Vidolov
---

DataTables.net has powered jQuery tables for years. Moving to Svelte means dropping jQuery entirely and adopting a reactive, component-based grid. The concepts carry over; the implementation gets simpler. Here is the path.

## Concept mapping

| DataTables.net | SvGrid |
| --- | --- |
| `$('#t').DataTable({...})` | `<SvGrid ... />` |
| `data` / `ajax` | `data` (in-memory or fetched) |
| `columns: [{ data, title }]` | `columns: [{ field, header }]` |
| `render` callback | `format` / `formatter` / `cell` |
| `order` | initial `sorting` state |
| `searching` | `columnFilteringFeature` + global search |
| `paging` / `pageLength` | `rowPaginationFeature` / `pageSize` |
| `serverSide: true` + `ajax` | external mode (callbacks + `rowCount`) |
| `columnDefs` | per-column options |

## From plugin to component

```js
// DataTables (jQuery)
$('#people').DataTable({
  ajax: '/api/people',
  serverSide: true,
  columns: [
    { data: 'name', title: 'Name' },
    { data: 'salary', title: 'Salary', render: d => `$${d}` },
  ],
})
```

```svelte
<!-- SvGrid -->
<SvGrid
  data={rows}
  columns={[
    { field: 'name', header: 'Name' },
    { field: 'salary', header: 'Salary', format: { type: 'currency', currency: 'USD' } },
  ]}
  features={features}
  showPagination rowCount={total}
  onPaginationChange={(p) => load(p.pageIndex)}
/>
```

## Server-side

DataTables' `serverSide: true` posts a request format (`start`, `length`, `order`, `search`) and expects `recordsTotal`. SvGrid's external mode is the same idea in Svelte terms: read sort/filter/page from callbacks, fetch, and return rows plus a total `rowCount`. You design the request shape; nothing is dictated.

## What changes for the better

- **No jQuery.** State is reactive Svelte; the DOM is declarative.
- **Virtualization** is built in for large client-side datasets, where DataTables would lean on paging.
- **Editing** is first-class via `editorType` and `onCellValueChange`, rather than plugins.

## Frequently asked questions

### How do I replace jQuery DataTables in a Svelte app?

Use SvGrid: map `columns` and `data` directly, convert `render` callbacks to the column `format` option or a snippet, and replace `serverSide`/`ajax` with SvGrid's external mode (callbacks plus a total `rowCount`). You remove the jQuery dependency entirely.

### Does SvGrid support server-side processing like DataTables?

Yes. In external mode the grid reports sort, filter, and page state through callbacks and you return the matching page with a total count - the same server-driven model, expressed with Svelte runes instead of a jQuery plugin.
