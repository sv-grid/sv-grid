---
title: The Idea - Svelte 5 Deserves a Data Grid Built for It
description: Svelte 5 runes rewired how reactivity works. Every data grid we evaluated required a translation layer to keep up. Building one that didn't need that layer was the point.
date: 2026-06-13
updated: 2026-07-02
category: Company
tags: company, story, idea, svelte data grid
author: Boyko Markov
---

Svelte 5 runes shipped and immediately exposed a gap: there was no data grid that actually spoke the same reactivity dialect. Not a partial mismatch - a fundamental one. Grids built on Svelte stores required `writable` wrappers and `.subscribe` calls. Framework-agnostic engines with a Svelte adapter needed manual `tick()` calls to flush state. Headless table libraries were designed around the Svelte 4 contract and hadn't caught up to `$state`. Every option required some form of bridge code between the grid's internals and your app's reactive graph.

That bridge code is where bugs live. It's where you spend an afternoon debugging why a filtered row count is one frame stale, or why selecting a row in a modal doesn't update the parent's `$derived` until the next user interaction. The fix is usually a `$effect` that watches the grid's exported state and copies it back into a rune. That works, but it shouldn't be necessary.

## Why the existing options didn't fit

The problem isn't that other grids are bad - some of them are excellent. The problem is architectural. A grid designed for framework-agnostic use has to manage its own reactivity internally, then expose an event-based or callback-based API for frameworks to subscribe to. When Svelte 5's signal graph is already managing reactivity for your entire app, adding a second reactivity system inside the grid creates coordination overhead.

Consider sorting. In a runes-native grid, the sort state is a `$state` object. The sorted row model is `$derived` from that state and the raw data. When you call `api.setSort('price', 'desc')`, it mutates the sort state rune, the derived row model recomputes, and Svelte's scheduler batches the DOM update with everything else that changed in the same tick. One system, one scheduler, zero bridges.

In a grid with its own reactivity layer, the same operation involves: the grid updating its internal sort state, the grid emitting a change event, your `$effect` catching that event, copying the new sorted rows into a `$state` array, and Svelte re-rendering from that copy. Two systems, two schedulers, potential for double-render.

## What "native to runes" actually means in practice

The core abstraction is `createGrid`. It takes your data as a reactive getter and returns a grid instance whose internal pipeline is built from `$derived` nodes.

```ts
import {
  createGrid,
  tableFeatures,
  rowSortingFeature,
  columnFilteringFeature,
  rowSelectionFeature,
  type ColumnDef,
} from '@svgrid/grid'

type Order = {
  id: string
  customer: string
  amount: number
  status: 'pending' | 'shipped' | 'delivered' | 'cancelled'
  region: string
}

const features = tableFeatures({
  rowSortingFeature,
  columnFilteringFeature,
  rowSelectionFeature,
})

let rows = $state<Order[]>([])
let sortState = $state<{ id: string; desc: boolean }[]>([])
let filterState = $state<Record<string, unknown>>({})
let selectionState = $state<Record<string, boolean>>({})

const columns: ColumnDef<typeof features, Order>[] = [
  { id: 'customer', field: 'customer', header: 'Customer', width: 200 },
  { id: 'amount',   field: 'amount',   header: 'Amount',   width: 110, type: 'number' },
  { id: 'status',   field: 'status',   header: 'Status',   width: 120 },
  { id: 'region',   field: 'region',   header: 'Region',   width: 130 },
]

const grid = createGrid({
  data: rows,
  columns,
  features,
  options: {
    sorting:      { state: sortState },
    filtering:    { state: filterState },
    rowSelection: { state: selectionState },
  },
})
```

`rows` is a plain `$state` array. Assigning a new array to it - from a live data feed, a server response, or a user action - is the complete update path. The grid's derived pipeline reacts to that assignment the same way any `$derived` block would: it re-runs only the stages that depend on the changed value.

That last point matters for performance. If you update `sortState` without changing `rows`, the sorting stage re-derives but the filter stage doesn't re-run its predicate against every row. The Svelte signal graph tracks fine-grained dependencies, so each stage in the pipeline only recomputes when its specific inputs change.

## Wiring it into a component

The `<SvGrid>` component wraps the headless core with a virtualized DOM layer. It reads from the same derived nodes and renders only the rows currently in the viewport.

