---
title: A Svelte Data Grid with PocketBase
description: Connect SvGrid to PocketBase - server-side paging with getList, sort and filter strings, and live updates via realtime subscriptions.
date: 2026-06-13
category: Integration
tags: pocketbase, realtime, server-side, integration, svelte data grid
author: SvGrid Team
---

PocketBase is a single-file backend with a clean JavaScript SDK, built-in auth, and realtime subscriptions - a great fit for a Svelte data grid. Its `getList` API maps almost exactly onto what the grid needs.

## Server-side paging

`getList(page, perPage, options)` returns the page plus `totalItems` - exactly SvGrid's `data` and `rowCount`:

```svelte
<script lang="ts">
  import PocketBase from 'pocketbase'
  const pb = new PocketBase('http://127.0.0.1:8090')

  let rows = $state<Row[]>([]), total = $state(0)
  let s = $state({ page: 1, sort: '-created', filter: '' })

  async function load() {
    const res = await pb.collection('people').getList(s.page, 50, {
      sort: s.sort,         // e.g. '-name' for descending
      filter: s.filter,     // e.g. "name ~ 'ada'"
    })
    rows = res.items as Row[]
    total = res.totalItems
  }
  $effect(() => { load() })
</script>

<SvGrid data={rows} columns={columns} features={features}
  showPagination pageSize={50} rowCount={total}
  onSortingChange={(x) => s = { ...s, sort: `${x[0]?.desc ? '-' : ''}${x[0]?.id ?? 'created'}` }}
  onFiltersChange={(f) => s = { ...s, filter: f.columns[0]?.value ? `name ~ '${f.columns[0].value}'` : '' }}
  onPaginationChange={(p) => s = { ...s, page: p.pageIndex + 1 }} />
```

Note PocketBase pages are 1-based, so add 1 to SvGrid's zero-based `pageIndex`. Sort uses a `-` prefix for descending; filters are a small expression string.

## Live updates

PocketBase can push changes in real time:

```ts
$effect(() => {
  pb.collection('people').subscribe('*', () => load())
  return () => pb.collection('people').unsubscribe('*')
})
```

For high-frequency changes, batch reloads or update rows in place rather than refetching the whole page - see [real-time grids](realtime-websocket-updates).

## Security

Use PocketBase collection API rules so the list only returns records the user may see; never build filter strings from unsanitized user input without escaping.

## Frequently asked questions

### How do I paginate PocketBase in a data grid?

Use `collection.getList(page, perPage, { sort, filter })`. It returns `items` for `data` and `totalItems` for `rowCount`. Remember PocketBase pages are 1-based, so add one to SvGrid's zero-based page index.

### Can SvGrid update live from PocketBase?

Yes. Subscribe to the collection's realtime feed and reload (or patch rows) when changes arrive, unsubscribing on cleanup. For busy feeds, batch updates to keep rendering smooth.
