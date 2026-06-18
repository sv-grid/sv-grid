---
title: An End-to-End Typed Svelte Data Grid with tRPC
description: Use tRPC to drive SvGrid with full type safety from server to grid - a typed pagination procedure, input validation, and the grid wiring.
date: 2026-06-13
category: Integration
tags: trpc, sveltekit, server-side, type safety, svelte data grid
author: Victor Vidolov
---

tRPC's whole pitch is calling your server like a local function, with the input and output types known on the client and zero schema to keep in sync. Wire it to SvGrid and the type safety runs the entire length of the pipe, from the database query to the column definitions. Here is the setup.

![A server-driven SvGrid grid.](/blog-media/server-side-2.png)
*A server-driven SvGrid grid.*

## A typed pagination procedure

Define the grid's query as a tRPC procedure with validated input:

```ts
// server router
import { z } from 'zod'
import { publicProcedure, router } from './trpc'

export const peopleRouter = router({
  list: publicProcedure
    .input(z.object({
      page: z.number().default(0),
      size: z.number().max(200).default(50),
      sort: z.enum(['name', 'salary', 'createdAt']).default('createdAt'),
      desc: z.boolean().default(true),
      q: z.string().default(''),
    }))
    .query(async ({ input }) => {
      const { rows, total } = await queryPeople(input) // your ORM call
      return { rows, total }
    }),
})
```

Using `z.enum` for `sort` both validates input and prevents arbitrary column names, security and types in one move.

## Wire the grid

The client procedure is fully typed, so the result drives `data` and `rowCount` with no casts:

```svelte
<script lang="ts">
  let state = $state({ page: 0, size: 50, sort: 'createdAt' as const, desc: true, q: '' })
  let rows = $state([]), total = $state(0)

  async function load() {
    const res = await trpc.people.list.query(state)
    rows = res.rows; total = res.total
  }
  $effect(() => { load() })
</script>

<SvGrid data={rows} columns={columns} features={features}
  showPagination rowCount={total}
  onSortingChange={(s) => { state = { ...state, sort: (s[0]?.id ?? 'createdAt') as any, desc: !!s[0]?.desc }; load() }}
  onPaginationChange={(p) => { state = { ...state, page: p.pageIndex }; load() }} />
```

## Why it is worth it

- **One source of truth for types.** The procedure's output type flows into your row type and column definitions.
- **Validated inputs.** Zod guards page size and sortable columns at the boundary.
- **Refactor safety.** Rename a field on the server and the grid code fails to compile until you fix it.

Pair tRPC with [TanStack Query](svelte-data-grid-tanstack-query) for caching, or see the general [server-side pattern](server-side-data).

## Frequently asked questions

### How does tRPC help a data grid?

It makes the grid's data call fully typed end to end, the server procedure's input and output types are known on the client, so your column definitions and row handling stay in sync with the backend with no manual types.
