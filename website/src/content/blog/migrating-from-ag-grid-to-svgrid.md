---
title: Migrating from AG Grid to SvGrid
description: A practical, honest migration guide - mapping AG Grid concepts like columnDefs, cellRenderer, and the server-side row model onto their SvGrid equivalents.
date: 2026-06-27
updated: "2026-07-02"
category: Comparisons
tags: migration, ag grid, comparison, svelte data grid
author: Kamelia M
---

AG Grid is a serious piece of software. This is not a post about how it is bad. But "wrap this React component" is not a sentence you want in a Svelte 5 codebase, and once you decide you want a grid that is actually Svelte-native, the mapping is closer than you might expect.

Most AG Grid concepts translate directly. The differences show up in three places: how columns are typed, how cell renderers are expressed in Svelte 5, and how the server-side row model is wired. Everything else is a rename.

## The concept map

Before touching code, it helps to see the vocabulary side by side:

| AG Grid | SvGrid |
| --- | --- |
| `rowData` | `data` |
| `columnDefs` | `columns` |
| `headerName` | `header` |
| `valueFormatter` | `format` (keeps raw value; formatting is display-only) |
| `cellRenderer` | `cell` snippet |
| `valueGetter` | `fieldFn` |
| `editable` + `cellEditor` | `editable` + `editorType` |
| `onCellValueChanged` | `onCellValueChange` |
| Client-side row model | default in-memory mode |
| Server-side row model | `createServerDataSource` |
| AG Grid Enterprise | `@svgrid/enterprise` |

One thing to notice: SvGrid separates formatting from value access. In AG Grid, `valueFormatter` is commonly used for both display formatting and for coercing values before sort. SvGrid's `format` is display-only, which means sort and filter always operate on the raw value. That is almost always the right behavior, but it is something to be aware of when you have columns that were doing extra work in `valueFormatter`.

## Columns: a direct translation

Here is a real columnDefs array and what it looks like in SvGrid:

```ts
import type { ColumnDef } from '@svgrid/grid'

// AG Grid
const columnDefs = [
  { field: 'name', headerName: 'Name', width: 200, pinned: 'left' },
  { field: 'department', headerName: 'Department', width: 150 },
  { field: 'salary', headerName: 'Salary', valueFormatter: (p) => `$${p.value.toLocaleString()}` },
  { field: 'hireDate', headerName: 'Hire Date', valueFormatter: (p) => new Date(p.value).toLocaleDateString() },
  { field: 'status', headerName: 'Status', pinned: 'right', width: 100 },
]

// SvGrid
const columns: ColumnDef<typeof features, Employee>[] = [
  { id: 'name', field: 'name', header: 'Name', width: 200, pinned: 'left' },
  { id: 'department', field: 'department', header: 'Department', width: 150 },
  { id: 'salary', field: 'salary', header: 'Salary', type: 'number',
    format: { type: 'currency', currency: 'USD' } },
  { id: 'hireDate', field: 'hireDate', header: 'Hire Date',
    format: { type: 'date', dateStyle: 'medium' } },
  { id: 'status', field: 'status', header: 'Status', pinned: 'right', width: 100 },
]
```

Two things to note. First, SvGrid columns require an `id` field - it is used by the imperative API and for state serialization. Second, `format` takes an options object rather than a function, which lets SvGrid use the browser's `Intl` formatters directly. If you have custom formatting logic that does not fit a format object, you can still use a `formatter` function:

```ts
{ id: 'score', field: 'score', header: 'Score',
  formatter: ({ value }) => value >= 100 ? '100+' : String(value) }
```

## Cell renderers become Svelte snippets

This is the most idiomatic change. AG Grid cell renderers are components with a specific interface. In SvGrid, they are Svelte 5 snippets, which means they live in your `.svelte` file and use the same reactive state as the rest of your page.

```svelte
<script lang="ts">
  import SvGrid from '@svgrid/grid'
  import { renderSnippet, tableFeatures, rowSortingFeature,
           rowSelectionFeature, type ColumnDef } from '@svgrid/grid'

  const features = tableFeatures({ rowSortingFeature, rowSelectionFeature })

  type Employee = { name: string; status: 'active' | 'inactive' | 'pending' }

  const columns: ColumnDef<typeof features, Employee>[] = [
    { id: 'name', field: 'name', header: 'Name', width: 200 },
    {
      id: 'status',
      field: 'status',
      header: 'Status',
      width: 120,
      cell: ({ cell }) => renderSnippet(statusBadge, { value: cell.getValue() })
    },
  ]
</script>

{#snippet statusBadge({ value }: { value: string })}
  <span class="badge" class:active={value === 'active'}
        class:pending={value === 'pending'}>
    {value}
  </span>
{/snippet}

<SvGrid data={employees} {columns} sortable />
```

