---
title: A Reactive Svelte Data Grid with Convex
description: Pair SvGrid with Convex's reactive queries for a data grid that updates live by default - no manual subscriptions, no refetching.
date: 2026-06-13
category: Integration
tags: convex, reactive, realtime, integration, svelte data grid
author: Victor Vidolov
---

Convex flips the usual model: its query functions are live by default, so when the underlying data changes, your result updates on its own, no subscriptions to manage. Bind that to SvGrid and you get a grid that stays fresh with almost no plumbing of your own.

## A query function

Define the grid's data as a Convex query that takes pagination and sort args:

```ts
// convex/people.ts
import { query } from './_generated/server'
import { v } from 'convex/values'

export const list = query({
  args: { sort: v.string(), desc: v.boolean(), limit: v.number() },
  handler: async (ctx, { sort, desc, limit }) => {
    let q = ctx.db.query('people').withIndex('by_' + sort)
    const rows = await (desc ? q.order('desc') : q).take(limit)
    return rows
  },
})
```

Convex queries are transactional and reactive, any mutation that touches `people` re-runs this query for subscribed clients.

## The grid stays live for free

With the Svelte Convex client, the query result is a reactive value. Bind it to SvGrid and you are done, no `onSnapshot`, no polling:

```svelte
<script lang="ts">
  import { useQuery } from 'convex-svelte'
  let sort = $state({ field: 'name', desc: false })
  const rows = useQuery(api.people.list, () => ({ sort: sort.field, desc: sort.desc, limit: 200 }))
</script>

<SvGrid data={$rows ?? []} columns={columns} features={features}
  onSortingChange={(s) => sort = { field: s[0]?.id ?? 'name', desc: !!s[0]?.desc }} />
```

Edit a row through a Convex mutation and every connected grid updates instantly, because the query is reactive.

## When to page on the server

Convex supports cursor pagination (`paginate`) for large tables; for big datasets, page on the server and feed SvGrid `rowCount`. For moderate tables, fetch a generous slice and let the grid's virtualization handle rendering. See [client-side vs server-side data](client-side-vs-server-side-data).

## Frequently asked questions

### Does SvGrid update live with Convex automatically?

Yes. Convex queries are reactive by default, so binding the query result to SvGrid's `data` means the grid updates whenever the underlying data changes, no manual subscriptions or refetching.

### How do I sort or paginate a Convex-backed grid?

Pass sort and pagination as query arguments and update them in SvGrid's callbacks; Convex re-runs the query reactively. For large tables, use Convex cursor pagination and provide a total to SvGrid's `rowCount`.
