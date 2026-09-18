---
'@svgrid/grid': minor
---

Add a free infinite row model: block-cached server scrolling, and one prop to
wire it.

`createServerDataSource(source, { mode: 'infinite' })` turns the same datasource
into one long scrollable list instead of a page at a time. Rows load in blocks
as the viewport reaches them, rows nobody has scrolled to render as skeletons,
and the cache holds a bounded number of blocks:

```svelte
const ctl = createServerDataSource(source, {
  mode: 'infinite', blockSize: 100, maxBlocksInCache: 6, onChange,
})

<SvGrid rowModel={ctl} {columns} />
```

`blockSize`, `maxBlocksInCache`, `maxConcurrentRequests`, `blockLoadDebounceMs`
and `initialRowCount` control it; `setViewport`, `retryLoads`, `purge` and
`getCacheState` drive and inspect it. In-flight blocks are deduplicated,
abandoned ones are aborted, and a backend that cannot count cheaply can omit
`rowCount` (or send `-1`) - the list then grows a block at a time until a short
block shows where the data ends. The engine is exported on its own as
`createBlockCache` for anything that needs it directly.

**`rowModel`** is the new one-prop integration. A `GridRowModel` supplies the
rows, the loading flag, the row ids, the external sort and filter wiring, the
visible range, placeholder rows, group accessors, selection and paging - each
only if it implements that part, and any prop written on the grid still wins.
`createServerDataSource` returns one, so the twelve props a server-backed grid
used to need collapse to `rowModel={ctl}` - including the `onFiltersChange`
conversion every app was writing by hand (`toServerFilterColumns` is exported
for anyone who still wants to).

Four smaller props underneath it, usable on their own:

- `onVisibleRangeChange` - the first and last visible row INDEX, coalesced per
  frame. `onScrollBottomReached` only ever means "append more"; this says which
  rows to fetch and which to keep.
- `rowPlaceholder` / `onRetryRow` - mark a row as `"loading"` (a shimmer in each
  cell, `aria-busy`) or `"failed"` (one full-width message and a Retry button).
  Placeholder rows are never selectable.
- `rowSelectionModel` - hand selection to a model that stores the RULE rather
  than a list of ids, so "select all" over a million server rows means a million
  rows and the header checkbox can say so.

`data` is now optional, since `rowModel` can supply the rows instead. A grid
with neither renders empty.

Two fixes found while building this: `api.selectAllRows()` had its own copy of
select-all that had drifted from the header checkbox (it now shares one
implementation, and skips rows that have not loaded), and `api.getPageInfo()`
reported the rows in hand as the total under `externalPagination` instead of
reading `rowCount` - so a 95-row table paged 20 at a time called itself 1 page.
