# Features, the API, and data

## Prefer shortcut props; drop to `tableFeatures` only when needed

The grid engine is feature-gated, but the `<SvGrid>` shortcut props inject
the matching feature for you. Use them for the common path:

| Shortcut prop | Injects |
| --- | --- |
| `sortable` | `rowSortingFeature` |
| `filterable` | `columnFilteringFeature` |
| `pageable` | pagination footer |
| `editable` | inline cell editing |
| `groupable` | row grouping controls |

```svelte
<!-- ✅ Correct — common path, no manual feature wiring. -->
<SvGrid {data} {columns} sortable filterable pageable />
```

Use `tableFeatures({ ... })` explicitly when you need a feature without a
shortcut (selection, expansion, grouping model) or want full control:

```svelte
<script lang="ts">
  import {
    SvGrid, tableFeatures,
    rowSortingFeature, columnFilteringFeature,
    rowSelectionFeature, rowExpandingFeature,
  } from '@svgrid/grid'

  const features = tableFeatures({
    rowSortingFeature,
    columnFilteringFeature,
    rowSelectionFeature,
    rowExpandingFeature,
  })
</script>

<SvGrid {features} {data} {columns} selectable />
```

Available features: `rowSortingFeature`, `columnFilteringFeature`,
`columnGroupingFeature`, `rowPaginationFeature`, `rowSelectionFeature`,
`rowExpandingFeature`.

## The imperative API comes from `onApiReady`

Capture `SvGridApi` in `$state` and call it from event handlers. Do **not**
try to read grid state by reaching into the DOM.

```svelte
<script lang="ts">
  import { SvGrid, type SvGridApi } from '@svgrid/grid'
  let api = $state<SvGridApi | null>(null)

  function onlyEmea() {
    api?.setFilter('region', { operator: 'equals', value: 'EMEA' })
  }
</script>

<button onclick={onlyEmea}>EMEA</button>
<button onclick={() => api?.clearAllFilters()}>Clear</button>

<SvGrid {data} {columns} filterable onApiReady={(a) => (api = a)} />
```

Common methods: `setFilter`, `clearAllFilters`, `setSort`, `setGroupBy`,
`getDisplayedRows`, `setPageSize`. When a name is uncertain, check
`https://svgrid.com/schemas/svgrid-options.json` or the MCP `list_docs`
tool — don't guess.

## Data is a plain reactive array

Pass a `$state` array as `data`. Mutating it (push, splice, reassign
fields) updates the grid — no imperative "refresh" call.

```ts
const data = $state<Row[]>([])
// later:
data.push(newRow)          // grid re-renders
```

## Server-side data: `createServerDataSource`

For large datasets or a real backend, don't ship all rows to the client.
Implement the `ServerDataSource` contract: the grid renders its native
sort/filter/pager UI and emits the user's intent; your source fetches the
matching page. In server mode the grid does **not** sort/filter/page
locally.

```ts
import { createServerDataSource, type ServerDataSource } from '@svgrid/grid'

const source: ServerDataSource<Row> = {
  async getRows(req) {
    // req carries paging + sortModel + filterModel
    const res = await fetch('/api/rows?' + new URLSearchParams({
      page: String(req.page),
      pageSize: String(req.pageSize),
      sort: JSON.stringify(req.sortModel),
      filter: JSON.stringify(req.filterModel),
    }))
    const { rows, total } = await res.json()
    return { rows, total }
  },
}
```

Wire it via `createServerDataSource(source)` and pass to `<SvGrid>`; keep
`pageable` on so the footer shows. The exact request/response shape is in
the docs — fetch `llms-full.txt` or use the MCP server for the current
contract.

## Enterprise data helpers (only if installed)

Export/import/pivot/AI come from `@svgrid/enterprise` via
`installEnterprise(api)`. Guard their use on the package being present:

```ts
import { installEnterprise } from '@svgrid/enterprise'
onApiReady={(a) => { api = a; installEnterprise(a) }}
// then: api.exportToCsv(), api.exportToXlsx(), api.ai.filter(...)
```
