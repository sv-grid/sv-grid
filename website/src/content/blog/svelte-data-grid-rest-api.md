---
title: A Svelte Data Grid with a Plain REST API
description: Wire SvGrid to any paginated REST endpoint - serializing sort, filter, and page state into query params, handling debounce, and cancelling stale requests before they land.
date: 2026-06-13
updated: 2026-07-02
category: Integration
tags: rest api, server-side, fetch, integration, svelte data grid
author: Boyko Markov
---
Most REST APIs that back a data grid are dead simple: a single `GET /api/things` endpoint that accepts `page`, `size`, `sort`, and a filter parameter, and returns `{ rows: [...], total: N }`. You do not need a GraphQL client, a data-fetching library, or a custom hook abstraction to wire this to SvGrid. You need three things done correctly: query param serialization, a debounce on filter input so you are not firing a request per keystroke, and request cancellation so a slow response from page 3 does not stomp the results the user is already looking at on page 7.

## Mapping grid state to query params

The grid tells you about sort, filter, and pagination changes through callbacks. Your job is to translate those callbacks into your own reactive variables, then build a `URLSearchParams` from them before each fetch.

The important decision is what those reactive variables look like. Keep them flat and primitive - strings and numbers - rather than mirroring the grid's internal state objects. That makes serialization trivial and keeps the component easy to read.

```ts
// people-columns.ts
import {
  tableFeatures,
  rowSortingFeature,
  columnFilteringFeature,
  rowPaginationFeature,
  type ColumnDef,
} from '@svgrid/grid'

export type Person = {
  id: number
  firstName: string
  lastName: string
  department: string
  country: string
  age: number
  salary: number
}

export const features = tableFeatures({
  rowSortingFeature,
  columnFilteringFeature,
  rowPaginationFeature,
})

export const columns: ColumnDef<typeof features, Person>[] = [
  { field: 'firstName',  header: 'First name' },
  { field: 'lastName',   header: 'Last name' },
  { field: 'department', header: 'Department' },
  { field: 'country',    header: 'Country' },
  { field: 'age',        header: 'Age',    type: 'number' },
  {
    field: 'salary',
    header: 'Salary',
    type: 'number',
    format: { type: 'currency', currency: 'USD', options: { maximumFractionDigits: 0 } },
  },
]
```

Separating column definitions from the component keeps the component under 80 lines and makes the column list easy to modify without touching fetch logic.

## The wiring: callbacks, state, and a single fetch function

The pattern is: one `$effect` that watches your flat query variables and calls `scheduleLoad`, one `loadPage` function that builds the URL, one `AbortController` that gets replaced on every call.

```svelte
<!-- PeopleGrid.svelte -->
<script lang="ts">
  import SvGrid, { type SvGridApi } from '@svgrid/grid'
  import { features, columns, type Person } from './people-columns'

  // ── query state ───────────────────────────────────────────────
  let page = $state(0)
  let size = $state(25)
  let sort = $state('lastName')
  let desc = $state(false)
  let q    = $state('')

  // ── response state ────────────────────────────────────────────
  let rows    = $state<Person[]>([])
  let total   = $state(0)
  let loading = $state(false)
  let error   = $state<string | null>(null)

  // ── inflight control ──────────────────────────────────────────
  let controller: AbortController | null = null
  let timer: ReturnType<typeof setTimeout> | null = null
  let api = $state<SvGridApi<typeof features, Person> | null>(null)

  async function loadPage() {
    if (controller) controller.abort()
    controller = new AbortController()
    loading = true
    error = null
    try {
      const params = new URLSearchParams({
        page: String(page),
        size: String(size),
        sort,
        desc: String(desc),
        q,
      })
      const res = await fetch(`/api/people?${params}`, { signal: controller.signal })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const body = (await res.json()) as { rows: Person[]; total: number }
      rows  = body.rows
      total = body.total
    } catch (e) {
      if ((e as Error).name !== 'AbortError') error = (e as Error).message
    } finally {
      loading = false
    }
  }

  function scheduleLoad() {
    if (timer !== null) clearTimeout(timer)
    timer = setTimeout(loadPage, 250)
  }

  $effect(scheduleLoad)

  // ── grid callbacks ────────────────────────────────────────────
  function onSortingChange(clauses: Array<{ id: string; desc: boolean }>) {
    sort = clauses[0]?.id   ?? 'lastName'
    desc = clauses[0]?.desc ?? false
    page = 0
    api?.setPage(0)
  }

  function onFiltersChange(state: { columns: Array<{ id: string; value: string }> }) {
    q    = state.columns[0]?.value ?? ''
    page = 0
    api?.setPage(0)
  }

  function onPaginationChange(p: { pageIndex: number; pageSize: number }) {
    page = p.pageIndex
    size = p.pageSize
  }
</script>

{#if error}
  <p class="grid-error">Failed to load: {error}</p>
{/if}

<SvGrid
  {features}
  {columns}
  data={rows}
  rowCount={total}
  showPagination
  pageSizeOptions={[25, 50, 100]}
  {loading}
  onApiReady={(a) => { api = a }}
  {onSortingChange}
  {onFiltersChange}
  {onPaginationChange}
/>
```

