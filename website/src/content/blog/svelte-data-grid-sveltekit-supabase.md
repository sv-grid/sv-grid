---
title: A Svelte Data Grid with SvelteKit and Supabase
description: Wire SvGrid to a Supabase Postgres backend in SvelteKit - server-side pagination, sorting, and filtering with range queries and an accurate total count.
date: 2026-06-24
category: Integration
tags: sveltekit, supabase, server-side, integration, svelte data grid
author: SvGrid Team
---

Supabase gives you a Postgres database with a clean JavaScript client; SvelteKit gives you load functions and server endpoints. Together they are a great backend for a data grid. Here is how to drive SvGrid server-side from Supabase so it scales past what fits in the browser.

## The shape of the integration

For anything beyond a few thousand rows, let the database do the work: SvGrid records the sort, filter, and page state, and Supabase returns the matching page plus a total count. Supabase's `.range()` and the `{ count: 'exact' }` option map directly onto what the grid's pager needs.

## A server endpoint

Put the query behind a SvelteKit endpoint so credentials stay on the server:

```ts
// src/routes/api/people/+server.ts
import { json } from '@sveltejs/kit'
import { supabase } from '$lib/server/supabase'

export async function GET({ url }) {
  const page = Number(url.searchParams.get('page') ?? 0)
  const size = Number(url.searchParams.get('size') ?? 50)
  const sort = url.searchParams.get('sort') ?? 'created_at'
  const desc = url.searchParams.get('desc') === 'true'
  const q = url.searchParams.get('q') ?? ''

  let query = supabase
    .from('people')
    .select('*', { count: 'exact' })
    .order(sort, { ascending: !desc })
    .range(page * size, page * size + size - 1)

  if (q) query = query.ilike('name', `%${q}%`)

  const { data, count, error } = await query
  if (error) return json({ error: error.message }, { status: 500 })
  return json({ rows: data, total: count ?? 0 })
}
```

The `count: 'exact'` gives you the total the pager needs; `.range()` is your LIMIT/OFFSET.

## The grid

In the component, fetch on every state change and feed the result back:

```svelte
<script lang="ts">
  let rows = $state([])
  let total = $state(0)
  let state = { page: 0, size: 50, sort: 'created_at', desc: true, q: '' }

  async function load() {
    const p = new URLSearchParams(state as any)
    const res = await fetch(`/api/people?${p}`).then((r) => r.json())
    rows = res.rows
    total = res.total
  }
  $effect(() => { load() })
</script>

<SvGrid
  data={rows}
  columns={columns}
  features={features}
  showPagination={true}
  pageSize={50}
  rowCount={total}
  onSortingChange={(s) => { state = { ...state, sort: s[0]?.id ?? 'created_at', desc: !!s[0]?.desc }; load() }}
  onPaginationChange={(p) => { state = { ...state, page: p.pageIndex }; load() }}
/>
```

## Production touches

- **Debounce the search** so typing does not fire a query per keystroke.
- **Cancel stale requests** so a slow earlier response cannot overwrite a newer page.
- **Use Row Level Security** in Supabase so the endpoint only returns what the user may see.
- **Index the sort/filter columns** in Postgres - server-side paging is only fast if the database is.

## Frequently asked questions

### How do I paginate a Supabase query for a data grid?

Use `.range(from, to)` for the page slice and `.select('*', { count: 'exact' })` to get the total row count. Feed the rows to SvGrid as `data` and the count as `rowCount` so the pager is accurate.

### Where should the Supabase query live in SvelteKit?

Behind a server endpoint (`+server.ts`) or in a server load function, so your keys and Row Level Security stay on the server. The grid calls it with the current sort, filter, and page state.
