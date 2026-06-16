# Migrating from AG Grid to SvGrid

If you tried AG Grid on a Svelte 5 project - via `ag-grid-svelte`, the
old `ag-grid-community/svelte`, or a hand-rolled wrapper - you probably
hit the same friction everyone hits: the bridge between AG Grid's
React/Angular-first API and Svelte 5 runes is brittle, the bundle is
heavy, and the Enterprise pricing only makes sense at scale.

This page is a 30-minute migration recipe from AG Grid to SvGrid. It
covers what maps 1:1, what's different by design, and what you'll lose.
We tell you when **not** to switch at the bottom.

## TL;DR

| | AG Grid Community | AG Grid Enterprise | SvGrid Community | @svgrid/enterprise |
| --- | --- | --- | --- | --- |
| **License** | MIT | Commercial (~$999/dev/yr) | **MIT** | $599/dev/yr (single app) or $999/dev/yr (multi app) |
| **Svelte 5 native** | ❌ (wrapper) | ❌ (wrapper) | ✅ | ✅ |
| **Bundle (gzipped)** | ~250 KB | ~400 KB | ~7.5 KB headless / ~42 KB full | lazy-loaded subpaths |
| **Sorting / filtering / grouping** | ✅ | ✅ | ✅ | (in Community) |
| **Master/detail, tree, range select** | ❌ Enterprise only | ✅ | ✅ (free) | (in Community) |
| **Excel export** | ❌ | ✅ Enterprise | ❌ | ✅ |
| **PDF / CSV / TSV / HTML export** | ❌ | Partial | ❌ | ✅ |
| **Print view** | ❌ | ❌ | ❌ | ✅ |
| **Set filter / Excel-style filter menu** | ❌ Enterprise | ✅ | ✅ (free) | (in Community) |

The headline: **SvGrid Community gives you most of AG Grid Enterprise's
features for free**, and `@svgrid/enterprise` adds the export + print pack for
~40% less than AG Grid Enterprise. The catch is Svelte-only and a much
smaller ecosystem.

## Mental model - what changes

AG Grid is one big object you configure declaratively. SvGrid is a
**headless engine** (`createSvGrid`) with an optional **render
component** (`<SvGrid>`) on top - the same split TanStack Table made
popular. You can use either layer; most projects use the render
component.

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
| `valueGetter` | `accessorFn` | Returns the value for sorting/filtering. |
| `cellRenderer` + `cellRendererParams` | `cell: renderComponent(C, ctx => props)` | One call, type-checked. |
| `cellEditor: 'agTextCellEditor'` | `editorType: 'text'` | Built-in: `text`, `number`, `checkbox`, `date`. |
| `editable: true` | `enableInlineEditing` prop on `<SvGrid>` | Per-grid, not per-column. (Per-column control on the roadmap.) |
| `pinned: 'left'` / `'right'` | Right-click column menu → Pin | Set programmatically via the api. |
| `rowGroup: true` | Via `setGroupBy([colId])` | See Grouping below. |
| `aggFunc: 'sum'` | `aggregation: 'sum'` | Built-in: `sum`, `avg`, `min`, `max`, `count`. |

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
    { field: 'salary',     header: 'Salary', aggregation: 'sum',
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
[demo 08](https://sv-grid.dev/#/demos/08-tree-and-master-detail) for the exact pattern.

### Server-side data

AG Grid uses an `IServerSideDatasource` interface. SvGrid uses
`externalSort` + `externalFilter` props - your code keeps full control
over the query, and the grid records UI state but doesn't re-order rows
locally. See [demo 09](https://sv-grid.dev/#/demos/09-server-side).

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
SvGrid v1.0 toggles editing at the grid level (`enableInlineEditing`).
Per-column editability is on the roadmap - until then, you can gate
edits in your `onCellValueChange` handler.

### 2. Column drag-to-reorder
SvGrid v1.0 supports column reorder via the API (`setColumnOrder`), not
header drag. Built-in header drag is on the roadmap. Most teams don't
miss it - it's a power-user feature.

### 3. AG Grid `valueGetter` chains
AG Grid's `valueGetter` can read other column values via the API. In
SvGrid, `accessorFn` only receives the row; if you need cross-column
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
- **Use AG Grid's integrated charts** - those depend on AG Grid's chart engine; SvGrid has no equivalent.
- **Depend on AG Grid pivoting** - not in SvGrid's roadmap.
- **Are mid-project and shipping in <2 weeks** - the migration is a few hours per grid, but only do it when you have buffer.
- **Have a Svelte 4 codebase you can't upgrade** - SvGrid requires Svelte 5 runes. (Consider [htmlelements.com](https://www.htmlelements.com) for vanilla / multi-framework.)

If none of those apply: switching saves you $400-$1000 per dev per year,
cuts your bundle by 200+ KB, and gives you a Svelte-native API that
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
8. **Remove `ag-grid-*` packages** - `pnpm remove ag-grid-community ag-grid-svelte` etc. Inspect your bundle to confirm the 200+ KB drop.

## Need help migrating?

Enterprise customers get **migration help included** with the support plan
(architecture review, port one grid for you as a reference). Email
`support@jqwidgets.com` after purchase, or `sales@jqwidgets.com` for
pre-sales questions.

## See also

- [Getting started](../getting-started.md) - full SvGrid walkthrough
- [Why headless?](../why-headless.md) - the headless / render-component split
- [Data export and printing](./export.md) - the `@svgrid/enterprise` feature pack
- [SvGrid vs AG Grid comparison page](https://sv-grid.dev/#/compare/ag-grid)

## Frequently asked questions

### Is SvGrid a drop-in replacement for AG Grid in Svelte?

Not a literal drop-in - there is no `ag-grid-svelte` shim to swap. But the
concepts map closely: column definitions, row models, sorting, filtering,
grouping, and an imperative API all have direct SvGrid equivalents, so most
teams port a grid in 30 minutes to a day. It is a configuration translation,
not a rewrite.

### What is the SvGrid equivalent of AG Grid Enterprise?

`@svgrid/enterprise`. It adds Excel/PDF/CSV/TSV/HTML export, a printable view, pivot
tables, data import, and AI helpers. It is licensed per developer
($599 single-app / $999 multi-app), not per deployment, and the Community
package is MIT-licensed and free for commercial use.

### Does SvGrid use Svelte 5 runes, or is it a wrapper?

It is Svelte-5-native. State is `$state` / `$derived` / `$effect` and cells
render through Svelte snippets - there is no React or Angular core underneath
and no framework bridge to keep in sync.

### Will my AG Grid bundle size shrink?

Almost always. SvGrid's full render component is ~42 KB gzipped (or ~7.5 KB
for the headless core) versus a much heavier AG Grid Community bundle, and you
only add `@svgrid/enterprise` features you actually use - so you ship a fraction of
the JavaScript.
