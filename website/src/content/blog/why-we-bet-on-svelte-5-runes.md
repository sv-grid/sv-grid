---
title: Why We Bet on Svelte 5 Runes for a High-Performance Data Grid
description: Fine-grained reactivity with $state, $derived, and $effect makes surgical cell updates the default, not the exception - and that changes how you build a data grid.
date: 2026-05-30
updated: 2026-07-02
category: Engineering
tags: svelte 5, runes, reactivity, performance, architecture
author: Victor Vidolov
---

Before Svelte 5, building a reactive data grid meant choosing between two bad options: coarse-grained component re-renders (fast to write, slow to run) or a manual signal graph that you maintain yourself and inevitably get wrong. Svelte 5 runes dissolved that tradeoff. The moment I saw the dependency tracking model in `$derived`, I knew this was the right foundation for SvGrid.

## The actual reactivity problem in a data grid

A data grid has a lot of state, and most of it is orthogonal. Sort order has nothing to do with which rows are selected. A column width change should not touch filter state. A WebSocket pushing price ticks should repaint exactly the cells that changed - not trigger a filter re-evaluation, not reset scroll position, not lose the user's current selection.

In a framework without fine-grained reactivity, you work against the default. You reach for memoization libraries, manually subscribed stores, and careful component splitting just to get what amounts to basic correctness. In Svelte 5, the default is already fine-grained. `$derived` tracks exactly the reactive values it reads during its last execution. Nothing more.

That one fact is load-bearing for every performance claim SvGrid makes.

## Three runes, three responsibilities

The architecture splits cleanly along rune boundaries.

`$state` is the source of truth. Row data, sort state, filter state, selected row IDs - all declared with `$state`. Svelte wraps these in a proxy that records property-level mutations, which means updating a single field on row 18,441 registers as a change only to that field, not to the array or to any other row.

`$derived` is for pure derivation. The filtered row list, the sorted row order, column visibility masks, aggregated footer values - these are all derived. Svelte 5 evaluates them lazily: mark dirty on mutation, re-compute on next read. A burst of 50 WebSocket messages within one animation frame produces exactly one re-evaluation of every derived value. That is not a configuration option; it is the default behavior.

`$effect` owns side effects. WebSocket connections, resize observers, clipboard listeners, scroll position sync - anything that touches the outside world lives here. Effects return cleanup functions. They are the outermost boundary, not the core.

## Building a live-updating grid

Here is what this looks like in practice. This component seeds 5,000 rows and applies streaming updates at 150 ms intervals. The filter input and the ticker are completely independent - mutations from one never trigger recalculation in the other.

```svelte
<script lang="ts">
  import { untrack } from 'svelte'
  import {
    SvGrid,
    tableFeatures,
    rowSortingFeature,
    columnFilteringFeature,
    renderSnippet,
    type ColumnDef,
    type SvGridApi,
  } from '@svgrid/grid'

  type Status = 'open' | 'filled' | 'partial' | 'cancelled'
  type Order = {
    id: string
    symbol: string
    side: 'buy' | 'sell'
    qty: number
    price: number
    status: Status
  }

  const features = tableFeatures({ rowSortingFeature, columnFilteringFeature })

  // Seed rows
  const SYMBOLS = ['AAPL', 'MSFT', 'NVDA', 'TSLA', 'AMZN']
  const STATUSES: Status[] = ['open', 'filled', 'partial', 'cancelled']
  let uid = 1
  function makeOrder(): Order {
    return {
      id: `ORD-${uid++}`,
      symbol: SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)]!,
      side: Math.random() > 0.5 ? 'buy' : 'sell',
      qty: Math.floor(Math.random() * 500) + 1,
      price: +(100 + Math.random() * 900).toFixed(2),
      status: STATUSES[Math.floor(Math.random() * 2)]! as Status,
    }
  }

  let rows = $state<Order[]>(Array.from({ length: 5000 }, makeOrder))

  // Track which rows recently changed so cells can flash
  let changedIds = $state<Set<string>>(new Set())

  // Ticker: mutates rows in place. untrack prevents the $effect
  // from treating `rows` as a dependency and restarting the interval.
  $effect(() => {
    const id = setInterval(() => {
      untrack(() => {
        const next = new Set<string>()
        for (let i = 0; i < 8; i++) {
          const row = rows[Math.floor(Math.random() * rows.length)]!
          row.price = +(row.price * (0.995 + Math.random() * 0.01)).toFixed(2)
          row.status = STATUSES[Math.floor(Math.random() * STATUSES.length)]!
          next.add(row.id)
        }
        changedIds = next
      })
    }, 150)
    return () => clearInterval(id)
  })

  let api = $state<SvGridApi<typeof features, Order> | null>(null)

  const SIDE_COLOR = { buy: '#16a34a', sell: '#dc2626' }
  const STATUS_BG: Record<Status, string> = {
    open: '#2563eb', filled: '#16a34a',
    partial: '#d97706', cancelled: '#6b7280',
  }

  const columns: ColumnDef<typeof features, Order>[] = [
    { id: 'id',     field: 'id',     header: 'Order',  width: 100 },
    { id: 'symbol', field: 'symbol', header: 'Symbol', width: 80, filterable: true },
    {
      id: 'side',
      field: 'side',
      header: 'Side',
      width: 70,
      cell: renderSnippet(sideCell),
    },
    {
      id: 'qty',
      field: 'qty',
      header: 'Qty',
      width: 80,
      format: { type: 'number' },
    },
    {
      id: 'price',
      field: 'price',
      header: 'Price',
      width: 100,
      format: { type: 'currency', currency: 'USD', options: { minimumFractionDigits: 2 } },
      cell: renderSnippet(priceCell),
    },
    {
      id: 'status',
      field: 'status',
      header: 'Status',
      width: 100,
      filterable: true,
      cell: renderSnippet(statusCell),
    },
  ]
</script>

{#snippet sideCell(ctx)}
  <span style="color:{SIDE_COLOR[ctx.row.original.side]};font-weight:600">
    {ctx.row.original.side.toUpperCase()}
  </span>
{/snippet}

{#snippet priceCell(ctx)}
  {@const flashing = changedIds.has(ctx.row.original.id)}
  <span class:flash={flashing}>
    ${ctx.row.original.price.toFixed(2)}
  </span>
{/snippet}

{#snippet statusCell(ctx)}
  <span
    class="badge"
    style="background:{STATUS_BG[ctx.row.original.status]}"
  >
    {ctx.row.original.status}
  </span>
{/snippet}

<SvGrid
  {features}
  {rows}
  {columns}
  height={520}
  sortable
  showFilterRow
  onApiReady={(g) => { api = g }}
/>

<style>
  .badge {
    color: #fff;
    font-size: 11px;
    padding: 2px 8px;
    border-radius: 4px;
  }
  .flash {
    animation: highlight 0.3s ease-out;
  }
  @keyframes highlight {
    0%   { background: rgba(250, 204, 21, 0.5); }
    100% { background: transparent; }
  }
</style>
```

