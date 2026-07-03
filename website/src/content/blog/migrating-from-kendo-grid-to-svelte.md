---
title: Migrating from Kendo UI Grid to a Svelte Data Grid
description: A practical migration guide from Kendo UI Grid to SvGrid - column mapping, server-side data, editing, and what to expect when you make the switch.
date: 2026-08-15
updated: "2026-07-02"
category: Comparisons
tags: migration, kendo grid, comparison, svelte data grid
author: Boyko Markov
---

Kendo UI Grid has been around long enough that you might be running a version that still leans on jQuery under the hood, or one of the framework wrappers that Progress ships for React, Angular, or Vue. Either way, if you are building in Svelte 5, you are working against the grain. The Kendo Svelte package exists, but it is a thin wrapper around the same core, and it does not feel native. You lose reactivity primitives, Svelte snippets for cell rendering, and the natural $state-based data flow that makes Svelte 5 actually pleasant to build with.

SvGrid is built from scratch for Svelte 5. No framework wrapper, no adapter layer. The migration is not trivial if you have heavily customized templates or a complex DataSource setup, but the concepts map closely enough that you can usually do it in a day for a medium-complexity grid.

![SvGrid's Excel-style column filter menu.](/blog-media/excel-filters.png)
*SvGrid's Excel-style column filter menu.*

## What maps and what does not

The conceptual model is similar. Kendo thinks in terms of DataSource, column definitions, and widget configuration. SvGrid thinks in terms of data, column definitions, and features. The naming is different but the mental model transfers.

| Kendo UI Grid | SvGrid |
| --- | --- |
| `dataSource` (kendo.data.DataSource) | `data` prop (array or server datasource) |
| `columns: [{ field, title }]` | `columns: [{ field, header }]` |
| `template` function / `format` string | `cell` snippet / `format` object |
| `editor` callback + `editable: true` | `editorType` string + `editable` prop |
| `sortable: { mode: 'multiple' }` | `rowSortingFeature` in `tableFeatures` |
| `filterable: { mode: 'row' }` | `columnFilteringFeature` + `showFilterRow` |
| `pageable: { pageSize: 25 }` | `rowPaginationFeature` + `pageable` |
| `group` configuration | `columnGroupingFeature` + `groupable` |
| `serverPaging`, `serverSorting`, `serverFiltering` | `createServerDataSource` |
| Excel and PDF export | `@svgrid/enterprise` |
| `selectable: 'row'` | `rowSelectionFeature` + `enableRowSelection` |

The one area that does not map cleanly is Kendo's DataSource transport. Kendo hides a lot of complexity inside `read`, `create`, `update`, `destroy` callbacks and handles batching, error states, and dirty tracking internally. SvGrid's server datasource is more explicit - you write the fetch logic, you own the state. That is more code up front but it is also more predictable and easier to debug.

## Column definitions first

Start with columns - they are the least risky thing to migrate and they give you a working scaffold to build on.

```ts
import type { ColumnDef } from '@svgrid/grid'

// Before (Kendo)
const kendoColumns = [
  { field: 'name', title: 'Full Name', width: 200 },
  { field: 'salary', title: 'Salary', format: '{0:c}', width: 120 },
  { field: 'hireDate', title: 'Hire Date', format: '{0:MM/dd/yyyy}', width: 140 },
  { field: 'department', title: 'Department', width: 160 },
  { field: 'status', title: 'Status', width: 100, template: statusTemplate },
]

// After (SvGrid)
type Row = { name: string; salary: number; hireDate: string; department: string; status: string }

const columns: ColumnDef<typeof features, Row>[] = [
  { id: 'name', field: 'name', header: 'Full Name', width: 200 },
  { id: 'salary', field: 'salary', header: 'Salary', width: 120,
    format: { type: 'currency', currency: 'USD' } },
  { id: 'hireDate', field: 'hireDate', header: 'Hire Date', width: 140,
    format: { type: 'date', dateFormat: 'MM/dd/yyyy' } },
  { id: 'department', field: 'department', header: 'Department', width: 160 },
  { id: 'status', field: 'status', header: 'Status', width: 100, cell: statusCell },
]
```

The `format` property in Kendo is a string like `{0:c}` or `{0:MM/dd/yyyy}`. In SvGrid it is a typed object. The advantage is that you get autocomplete and the formatter is locale-aware by default - passing `{ type: 'currency', currency: 'USD' }` will use the browser's `Intl.NumberFormat` under the hood, so you get correct formatting for your user's locale without any extra work.

## Replacing Kendo templates with Svelte snippets

Kendo templates are JavaScript functions or string templates that return HTML. In Svelte 5, cell rendering is a snippet - a first-class Svelte construct that gets full reactivity, event handling, and component access.

```svelte
<script lang="ts">
  import SvGrid from '@svgrid/grid'
  import { tableFeatures, rowSortingFeature, columnFilteringFeature,
           rowSelectionFeature, type ColumnDef } from '@svgrid/grid'

  type Row = { name: string; status: 'active' | 'inactive' | 'pending'; salary: number }

  const features = tableFeatures({ rowSortingFeature, columnFilteringFeature, rowSelectionFeature })

  const columns: ColumnDef<typeof features, Row>[] = [
    { id: 'name', field: 'name', header: 'Name', width: 200 },
    { id: 'status', field: 'status', header: 'Status', width: 120, cell: statusCell },
    { id: 'salary', field: 'salary', header: 'Salary', width: 140,
      format: { type: 'currency', currency: 'USD' } },
  ]

  let data = $state<Row[]>([
    { name: 'Alice Chen', status: 'active', salary: 95000 },
    { name: 'Bob Torres', status: 'pending', salary: 72000 },
    { name: 'Carol Kim', status: 'inactive', salary: 81000 },
  ])
</script>

{#snippet statusCell({ value }: { value: string })}
  <span class="status-badge" data-status={value}>
    {value.charAt(0).toUpperCase() + value.slice(1)}
  </span>
{/snippet}

<SvGrid {data} {columns} {features} sortable />

<style>
  .status-badge { padding: 2px 8px; border-radius: 10px; font-size: 12px; font-weight: 500; }
  .status-badge[data-status="active"] { background: #d1fae5; color: #065f46; }
  .status-badge[data-status="inactive"] { background: #fee2e2; color: #991b1b; }
  .status-badge[data-status="pending"] { background: #fef3c7; color: #92400e; }
</style>
```

The snippet has access to `value`, `row`, `rowIndex`, and `column`. If you had Kendo templates that called jQuery plugins or manipulated the DOM directly, those need to be rewritten as Svelte components - but that is a good thing, not a cost. You end up with something that is actually maintainable.

## Server-side operations

This is where most of the migration effort goes. Kendo's DataSource transport abstracts the HTTP calls behind a configuration object. SvGrid's `createServerDataSource` is more direct - you write the fetch function yourself.

```ts
import { createServerDataSource } from '@svgrid/grid'

const ds = createServerDataSource({
  fetch: async ({ page, pageSize, sort, filters }) => {
    const params = new URLSearchParams({
      page: String(page),
      size: String(pageSize),
    })

    if (sort.length > 0) {
      params.set('sortField', sort[0].id)
      params.set('sortDir', sort[0].desc ? 'desc' : 'asc')
    }

    for (const [field, filter] of Object.entries(filters)) {
      if (filter) {
        params.set(`filter[${field}]`, String(filter.value))
        if (filter.valueTo) params.set(`filter[${field}]To`, String(filter.valueTo))
      }
    }

    const res = await fetch(`/api/employees?${params}`)
    if (!res.ok) throw new Error(`Server error: ${res.status}`)
    const json = await res.json()
    return { rows: json.data, total: json.total }
  }
})
```

Then wire it to the component:

```svelte
<SvGrid
  data={ds}
  {columns}
  {features}
  pageable
  sortable
  filterable
  showFilterRow
  rowHeight={36}
/>
```

Compared to Kendo's transport configuration, this is more lines of code. But when something goes wrong - wrong parameter name, unexpected response shape, auth header missing - you debug a plain async function, not a framework abstraction. In practice, this pays off quickly.

## Editing: from Kendo's popup/inline to SvGrid's cell editing

Kendo supports popup editing, inline editing, and incell editing through the `editable` configuration. SvGrid focuses on inline and incell editing. If you used Kendo's popup form heavily, that part of the migration will take the most thought.

For incell and inline editing, the mapping is direct. Add `editable` to the grid and `editorType` to columns where you want editing:

```svelte
<script lang="ts">
  import SvGrid from '@svgrid/grid'
  import { tableFeatures, rowSortingFeature, type ColumnDef } from '@svgrid/grid'

  type Product = { id: number; name: string; price: number; inStock: boolean; category: string }

  const features = tableFeatures({ rowSortingFeature })

  const columns: ColumnDef<typeof features, Product>[] = [
    { id: 'id', field: 'id', header: 'ID', width: 60 },
    { id: 'name', field: 'name', header: 'Name', width: 200, editable: true, editorType: 'text' },
    { id: 'price', field: 'price', header: 'Price', width: 120,
      editable: true, editorType: 'number',
      format: { type: 'currency', currency: 'USD' } },
    { id: 'inStock', field: 'inStock', header: 'In Stock', width: 100,
      editable: true, editorType: 'boolean' },
    { id: 'category', field: 'category', header: 'Category', width: 160,
      editable: true, editorType: 'select',
      editorOptions: { options: ['Electronics', 'Clothing', 'Books', 'Food'] } },
  ]

  let data = $state<Product[]>([
    { id: 1, name: 'Laptop Pro', price: 1299, inStock: true, category: 'Electronics' },
    { id: 2, name: 'Winter Jacket', price: 89, inStock: false, category: 'Clothing' },
  ])

  let api: any

  function handleSave() {
    const rows = api.getData()
    fetch('/api/products/batch', { method: 'PUT', body: JSON.stringify(rows),
      headers: { 'Content-Type': 'application/json' } })
  }
</script>

<SvGrid {data} {columns} {features} editable enableCellSelection
  onApiReady={(a) => { api = a }} />

<button onclick={handleSave}>Save changes</button>
```

Undo/redo works out of the box with `api.undo()` and `api.redo()`. You do not need to configure it.

## The licensing difference

Kendo UI requires a commercial license - either through a Progress subscription or a standalone purchase. SvGrid's core is MIT-licensed. That means no license key, no watermark, no deployment restrictions for the grid itself. Export to Excel, PDF, and CSV, plus pivot tables, are in `@svgrid/enterprise` which has a commercial license, but the sorting, filtering, grouping, pagination, editing, and virtualization you probably use day-to-day are all free.

If you were paying for Kendo primarily because your grid needed to sort and filter data, the economics of a migration look pretty good.

## What to budget for

Most teams can migrate a standard read-only or lightly interactive Kendo grid in a day. The parts that take longer are custom popup forms (there is no direct equivalent - you build them as Svelte components yourself), complex DataSource schemas with nested models, and anything that relied on Kendo's built-in MVVM or observable patterns from the jQuery era.

Server-side datasource migration is usually 2-4 hours if you know your API well. Column definitions take about 30 minutes. Custom cell templates depend entirely on what the templates do - simple formatting is trivial, templates that call jQuery methods need to be thought through.

The result is a grid that behaves like a Svelte component should: reactive by default, typed throughout, and easy to extend without reaching for a framework adapter.
