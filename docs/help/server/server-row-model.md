# Server-Side Row Model (SSRM)

When the data lives on the server - millions of rows in a database - the grid
should hold only the page on screen and push sorting, filtering, and paging to
the backend. SvGrid packages this as **one datasource contract**: you implement
a single async `getRows`, and `createServerDataSource` owns the rest.

```ts
import { createServerDataSource, type ServerDataSource } from 'sv-grid-community'

const source: ServerDataSource<Row> = {
  async getRows({ startRow, endRow, sortModel, filterModel }) {
    const res = await fetch('/api/rows', {
      method: 'POST',
      body: JSON.stringify({ startRow, endRow, sortModel, filterModel }),
    })
    const { rows, total } = await res.json()
    return { rows, rowCount: total }
  },
}

let s = $state(/* initial ServerState */)
const ctl = createServerDataSource(source, { pageSize: 50, onChange: (next) => (s = next) })
ctl.refresh()
```

## Wiring to the grid

Run the grid in **controlled** mode - it records sort/filter UI state but
doesn't reorder/slice the data itself (the server already did) - and feed it
the controller's current page:

```svelte
<SvGrid
  data={s.rows}
  {columns} {features}
  sortable filterable
  externalSort externalFilter
  loading={s.loading}
  pageable={false}
  onSortingChange={(sorting) => ctl.setSort(sorting)}
  onFiltersChange={(f) => ctl.setFilter({ global: f.global, columns: toColumnModel(f.columns) })}
/>
<!-- your pager drives ctl.setPage(...) from s.pageIndex / s.pageCount -->
```

## The controller

`createServerDataSource(source, { pageSize, onChange })` returns:

| Method            | Does                                            |
| ----------------- | ----------------------------------------------- |
| `refresh()`       | Re-fetch the current page (after a mutation).   |
| `setSort(model)`  | New sort, jump to page 0, fetch.                |
| `setFilter(model)`| New filter, jump to page 0, fetch.             |
| `setPage(i)`      | Fetch page `i`.                                 |
| `setPageSize(n)`  | New page size, page 0, fetch.                   |
| `getState()`      | Current `{ rows, total, loading, pageIndex, pageCount, ... }`. |
| `dispose()`       | Stop accepting responses (call on unmount).     |

`onChange` fires on every state transition (including `loading: true` before a
fetch and `loading: false` after) so the UI tracks in-flight requests.

## Race safety

Each fetch carries a monotonic id; only the **latest** request is allowed to
land. A slow response for an old sort/filter can't clobber a newer one - the
classic SSRM bug, handled for you. `dispose()` drops everything in flight.

## Notes

- The `ServerRequest` carries `startRow` / `endRow` (block bounds),
  `pageIndex` / `pageSize`, plus `sortModel` and `filterModel` - map these to
  your `ORDER BY` / `WHERE` / `LIMIT`.
- This is the **controlled** building block; pair it with optimistic updates
  (demo 115) or `applyTransaction` for writes.

See the live [Server-Side Row Model](https://sv-grid.com/demos/148-server-row-model)
demo.
