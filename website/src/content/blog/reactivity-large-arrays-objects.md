---
title: Reactivity with Large Arrays and Objects in Svelte 5
description: Deep proxies are powerful but not free. Here is when to pay the cost and when to use $state.raw to keep bulk data loads fast in a SvGrid app.
date: 2026-08-28
updated: "2026-07-02"
category: Engineering
tags: svelte 5, reactivity, arrays, performance, engineering
author: Victor Vidolov
---

Every Svelte 5 object you put in `$state` gets wrapped in a `Proxy`. One object, negligible. Fifty thousand objects with ten properties each - that is 500,000 proxy handlers allocated before the first row paints. This is the quiet culprit behind grids that stutter on initial load even when the renderer itself is virtualized and fast.

## Why deep proxying hurts at scale

Svelte 5's fine-grained reactivity works by intercepting property reads and writes on every object in your state tree. The upside: write `rows[42].status = 'shipped'` and only the single cell displaying that status updates. The downside: building that dependency graph requires walking every object recursively at construction time.

Measure it with a quick benchmark. Drop 50,000 plain objects into `$state` versus `$state.raw` and time the assignment:

```ts
// With deep proxy (plain $state):
// ~90-130 ms on a mid-range laptop
let rows = $state<Order[]>(await fetchOrders()) // Svelte recurses into all 50k objects

// With $state.raw:
// ~1-3 ms - Svelte stores the reference, nothing more
let rows = $state.raw<Order[]>(await fetchOrders())
```

The numbers vary by machine and object shape, but the gap is always large enough to be visible to users. A 100 ms freeze before any row appears is not a rendering problem - it is a state initialization problem.

SvGrid's virtualizer only ever reads 20 to 60 rows at a time, so the DOM work scales regardless. But the proxy wrapping happens before the virtualizer touches anything. Virtualization and `$state.raw` solve two different problems; you need both for large server-driven datasets.

## When to reach for `$state.raw`

The rule is straightforward: if your code replaces the array as a unit rather than mutating individual elements, use `$state.raw`. The classic scenario is a paginated server grid where each page load replaces the whole dataset:

```svelte
<script lang="ts">
  import {
    SvGrid,
    tableFeatures,
    rowSortingFeature,
    columnFilteringFeature,
    rowPaginationFeature,
    type ColumnDef,
    type SvGridApi,
  } from '@svgrid/grid'

  type Order = {
    id: string
    customer: string
    sku: string
    qty: number
    amount: number
    status: 'placed' | 'paid' | 'picking' | 'shipped' | 'delivered'
    region: 'NA' | 'EU' | 'APAC'
    placedAt: string
  }

  // Raw state: Svelte tracks the binding, not the contents.
  // Reassign rows to trigger a rerender. Do NOT mutate elements in place.
  let rows = $state.raw<Order[]>([])
  let loading = $state(false)
  let currentPage = $state(1)

  const features = tableFeatures({
    rowSortingFeature,
    columnFilteringFeature,
    rowPaginationFeature,
  })

  const columns: ColumnDef<typeof features, Order>[] = [
    { id: 'id',       field: 'id',       header: 'Order ID', width: 120 },
    { id: 'customer', field: 'customer', header: 'Customer',  width: 160 },
    { id: 'sku',      field: 'sku',      header: 'SKU',       width: 140 },
    { id: 'qty',      field: 'qty',      header: 'Qty',       width: 70  },
    { id: 'amount',   field: 'amount',   header: 'Amount',    width: 100 },
    { id: 'status',   field: 'status',   header: 'Status',    width: 120 },
    { id: 'region',   field: 'region',   header: 'Region',    width: 90  },
    { id: 'placedAt', field: 'placedAt', header: 'Placed',    width: 160 },
  ]

  let api = $state<SvGridApi<typeof features, Order> | null>(null)

  async function loadPage(page: number) {
    loading = true
    try {
      // Whole-array reassignment - O(1) from Svelte's perspective with $state.raw
      rows = await fetchOrders(page, 500)
      currentPage = page
    } finally {
      loading = false
    }
  }

  $effect(() => { loadPage(1) })
</script>

{#if loading}
  <p class="loading-indicator">Loading...</p>
{/if}

<SvGrid
  {features}
  {columns}
  data={rows}
  onApiReady={(g) => { api = g }}
  style="height: 600px"
/>

<div class="pagination-controls">
  <button onclick={() => loadPage(currentPage - 1)} disabled={currentPage <= 1 || loading}>
    Previous
  </button>
  <span>Page {currentPage}</span>
  <button onclick={() => loadPage(currentPage + 1)} disabled={loading}>
    Next
  </button>
</div>
```