```svelte
<script lang="ts">
  import {
    SvGrid,
    createGrid,
    tableFeatures,
    rowSortingFeature,
    columnFilteringFeature,
    rowPaginationFeature,
    type ColumnDef,
    type SvGridApi,
  } from '@svgrid/grid'

  type Product = {
    id: string
    name: string
    category: string
    price: number
    stock: number
    sku: string
  }

  const features = tableFeatures({
    rowSortingFeature,
    columnFilteringFeature,
    rowPaginationFeature,
  })

  let rows = $state<Product[]>([])
  let api = $state<SvGridApi | null>(null)

  const columns: ColumnDef<typeof features, Product>[] = [
    { id: 'sku',      field: 'sku',      header: 'SKU',      width: 120, pinned: 'left' },
    { id: 'name',     field: 'name',     header: 'Name',     width: 220 },
    { id: 'category', field: 'category', header: 'Category', width: 140 },
    { id: 'price',    field: 'price',    header: 'Price',    width: 100, type: 'number', editable: true },
    { id: 'stock',    field: 'stock',    header: 'Stock',    width: 90,  type: 'number' },
  ]

  async function loadProducts() {
    const res = await fetch('/api/products')
    rows = await res.json()
  }

  $effect(() => {
    loadProducts()
  })

  function exportSelection() {
    if (!api) return
    const selected = api.getSelectedRows()
    console.log('selected rows:', selected)
  }
</script>

<button onclick={exportSelection}>Export selected</button>

<SvGrid
  {features}
  data={rows}
  {columns}
  sortable
  filterable
  pageable
  showFilterRow={true}
  rowHeight={36}
  virtualization={true}
  onApiReady={(g) => (api = g)}
/>
```

The `onApiReady` callback hands you a handle for imperative operations - things that don't fit naturally into declarative bindings. Scrolling to a specific row after a search result, triggering inline edit from a keyboard shortcut, restoring a saved view from localStorage. The declarative path handles the common cases; the API handle covers the rest.

## The reactivity edge case worth knowing

One thing that trips people up early: mutating a row object in place does not trigger a re-derive.

```ts
// This does NOT update the grid - Svelte tracks array identity, not deep mutations
rows[0].price = 99.99

// This works - new array reference signals a change to all derived stages
rows = rows.map((r, i) => i === 0 ? { ...r, price: 99.99 } : r)

// Or with applyTransaction via the API (batches add/update/remove in one pass):
api?.applyTransaction({ update: [{ ...rows[0], price: 99.99 }] })
```

`applyTransaction` is the right tool for bulk data updates because it diffs against the current dataset by row ID and produces a minimal update, rather than replacing the full array. For a 50,000-row grid receiving 200 row updates per second from a WebSocket feed, the difference in derived-stage recomputation time is significant.

## The server-side path

Local data works out of the box because the grid owns the sort, filter, and page logic. For datasets too large to send to the client, `createServerDataSource` swaps out the local pipeline and delegates to your server instead.

```ts
import { createServerDataSource } from '@svgrid/grid'

const ds = createServerDataSource({
  fetch: async ({ page, pageSize, sort, filters }) => {
    const params = new URLSearchParams({
      page: String(page),
      size: String(pageSize),
      sort: sort.map(s => `${s.id}:${s.desc ? 'desc' : 'asc'}`).join(','),
    })

    for (const [field, filter] of Object.entries(filters)) {
      params.set(`filter_${field}`, JSON.stringify(filter))
    }

    const res = await fetch(`/api/orders?${params}`)
    const json = await res.json()
    return { rows: json.data, total: json.total }
  },
  debounce: 150,
})
```

Then pass `ds` as the `data` prop instead of a `$state` array. The grid handles pagination state, triggers fetches when sort or filter state changes, and shows a loading indicator during in-flight requests. Your server receives structured sort and filter descriptors - no query-string parsing on your end.

## Why we built this instead of adapting something existing

The honest answer is that we evaluated adapting a well-known headless table library and concluded that runes compatibility was a rewrite, not a patch. The internal event system, the column size tracking, the row model pipeline - all of it assumed a different reactive primitive. The surface area of changes was large enough that we'd end up maintaining a fork with significant divergence from upstream.

Starting from the runes API as the ground truth meant we could design the pipeline topology around `$derived` from the beginning. The result is a grid where the reactive graph is the same graph Svelte uses for everything else in your app. No translation layer. No coordination bugs between two schedulers. When Svelte batches a render, the grid's updates are in the same batch.

That was the idea. Everything built since then - the server data source, the pivot adapter in the enterprise package, the HyperFormula spreadsheet mode - is built on top of that same foundation.
