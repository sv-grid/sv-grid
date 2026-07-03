---
title: Lazy-Loading Master-Detail Content in SvGrid
description: Fetch detail-panel data only when a row is expanded, cache the results, and cancel abandoned requests - keeping a large grid fast without paying for panels no one views.
date: 2026-08-07
updated: "2026-07-02"
category: Performance
tags: performance, master detail, lazy loading, recipe, svelte data grid
author: Kamelia M
---

A grid with 2,000 orders should not fire 2,000 API calls. Yet that is exactly what happens when detail panels load up front. The fix is straightforward: fetch only when someone actually expands a row, cache results so collapsing and re-expanding costs nothing, and cancel any in-flight request if the user changes their mind before data arrives.

This pattern is not complex, but there are a few places to get it wrong. Here is a solid recipe that handles all three concerns.

![Lazy-loaded tree branches in SvGrid](/blog-media/lazy-tree.png)
*Detail data fetched only on expand, cached on subsequent opens.*

## Why up-front loading fails at scale

The intuitive approach is to prepare detail data for every row when the grid initializes. It works fine on a demo dataset of 20 rows. At 500 rows it bogs down the page load. At 5,000 it makes the grid unusable.

The root problem is that a user typically opens a handful of rows - rarely more than a dozen in a session. Loading detail for every row to support those few is wasteful by definition. The fix is demand-driven loading: nothing fetches until the row actually opens.

## Fetching on expand with Svelte's await block

SvGrid passes a `row` object into your detail snippet. That is the trigger point. Wrap the fetch in `{#await}` and Svelte handles the three states - loading, success, and error - without any extra state variables:

```svelte
<script lang="ts">
  import SvGrid from '@svgrid/grid'
  import type { ColumnDef } from '@svgrid/grid'
  import type { Order, LineItem } from '$lib/types'

  const orderColumns: ColumnDef[] = [
    { id: 'id',       field: 'id',       header: 'Order ID', width: 120 },
    { id: 'customer', field: 'customer', header: 'Customer',  width: 200 },
    { id: 'total',    field: 'total',    header: 'Total',     width: 100, type: 'number' },
    { id: 'status',   field: 'status',   header: 'Status',    width: 120 },
  ]

  const lineItemColumns: ColumnDef[] = [
    { id: 'sku',      field: 'sku',      header: 'SKU',       width: 140 },
    { id: 'name',     field: 'name',     header: 'Product',   width: 240 },
    { id: 'qty',      field: 'qty',      header: 'Qty',       width: 80,  type: 'number' },
    { id: 'price',    field: 'price',    header: 'Unit Price', width: 110, type: 'number' },
  ]

  const { data: orders } = $props<{ data: Order[] }>()
</script>

{#snippet detailPanel({ row }: { row: Order })}
  {#await fetchLineItems(row.id)}
    <div class="detail-placeholder">
      <span class="spinner"></span> Loading line items...
    </div>
  {:then items}
    <div class="detail-inner">
      <SvGrid data={items} columns={lineItemColumns} rowHeight={28} />
    </div>
  {:catch err}
    <div class="detail-error">
      Failed to load. <button onclick={() => retryFor(row.id)}>Try again</button>
    </div>
  {/await}
{/snippet}

<SvGrid
  data={orders}
  columns={orderColumns}
  rowHeight={36}
  detail={detailPanel}
/>
```

The grid renders immediately. `fetchLineItems` does not run until the user expands a row. Svelte's reactive `{#await}` block takes care of the rest.

## Caching so the second open is instant

The snippet above re-fetches every time a row is expanded. Collapsing and re-opening the same order should not round-trip to the server again. The cleanest way to prevent that is to cache the promise, not the result:

```ts
// lib/line-item-cache.ts
const cache = new Map<string, Promise<LineItem[]>>()

export function fetchLineItems(orderId: string): Promise<LineItem[]> {
  if (!cache.has(orderId)) {
    cache.set(orderId, fetchFromApi(orderId))
  }
  return cache.get(orderId)!
}

async function fetchFromApi(orderId: string): Promise<LineItem[]> {
  const res = await fetch(`/api/orders/${orderId}/line-items`)
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}

// Call this if the user edits an order and you need to bust the cache
export function invalidate(orderId: string) {
  cache.delete(orderId)
}
```

