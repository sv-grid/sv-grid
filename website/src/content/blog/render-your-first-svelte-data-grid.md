---
title: Render Your First Svelte Data Grid in Under 5 Minutes
description: How to add a fast, accessible, sortable data grid to a Svelte 5 app with SvGrid - covering data, typed columns, feature composition, and the imperative API.
date: 2026-06-09
updated: 2026-07-02
category: Getting started
tags: svelte data grid, getting started, svelte 5, sv-grid
author: Kamelia M
---

Every Svelte app eventually needs a table that sorts, filters, and paginates. The obvious path - hand-rolling a `<table>` with reactive sort state - works until it doesn't. Column resizing, keyboard navigation, WAI-ARIA compliance, and virtualization for large datasets each become their own weekend project. SvGrid packages all of that into a single import under 40 KB gzipped. The minimum working grid is about fifteen lines.

## One install, one import

```bash
npm add @svgrid/grid
```

`@svgrid/grid` is MIT-licensed with no row cap and no license key. Everything you need - the component, feature factories, and TypeScript types - comes from a single entry point.

## What we're building

The example here is a product inventory table: rows with a string `sku`, a string `category`, a numeric `price`, a numeric `stock`, and a boolean `active`. That mix of types is enough to show numeric formatting, conditional rendering, and column filtering without padding things out unnecessarily.

Here is the row type and some seed data:

```ts
type Product = {
  sku: string
  category: string
  price: number
  stock: number
  active: boolean
}

const rows: Product[] = [
  { sku: 'PRD-001', category: 'Electronics', price: 299.99,  stock: 42,  active: true  },
  { sku: 'PRD-002', category: 'Electronics', price: 149.50,  stock: 0,   active: false },
  { sku: 'PRD-003', category: 'Apparel',     price: 59.95,   stock: 128, active: true  },
  { sku: 'PRD-004', category: 'Apparel',     price: 34.00,   stock: 75,  active: true  },
  { sku: 'PRD-005', category: 'Home',        price: 89.99,   stock: 19,  active: true  },
  { sku: 'PRD-006', category: 'Home',        price: 214.00,  stock: 3,   active: true  },
  { sku: 'PRD-007', category: 'Electronics', price: 499.00,  stock: 0,   active: false },
  { sku: 'PRD-008', category: 'Apparel',     price: 22.50,   stock: 200, active: true  },
]
```

## Feature composition

SvGrid's sorting, filtering, and pagination are opt-in features you register once with `tableFeatures`. Nothing in the bundle runs unless you ask for it.

```ts
import {
  tableFeatures,
  rowSortingFeature,
  columnFilteringFeature,
  rowPaginationFeature,
  rowSelectionFeature,
} from '@svgrid/grid'

const features = tableFeatures({
  rowSortingFeature,
  columnFilteringFeature,
  rowPaginationFeature,
  rowSelectionFeature,
})
```

Order matters here. Each feature is a row model transformer applied in sequence. Putting `columnFilteringFeature` before `rowSortingFeature` means the sort operates on the already-filtered set, which is almost always what you want when the filtered set is much smaller than the full dataset. Swap them and sort runs first on all rows, then the filter slices the result - subtle difference, same final output in most cases, but the former is more efficient.

## Typed columns with value formatters

`ColumnDef` takes two generic parameters: the features object and your row type. That pairing lets TypeScript catch a typo in `field: 'pricce'` at compile time rather than silently rendering an empty column at runtime.

```ts
import { type ColumnDef } from '@svgrid/grid'

const columns: ColumnDef<typeof features, Product>[] = [
  {
    id: 'sku',
    field: 'sku',
    header: 'SKU',
    width: 110,
  },
  {
    id: 'category',
    field: 'category',
    header: 'Category',
    width: 130,
  },
  {
    id: 'price',
    field: 'price',
    header: 'Price',
    width: 100,
    type: 'number',
    format: (v) =>
      new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
      }).format(v as number),
  },
  {
    id: 'stock',
    field: 'stock',
    header: 'In Stock',
    width: 90,
    type: 'number',
  },
  {
    id: 'active',
    field: 'active',
    header: 'Active',
    width: 80,
    cell: activeSnippet,
  },
]
```

The `format` function receives the raw cell value and returns a string. For more complex rendering - anything that needs HTML or reactive state - use a Svelte snippet assigned to `cell` instead.

## A complete component

Here is the full `.svelte` file, pulling together everything above and adding a custom cell snippet for the boolean `active` column plus an `onApiReady` callback to wire up a button that logs the current selection:

