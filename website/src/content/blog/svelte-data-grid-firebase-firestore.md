---
title: A Live Svelte Data Grid with Firebase Firestore
description: Build a real-time SvGrid backed by Firestore - live onSnapshot updates, query-based sorting and filtering, and cursor pagination with startAfter.
date: 2026-06-13
category: Integration
tags: firebase, firestore, realtime, integration, svelte data grid
author: Kamelia M
---

Firestore's real-time listeners are the feature that makes it click with a data grid: subscribe to a query once and the grid just keeps up as documents change underneath it.

![Live updates streaming into a SvGrid grid.](/blog-media/websocket-live.png)
*Live updates streaming into a SvGrid grid.*

## Live rows with onSnapshot

Subscribe to a query and pipe documents into `$state`; the grid re-renders as data changes:

```svelte
<script lang="ts">
  import { collection, query, orderBy, limit, onSnapshot } from 'firebase/firestore'
  import { db } from '$lib/firebase'

  let rows = $state<Row[]>([])

  $effect(() => {
    const q = query(collection(db, 'people'), orderBy('name'), limit(50))
    const unsub = onSnapshot(q, (snap) => {
      rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Row)
    })
    return unsub // cleanup on teardown
  })
</script>

<SvGrid data={rows} columns={columns} features={features} />
```

Returning `unsub` from the `$effect` detaches the listener automatically when the component is destroyed.

## Sorting and filtering

Firestore sorts and filters at the query level. Translate the grid's state into the query and re-subscribe:

```ts
let order = $state<{ field: string; dir: 'asc' | 'desc' }>({ field: 'name', dir: 'asc' })
// rebuild query with orderBy(order.field, order.dir) when onSortingChange fires
```

Remember Firestore's constraints: range filters and ordering have indexing rules, and you will create composite indexes for some combinations.

## Pagination

Firestore uses cursor pagination via `startAfter(lastDoc)`. Track the last document of each page and request the next slice. See [pagination patterns](pagination-patterns) for cursor vs offset trade-offs, Firestore is cursor-only by design.

## Flash on change

Because rows update live, a brief background flash on changed cells makes the grid read like a ticker. See [real-time grids](realtime-websocket-updates) for the batching and flash technique; it applies equally to Firestore snapshots.

## Frequently asked questions

### How do I make a Svelte data grid update live from Firestore?

Subscribe to a Firestore query with `onSnapshot` inside a Svelte `$effect`, map the documents into a `$state` array bound to SvGrid's `data`, and return the unsubscribe function so the listener detaches on cleanup.

### How does pagination work with Firestore and a grid?

Firestore uses cursor pagination: order the query, take a `limit`, and use `startAfter(lastDoc)` to fetch the next page. Track the last document per page and pass the rows to SvGrid as `data`.
