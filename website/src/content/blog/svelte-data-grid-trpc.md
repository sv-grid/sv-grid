---
title: An End-to-End Typed Svelte Data Grid with tRPC
description: Use tRPC to drive SvGrid with full type safety from server to grid - a typed pagination procedure, input validation, and the grid wiring.
date: 2026-06-13
category: Integration
tags: trpc, sveltekit, server-side, type safety, svelte data grid
author: Victor Vidolov
---

tRPC gives you typed remote procedure calls with no schema duplication - the client knows the server's input and output types. Combined with SvGrid, you get a data grid that is type-safe from the database query all the way to the column definitions. Here is the setup.

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

Using `z.enum` for `sort` both validates input and prevents arbitrary column names - security and types in one move.

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

It makes the grid's data call fully typed end to end - the server procedure's input and output types are known on the client, so your column definitions and row handling stay in sync with the backend with no manual types.

### How do I prevent unsafe sort columns with tRPC?

Validate the `sort` input with `z.enum([...])` listing only allowed columns. Invalid values are rejected at the boundary, which is both a type guarantee and protection against injecting arbitrary column names.
