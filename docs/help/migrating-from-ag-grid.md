# Migrating from AG Grid to SvGrid

If you tried AG Grid on a Svelte 5 project - via `ag-grid-svelte`, the
old `ag-grid-community/svelte`, or a hand-rolled wrapper - you probably
hit the same friction everyone hits: the bridge between AG Grid's
React/Angular-first API and Svelte 5 runes is brittle, the bundle is
heavy, and the Enterprise pricing only makes sense at scale.

<!-- facts:start ag-grid -->
> **Facts, checked 12 Sep 2026.** `ag-grid-community` 36.1.0, MIT, last published 5 Aug 2026, 12,400,000 npm downloads in the 30 days to 10 Sep 2026. `@svgrid/grid` 3.0.3, MIT, last published 11 Sep 2026, 16,900 npm downloads in the same window. Bundle, minified and gzipped, each package built alone with Svelte external: SvGrid 3.0.4 95.8 KB JS + 10.5 KB CSS (measured 20 Sep 2026); `ag-grid-community` 36.1.0 317.5 KB JS, no separate stylesheet (measured 12 Sep 2026). AG Grid pricing, as its site states it: AG Grid Community is free under MIT. AG Grid Enterprise is listed at $999 USD per developer with one year of updates and Zendesk support; the Enterprise Bundle with AG Charts Enterprise is $1,498 USD per developer (https://www.ag-grid.com/license-pricing/, read 12 Sep 2026). SvGrid: MIT core; @svgrid/enterprise from $599 per developer per year. Side by side, with sources: [SvGrid vs AG Grid (community + enterprise)](https://svgrid.com/compare/ag-grid/).
<!-- facts:end -->

This page is a 30-minute migration recipe from AG Grid to SvGrid. It
covers what maps 1:1, what's different by design, and what you'll lose.
We tell you when **not** to switch at the bottom.

## TL;DR

| | AG Grid Community | AG Grid Enterprise | SvGrid Community | @svgrid/enterprise |
| --- | --- | --- | --- | --- |
| **Licence** | MIT | Commercial, per developer (the price is in the facts box above) | **MIT** | $599/dev/yr (single app) or $999/dev/yr (multi app) |
| **Svelte 5 native** | No (community-built integration) | No (community-built integration) | Yes | Yes |
| **Bundle (gzipped)** | measured, in the facts box above | not measured (licence) | measured, in the facts box above | lazy-loaded subpaths |
| **Sorting / filtering** | Yes | Yes | Yes | (in Community) |
| **Row grouping + aggregation** | No (Enterprise) | Yes | Yes (free) | (in Community) |
| **Master/detail, tree, range select** | No (Enterprise) | Yes | Yes (free) | (in Community) |
| **Set filter / Excel-style filter menu** | No (Enterprise) | Yes | Yes (free) | (in Community) |
| **Server-side data, flat (infinite row model)** | Yes | Yes | Yes (free) | (in Community) |
| **Server-side row model (grouping, tree, pivot, transactions, selection)** | No (Enterprise) | Yes | No | Yes |
| **Integrated charts** | No (Enterprise) | Yes, AG Charts | Yes (free) | (in Community) |
| **CSV export** | Yes (API) | Yes | Yes, with TSV and JSON | (in Community) |
| **Excel export** | No | Yes | No | Yes |
| **PDF / styled-HTML export, print** | No | No | No | Yes |
| **Pivot tables** | No | Yes | No | Yes |
| **MCP server for AI assistants** | Yes, `ag-mcp` | Yes | Yes, `@svgrid/mcp` | (in Community) |
| **In-grid AI helpers** | No | No | Yes (bring your own model) | (in Community) |

**SvGrid Community gives you most of what AG Grid sells as Enterprise for
free**, and `@svgrid/enterprise` adds Excel, PDF and print output, import,
pivot tables and the server-side row model per developer per year. Compare what each paid tier adds
before comparing prices; both are in the facts box. The trade-offs are
Svelte-only and a much smaller ecosystem. Every AG Grid cell above follows
ag-grid.com's own pages; the dated list is on the
[SvGrid vs AG Grid](https://svgrid.com/compare/ag-grid/) page.

## Mental model - what changes

AG Grid is one big object you configure declaratively. SvGrid is a
**headless engine** (`createSvGrid`) with an optional **render
component** (`<SvGrid>`) on top - the same split TanStack Table made
popular. You can use either layer; most projects use the render
component.

Every example below runs against this setup:

```svelte {preamble}
<script lang="ts">
  import { SvGrid, tableFeatures, rowSortingFeature, columnFilteringFeature, type ColumnDef } from '@svgrid/grid'

  type Row = { id: number; make: string; model: string; price: number }

  const features = tableFeatures({ rowSortingFeature, columnFilteringFeature })

  let rows = $state<Row[]>([
    { id: 1, make: 'Toyota', model: 'Celica', price: 35000 },
    { id: 2, make: 'Ford',   model: 'Mondeo', price: 32000 },
    { id: 3, make: 'Porsche', model: 'Boxster', price: 72000 },
  ])
  const data = rows

  const columns: ColumnDef<typeof features, Row>[] = [
    { field: 'make',  header: 'Make' },
    { field: 'model', header: 'Model' },
    { field: 'price', header: 'Price', format: { type: 'currency', currency: 'USD' } },
  ]
</script>
```

```svelte
<!-- AG Grid (via a Svelte wrapper) -->
<AgGridSvelte
  gridOptions={{
    rowData: rows,
    columnDefs: columns,
    onGridReady: (params) => (gridApi = params.api),
  }}
/>

<!-- SvGrid -->
<SvGrid
  data={rows}
  columns={columns}
  features={features}
  onApiReady={(api) => (gridApi = api)}
/>
```

Three things to note:

1. **No giant `gridOptions` blob.** Each capability is a top-level prop.
2. **Features are opt-in.** You pass a `features` object built with
   `tableFeatures({...})` - only the features you list ship JS.
3. **`onApiReady`** gives you a typed `SvGridApi` that is roughly the
   AG Grid `gridApi` equivalent (see the API-mapping table below).

## Column definitions - direct translation

The shapes are similar enough that you can usually translate by hand
without thinking too hard.

```ts
// AG Grid
const columnDefs: ColDef[] = [
  { field: 'name', headerName: 'Name', sortable: true, filter: true, width: 200 },
  { field: 'price', headerName: 'Price', type: 'numericColumn',
    valueFormatter: ({ value }) => `$${value.toFixed(2)}` },
  { field: 'date', headerName: 'Date',
    valueGetter: ({ data }) => new Date(data.date).toISOString().slice(0, 10) },
  { field: 'status', headerName: 'Status',
    cellRenderer: StatusCellRenderer,
    cellRendererParams: { onChange: handleStatusChange } },
]
```

```ts
// SvGrid
import { renderComponent, type ColumnDef } from '@svgrid/grid'
import StatusCell from './StatusCell.svelte'

const columns: ColumnDef<typeof features, Row>[] = [
  { field: 'name', header: 'Name', width: 200 }, // sortable + filterable by default
  { field: 'price', header: 'Price',
    format: { type: 'currency', currency: 'USD' } },
  { field: 'date', header: 'Date',
    format: { type: 'date', pattern: 'y-m-d' } },
  { field: 'status', header: 'Status',
    cell: renderComponent(StatusCell, (ctx) => ({
      value: ctx.getValue(),
      onChange: handleStatusChange,
    })),
  },
]
```

### Property mapping

| AG Grid | SvGrid | Notes |
| --- | --- | --- |
| `field` | `field` | Same. |
| `headerName` | `header` | Accepts a string or a snippet/component. |
| `width` | `width` | Same. |
| `minWidth` / `maxWidth` | `minWidth` / `maxWidth` | Same. |
| `sortable: true` | (default) | Sorting is on when `rowSortingFeature` is registered. |
| `filter: true` | (default) | Filtering is on when `columnFilteringFeature` is registered. |
| `valueFormatter` | `format: { ... }` | Built-in types: `number`, `currency`, `percent`, `date`. For custom, use `cell`. |
| `valueGetter` | `fieldFn` | Returns the value for sorting/filtering. |
| `cellRenderer` + `cellRendererParams` | `cell: renderComponent(C, ctx => props)` | One call, type-checked. |
| `cellEditor: 'agTextCellEditor'` | `editorType: 'text'` | Built-in: `text`, `number`, `checkbox`, `date`. |
| `editable: true` | `enableInlineEditing` prop on `<SvGrid>` | Per-grid, not per-column. (Per-column control on the roadmap.) |
| `pinned: 'left'` / `'right'` | Right-click column menu → Pin | Set programmatically via the api. |
| `rowGroup: true` | Via `setGroupBy([colId])` | See Grouping below. |
| `aggFunc: 'sum'` | `aggregate: 'sum'` | Built-in: `sum`, `avg`, `min`, `max`, `count`. |

## Feature registration - the one new thing

AG Grid auto-enables most features; you turn them off. SvGrid is the
opposite - features are opt-in. The result is a smaller bundle.

```ts
import {
  tableFeatures,
  rowSortingFeature,
  columnFilteringFeature,
  columnGroupingFeature,
  rowExpandingFeature,
  rowPaginationFeature,
  rowSelectionFeature,
} from '@svgrid/grid'

const features = tableFeatures({
  rowSortingFeature,
  columnFilteringFeature,
  rowSelectionFeature,
  // omit any you don't need - their code won't ship
})
```

Pass `features` to `<SvGrid>` once. From then on the grid behaves like
AG Grid's `enableSorting`, `enableFilter`, `rowSelection`, etc. are all
on for the registered features.

## API mapping (`gridApi` → `SvGridApi`)

You get the SvGrid API from `onApiReady` (equivalent to AG Grid's
`onGridReady`).

| AG Grid `gridApi.X()` | SvGrid `api.X()` |
| --- | --- |
| `setRowData(rows)` | (declarative - just update `data` prop) |
| `addRow(row)` / `applyTransaction({ add: [row] })` | `api.addRow(row)` / `api.addRows(rows)` |
| `applyTransaction({ remove: [row] })` | `api.removeRow(rowIndex)` |
| `getValue(colId, rowNode)` | `api.getCellValue(rowIndex, columnId)` |
| `setValue(...)` | `api.setCellValue(rowIndex, columnId, value)` |
| `setColumnVisible(colId, visible)` | `api.setColumnVisible(columnId, visible)` |
| `getSortModel()` / `setSortModel()` | `api.setSort(columnId, 'asc'\|'desc'\|null)` |
| `setFilterModel({...})` | `api.setFilter(columnId, { operator, value })` |
| `getDisplayedRowAtIndex(i)` / `forEachNodeAfterFilterAndSort(...)` | `api.getDisplayedRows()` |
| `getModel()` (raw rows) | `api.getData()` |

## Common patterns

### Sorting + filtering + pagination (the 80% case)

```svelte
<script lang="ts">
  import {
    SvGrid,
    tableFeatures,
    rowSortingFeature,
    columnFilteringFeature,
    rowPaginationFeature,
  } from '@svgrid/grid'

  const features = tableFeatures({
    rowSortingFeature,
    columnFilteringFeature,
    rowPaginationFeature,
  })
</script>

<SvGrid
  data={rows}
  columns={columns}
  features={features}
  showPagination
  showColumnFilters
/>
```

AG Grid equivalent: `gridOptions: { defaultColDef: { sortable: true, filter: true }, pagination: true }`.

### Cell editing with persistence

```svelte
<script lang="ts">
  function onCellValueChange(e: { rowIndex: number; columnId: string; value: unknown }) {
    // Persist however you like (fetch to backend, optimistic local update, etc.)
    console.log('cell changed', e)
  }
</script>

<SvGrid
  data={rows}
  columns={columns}
  features={features}
  enableInlineEditing
  onCellValueChange={onCellValueChange}
/>
```

AG Grid equivalent: `onCellValueChanged: ({ data, colDef, newValue, oldValue }) => ...`.
SvGrid's event payload is column-id + row-index based rather than node-based; the row data is yours
to mutate (or not) on the `rows` array you passed in.

### Grouping + aggregation

```svelte
<script lang="ts">
  import {
    SvGrid,
    tableFeatures,
    columnGroupingFeature,
    rowSortingFeature,
    rowExpandingFeature,
  } from '@svgrid/grid'

  const features = tableFeatures({
    rowSortingFeature,
    columnGroupingFeature,
    rowExpandingFeature,
  })

  const columns = [
    { field: 'department', header: 'Department' },
    { field: 'team',       header: 'Team' },
    { field: 'salary',     header: 'Salary', aggregate: 'sum',
      format: { type: 'currency', currency: 'USD' } },
  ]

  function setGroup(api) {
    api.setGroupBy(['department', 'team'])
  }
</script>

<SvGrid
  data={rows}
  columns={columns}
  features={features}
  showGroupingControls
  onApiReady={setGroup}
/>
```

AG Grid Enterprise's `rowGroupPanelShow: 'always'` + `aggFunc: 'sum'` translates 1:1.

### Master / detail

AG Grid Enterprise feature; **free in SvGrid Community**. See
[demo 08](https://svgrid.com/demos/08-tree-and-master-detail/) for the exact pattern.

### Server-side data

AG Grid's Infinite Row Model (Community) and Server-Side Row Model
(Enterprise) both take an `IServerSideDatasource` with a `getRows(params)`
that answers through `params.success({ rowData, rowCount })`. SvGrid has one
`ServerDataSource` whose `getRows(request)` returns `{ rows, rowCount }`,
and two controllers over it: `createServerDataSource` (free: paging or
infinite block scroll, sort, filter, CRUD) and `createServerRowModel`
(Enterprise: lazy grouping, tree, pivot, transactions, selection). Both
mount through one prop, `<SvGrid rowModel={ctl} />`.

An existing datasource written for AG Grid keeps working behind one call:

```ts
import { adaptCallbackDatasource, createServerRowModel } from '@svgrid/enterprise'

const ctl = createServerRowModel(adaptCallbackDatasource(myServerSideDatasource), {
  groupBy: ['country'],
  aggregations: [{ col: 'amount', fn: 'sum' }],
})
```

`adaptCallbackDatasource` maps the request both ways (`rowGroupCols` ->
`groupBy`, `valueCols` -> `aggregations`, `pivotCols` -> `pivotBy`, the
sort and filter models, `context`, `parentNode`) and turns `success` /
`fail` into a resolved or rejected promise.

More often the datasource is a thin `fetch` and the real investment is the
endpoint behind it - a Java or Node service that parses AG Grid's
`IServerSideGetRowsRequest` JSON. That endpoint stays as it is: post
`toCallbackRequest(request)` and read the answer back.

```ts
import { toCallbackRequest } from '@svgrid/enterprise'

const source = {
  async getRows(request) {
    const res = await fetch('/api/sales', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(toCallbackRequest(request)),
    })
    const { rowData, rowCount, pivotResultFields } = await res.json()
    return { rows: rowData, rowCount: rowCount ?? -1, pivotResultFields }
  },
}
```

`fromCallbackRequest` is the other direction, for a SvelteKit endpoint that
has to keep serving an AG Grid client during the switch. A saved selection
or a bulk endpoint written against `getServerSideSelectionState()` keeps
its shape the same way: `toCallbackSelectionState(ctl.getSelectionState())`
produces `{ selectAll, toggledNodes }` (or the `nodeId` /
`selectAllChildren` / `toggledNodes` tree), `ctl.setSelectionState` takes
that shape as it is when your group node ids are the group keys, and
`fromCallbackSelectionState(state, { groupKey, isGroup })` maps them when
a `getRowId` gave group rows ids of their own. Option by option:

| AG Grid | SvGrid |
| --- | --- |
| `rowModelType: 'infinite'` + `datasource` | `createServerDataSource(source, { mode: 'infinite' })` + `rowModel={ctl}` |
| `rowModelType: 'serverSide'` + `serverSideDatasource` | `createServerRowModel(source, options)` + `rowModel={ctl}` |
| `getRows(params)` + `params.success({ rowData, rowCount })` / `params.fail()` | `getRows(request)` returning `{ rows, rowCount }` / throwing |
| `cacheBlockSize`, `maxBlocksInCache`, `maxConcurrentDatasourceRequests`, `blockLoadDebounceMillis` | `blockSize`, `maxBlocksInCache`, `maxConcurrentRequests`, `blockLoadDebounceMs` |
| `infiniteInitialRowCount` / `serverSideInitialRowCount` | `initialRowCount` |
| `rowCount: -1` (unknown) | `rowCount: -1` |
| `refreshInfiniteCache()` / `purgeInfiniteCache()` | `ctl.refresh()` / `ctl.purge()` |
| `request.rowGroupCols`, `groupKeys`, `valueCols`, `pivotCols`, `pivotMode` | `request.groupBy`, `groupKeys`, `aggregations`, `pivotBy`, `pivotMode` |
| `getChildCount(data)` | `childCount: (row) => row.childCount` |
| `isServerSideGroupOpenByDefault` | `isGroupOpenByDefault(route, row)` |
| `getServerSideGroupLevelParams` | `levelParams(level, route)` |
| `isServerSideGroup` / `getServerSideGroupKey` (tree) | `treeData: true` + `hasChildren` / `getRowId` |
| `grandTotalRow` / `groupTotalRow` | `grandTotalRow` / `groupFooters` |
| `refreshServerSide({ route, purge })` / `retryServerSideLoads()` | `ctl.refresh({ route, purge })` / `ctl.retryLoads()` |
| `applyServerSideTransaction` / `applyServerSideTransactionAsync` / `flushServerSideAsyncTransactions` | `ctl.applyTransaction` / `applyTransactionAsync` / `flushAsyncTransactions` |
| `applyServerSideRowData` | `ctl.applyRowData` |
| `serverSideSortAllLevels`, `serverSideEnableClientSideSort`, `serverSideOnlyRefreshFilteredGroups` | `sortAllLevels`, `clientSideSort`, `onlyRefreshFilteredGroups` |
| `getServerSideSelectionState` / `setServerSideSelectionState` | `ctl.getSelectionState()` / `setSelectionState()` (the `toggledNodes` shape is accepted; `toCallbackSelectionState` / `fromCallbackSelectionState` convert) |
| `ServerSideTransactionResult.status`: `Applied`, `StoreNotFound`, `StoreLoading`, `StoreWaitingToLoad`, `StoreLoadingFailed`, `Cancelled` | `ServerTransactionResult.status`: the same six, lower camel case (`applied`, `storeNotFound`, ...) - a `switch` on the old spelling falls through silently |
| `groupSelects: 'descendants'` | `selection: { groupSelects: 'descendants' }` |
| `pivotResultFields` in `success`, `setPivotResultColumns`, `processPivotResultColDef` | `pivotResultFields` / `pivotResultColumns` in the result, `pivotResultColumn(field, def)` |
| `pagination` + `paginateChildRows` | `pagination: { pageSize, paginateChildRows }` |
| `getCacheBlockState()` / `getServerSideGroupLevelState()` | `ctl.getCacheState()` / `ctl.levelStates()` |
| `serverSideDatasource.destroy()` | `source.destroy()` |

Two differences worth knowing before you start: SvGrid sends the global
search box to the server as `filterModel.global` (AG Grid's quick filter is
client-side only and unsupported under its infinite and server-side models),
and SvGrid has no viewport row model. See
[Server grouping](./server/server-grouping.md) and
[demo 467](https://svgrid.com/demos/467-server-row-model-1m/).

### Excel / PDF export

AG Grid: `gridApi.exportDataAsExcel({...})` (Enterprise-only).
SvGrid: install `@svgrid/enterprise`, call `api.exportData({ format: 'xlsx', ... })`. See [Data export and printing](./export.md).

```ts
import { installEnterprise, setLicenseKey } from '@svgrid/enterprise'
setLicenseKey('SVENTERPRISE-...')   // your Enterprise key

// inside onApiReady:
const pro = installEnterprise(api)
await pro.exportData({ format: 'xlsx', filename: 'orders' })
```

## Gotchas - things that don't translate directly

### 1. Per-column `editable: true`
Editing is switched on at the grid level (`enableInlineEditing`) and
narrowed per column with `editable: boolean | (ctx) => boolean` on the
column definition, so AG Grid's per-column flag and its callback form both
map directly. What does not map is AG Grid's `editable` on a column
group: set it on each child column.

### 2. Column drag-to-reorder
Header drag is `enableColumnReorder` on `<SvGrid>`; `setColumnOrder`
on the API does the same from code. See
[column moving](./columns/column-moving.md) for the events.

### 3. AG Grid `valueGetter` chains
AG Grid's `valueGetter` can read other column values via the API. In
SvGrid, `fieldFn` only receives the row; if you need cross-column
computed values, do it in the cell renderer with `ctx.row.original` or
compute the derived value upstream and store it in the row.

### 4. `cellClass` / `rowClass` callbacks
On the roadmap. For now, render a wrapper element in your `cell` snippet
with the conditional class.

### 5. The Status Bar / Side Bar / Tool Panels
AG Grid's chrome (status bar with row count, side bar with filters and
columns panels) doesn't exist in SvGrid - build it as plain Svelte
markup around the grid. Most teams build their own anyway because
AG Grid's defaults rarely match a polished design system.

### 6. Set filter (the Excel-style funnel popup)
SvGrid ships an Excel-style filter menu (free in Community). API surface
is similar but not identical - see [Set filter](./filtering/set-filter.md).

## When NOT to migrate

Be honest. Stay on AG Grid if you:

- **Use multiple frameworks** - AG Grid has React, Angular, Vue, Solid, Qwik, vanilla adapters. SvGrid is Svelte-only.
- **Need a push-based viewport row model** - SvGrid's server-side row model covers grouping, tree, pivot, transactions and select-all across unloaded rows, and its real-time page merges deltas into loaded rows, but the server cannot push the visible window over a socket the way the viewport model does.
- **Need pluggable custom filter components or custom tool panels** - SvGrid's tool panel is a fixed Columns + Filters pair.
- **Are mid-project and shipping in <2 weeks** - the migration is a few hours per grid, but only do it when you have buffer.
- **Have a Svelte 4 codebase you can't upgrade** - SvGrid requires Svelte 5 runes. (Consider [htmlelements.com](https://www.htmlelements.com) for vanilla / multi-framework.)

If none of those apply: switching drops a per-developer Enterprise licence
for features that are in SvGrid's MIT core, cuts the bundle by the
difference in the facts box above, and gives you a Svelte-native API that
plays well with runes.

## Step-by-step migration

A typical migration of a single grid takes 1-3 hours:

1. **Install** - `pnpm add @svgrid/grid` (and `@svgrid/enterprise` if you need export).
2. **Translate columnDefs** - use the mapping table above. Most columns are 1:1.
3. **Wrap features** - figure out which AG Grid features you actually use; register only those in `tableFeatures({...})`.
4. **Swap the component** - `<AgGridSvelte gridOptions={...}>` → `<SvGrid data={rows} columns={columns} features={features}>`.
5. **Move event handlers** - AG Grid `onCellValueChanged` → SvGrid `onCellValueChange` (signature differs slightly, see above).
6. **Move API calls** - AG Grid `gridApi.X()` → SvGrid `api.X()` per the API table.
7. **Test interactions** - sort, filter, edit, select. Most "just works."
8. **Remove `ag-grid-*` packages** - `pnpm remove ag-grid-community ag-grid-svelte` etc. Inspect your bundle to confirm the drop; the facts box above has both measured sizes.

## Need help migrating?

Enterprise customers get **migration help included** with the support plan
(architecture review, port one grid for you as a reference). Email
`support@jqwidgets.com` after purchase, or `sales@jqwidgets.com` for
pre-sales questions.

## Frequently asked questions

### Is SvGrid a drop-in replacement for AG Grid in Svelte?

Not a literal drop-in - there is no `ag-grid-svelte` shim to swap. But the
concepts map closely: column definitions, row models, sorting, filtering,
grouping, and an imperative API all have direct SvGrid equivalents, so most
teams port a grid in 30 minutes to a day. It is a configuration translation,
not a rewrite.

### What is the SvGrid equivalent of AG Grid Enterprise?

`@svgrid/enterprise`. It adds Excel/PDF/styled-HTML export (CSV, TSV and JSON export are already free in the grid), a printable view, pivot
tables and data import. The in-grid AI helpers are free in `@svgrid/grid`.
It is licensed per developer ($599 single-app / $999 multi-app), and the
Community package is MIT-licensed and free for commercial use.

### Does SvGrid use Svelte 5 runes, or is it a wrapper?

It is Svelte-5-native. State is `$state` / `$derived` / `$effect` and cells
render through Svelte snippets - there is no React or Angular core underneath
and no framework bridge to keep in sync.

### Will my AG Grid bundle size shrink?

Almost always. The facts box at the top of this page has both packages
measured the same way on the same date: the full SvGrid render component
with its stylesheet against `createGrid` with every AG Grid Community
module registered. You add `@svgrid/enterprise` features only where you
import them, and the headless core on its own is a small fraction of the
render component.

## More examples

### AG Grid ↔ sv-grid side-by-side

Two real grids over the same dataset: the installed AG Grid Community on the left, sv-grid on the right. Same global filter drives both. Source code panels for either side.

<div data-docs-demo="139-migration-from-ag-grid" data-height="460"></div>

## See also

- [Getting started](../getting-started.md) - full SvGrid walkthrough
- [Why headless?](../why-headless.md) - the headless / render-component split
- [Data export and printing](./export.md) - the `@svgrid/enterprise` feature pack
- [Comparison: SvGrid vs AG Grid vs TanStack Table](./comparison.md) - the
  measured benchmark and the feature matrix
- [SvGrid vs AG Grid comparison page](https://svgrid.com/compare/ag-grid/) -
  every claim with its source and date
