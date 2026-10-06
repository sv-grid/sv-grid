# Worker data source - Enterprise

When every row is already in the browser, a sort or a grouping still has to
walk all of them, and on the main thread nothing else happens until it is
done: the page does not paint, scroll or take input. `createWorkerDataSource`
moves that work into a Web Worker. The worker holds the rows and answers the
grid's requests the way a server would, and the
[server-side row model](./server-row-model.md) asks it for one block of rows
at a time, so only the rows on screen cross back to the page.

<div data-docs-demo="500-worker-data-source" data-height="640"></div>

The demo puts the same orders table in two grids. **Free grid** hands the rows to
`<SvGrid data>` and the grid sorts, filters and groups them itself, on the page,
with nothing turned off. **Enterprise: Web Worker** builds the rows in a worker
and runs the same operations there. Pick a row count, sort, group or search, and
compare the meters in the footer: the slowest request and the longest frame. The
dot next to the row count is moved by JavaScript on every frame, so it stops
whenever the page is blocked.

## Two files

The worker side is one call. Import it from `@svgrid/enterprise/worker`, the
entry point with no Svelte and no DOM in its import graph:

```ts
// orders.worker.ts
import { serveWorkerDataSource } from '@svgrid/enterprise/worker'

serveWorkerDataSource({
  rows: () => fetch('/api/orders.json').then((r) => r.json()),
})
```

The page creates the worker and hands it to `createWorkerDataSource`, which
returns an ordinary `ServerDataSource`:

```svelte
<script lang="ts">
  import { SvGrid } from '@svgrid/grid'
  import { createServerRowModel, createWorkerDataSource } from '@svgrid/enterprise'

  const worker = new Worker(new URL('./orders.worker.ts', import.meta.url), { type: 'module' })
  const ctl = createServerRowModel(createWorkerDataSource(worker), {
    groupBy: ['region'],
    aggregations: [{ col: 'amount', fn: 'sum' }],
    keepRowsWhileLoading: 500,
  })
  ctl.refresh()
  $effect(() => () => ctl.dispose())
</script>

<SvGrid rowModel={ctl} {columns} sortable filterable />
```

`new Worker(new URL(...), { type: 'module' })` written out in full is the form
Vite recognises and bundles. In SvelteKit, create the worker in the browser
only (in `onMount`, an `$effect`, or behind `browser`), since there is no
`Worker` during server rendering.

`ctl.dispose()` calls the source's `destroy()`, which terminates the worker.