The key decision is `untrack` around the mutation block. Without it, the `$effect` reads `rows` to pick random targets, which registers `rows` as a dependency. The next mutation writes to `rows`, which marks the effect dirty and re-runs it - tearing down and re-creating the interval 150 ms later. With `untrack`, the read happens outside the tracking scope. Svelte never sees the dependency.

## Why in-place mutation beats array replacement

A common pattern from React-trained instinct is to replace the array on every update: `rows = rows.map(r => r.id === id ? { ...r, price: newPrice } : r)`. That works, but it costs more than it should.

When you replace the array, Svelte treats every element as potentially new. SvGrid's internal row identity map - which tracks selections, expanded groups, and edit state - has to reconcile the entire structure. Selections can be lost if row references change.

When you mutate in place (`rows[idx].price = newPrice`), Svelte's proxy records a change to exactly one property path. SvGrid receives a granular notification, updates only the affected cell, and the rest of the grid is untouched. At 5,000 rows with 8 updates every 150 ms, this difference is visible in the profiler.

For batched updates from a server payload, `api.applyTransaction` is the right tool:

```typescript
// Arrived from WebSocket: partial state updates
socket.on('order-updates', (patches: Partial<Order>[]) => {
  if (!api) return
  api.applyTransaction({
    update: patches.map(p => ({ ...currentRowMap.get(p.id)!, ...p })),
  })
})
```

`applyTransaction` batches all mutations into a single reconciliation pass, which is more efficient than individual property writes when the update set is large and predictable.

## Derived stats without a performance penalty

One scenario that trips people up: computing aggregates over selected rows. A naive approach is to derive over the full row set and filter down, but that re-runs on every mutation anywhere in the table.

```typescript
// This re-runs whenever ANY row changes, not just selection changes
let totalSelected = $derived(
  rows.filter(r => selectedIds.has(r.id)).reduce((s, r) => s + r.price, 0)
)

// This re-runs only when selectedIds changes
let selectedRows = $derived(
  rows.filter(r => selectedIds.has(r.id))
)
let totalSelected = $derived(
  selectedRows.reduce((s, r) => s + r.price, 0)
)
```

The second form chains two `$derived` values. Svelte tracks each independently. If `selectedIds` does not change, `selectedRows` stays stale and `totalSelected` is never re-evaluated - even if the ticker is firing every 150 ms. This is the kind of precision that makes the system feel snappy regardless of update rate.

## Tradeoffs worth knowing

Runes are not free of sharp edges.

`$derived` over a large array is not O(1). A `$derived` that calls `.filter()` on 50,000 rows re-runs whenever the source array mutates. If filter evaluation is expensive, gate it on a debounced query string rather than the raw input binding. SvGrid handles this internally for its own filter pipeline, but custom `$derived` values in your component are your responsibility.

`renderSnippet` requires the snippet to be defined in the same component file. Snippets are not importable in Svelte 5. If you need to share cell renderers across multiple grids, wrap them in a child Svelte component and use `renderComponent` instead. The ergonomics are slightly worse but the sharing works fine.

`onApiReady` fires once, after mount. The `api` value is `null` during SSR and on the initial render pass. Any code calling `api.scrollToRow()` or `api.setSort()` must guard with `if (api)`, or live inside a `$effect` that will naturally run post-mount.

## What this makes possible at scale

The rune model is why SvGrid can run at 150 ms tick intervals against 30,000 rows on a mid-range laptop without dropping frames. It is not caching tricks or virtualization alone - the virtualization helps, but it is the dependency precision that prevents unnecessary work from reaching the renderer in the first place.

The decision to build on Svelte 5 runes rather than abstracting over multiple frameworks was deliberate. A framework-agnostic grid lives at the lowest common denominator of every target framework's reactive model. We chose to live at Svelte 5's ceiling instead.