```svelte
<script lang="ts">
  import SvGrid, {
    tableFeatures,
    rowSortingFeature,
    columnFilteringFeature,
    rowPaginationFeature,
    rowSelectionFeature,
    type ColumnDef,
    type SvGridApi,
  } from '@svgrid/grid'

  type Product = {
    sku: string
    category: string
    price: number
    stock: number
    active: boolean
  }

  const rows: Product[] = [
    { sku: 'PRD-001', category: 'Electronics', price: 299.99,  stock: 42,  active: true  },
    { sku: 'PRD-002', category: 'Electronics', price: 149.50,  stock: 0,   active: false },
    { sku: 'PRD-003', category: 'Apparel',     price: 59.95,   stock: 128, active: true  },
    { sku: 'PRD-004', category: 'Apparel',     price: 34.00,   stock: 75,  active: true  },
    { sku: 'PRD-005', category: 'Home',        price: 89.99,   stock: 19,  active: true  },
    { sku: 'PRD-006', category: 'Home',        price: 214.00,  stock: 3,   active: true  },
    { sku: 'PRD-007', category: 'Electronics', price: 499.00,  stock: 0,   active: false },
    { sku: 'PRD-008', category: 'Apparel',     price: 22.50,   stock: 200, active: true  },
  ]

  const features = tableFeatures({
    rowSortingFeature,
    columnFilteringFeature,
    rowPaginationFeature,
    rowSelectionFeature,
  })

  const columns: ColumnDef<typeof features, Product>[] = [
    { id: 'sku',      field: 'sku',      header: 'SKU',      width: 110 },
    { id: 'category', field: 'category', header: 'Category', width: 130 },
    {
      id: 'price',
      field: 'price',
      header: 'Price',
      width: 100,
      type: 'number',
      format: (v) =>
        new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(v as number),
    },
    { id: 'stock',  field: 'stock',  header: 'In Stock', width: 90, type: 'number' },
    { id: 'active', field: 'active', header: 'Active',   width: 80, cell: activeSnippet },
  ]

  let api = $state<SvGridApi | null>(null)

  function onApiReady(ready: SvGridApi) {
    api = ready
    ready.setPageSize(5)
    ready.setSort('price', 'desc')
  }

  function logSelected() {
    const selected = api?.getSelectedRows() ?? []
    console.log('selected:', selected)
  }
</script>

{#snippet activeSnippet({ value }: { value: boolean })}
  <span style:color={value ? 'green' : 'gray'}>
    {value ? 'Yes' : 'No'}
  </span>
{/snippet}

<button onclick={logSelected} disabled={!api}>Log selected rows</button>

<SvGrid
  data={rows}
  {columns}
  {features}
  showFilterRow={true}
  {onApiReady}
/>
```

The `onApiReady` callback fires once on mount with a stable `SvGridApi` reference. Storing it in a `$state` variable makes the `disabled` binding on the button work correctly - the button is inert until the grid is ready.

## The accessibility you get without asking

SvGrid attaches `role="grid"` to the root element, `role="row"` to each row, and `role="gridcell"` to each cell automatically. Keyboard navigation follows the ARIA grid pattern: arrow keys move the active cell, `Home` and `End` jump to row edges, `Ctrl+Home` and `Ctrl+End` jump to the grid corners. You do not configure any of this. It is the default behavior.

## Two things that bite new users

**Array mutations don't trigger a re-render.** If you do `rows.push(newItem)` outside the grid, nothing updates because the array reference has not changed. Either reassign the array - `rows = [...rows, newItem]` - or use the imperative `api.addRow(newItem)` method, which updates the grid without a full prop re-render.

**`format` only receives the cell's own field value.** If you need to combine two fields into a display string (say, `firstName + ' ' + lastName`), `format` won't work for that - it only sees the single field the column is bound to. Use a snippet assigned to `cell` instead, which receives the full row object.

## The imperative API is not optional

Most tutorials stop at the declarative props, but the `SvGridApi` is where the real control lives. Once you have a reference from `onApiReady`, you can drive the grid programmatically from anywhere in your component or from a parent:

```ts
// Sort by a column
api.setSort('stock', 'asc')

// Apply a filter
api.setFilter('category', { operator: 'equals', value: 'Electronics' })

// Bulk-update rows without re-rendering the full dataset
api.applyTransaction({
  update: [{ sku: 'PRD-002', category: 'Electronics', price: 139.00, stock: 5, active: true }],
})

// Save and restore the full view state (sort, filters, page, column widths)
const saved = api.getState()
// ... later ...
api.setState(saved)
```

`applyTransaction` is the right tool when you are streaming updates from a WebSocket or polling an API. It applies only the diff rather than replacing the whole dataset, which matters at a few hundred rows where a full swap would cause visible flicker.

From here the natural next step is wiring up a real backend with `createServerDataSource`, which handles server-side pagination, sorting, and filtering through the same `data` prop.
