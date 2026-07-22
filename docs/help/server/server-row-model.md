# Server-Side Row Model (SSRM)

When the data lives on the server - millions of rows in a database - the grid
should hold only the page on screen and push sorting, filtering, and paging to
the backend. SvGrid packages this as **one datasource contract**: you implement
a single async `getRows`, and `createServerDataSource` owns the request
lifecycle (paging, sort, filter, race-safety, writes).

![The createServerDataSource request lifecycle: setSort, setFilter, and setPage trigger a fetch that tags each getRows call with a monotonic request id, and only the latest request lands as a ServerState of rows, total, loading, saving, and error that the grid renders from.](/docs-media/server-controller-state.svg)

<div data-docs-demo="148-server-row-model" data-height="480"></div>

> **Scope.** This is a **page-based** server model: one page is in memory at a
> time and each fetch loads exactly that page. It is not infinite block-scroll
> with a background block cache, and it does not lazily load group children on
> the server. For those, see [what this does not do](#what-this-does-not-do).

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

Run the grid in **controlled** mode - it records the sort/filter UI state but
does not reorder or slice the data itself (the server already did) - and render
it from the controller's current page:

```svelte
<SvGrid
  data={view.rows}
  {columns} {features}
  sortable filterable
  externalSort externalFilter
  loading={view.loading}
  pageable={false}
  onSortingChange={(sorting) => ctl.setSort(sorting)}
  onFiltersChange={(f) => ctl.setFilter({ global: f.global, columns: toColumnModel(f.columns) })}
/>
<!-- your pager drives ctl.setPage(i) from view.pageIndex / view.pageCount -->
```

`externalSort` / `externalFilter` tell the grid to emit intent instead of acting
locally; `pageable={false}` hands paging to your pager + the controller.

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

- **This controller is page-based, not infinite-scroll.** `createServerDataSource`
  keeps one page resident and navigates with a pager (or a "Load more" that calls
  `setPage`). If you instead want the grid to render placeholder rows and stream
  chunks as the user scrolls, use the separate
  [sparse infinite-scroll pattern](../server-side-data.md#option-3-sparse-infinite-scroll)
  (demo 33) - a different mechanism from this controller.
- **No lazy server-side group expansion.** Grouping runs on the rows you return,
  not by fetching a group's children on expand. Group on the server and return
  pre-grouped rows if you need server-driven grouping.
- **Writes are non-optimistic unless you opt in** (above).

## See also

- [Tutorial: a Postgres CRUD grid](../../enterprise/studio/postgres-grid.md) - a complete server route + query builder.
- [Tutorial: a REST CRUD grid](../../enterprise/studio/rest-grid.md) - the same contract over an existing JSON API.
- [Data binding](../../enterprise/studio/data-binding.md) - the ServerDataSource contract across every backend.
- [Server-side data](../server-side-data.md) - the wider server-mode overview.
