---
title: A Svelte Data Grid with Prisma
description: Connect SvGrid to a Prisma backend in SvelteKit - server-side pagination, sorting, and filtering with findMany, orderBy, where, and a count.
date: 2026-06-13
category: Integration
tags: prisma, sveltekit, server-side, integration, svelte data grid
author: Boyko Markov
---

Prisma is the ORM a lot of teams already reach for, and it happens to line up almost perfectly with what a grid asks for: `orderBy` is your sort, `where` is your filter, `skip`/`take` is your page, and `count` is your pager total.

![Server-side data from Prisma in SvGrid](/blog-media/server-side-2.png)
*A Prisma-backed server row model in SvGrid.*

## The query

```ts
// server
import { prisma } from '$lib/server/prisma'

export async function queryPeople(o: {
  page: number; size: number; sort: string; desc: boolean; q: string
}) {
  const where = o.q ? { name: { contains: o.q, mode: 'insensitive' as const } } : {}
  const [rows, total] = await Promise.all([
    prisma.person.findMany({
      where,
      orderBy: { [o.sort]: o.desc ? 'desc' : 'asc' },
      skip: o.page * o.size,
      take: o.size,
    }),
    prisma.person.count({ where }),
  ])
  return { rows, total }
}
```

Running the page query and the count in `Promise.all` keeps the request fast.

## Connect to the grid

Put this behind a SvelteKit endpoint or server load function, then drive SvGrid in external mode, read sort/filter/page from the callbacks, fetch, and return rows plus a total `rowCount`. The component side is in [Server-Side Data](server-side-data).

```svelte
<SvGrid data={rows} columns={columns} features={features}
  showPagination rowCount={total}
  onSortingChange={(s) => load({ sort: s[0]?.id, desc: !!s[0]?.desc })}
  onPaginationChange={(p) => load({ page: p.pageIndex })} />
```

## Types

Prisma generates a type per model (`Person`), so type your columns `ColumnDef<{}, Person>[]` and a schema change becomes a compile error in the grid.

## Production checklist

- Validate `o.sort` against an allowed set so only real columns can order the query.
- Add database indexes for sorted/filtered fields.
- Debounce filter input and cancel superseded requests.
- Use Prisma's `select` to return only the columns the grid shows.

## Frequently asked questions

### How do I paginate Prisma for a data grid?

Use `skip: page * size` and `take: size` in `findMany`, plus a `count` with the same `where`, and run them together with `Promise.all`. Pass the rows to SvGrid as `data` and the count as `rowCount`.

### How do I filter a Prisma query from the grid?

Translate SvGrid's filter model into a Prisma `where` object - for example `{ name: { contains: q, mode: 'insensitive' } }` - applied to both the `findMany` and the `count` so the pager total matches the filtered set.
