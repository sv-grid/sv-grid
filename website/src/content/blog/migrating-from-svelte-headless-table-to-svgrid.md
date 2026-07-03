---
title: Migrating from svelte-headless-table to SvGrid
description: A practical migration guide moving from svelte-headless-table's plugin and Subscribe model to SvGrid's runes-native API, with concrete before/after code and an honest look at the tradeoffs.
date: 2026-08-16
updated: "2026-07-02"
category: Comparisons
tags: migration, svelte-headless-table, comparison, svelte data grid
author: Victor Vidolov
---

svelte-headless-table was ahead of its time. It gave Svelte 3/4 developers a composable, plugin-based table primitive that matched how you thought about the problem - pick your features, wire them to stores, and render however you want. If you built something real with it, you know the pattern cold.

Svelte 5 changes the picture. Stores become runes, reactivity is fine-grained again, and the `<Subscribe>` ceremony that made headless-table tick starts to feel foreign in a runes codebase. SvGrid is written for Svelte 5 from the ground up. It covers the same headless core (sorting, filtering, pagination, grouping, selection) and adds things headless-table deliberately left out: a production-ready render component, row and column virtualization, and an imperative API for the cases where you need to drive the grid from outside.

This is how you move over.

## The mental model shift

svelte-headless-table's contract is: you give it data, attach plugins, call `table.createRows` in a reactive context, and render using `<Subscribe>` against the resulting stores. Every feature is opt-in at the plugin level.

SvGrid keeps opt-in features but replaces plugins with `tableFeatures`. The stores-plus-Subscribe pattern becomes runes. And instead of building your own `<table>` from the row model, you can hand everything to `<SvGrid>` and only reach into the headless layer when you need to customize rendering.

The core concept map:

| svelte-headless-table | SvGrid |
| --- | --- |
| `createTable(data, plugins)` | `tableFeatures(...)` + `<SvGrid>` |
| `table.createColumns([...])` | `columns: ColumnDef[]` array |
| `table.column({ accessor, header })` | `{ field, header }` or `{ fieldFn, header }` |
| `addSortBy()` | `rowSortingFeature` |
| `addColumnFilters()` | `columnFilteringFeature` |
| `addPagination()` | `rowPaginationFeature` |
| `addGroupBy()` | `columnGroupingFeature` |
| `addSelectedRows()` | `rowSelectionFeature` |
| `addExpandedRows()` | `rowExpandingFeature` |
| `<Subscribe>` + store reads | `$state` / `$derived` runes |
| Custom `<table>` render | `<SvGrid>` or custom render via headless core |

## Columns: accessors and computed fields

Column definitions map almost one-to-one. The `accessor` string becomes `field`, and `accessor` as a function becomes `fieldFn`. The `id` field works the same way.

```ts
// svelte-headless-table
import { createTable } from 'svelte-headless-table'

const table = createTable(readable(data))
const columns = table.createColumns([
  table.column({ header: 'Name', accessor: 'name' }),
  table.column({ header: 'Full name', accessor: r => `${r.first} ${r.last}`, id: 'full' }),
  table.column({ header: 'Price', accessor: 'price', id: 'price' }),
])

// SvGrid
import type { ColumnDef } from '@svgrid/grid'

interface Row { name: string; first: string; last: string; price: number }
const features = tableFeatures({ rowSortingFeature, columnFilteringFeature })

const columns: ColumnDef<typeof features, Row>[] = [
  { id: 'name', field: 'name', header: 'Name', width: 160 },
  { id: 'full', header: 'Full name', fieldFn: r => `${r.first} ${r.last}` },
  { id: 'price', field: 'price', header: 'Price', type: 'number', width: 100 },
]
```

One thing to know: SvGrid column defs accept `width` and `pinned` directly. You do not need a separate plugin for pinning.

## Features instead of plugins

In svelte-headless-table you attach plugins before creating columns. In SvGrid you declare features before creating columns. The shape is similar; the execution is different because features compose into a typed `features` object that flows through columns and the grid state.

```ts
import {
  tableFeatures,
  rowSortingFeature,
  columnFilteringFeature,
  rowPaginationFeature,
  rowSelectionFeature,
  rowExpandingFeature,
  columnGroupingFeature,
} from '@svgrid/grid'

// Pick exactly the features you need - nothing ships unused
const features = tableFeatures({
  rowSortingFeature,
  columnFilteringFeature,
  rowPaginationFeature,
  rowSelectionFeature,
})
```

The `features` object is passed to `<SvGrid>` or to `createGrid` if you are using the headless core directly. TypeScript uses it to type the options and state objects, so the compiler catches mismatches between declared features and what you pass in.

## From Subscribe to runes

This is where the migration feels the biggest. svelte-headless-table surfaces everything as Svelte stores. You read sorting state from `$sort`, page state from `$pageIndex`, and so on. Rendering requires wrapping things in `<Subscribe>`.

SvGrid state is plain runes. You initialize state objects with `$state(...)` and the grid reads and writes them directly. No subscriptions, no derived stores, just reactive assignments.