This is cleaner than AG Grid's approach for Svelte codebases because snippets share scope with the rest of the component. If you have a store or a reactive value you want to reference inside the cell, you reference it directly - no prop drilling, no context.

## Editing and cell value changes

AG Grid mutates `rowData` in place by default (with some configuration). SvGrid never touches your data array - it emits a `onCellValueChange` event and expects you to update the source:

```ts
import SvGrid, { tableFeatures } from '@svgrid/grid'

let rows = $state<Employee[]>([...])

function handleCellValueChange(e: { rowIndex: number; columnId: string; newValue: unknown }) {
  rows[e.rowIndex] = { ...rows[e.rowIndex], [e.columnId]: e.newValue }
}
```

```svelte
<SvGrid
  data={rows}
  {columns}
  editable
  {onCellValueChange}
/>
```

The reason SvGrid does not mutate is that it supports undo/redo out of the box - `api.undo()` and `api.redo()` work on the edit history. Mutating the source array directly would break that. If you want mutation, just do it in `onCellValueChange`.

## Server-side data

AG Grid's Server-Side Row Model has its own registration, block loading, and cache concepts. SvGrid wraps this into a `createServerDataSource` call that takes a single async `fetch` function. SvGrid calls it whenever the page, sort, or filter state changes:

```ts
import { createServerDataSource } from '@svgrid/grid'

const ds = createServerDataSource({
  fetch: async ({ page, pageSize, sort, filters }) => {
    const params = new URLSearchParams({
      page: String(page),
      size: String(pageSize),
    })

    if (sort.length > 0) {
      params.set('sortBy', sort[0].id)
      params.set('sortDir', sort[0].desc ? 'desc' : 'asc')
    }

    for (const f of filters) {
      params.set(`filter[${f.id}]`, String(f.value))
    }

    const res = await fetch(`/api/employees?${params}`)
    const json = await res.json()
    return { rows: json.data, total: json.total }
  }
})
```

Then pass the data source directly to the grid:

```svelte
<SvGrid data={ds} {columns} pageable filterable sortable />
```

The grid handles loading state, debounced filter requests, and page resets when filters change. You own the fetch logic and nothing else.

## What does not map directly

A few AG Grid Enterprise features need the `@svgrid/enterprise` package rather than the free core:

- Pivot tables - `createPivotModel` from `@svgrid/enterprise`
- Excel export (XLSX) - available in enterprise; CSV export is in the free tier
- Row grouping with aggregations - enterprise; flat grouping is free

The full comparison is at [SvGrid vs AG Grid](/compare/ag-grid).

Theming is a CSS variable swap rather than a theme class. Replace AG Grid theme classes with `--sg-*` tokens. The ones you will hit most often are `--sg-bg`, `--sg-fg`, `--sg-accent`, `--sg-header-bg`, and `--sg-border`. The [theming docs](theming-and-dark-mode) cover the full token list.

## The imperative API

One thing worth knowing before you start: SvGrid has a full imperative API that you get via the `onApiReady` callback. If you are used to using `gridRef.api.setFilterModel()` or `gridRef.api.getSelectedRows()` in AG Grid, the equivalent calls exist:

```ts
let api: SvGridApi

// Sort, filter, selection
api.setSort('salary', 'desc')
api.setFilter('status', { operator: 'equals', value: 'active' })
api.getSelectedRows()
api.selectAllRows()

// State save/restore (for persisting user layout)
const savedState = api.getState()
api.setState(savedState)

// Column control
api.setColumnVisible('department', false)
api.autosizeAllColumns()
api.setColumnPinning({ left: ['name'], right: ['status'] })
```

If you are migrating a grid that uses AG Grid's event bus heavily, this is where you will spend time matching method names - but the functionality is there.

The short version: if you have an AG Grid screen in a Svelte 5 app, the migration is a few hours of renaming and a snippet rewrite for any custom cell renderers. The concepts are close enough that you can do it incrementally, one grid at a time.