Caching the promise (not the resolved data) means two expansions that fire before the first fetch completes both get the same promise - no duplicate requests. It is a subtle point that matters in grids where someone can expand rows rapidly.

## Cancelling abandoned requests

Users scroll fast. Someone might expand row 47, start reading, then collapse it and jump to row 120. If the line-items request for row 47 is still in flight, it is waste. Cancel it.

```ts
// lib/line-item-cache.ts (revised to support cancellation)
const cache = new Map<string, Promise<LineItem[]>>()
const controllers = new Map<string, AbortController>()

export function fetchLineItems(orderId: string): Promise<LineItem[]> {
  if (cache.has(orderId)) return cache.get(orderId)!

  const controller = new AbortController()
  controllers.set(orderId, controller)

  const promise = fetch(`/api/orders/${orderId}/line-items`, {
    signal: controller.signal,
  })
    .then(res => {
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      return res.json() as Promise<LineItem[]>
    })
    .finally(() => {
      controllers.delete(orderId)
    })

  cache.set(orderId, promise)
  return promise
}

export function cancelFetch(orderId: string) {
  controllers.get(orderId)?.abort()
  // Remove from cache so a future expand retries cleanly
  cache.delete(orderId)
}

export function invalidate(orderId: string) {
  cancelFetch(orderId)
}
```

Wire `cancelFetch` into a collapse handler if you want strict cancellation. In practice, aborting only matters for slow connections or very large payloads - for sub-200ms API responses, the extra plumbing may not be worth it. Know your p99 latency before adding complexity.

## How this interacts with row virtualization

SvGrid virtualizes rows by default. Only the rows currently visible in the viewport render - detail snippets included. That means an expanded row that scrolls out of view unmounts its detail panel, and when it scrolls back in, `{#await}` re-runs. With caching in place, re-running hits the cache immediately and the panel appears without a flash or refetch.

Without caching, every re-enter into the viewport triggers a fresh request. On a fast connection you might not notice. On a slow one, or when the detail panel contains a nested grid that itself needs settling time, the repeated fetch becomes visible jank. Cache the promise.

## Nested grids inside detail panels

If the detail content is itself a `<SvGrid>` (orders -> line items, accounts -> transactions), there is one sizing concern worth knowing: the outer grid does not know the inner grid's height until it renders. Set an explicit height on the detail panel container so the outer grid can allocate space cleanly:

```svelte
{#snippet detailPanel({ row }: { row: Order })}
  {#await fetchLineItems(row.id)}
    <div style="height: 160px;" class="detail-placeholder">Loading...</div>
  {:then items}
    <div style="height: 160px; overflow: hidden;">
      <SvGrid data={items} columns={lineItemColumns} rowHeight={28} />
    </div>
  {:catch}
    <div style="height: 40px;" class="detail-error">Load failed.</div>
  {/await}
{/snippet}
```

A fixed height also avoids layout shifts when data arrives - the outer grid reserves the space during the loading state and nothing reflows when items populate the inner grid.

## When to skip caching

Short sessions, frequently updated data, or detail panels where freshness matters more than speed. If your order line items can change in the seconds between a user opening and closing a row, stale cache is a real risk. In that case, either skip the cache entirely or pair it with a short TTL:

```ts
const cache = new Map<string, { promise: Promise<LineItem[]>, ts: number }>()
const TTL = 30_000 // 30 seconds

export function fetchLineItems(orderId: string): Promise<LineItem[]> {
  const entry = cache.get(orderId)
  if (entry && Date.now() - entry.ts < TTL) return entry.promise

  const promise = fetch(`/api/orders/${orderId}/line-items`).then(r => r.json())
  cache.set(orderId, { promise, ts: Date.now() })
  return promise
}
```

Thirty seconds is usually enough to cover the "collapse and immediately re-open" case while keeping data reasonably fresh. Adjust based on how often your backend data actually changes.

The core principle stays constant: pay for only what the user looks at, serve it instantly if they look again, and clean up what they walked away from.