This pattern loads fast at any page size because Svelte never recurses into the rows array. The grid gets a raw array, the virtualizer slices it for display, and the whole thing stays off the reactivity tracking graph until the next page reassignment.

## Editing rows without rebuilding the world

`$state.raw` imposes one firm rule: mutating an element in place does not trigger a rerender. `rows[0].status = 'paid'` silently does nothing visible. This trips people up the first time, usually in an edit callback.

The correct pattern is surgical replacement - create a new array with one new object, keep every other reference stable:

```ts
// Wrong: creates 50,000 new object references
// SvGrid's row model sees every row as changed and re-renders all of them
rows = rows.map(r => r.id === targetId ? { ...r, status: 'paid' } : { ...r })

// Also wrong: mutates in place on a $state.raw value - no rerender at all
rows.find(r => r.id === targetId)!.status = 'paid'

// Right: one new object, 49,999 stable references
// SvGrid can diff the array and only update the changed row
function updateStatus(id: string, status: Order['status']) {
  const i = rows.findIndex(r => r.id === id)
  if (i === -1) return
  const next = rows.slice() // shallow copy of the array wrapper
  next[i] = { ...rows[i]!, status }
  rows = next
}
```

If you find yourself doing in-place edits frequently - inline cell editing, live form validation, optimistic UI updates - plain `$state` is the better tool. The proxy cost is real but the ergonomics pay it back. Use `$state.raw` for datasets that arrive from a server and get replaced wholesale; use plain `$state` for user-editable datasets that change field by field.

## Live updates from a WebSocket feed

The wrong instinct when rows arrive from a WebSocket is to rebuild the array every time. At 5 messages per second on a 10,000-row dataset, each full reassignment triggers a rerender of the entire visible window even if only one row changed.

SvGrid's `applyTransaction` handles streaming inserts, updates, and removals without touching the rest of the display model:

```ts
let api = $state<SvGridApi<typeof features, Order> | null>(null)

function connectFeed() {
  const ws = new WebSocket('wss://orders.example.com/live')

  ws.onmessage = (event) => {
    const msg: { type: 'insert' | 'update' | 'delete'; row: Order } = JSON.parse(event.data)

    if (!api) return

    if (msg.type === 'insert') {
      api.applyTransaction({ add: [msg.row] })
    } else if (msg.type === 'update') {
      api.applyTransaction({ update: [msg.row] })
    } else if (msg.type === 'delete') {
      api.applyTransaction({ remove: [msg.row] })
    }
  }
}
```

This avoids the array reassignment entirely. SvGrid merges each transaction into the existing row model, re-derives sort and filter state for the affected rows only, and queues a targeted DOM update. At 50 messages per second you get smooth incremental updates rather than 50 full repaints.

## Mixing `$state.raw` and `$state` in the same component

You do not have to choose one approach for an entire component. A practical pattern is raw state for the data and regular reactive state for UI concerns - selection, edit drafts, loading flags:

```ts
// Server data: raw, replaced as a unit
let rows = $state.raw<Order[]>([])

// UI state: fine-grained, mutated in place
let selectedIds = $state(new Set<string>())
let editDraft = $state<Partial<Order> | null>(null)
let filterText = $state('')

// Derive the filtered view without touching rows itself
let visible = $derived(
  filterText.trim()
    ? rows.filter(r =>
        r.customer.toLowerCase().includes(filterText.toLowerCase()) ||
        r.sku.toLowerCase().includes(filterText.toLowerCase())
      )
    : rows
)
```

`$derived` reading a `$state.raw` array registers a dependency on the array reference, not its contents. So `visible` recomputes when `rows` or `filterText` changes, but not when you mutate a row element in place - which is consistent with the raw contract and actually what you want here.

## The threshold question

Below roughly 5,000 rows on a modern machine, the difference between `$state` and `$state.raw` is under 5 ms and not worth the ergonomic tradeoff. Profile with `performance.mark` around your state assignment if you are unsure where your dataset lands. If you do not see a gap, use plain `$state` and enjoy the simpler mutation model.

Above 20,000 rows, the proxy overhead is consistently user-visible on mid-range hardware. At 50,000 rows it is the dominant cost on page load - not the network, not the rendering, not the sort. Switch to `$state.raw`, adopt the surgical replacement pattern for edits, and use `applyTransaction` for streaming updates. The three together keep a large grid feeling immediate regardless of dataset size.