`keepRowsWhileLoading` keeps the rows on screen after a sort, a filter or a
regroup until the worker's answer lands (here for up to 500 ms). The worker
usually answers well inside that, so the grid goes from the old rows straight to
the new ones, with no skeleton frame between them and one render instead of two.
See [server grouping](./server-grouping.md#blocks-per-level).

The free `createServerDataSource` takes the same source if you want flat
paging or infinite scroll without the Enterprise row model's grouping:
`createServerDataSource(createWorkerDataSource(worker), { pageSize: 100 })`.

## Where the rows come from

| Rows | How | When to use it |
| --- | --- | --- |
| Loaded in the worker | `serveWorkerDataSource({ rows: () => fetch(...) })` | The usual case. The full array never exists on the main thread. |
| An array in the worker | `serveWorkerDataSource({ rows: data })` | Data the worker generates or imports. |
| Sent from the page | `createWorkerDataSource(worker, { rows })` | The rows are already on the page. Sending them is a structured clone, which runs on the main thread. |
| Replaced later | `source.setRows(next)` | A new dataset without a new worker. Resolves with the new row count. |

Requests that arrive before the rows exist wait for them. `source.ready`
resolves with the row count once the worker holds data, and rejects if the
worker's loader threw or the worker script failed to load. After a failure,
every call rejects with the same error and the grid shows Retry on the
affected rows.

## What the worker can and cannot do

Inside the worker, requests run through a columnar engine that answers exactly as
`createInMemoryDataSource`, the reference implementation of the datasource
contract, does: the same rows, in the same order, with the same aggregate values.
It supports everything that contract describes: sort, column filters, set filters, global search,
the advanced filter expression, grouping to any depth with aggregates and
child counts, the grand total, server pivot, and the write methods
(`createRow`, `updateRow`, `deleteRow`, `updateWhere`). `getAggregate` is
there too, for `SvSchemaChart`.

The engine keeps each field as a dictionary: its distinct values, and one integer
code per row. A filter or a search is decided once per distinct value rather than
once per row, a sort is a counting sort over the ranks of those values, and a
grouping buckets rows by code. Three cases go to the reference implementation
instead, which holds the same rows: the advanced filter expression, pivot, and a
sort on a field that mixes numbers with other values. Those answer correctly,
without the speed-up.

A worker receives data, not code, so your functions stay on the page. A
column's `valueGetter`, `comparator` or custom filter function does not reach
the worker. Sorting and filtering in the worker go by field value, the way a
database works. If a column needs a computed value, compute it into the rows
before they reach the worker.

The schema decides which fields can be filtered, sorted and grouped, and how a
filter value typed as text is compared. Pass an `EntitySchema` as `schema`, or
leave it out and `inferSchemaFromRows` reads one off the first 200 rows:

- A field is `number` when every non-empty sampled value is a number, and
  `boolean` when every one is a boolean. Everything else is `text`.
- The id field is `id` when the rows have one, otherwise the first field.
  Pass `idField` to choose.
- Dates should be ISO strings (`2026-09-30`), which sort correctly as text, or
  epoch numbers. A `Date` object is compared by its `toString()`.
- Global search scans the text fields, skipping the id.

## Requests and the cache

The worker builds the dictionaries in idle time after the rows load, one field at
a time between requests, so the first sort on a column finds its work done. A
write (`createRow`, `updateRow`, `deleteRow`, `updateWhere`) drops them and the
worker builds them again once it is idle.

The worker runs one request at a time. When the grid abandons a block (the
user scrolled past it, or the sort changed before it loaded), the request's
`AbortSignal` fires and the page sends a cancel. The worker drops the request
if it has not started it, so a fast scroll does not leave a queue of blocks
nobody will see.

Scrolling asks for the same query once per block, with only the row range
changing. The worker keeps the last 8 filtered, sorted and grouped results and
answers a request for another range of the same query by slicing one. Each
write clears the cache.

The same cache is available on the main thread as an option of the in-memory
source:

```ts
createInMemoryDataSource(rows, schema, { cacheResults: true })
```

It is off by default there, because a cached result does not see a row object
changed in place. Only changes made through the source's own write methods
clear it. The worker's engine keeps its own cache of the same kind.

## Sharing a worker

Every message the data source sends carries a `channel` field, and each side
ignores messages without it. A worker can handle messages of its own next to
the data source. The demo uses one to tell the worker how many rows to build:

```ts
// orders.worker.ts
let resolveCount: (n: number) => void = () => {}
const count = new Promise<number>((resolve) => (resolveCount = resolve))
self.addEventListener('message', (e) => {
  if (e.data?.type === 'orders:init') resolveCount(e.data.rows)
})
serveWorkerDataSource({ rows: async () => makeOrders(await count) })
```

## API

`createWorkerDataSource(worker, options?)` (from `@svgrid/enterprise` or
`@svgrid/enterprise/server`, main thread):

| Option | Type | Description |
| --- | --- | --- |
| `rows` | `TData[]` | Rows to copy into the worker. Leave it out when the worker loads its own. |
| `schema` | `EntitySchema<TData>` | Sent with `rows`. Default: the worker's schema, or one inferred from the rows. |
| `idField` | `string` | The id field when the schema is inferred. |

It returns the `ServerDataSource` methods (`getRows`, `createRow`,
`updateRow`, `deleteRow`, `updateWhere`) plus `getAggregate`, `ready`,
`setRows(rows, schema?)` and `destroy()`. `worker` can be anything with
`postMessage` and `addEventListener`, a `MessagePort` included.

`serveWorkerDataSource(options?)` (from `@svgrid/enterprise/worker`, inside
the worker):

| Option | Type | Description |
| --- | --- | --- |
| `rows` | `TData[]` or a function returning one (or a promise of one) | The rows, loaded in the worker. Leave it out to wait for rows from the page. |
| `schema` | `EntitySchema<TData>` | Default: `inferSchemaFromRows`. |
| `idField` | `string` | The id field when the schema is inferred. |
| `scope` | `WorkerScopeLike` | Where to listen. Default: the worker's global scope. |

It returns `{ dispose() }`, which stops answering.
