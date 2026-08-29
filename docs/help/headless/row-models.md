# Row models

The engine turns your raw `data` into the rows you render by running it through
a **pipeline** of row models. You opt into the steps you need; everything else
is tree-shaken out.

```
data
 └─▶ coreRowModel        wrap each item as a Row
      └─▶ filteredRowModel   drop rows that fail the column filters
           └─▶ sortedRowModel     order by the sort state
                └─▶ groupedRowModel    build group parent rows + aggregates
                     └─▶ expandedRowModel   flatten only expanded groups
                          └─▶ paginatedRowModel   slice to the current page
```

Each step is lazy and reads from the [controlled state](./controlled-state.md)
(`sorting`, `columnFilters`, `grouping`, `expanded`, `pagination`).

Flip the group-by control below and watch the pipeline change shape - the same
engine goes from a flat list to `grouped -> expanded` with per-group `sum`
aggregates, and the markup stays a plain hand-styled `<table>`:

<div data-docs-demo="190-headless-row-models" data-height="440"></div>

## Opt in per step

Pass only the models you want into `_rowModels`. `createCoreRowModel` is always
required (it's the entry point); the rest are optional.

```ts
import {
  createSvGrid,
  createCoreRowModel,
  createFilteredRowModel,
  createSortedRowModel,
  createPaginatedRowModel,
  createGroupedRowModel,
  createExpandedRowModel,
  tableFeatures,
  rowPaginationFeature,
  columnGroupingFeature,
  rowExpandingFeature,
} from '@svgrid/grid'

const table = createSvGrid({
  _features: features,
  _rowModels: {
    coreRowModel:      createCoreRowModel<Row>(),
    filteredRowModel:  createFilteredRowModel<Row>(),
    sortedRowModel:    createSortedRowModel<Row>(),
    paginatedRowModel: createPaginatedRowModel<Row>(),
  },
  data,
  columns,
  state,
  // ...change handlers
})

const rows = table.getRowModel().rows // filtered → sorted → paged
```

Skip `paginatedRowModel` and `getRowModel().rows` returns every matching row.
Skip `filteredRowModel` and the `columnFilters` state is simply ignored.

## Pagination

Add `createPaginatedRowModel` and drive it with `pagination` state:

```ts
let pagination = $state({ pageIndex: 0, pageSize: 20 })

const features = tableFeatures({ rowPaginationFeature })

const table = $derived.by(() => createSvGrid({
  _features: features,
  _rowModels: {
    coreRowModel:      createCoreRowModel<Row>(),
    paginatedRowModel: createPaginatedRowModel<Row>(),
  },
  data, columns,
  state: { pagination },
  onPaginationChange: (u) =>
    (pagination = typeof u === 'function' ? u(pagination) : u),
}))

// getRowModel().rows is now just the current page
function nextPage() { pagination = { ...pagination, pageIndex: pagination.pageIndex + 1 } }
```

## Grouping + aggregation

`groupedRowModel` builds parent rows with aggregated values; `expandedRowModel`
then emits only the expanded children. A grouped row's `getIsGrouped()` is true
and its aggregates come from each column's `aggregate` setting.

```ts
let grouping = $state<string[]>(['lang'])
let expanded = $state<Record<string, boolean>>({})

const features = tableFeatures({ columnGroupingFeature, rowExpandingFeature })

const table = $derived.by(() => createSvGrid({
  _features: features,
  _rowModels: {
    coreRowModel:     createCoreRowModel<Repo>(),
    groupedRowModel:  createGroupedRowModel<Repo>(),
    expandedRowModel: createExpandedRowModel<Repo>(),
  },
  data,
  columns: [
    { field: 'lang', header: 'Lang' },
    { field: 'stars', header: 'Stars', aggregate: 'sum' }, // rolled up per group
  ],
  state: { grouping, expanded },
  onExpandedChange: (u) => (expanded = typeof u === 'function' ? u(expanded) : u),
}))

const rows = $derived(table.getRowModel().rows)
// each row: row.getIsGrouped(), row.getIsExpanded(), row.toggleExpanded()
```

## Server-side: skip the local pipeline

When the server does the sorting / filtering / paging, feed the engine only the
page it returned and leave those models out - the engine just wraps and renders
what you give it:

```ts
const table = createSvGrid({
  _features: tableFeatures({}),   // no features - the server did the work
  _rowModels: { coreRowModel: createCoreRowModel<Row>() }, // core only
  data: serverPage.rows,   // already sorted/filtered/paged by the API
  columns,
  state,
})
```

Track the sort/filter state via the change handlers and re-fetch on change - see
[Server-side data (load on demand)](./server-side.md) for a complete, runnable
example with paging, sorting, filtering and a race-safe fetch.

## See also

- [Build a table from scratch](./build-a-table.md)
- [Server-side data (load on demand)](./server-side.md)
- [Controlled state](./controlled-state.md)
- [Grouping & aggregation](../grouping-aggregation.md)
