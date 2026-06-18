---
title: A Svelte Data Grid with a Plain REST API
description: Drive SvGrid from any REST backend - mapping the grid's sort, filter, and page state to query parameters, with debouncing and request cancellation.
date: 2026-06-13
category: Integration
tags: rest api, server-side, fetch, integration, svelte data grid
author: Boyko Markov
---

You do not need an ORM, a GraphQL client, or anything clever to drive a grid server-side, a plain REST endpoint and `fetch` will do. The whole trick is mapping SvGrid's state to query parameters and returning a total count. Here is a clean version that holds up in production, debouncing and cancellation included.

## The contract

Your endpoint accepts `page`, `size`, `sort`, `desc`, and `q`, and returns `{ rows, total }`. SvGrid records the state; you translate and fetch.

```ts
async function fetchPeople(s: { page: number; size: number; sort: string; desc: boolean; q: string }, signal: AbortSignal) {
  const params = new URLSearchParams({
    page: String(s.page), size: String(s.size), sort: s.sort, desc: String(s.desc), q: s.q,
  })
  const res = await fetch(`/api/people?${params}`, { signal })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json() as Promise<{ rows: Row[]; total: number }>
}
```

## Wire it with debounce + cancellation

The two things a hand-rolled fetch must get right: do not fire on every keystroke, and do not let a slow old response overwrite a new one.

```svelte
<script lang="ts">
  let s = $state({ page: 0, size: 50, sort: 'name', desc: false, q: '' })
  let rows = $state<Row[]>([]), total = $state(0)
  let controller: AbortController | null = null
  let timer: ReturnType<typeof setTimeout>

  function reload() {
    clearTimeout(timer)
    timer = setTimeout(async () => {
      controller?.abort()
      controller = new AbortController()
      try { const r = await fetchPeople(s, controller.signal); rows = r.rows; total = r.total }
      catch (e) { if ((e as Error).name !== 'AbortError') console.error(e) }
    }, 250)
  }
  $effect(reload)
</script>

<SvGrid data={rows} columns={columns} features={features}
  showPagination rowCount={total}
  onSortingChange={(x) => s = { ...s, sort: x[0]?.id ?? 'name', desc: !!x[0]?.desc }}
  onFiltersChange={(f) => s = { ...s, q: f.columns[0]?.value ?? '' }}
  onPaginationChange={(p) => s = { ...s, page: p.pageIndex }} />
```

## Server side

Whatever your stack, the endpoint runs `ORDER BY`, a `WHERE`/`LIKE`, and `LIMIT`/`OFFSET`, plus a `COUNT(*)`. Return the page and the total. See [client-side vs server-side data](client-side-vs-server-side-data) for when this is worth it.

## Frequently asked questions

### How do I connect SvGrid to a REST API?

Map the grid's sort, filter, and page state to query parameters in a `fetch`, return `{ rows, total }` from your endpoint, and pass them to SvGrid as `data` and `rowCount`. Debounce the requests and cancel stale ones with `AbortController`.
