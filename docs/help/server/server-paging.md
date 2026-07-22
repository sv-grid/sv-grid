# Server paging

When the [Server-Side Row Model](./server-row-model.md) holds one page in memory,
paging is just the act of choosing which page. The `createServerDataSource`
controller turns a page index into an offset/limit request, asks your backend for
exactly those rows plus a total, and hands both back so a pager can draw itself.
This page is the deep dive on that loop: how the numbers are computed, how to wire
a "Load more" or numbered pager, how to change page size, and what to do when the
backend cannot cheaply count the total.

<div data-docs-demo="148-server-row-model" data-height="480"></div>

![A page round-trip: the pager calls ctl.setPage, the controller calls getRows with startRow and endRow, the backend runs LIMIT and OFFSET, and returns rows plus rowCount for the grid to render one page.](/docs-media/server-paging.svg)

## Offset / limit, computed for you

You never compute the offset yourself. When you call `setPage(i)` or
`setPageSize(n)`, the controller derives the row window from `pageIndex` and
`pageSize` and passes all four numbers into every `getRows` request:

```ts
type ServerRequest = {
  startRow: number   // pageIndex * pageSize        -> SQL OFFSET
  endRow: number     // startRow + pageSize (exclusive) -> OFFSET + LIMIT
  pageIndex: number
  pageSize: number
  sortModel: ServerSortModel
  filterModel: ServerFilterModel
}
```

`startRow` is inclusive and `endRow` is one past the last row wanted, so the page
size is exactly `endRow - startRow`. In SQL that is a plain window:

```sql
SELECT * FROM people
ORDER BY id
LIMIT  $pageSize          -- endRow - startRow
OFFSET $startRow;         -- pageIndex * pageSize
```

Your `getRows` returns the page and the total:

```ts
import { createServerDataSource, type ServerDataSource } from '@svgrid/grid'

type Row = { id: number; name: string }

const source: ServerDataSource<Row> = {
  async getRows({ startRow, endRow }) {
    const limit = endRow - startRow
    const res = await fetch(`/api/people?offset=${startRow}&limit=${limit}`)
    const { rows, total } = await res.json()
    return { rows, rowCount: total } // rowCount = total AFTER filtering
  },
}
```

## rowCount is the total after filtering

`rowCount` is not the number of rows you returned on this page - it is the total
number of rows the current filter matches across the whole table. The controller
stores it as `state.total` and, on every emit, computes the page count from it:

```ts
// inside the controller, on each state change:
state.pageCount = Math.max(1, Math.ceil(state.total / state.pageSize))
```

So `pageCount` is `ceil(total / pageSize)`, clamped to a minimum of 1, and it is
handed to you ready-made on `ServerState`. When a filter narrows the result set,
your next `getRows` returns a smaller `rowCount`, `pageCount` shrinks, and the
pager redraws with fewer pages. That is why `setSort` and `setFilter` both jump
back to page 0: the old page index may no longer exist.

## Reading the paging state

`onChange` fires on every transition with the full snapshot; the paging-relevant
fields are:

```ts
type ServerState<Row> = {
  rows: ReadonlyArray<Row>
  total: number       // rowCount from the last fetch (after filtering)
  loading: boolean    // a getRows fetch is in flight
  pageIndex: number   // zero-based
  pageSize: number
  pageCount: number   // ceil(total / pageSize), min 1
  // ...sortModel, filterModel, saving, error
}
```

Wire it up in Svelte with runes:

```svelte
<script lang="ts">
  import { SvGrid } from '@svgrid/grid'
  import { createServerDataSource, type ServerState } from '@svgrid/grid'
  import { source, columns } from './people'

  let view = $state<ServerState<Row>>()
  const ctl = createServerDataSource(source, {
    pageSize: 50,
    onChange: (s) => (view = s),
  })
  ctl.refresh()
</script>

{#if view}
  <SvGrid
    data={view.rows}
    {columns}
    loading={view.loading}
    pageable={false}
  />
{/if}
```

`pageable={false}` hands paging to your own pager plus the controller - the grid
does not slice or count the data itself, because the server already did.

## A numbered pager

With `pageIndex` and `pageCount` in hand, a numbered pager is `setPage` calls
against a clamped range. `setPage` ignores a no-op (the same index) and clamps a
negative index to 0, so you can wire buttons directly:

