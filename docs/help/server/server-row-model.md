# Server-Side Row Model (SSRM)

When the data lives on the server - millions of rows in a database - the grid
should hold only the page on screen and push sorting, filtering, and paging to
the backend. SvGrid packages this as **one datasource contract**: you implement
a single async `getRows`, and `createServerDataSource` owns the request
lifecycle (paging, sort, filter, race-safety, writes).

![The createServerDataSource request lifecycle: setSort, setFilter, and setPage trigger a fetch that tags each getRows call with a monotonic request id, and only the latest request lands as a ServerState of rows, total, loading, saving, and error that the grid renders from.](/docs-media/server-controller-state.svg)

<div data-docs-demo="148-server-row-model" data-height="480"></div>

> **Scope.** `createServerDataSource` is the free, flat row model: one page at
> a time in `page` mode, or one long block-cached list in
> [`infinite` mode](./server-infinite-scroll.md). Grouping, tree data, pivot,
> transactions and selection across unloaded rows are the Enterprise
> [Server-Side Row Model](./server-grouping.md), built on the same contract.
> See [what this does not do](#what-this-does-not-do).

## Quick start

```ts
import { createServerDataSource, type ServerDataSource } from '@svgrid/grid'

const source: ServerDataSource<Row> = {
  async getRows({ startRow, endRow, sortModel, filterModel }) {
    const res = await fetch('/api/rows', {
      method: 'POST',
      body: JSON.stringify({ startRow, endRow, sortModel, filterModel }),
    })
    const { rows, total } = await res.json()
    return { rows, rowCount: total } // rowCount = total AFTER filtering
  },
}

let view = $state(/* ServerState */)
const ctl = createServerDataSource(source, { pageSize: 50, onChange: (s) => (view = s) })
ctl.refresh()
```

## The request your server receives

Every fetch calls `getRows(request)` with this exact shape:

```ts
type ServerRequest = {
  startRow: number   // first row wanted, inclusive  (= pageIndex * pageSize)
  endRow: number     // one past the last row wanted, exclusive
  pageIndex: number
  pageSize: number
  sortModel: ServerSortModel
  filterModel: ServerFilterModel
}
```

`startRow` / `endRow` are the **page** bounds (they map to `OFFSET` / `LIMIT`),
not block-cache bounds. Return `{ rows, rowCount }` where `rowCount` is the total
count **after filtering** - the pager needs it to compute the last page.

Every request also carries `signal`, an `AbortSignal` the grid aborts when it
no longer wants the answer: a newer page superseded this one, a block was
purged or scrolled out of the cache, a group was collapsed, the controller
was disposed. Hand it to `fetch(url, { signal })` and a query the user has
scrolled past is cancelled at the server instead of completing for nothing;
the grid ignores the rejection the abort produces. The SvelteKit transport
does this for you and keeps the signal out of the posted body.

### The sort model

```ts
type ServerSortModel = Array<{ id: string; desc: boolean }>
```

Multi-column, in priority order. So this:

```json
[{ "id": "lastName", "desc": false }, { "id": "age", "desc": true }]
```

maps to `ORDER BY last_name ASC, age DESC`.

### The filter model

```ts
type ServerFilterModel = {
  global?: string                 // the quick-filter search box
  columns?: Record<string, {      // keyed by column id
    operator: string              // equals | contains | startsWith | greaterThan | lessThan | between | isBlank
    value: string
    valueTo?: string              // second bound, for `between`
    selectedValues?: string[]     // set-filter (facet checklist) selection
  }>
}
```

A populated model looks like:

```json
{
  "global": "berlin",
  "columns": {
    "status":  { "operator": "equals",  "value": "active" },
    "age":     { "operator": "between", "value": "18", "valueTo": "65" },
    "country": { "operator": "contains", "value": "", "selectedValues": ["DE", "FR"] }
  }
}
```

## Translating the model to SQL

Map each column filter's `operator` to a predicate:

| `operator`     | SQL                              |
| -------------- | -------------------------------- |
| `equals`       | `col = $value`                   |
| `contains`     | `col ILIKE '%' || $value || '%'` |
| `startsWith`   | `col ILIKE $value || '%'`        |
| `greaterThan`  | `col > $value`                   |
| `lessThan`     | `col < $value`                   |
| `between`      | `col BETWEEN $value AND $valueTo`|
| `isBlank`      | `col IS NULL OR col = ''`        |
| `selectedValues` present | `col IN ($selectedValues)` |

`global` is a free-text search you `OR` across your searchable columns. Always
bind values as parameters - never string-concatenate them into SQL.

You do not have to hand-write that switch. `@svgrid/enterprise` ships
`normalizeFilters(filterModel)`, which returns `{ predicates, search }` with the
operators already normalized to `in` / `contains` / `startsWith` / `eq` / `gt` /
`lt` / `between` - the same helper the built-in REST and SQL sources use. For a
complete, runnable server (route + query builder), follow the
[Postgres CRUD tutorial](../../enterprise/studio/postgres-grid.md).

## Wiring to the grid

The controller is a **row model**: hand it to the grid and every seam is
wired - the rows, the loading flag, external sort and filter, the pager in
page mode, the visible range and the placeholder rows in infinite mode:

```svelte
<SvGrid rowModel={ctl} {columns} {features} sortable filterable pageable />
```

A prop written on the grid beats what the model supplies, so you can adopt
the model and still override one piece. The long form spells out the same
seams by hand, which is also how a model of your own plugs in:

```svelte
<SvGrid
  data={view.rows}
  {columns} {features}
  sortable filterable
  externalSort externalFilter
  loading={view.loading}
  externalPagination rowCount={view.total} pageIndex={view.pageIndex} pageSize={view.pageSize}
  onSortingChange={(sorting) => ctl.setSort(sorting)}
  onFiltersChange={(f) => ctl.setFilter(f)}
  onPaginationChange={(p) => (p.pageSize !== view.pageSize ? ctl.setPageSize(p.pageSize) : ctl.setPage(p.pageIndex))}
/>
```

`externalSort` / `externalFilter` tell the grid to emit intent instead of acting
locally; `externalPagination` hands the pager the server's count.

## Infinite mode

Pass `mode: 'infinite'` and there are no pages: `state.rows` spans the whole
result, placeholder rows stand in for blocks nobody has scrolled to, and
blocks of `blockSize` rows load as the viewport reaches them, with an LRU
cap, a concurrency cap, retry for failed blocks and an unknown-count mode.
[Server-side infinite scroll](./server-infinite-scroll.md) covers it.

## The controller

`createServerDataSource(source, options)` returns:

| Method              | Does                                                     |
| ------------------- | -------------------------------------------------------- |
| `refresh()`         | Re-fetch the current page (after a mutation).            |
| `setSort(model)`    | New sort, jump to page 0, fetch.                         |
| `setFilter(model)`  | New filter, jump to page 0, fetch.                       |
| `setPage(i)`        | Fetch page `i`.                                          |
| `setPageSize(n)`    | New page size, page 0, fetch.                            |
| `createRow(input)`  | Create through the source, then refresh. Throws if the source has no `createRow`. |
| `updateRow(id, p)`  | Update by id. Optimistic when configured (below).        |
| `deleteRow(id)`     | Delete by id. Optimistic when configured.                |
| `getState()`        | Snapshot of the current `ServerState`.                   |
| `dispose()`         | Stop accepting in-flight responses. Call on unmount.     |

## The state you render from

`onChange` fires on every transition. The full shape:

```ts
type ServerState<Row> = {
  rows: ReadonlyArray<Row>
  total: number        // total after filtering (drives the pager)
  loading: boolean     // a getRows fetch is in flight
  saving: boolean      // a create / update / delete is in flight
  error: unknown       // the rejection from the last failed getRows (else null)
  pageIndex: number
  pageSize: number
  pageCount: number
  sortModel: ServerSortModel
  filterModel: ServerFilterModel
}
```

Bind `loading` to the grid's overlay, `saving` to a toolbar spinner, and check
`error` to render a retry banner.

## Writes and optimistic updates

Implement whichever of `createRow` / `updateRow` / `deleteRow` your backend
supports; the matching controller method calls through and then refreshes the
current page. Calling one whose source counterpart is missing throws a clear
error, so a read-only source stays read-only.

By default writes are **non-optimistic**: the grid reflects the change only
after the follow-up refresh lands. For instant feedback, opt in:

```ts
const ctl = createServerDataSource(source, {
  pageSize: 50,
  onChange: (s) => (view = s),
  optimistic: true,
  getRowId: (r) => String(r.id), // required, so a row can be located in the page
})
```

Now `updateRow` patches the local row immediately and reconciles with the server
result (rolling back on error); `deleteRow` removes it and decrements `total`,
restoring both if the server rejects.

## Error handling

If `getRows` rejects, the controller clears `rows`, stores the rejection in
`state.error`, and drops `loading` - it never throws into your render. Recover
by re-fetching:

```svelte
{#if view.error}
  <div role="alert">
    Could not load rows. <button onclick={() => ctl.refresh()}>Retry</button>
  </div>
{/if}
```

A successful fetch clears `error` again.

## Race safety

Every fetch carries a monotonic id; only the **latest** request is allowed to
land. A slow response for an old sort/filter can never clobber a newer one - the
classic SSRM bug, handled for you. `dispose()` drops everything in flight and
clears `loading`, so an unmounting component can't leave a stuck spinner.

## What this does not do

Being honest about the edges so you pick the right tool:

- **Flat rows only.** `createServerDataSource` sends `groupBy: []`. Lazy
  grouping per level, tree data and pivot are `createServerRowModel` in
  `@svgrid/enterprise` - the same `getRows`, with `groupBy`, `groupKeys`,
  `aggregations` and `pivotBy` filled in. See [Server grouping](./server-grouping.md).
- **A selection is the loaded rows.** Select-all over rows the grid never
  fetched, and a bulk edit sent as a rule, are the Enterprise model's
  [selection](./server-selection.md).
- **Writes refetch.** A write re-reads the page (or the held blocks); rows are
  not spliced in by hand. Route-addressed [transactions](./server-transactions.md)
  are Enterprise.
- **Writes are non-optimistic unless you opt in** (above).

## Enterprise: the Server-Side Row Model

`createServerRowModel` from `@svgrid/enterprise` is the same contract with
the rest of the request filled in, and the same one-prop wiring:

| Page | What it adds |
| ---- | ------------ |
| [Server grouping](./server-grouping.md) | lazy grouping per level, a block cache per level, aggregates, child counts, grand totals, footers, refresh and retry per route, paging over the tree |
| [Server tree data](./server-tree-data.md) | self-referential trees loaded on expand |
| [Server pivot](./server-pivot.md) | pivot on the server, columns built from `pivotResultFields`, the pivot designer in server mode |
| [Server transactions](./server-transactions.md) | add, update and remove rows in a loaded level without a request, sync or batched |
| [Server selection](./server-selection.md) | select-all as a rule across unloaded rows, a bulk edit by rule |

The flagship demo runs all of it over one million rows through one
`rowModel` prop:

<div data-docs-demo="467-server-row-model-1m" data-height="640"></div>

### A backend written for a callback-style datasource

Some server-side row models hand the datasource a `getRows(params)` that
answers through `params.success({ rowData, rowCount })`, with the request
spelt `rowGroupCols` / `valueCols` / `pivotCols` and a `sortModel` of
`{ colId, sort }`. `@svgrid/enterprise` maps that shape both ways, so a
backend built for it needs no rewrite:

- `adaptCallbackDatasource(ds)` wraps a datasource object of that shape
  for `createServerRowModel` or `createServerDataSource`.
- `toCallbackRequest(request)` turns a `ServerRequest` into that request
  JSON, for a `getRows` that is a `fetch` against an endpoint which already
  parses it; `fromCallbackRequest` reads it, for an endpoint of yours that
  has to serve such a client too.
- `toCallbackSelectionState` / `fromCallbackSelectionState` do the same for
  a saved selection rule (`toggledNodes` instead of `toggled`); see
  [Server selection](./server-selection.md).

## More examples

### Server-side pivot

The pivot designer in server mode over a million rows: Rows become groupBy, Columns pivotBy, Values aggregations, and every applied layout is one request.

<div data-docs-demo="468-server-pivot" data-height="560"></div>

### Server tree data (row model)

A file tree the grid never holds whole: expanding a folder is one getRows with the folder path as groupKeys, per-folder refresh, and a file added or deleted without a refetch.

<div data-docs-demo="469-server-tree-data" data-height="560"></div>

### Server transactions (live feed)

Changes the server already made, applied without a refetch: in-place patches with a flash, batched add and remove transactions addressed by route, and a status for every result.

<div data-docs-demo="470-server-transactions" data-height="560"></div>

### Server selection: select all, minus these

Select-all as a rule the server counts, flat and per group, with a bulk edit the server applies by rule.

<div data-docs-demo="471-server-selection" data-height="560"></div>

### Server row model to SQL

The statements planToSql renders for every request, per dialect: rows, count, grand total and the two-step pivot.

<div data-docs-demo="472-server-sql-planner" data-height="560"></div>

### Server grouping: totals, sort and refresh rules

Grand total positions, subtotal footers, open-by-default levels, expand-all over unloaded groups, refresh against purge, and what a sort or a filter re-requests, with the request log.

<div data-docs-demo="473-server-grouping-rules" data-height="560"></div>

### Server row model: CRUD

The four writes against a backend that says no: a form under the focused region, inline edits with a version check, a refused delete, an undo, `saving`, and optimistic mode against a slow server.

<div data-docs-demo="482-server-crud" data-height="560"></div>

### Server row model: master-detail

A detail panel under any order of the grouped, virtualized tree, fetched from its own endpoint when it opens, with the region row held under the header.

<div data-docs-demo="483-server-master-detail" data-height="560"></div>

### Server grouping (row model)

Server-side grouping through one getRows contract: the request carries groupBy + groupKeys, and createServerRowModel owns the group tree - a block cache per level, lazy expand, per-group sums and a subtotal footer, race-safety - mounted through the one rowModel prop. Leaves arrive by scroll, behind a Load N more row, or paged across the whole tree, and the group panel regroups on the fly. Here a 63,000-row in-memory server behind 200ms latency; the grid holds only the groups you expand. The row model ships in @svgrid/enterprise.

<div data-docs-demo="344-server-grouping-model" data-height="560"></div>

### Server-side infinite scroll

100k-event audit log behind a mock API. Sparse chunked load on scroll; sort + filter + search pushed to the server.

<div data-docs-demo="33-server-infinite" data-height="560"></div>

### Server-side grouping + aggregates

GROUP BY + SUM/AVG pushed to the server; pre-aggregated buckets with on-demand drill-in.

<div data-docs-demo="114-server-grouping" data-height="560"></div>

### Server-side data

Sort/filter/page round-tripped to a mock endpoint with debounce + cancel.

<div data-docs-demo="09-server-side" data-height="560"></div>

### Server-side rendering

SvelteKit-style SSR with a sandboxed pre-hydration snapshot.

<div data-docs-demo="19-ssr" data-height="460"></div>

## See also

- [Server-side infinite scroll](./server-infinite-scroll.md) - `mode: 'infinite'`: blocks, placeholders, retry, unknown counts.
- [Tutorial: a Postgres CRUD grid](../../enterprise/studio/postgres-grid.md) - a complete server route + query builder.
- [Tutorial: a REST CRUD grid](../../enterprise/studio/rest-grid.md) - the same contract over an existing JSON API.
- [Data binding](../../enterprise/studio/data-binding.md) - the ServerDataSource contract across every backend.
- [Server-side data](../server-side-data.md) - the wider server-mode overview.