```svelte
<script lang="ts">
  import SvGrid from '@svgrid/grid'
  import {
    tableFeatures, rowSortingFeature, columnFilteringFeature,
    rowPaginationFeature, rowSelectionFeature,
    type ColumnDef, type SvGridApi,
  } from '@svgrid/grid'

  interface Employee { id: number; name: string; department: string; salary: number }

  const data: Employee[] = [
    { id: 1, name: 'Ana Lima', department: 'Engineering', salary: 95000 },
    { id: 2, name: 'Ben Carter', department: 'Design', salary: 82000 },
    { id: 3, name: 'Clara Müller', department: 'Engineering', salary: 104000 },
  ]

  const features = tableFeatures({
    rowSortingFeature,
    columnFilteringFeature,
    rowPaginationFeature,
    rowSelectionFeature,
  })

  const columns: ColumnDef<typeof features, Employee>[] = [
    { id: 'name', field: 'name', header: 'Name', width: 180 },
    { id: 'department', field: 'department', header: 'Department', width: 140 },
    { id: 'salary', field: 'salary', header: 'Salary', type: 'number', width: 110 },
  ]

  let api: SvGridApi | undefined = $state()
</script>

<SvGrid
  {data}
  {columns}
  sortable
  filterable
  pageable
  showFilterRow={true}
  rowHeight={34}
  onApiReady={(a) => { api = a }}
/>
```

If you need to read state outside the grid - for example, to show "3 rows selected" somewhere else on the page - call `api.getSelectedRows()` or pass a reactive state object in. The grid writes back into the same `$state` you provided.

## Custom cell rendering

svelte-headless-table uses its `Render` component and a `Display` helper. SvGrid uses Svelte 5 snippets, which is the same thing minus the wrapper:

```svelte
<script lang="ts">
  import SvGrid, { type ColumnDef } from '@svgrid/grid'
  import { tableFeatures, rowSortingFeature } from '@svgrid/grid'

  interface Product { id: number; name: string; status: 'active' | 'archived'; stock: number }

  const features = tableFeatures({ rowSortingFeature })

  const columns: ColumnDef<typeof features, Product>[] = [
    { id: 'name', field: 'name', header: 'Product', width: 200 },
    { id: 'status', field: 'status', header: 'Status', width: 100, cell: statusCell },
    { id: 'stock', field: 'stock', header: 'Stock', type: 'number', width: 80 },
  ]
</script>

{#snippet statusCell({ value }: { value: string })}
  <span
    style:color={value === 'active' ? 'green' : '#999'}
    style:font-weight={value === 'active' ? '600' : '400'}
  >
    {value}
  </span>
{/snippet}

<SvGrid {data} {columns} sortable rowHeight={34} />
```

Snippets are defined in the same `<script>` scope and passed directly into the column definition - no import, no component file, no `Render` wrapper needed.

## The imperative API

svelte-headless-table has no imperative escape hatch. You wire everything through the plugin options and reactive state. That works for pure table UIs, but breaks down when something outside the table needs to trigger a sort, reset filters, or jump to a page.

SvGrid exposes `api` via `onApiReady`. Once you have it, you can drive the grid from buttons, URL params, keyboard shortcuts, or server push:

```ts
// Triggered from a button outside the grid
function resetView() {
  api?.clearAllFilters()
  api?.setSort('name', 'asc')
  api?.setPage(0)
}

// Jump to the row that just got updated via WebSocket
function highlightUpdatedRow(rowIndex: number) {
  api?.scrollToRow(rowIndex)
  api?.setActiveCell(rowIndex, 'status')
}

// Save and restore view state across sessions
function saveCurrentView() {
  const state = api?.getState()
  localStorage.setItem('grid-view', JSON.stringify(state))
}

function restoreView() {
  const raw = localStorage.getItem('grid-view')
  if (raw) api?.setState(JSON.parse(raw))
}
```

This is the part of SvGrid that has no equivalent in headless-table, and it matters a lot once your app grows past a single page.

## What you give up and what you gain

svelte-headless-table is a clean abstraction and nothing else. If you wanted full control over every `<td>`, it was the right tool. SvGrid still lets you do that via the headless core and custom snippets, but its default renderer handles the things most apps need: sticky headers, frozen columns, row hover, selection checkboxes, inline editing, Excel-style column menus, and vertical virtualization that keeps 100k rows smooth.

The tradeoff is surface area. SvGrid has more API to learn. The column definition shape is richer, the feature list longer, and there are CSS custom properties to understand if you want to theme it.

For a project already on Svelte 5 where you were going to build most of that surface area yourself anyway, the migration is usually worth it. For a small embedded table where you own every pixel and have no performance requirements, headless-table (or a runes port of it) still works fine.

The migration itself rarely takes more than a day. Column definitions translate almost mechanically, features replace plugins with the same compositional intent, and the render side actually gets simpler once you replace `<Subscribe>` with snippets.