```svelte
{#if view}
  <nav aria-label="Pagination">
    <button disabled={view.pageIndex === 0}
            onclick={() => ctl.setPage(view.pageIndex - 1)}>Prev</button>

    <span>Page {view.pageIndex + 1} of {view.pageCount}</span>

    <button disabled={view.pageIndex >= view.pageCount - 1}
            onclick={() => ctl.setPage(view.pageIndex + 1)}>Next</button>
  </nav>
{/if}
```

`setPage` does not clamp against `pageCount` for you - it only floors at 0 - so
disable the Next button (or clamp the argument) at the last page as shown.

## "Load more" instead of pages

A "Load more" button is the same controller, accumulating rows in your component
instead of replacing them. Keep a running list, and on each `getRows` append the
new page rather than swapping it:

```svelte
<script lang="ts">
  let all = $state<Row[]>([])
  let view = $state<ServerState<Row>>()

  const ctl = createServerDataSource(source, {
    pageSize: 50,
    onChange: (s) => {
      view = s
      // Append the freshly loaded page to what we already have.
      all = s.pageIndex === 0 ? [...s.rows] : [...all, ...s.rows]
    },
  })
  ctl.refresh()

  const hasMore = $derived(!!view && view.pageIndex < view.pageCount - 1)
  const loadMore = () => view && ctl.setPage(view.pageIndex + 1)
</script>

<SvGrid data={all} {columns} loading={view?.loading} pageable={false} />

{#if hasMore}
  <button onclick={loadMore} disabled={view?.loading}>Load more</button>
{/if}
```

Note that a `setSort` or `setFilter` returns to page 0, at which point the
`s.pageIndex === 0` branch resets the accumulator - which is exactly what you
want, because the ordering or the matching set just changed.

## Changing page size

`setPageSize(n)` sets a new size, resets to page 0, and re-fetches. It floors the
size at 1, so a bad input can never produce an empty request:

```svelte
<label>
  Rows per page
  <select onchange={(e) => ctl.setPageSize(Number(e.currentTarget.value))}>
    {#each [25, 50, 100] as n}
      <option value={n} selected={view?.pageSize === n}>{n}</option>
    {/each}
  </select>
</label>
```

Because `pageCount` is derived from `total / pageSize`, changing the size
immediately reshapes the pager on the next emit - no extra bookkeeping.

## The unknown-total case

Some backends cannot cheaply produce an exact `COUNT(*)` for the filtered set -
a large table, an expensive join, or a search API that only reports "there are
more". `rowCount` still has to be a number, so you have two honest options.

**Return an estimate.** If your database can give a cheap approximate count (for
example Postgres `reltuples`), pass it as `rowCount`. `pageCount` will be an
estimate too, which is fine for a "Page 4 of ~2,000" label - just don't hard-disable
Next purely on the estimate.

**Drive "Load more" from a `hasMore` flag.** When you truly cannot count, over-fetch
by one row to learn whether another page exists, and report an open-ended total so
the controller never thinks it has reached the end:

```ts
const source: ServerDataSource<Row> = {
  async getRows({ startRow, endRow }) {
    const limit = endRow - startRow
    // Ask for one extra row than the page needs.
    const res = await fetch(`/api/search?offset=${startRow}&limit=${limit + 1}`)
    const rows: Row[] = await res.json()

    const hasMore = rows.length > limit
    const page = hasMore ? rows.slice(0, limit) : rows

    // No real total: report "at least this many, plus one more page" while
    // there is more, so pageCount always leaves a next page to load.
    const rowCount = hasMore ? startRow + page.length + 1 : startRow + page.length
    return { rows: page, rowCount }
  },
}
```

Now pair it with the "Load more" pattern above: `hasMore` (derived from
`pageIndex < pageCount - 1`) stays true until the last, short page arrives, at
which point `rowCount` settles to the real running total and the button hides.
Avoid a numbered pager in this mode - the page numbers would be fictional.

## See also

- [Server-Side Row Model](./server-row-model.md) - the full datasource contract, controller methods, writes, and race safety.
- [Server sorting](./server-sorting.md) - the sibling deep dive on the sort model and ORDER BY.
