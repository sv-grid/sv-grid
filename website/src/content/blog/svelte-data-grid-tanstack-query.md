---
title: Using SvGrid with TanStack Query in Svelte
description: Combine TanStack Query's caching, refetching, and pagination with SvGrid's rendering for a fast, resilient server-driven data grid in Svelte 5.
date: 2026-06-25
category: Integration
tags: tanstack query, server-side, caching, integration, svelte data grid
author: SvGrid Team
---

TanStack Query (the Svelte adapter) handles the hard parts of server state - caching, background refetching, request deduplication, and keeping previous data while the next page loads. SvGrid handles rendering. Pairing them gives you a server-driven grid that feels instant. Here is the pattern.

## Why pair them

SvGrid's external mode wants you to fetch a page when sort/filter/page state changes. TanStack Query is purpose-built for exactly that fetch: it caches each page by key, dedupes in-flight requests, and can keep showing the current page while the next loads. You get a responsive grid without hand-writing caching and cancellation.

## Keying the query by grid state

Make the query key include everything that affects the result - page, size, sort, filters - so each distinct view is cached separately:

```svelte
<script lang="ts">
  import { createQuery } from '@tanstack/svelte-query'

  let gridState = $state({ page: 0, size: 50, sort: 'name', desc: false })

  const query = createQuery(() => ({
    queryKey: ['people', gridState],
    queryFn: () => fetchPeople(gridState),
    placeholderData: (prev) => prev, // keep the current page visible while loading
  }))
</script>

<SvGrid
  data={$query.data?.rows ?? []}
  columns={columns}
  features={features}
  showPagination={true}
  pageSize={gridState.size}
  rowCount={$query.data?.total ?? 0}
  onSortingChange={(s) => (gridState = { ...gridState, sort: s[0]?.id ?? 'name', desc: !!s[0]?.desc })}
  onPaginationChange={(p) => (gridState = { ...gridState, page: p.pageIndex })}
/>
```

Updating `gridState` changes the query key, TanStack Query fetches (or serves cache), and the grid re-renders with the new page.

## What you get for free

- **Instant back-and-forth paging.** Pages the user already visited come from cache.
- **No request waterfalls.** Duplicate requests are deduped automatically.
- **No flicker.** `placeholderData: (prev) => prev` keeps the current rows on screen until the next page arrives.
- **Background freshness.** Stale pages refetch quietly without blocking the UI.

## Loading and error states

Drive a subtle overlay from `$query.isFetching` and show a retry on `$query.isError`. Because TanStack Query owns the request lifecycle, you do not need to track loading flags by hand:

```svelte
{#if $query.isError}
  <button onclick={() => $query.refetch()}>Retry</button>
{/if}
```

## Why not use TanStack Table here?

TanStack Query (server state) and TanStack Table (a headless grid) are different products. You can use TanStack Query with any grid. Pairing it with SvGrid gives you the caching layer plus a native Svelte 5 render component, so you do not also have to build the UI. See [Server-Side Data](server-side-data) for the underlying grid contract.

## Frequently asked questions

### How do I cache data grid pages in Svelte?

Use TanStack Query with a query key that includes the grid's page, size, sort, and filter state. Each view is cached separately, so revisiting a page is instant, and `placeholderData` keeps the current rows visible while the next page loads.

### Can I use TanStack Query with SvGrid?

Yes. TanStack Query manages server state (fetching, caching, refetching) while SvGrid renders. Drive SvGrid's `data` and `rowCount` from the query result and update your grid-state object in the grid's callbacks.
