# Server-side infinite scroll

One long list, a million rows on the server, and a scrollbar that covers all
of them: the grid asks for the block under the viewport, shows placeholder
rows for what has not arrived, and forgets blocks it scrolled far past.
`createServerDataSource` does this in `infinite` mode over the same
`getRows` contract as [page mode](./server-row-model.md), and the grid wires
itself to it through one prop.

<div data-docs-demo="148-server-row-model" data-height="480"></div>

## Quick start

```svelte
<script lang="ts">
  import { SvGrid, createServerDataSource, type ServerDataSource } from '@svgrid/grid'

  const source: ServerDataSource<Row> = {
    async getRows({ startRow, endRow, sortModel, filterModel, signal }) {
      // `signal` aborts when the block is scrolled out of the cache or purged.
      const res = await fetch('/api/rows', { method: 'POST', body: JSON.stringify({ startRow, endRow, sortModel, filterModel }), signal })
      const { rows, total } = await res.json()
      return { rows, rowCount: total }
    },
  }

  const ctl = createServerDataSource(source, { mode: 'infinite', blockSize: 100, maxBlocksInCache: 10 })
</script>

<SvGrid rowModel={ctl} {columns} sortable filterable />
```

`rowModel={ctl}` is the whole wiring. The controller supplies the rows, the
loading flag, the external sort and filter hooks, the visible range and the
placeholder rows; the grid reads each one from it. A prop written on the
grid still wins, so adopting the model is never all-or-nothing.

## How a block loads

The grid reports the row indices on screen; the controller turns them into
block numbers (`blockSize` rows per block) and fetches the blocks it does not
have. A request is `getRows({ startRow, endRow, ... })` with the block's
bounds, so the backend does the same `OFFSET` / `LIMIT` it does for a page.

Until a block lands, its rows are **placeholders**: the grid draws a shimmer
in every cell and marks the row `aria-busy`. Placeholder rows cannot be
selected, edited or navigated into; there is nothing there yet. A block whose
request rejected keeps its rows as a tinted band with one full-width "could
not load" message and a **Retry** button on the first row in view, which
re-fetches that block and no other (`retryLoads()` re-fetches every failed
block). A first block that fails before anything is known
about the list stays `initialRowCount` rows tall, so the message is not
followed by a hundred empty slots.

The options mirror what a block cache needs, and nothing more:

| Option                  | Default   | Does                                                                 |
| ----------------------- | --------- | -------------------------------------------------------------------- |
| `mode: 'infinite'`      | `'page'`  | One scrollable list instead of a pager.                              |
| `blockSize`             | `100`     | Rows per request.                                                    |
| `maxBlocksInCache`      | unlimited | Loaded blocks to keep; the least recently seen is evicted past this. |
| `maxConcurrentRequests` | `2`       | Requests in flight at once; the rest queue.                          |
| `blockLoadDebounceMs`   | `0`       | Wait for the scroll to settle this long before fetching.             |
| `initialRowCount`       | `1`       | Rows to claim before anything has loaded, so there is a scrollbar.   |

An evicted block reloads when scrolled back to, at the cost of one request;
set `maxBlocksInCache` when the rows are wide enough that holding all of
them would matter.

## When the count is unknown

Counting a filtered million rows can cost more than fetching a block of
them. Return `rowCount: -1` and the controller runs without a total: the
scrollbar grows one block past the highest loaded block, and the end is
wherever the first short block arrives. `state.lastRowKnown` says which
state it is in.

## Refresh, purge, retry

| Method           | Does                                                                              |
| ---------------- | --------------------------------------------------------------------------------- |
| `refresh()`      | Re-fetch the loaded blocks in place; keeps the row count and the scroll position. |
| `purge()`        | Drop every cached block and reload from the current viewport.                     |
| `retryLoads()`   | Re-fetch the blocks that failed.                                                  |
| `getCacheState()`| Every block with its status: `loading`, `loaded`, `failed`.                       |
| `setViewport(a, b)` | Tell the controller what is on screen. The `rowModel` prop does this for you.  |

Sorting and filtering go through `setSort` / `setFilter` as in page mode; both
drop the cache, because the row at index 200 is a different row once the
order changes.

## Writes

`createRow`, `updateRow` and `deleteRow` work as in page mode. After a write
the controller re-reads the blocks it holds, in place, so the list keeps its
length and its scroll. With `optimistic` on (and a `getRowId`), an update
patches the cached row at once and a delete removes it, both rolled back if
the server rejects.

## Wiring without the prop

`rowModel` is a convenience. Every seam it fills is a plain prop you can wire
yourself, which is also how a model of your own would plug in:

```svelte
<SvGrid
  data={view.rows}
  loading={view.loading}
  externalSort externalFilter
  onSortingChange={(s) => ctl.setSort(s)}
  onFiltersChange={(f) => ctl.setFilter(f)}
  onVisibleRangeChange={(r) => ctl.setViewport(r.startIndex, r.endIndex)}
  rowPlaceholder={rowPlaceholderState}
  onRetryRow={() => ctl.retryLoads()}
/>
```

`rowPlaceholderState` (exported from `@svgrid/grid`) reads the marker the
controller puts on its placeholder rows; a model that makes its own can mark
them with `createRowPlaceholder`.

## What stays free, and what does not

Flat infinite scroll, sorting, filtering, the global search and row CRUD are
the free row model. Grouping on the server with lazy expand per level, tree
data, pivot, transactions on loaded blocks, and a selection that reaches rows
the grid never loaded are the Enterprise
[Server-Side Row Model](./server-grouping.md) - the same contract, the same
`rowModel` prop, more of the request filled in.

## More examples

### Server-side infinite scroll, by hand

The same block-by-block loading without the controller: a 100k-event audit log behind a mock API, sparse chunked load on scroll, sort and filter pushed to the server. The manual pattern, for a backend the contract does not fit.

<div data-docs-demo="33-server-infinite" data-height="520"></div>

### Live 10M-row dashboard

A ten-million-transaction stream behind a mock API: server-side paging, sort and filter with live deltas merged into the loaded page.

<div data-docs-demo="118-live-dashboard" data-height="520"></div>

## See also

- [Server-Side Row Model](./server-row-model.md) - the contract, the page-mode controller, the request and filter shapes.
- [Server grouping](./server-grouping.md) - lazy grouping over the same contract (Enterprise).
- [Server-side data](../server-side-data.md) - the wider overview, including the manual sparse-scroll pattern for any backend.