A few things are worth calling out explicitly.

`rowCount={total}` is not optional. If you pass only `data` without `rowCount`, SvGrid assumes client-side mode and paginates the 25 rows you gave it internally. The pagination bar will show "25 of 25" no matter how many rows exist on the server. Once `rowCount` is set and it exceeds `data.length`, SvGrid disables its internal sort and filter so they do not corrupt server-returned order.

`api?.setPage(0)` in the sort and filter callbacks tells the grid's pagination UI to reset its display immediately - before the debounce fires and the new page of data arrives. Without it, if a user is on page 8 and types a filter, the pagination control stays on page 8 during the 250 ms debounce window, then jumps to page 1 when data lands. That visual inconsistency is avoidable.

## Why the AbortController matters

Suppose the user has a slow connection and types "alice" in the filter box. Five requests fire in quick succession - one per character - each taking 400 ms because the server runs an unindexed LIKE query. Without cancellation, responses arrive out of order. The "a" query finishes last and overwrites the "alice" results, leaving the grid showing every person whose name starts with "a" instead of just the Alices.

The fix is mechanical: before each new fetch, call `controller.abort()` on the previous one, then assign a fresh `AbortController`. The `AbortError` is a normal outcome - do not surface it as a user-visible error, which is why the catch block checks `e.name !== 'AbortError'` before setting `error`.

The debounce at 250 ms reduces the number of requests that actually launch. The AbortController handles the ones that slip through when the user types quickly. You need both.

## Three things that go wrong in production

**Forgetting to reset `page` on filter change.** If `q` changes but `page` stays at 4, you send `page=4&q=alice`. The server returns results 100-124 of the Alice-filtered set, which may be empty even though Alice appears 800 times total. The grid shows a blank page and users assume the filter broke. Always reset `page = 0` and call `api?.setPage(0)` together whenever a filter or sort changes.

**`desc` as a boolean vs. a string.** `URLSearchParams` serializes `true` and `false` to the strings `"true"` and `"false"`. Your server route must parse them as strings, not as `1`/`0`. If your backend uses a different convention - say `order=asc` or `order=desc` - then adjust the serialization on the client rather than papering over it with coercion on the server. Pick one encoding and keep it consistent across routes.

**Multi-column sort.** The example above reads only `clauses[0]` from `onSortingChange`. That is correct for single-column sort. If you enable multi-column sort in the grid and your API supports it, serialize the full array: either as repeated params (`sort=lastName&sort=age&desc=false&desc=true`) or as a JSON-encoded string in a single param. Do not silently drop the secondary sort columns - users who carefully set a secondary sort will report it as a bug.

## The right debounce for your backend

250 ms is the number that works for most situations. The logic: a fast typist can hit 5-6 keystrokes per second, so 200 ms catches most bursts without feeling sluggish. Add 50 ms of margin for variability. If your filter endpoint uses a full-text index and consistently returns in under 60 ms, you can drop to 150 ms and the grid will feel noticeably more responsive. If your endpoint runs an unindexed LIKE on a 10-million-row table and takes 800 ms, raise the debounce to 400-500 ms to avoid queuing slow queries on top of each other. Profile the actual p95 latency before adjusting - do not guess.

## Adding a global search box

If your API exposes a single `q` param as a global text search rather than per-column filters, wire it to the `showGlobalFilter` prop and a single state variable instead of using per-column filter callbacks.

```svelte
<script lang="ts">
  // ... same imports and fetch logic ...

  function onGlobalFilterChange(value: string) {
    q    = value
    page = 0
    api?.setPage(0)
  }
</script>

<SvGrid
  {features}
  {columns}
  data={rows}
  rowCount={total}
  showPagination
  showGlobalFilter
  {loading}
  onApiReady={(a) => { api = a }}
  onGlobalFilterChange={onGlobalFilterChange}
  {onSortingChange}
  {onPaginationChange}
/>
```

The rest of the component stays the same. `q` flows into the `URLSearchParams` the same way it did when it came from a column filter. If your API supports both a global `q` and per-column filters at the same time, add both callbacks and merge them into the query params before the fetch.

For a runnable version of this pattern against synthetic data, see the `/demos/09-server-side` example in the repository. The infinite-scroll variant - useful when your dataset is too large for page controls to be meaningful - is at `/demos/33-server-infinite`.
