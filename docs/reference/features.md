# Features reference

A "feature" is a small bundle of state + helpers the grid engine
checks for when wiring its row-model pipeline. Register only what
you use - each feature ships about 1-2 KB gzipped and adds a small
per-update cost.

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
})
```

The `features` object is the contract the headless core checks for
optional capabilities. The wrapper reads it once at mount and wires
the matching row-model pipeline (core → filtered → sorted → grouped →
expanded). Features you don't register are tree-shaken out.

## The feature catalogue

| Feature                  | Enables                                                    | Topic                                                    |
| ------------------------ | ---------------------------------------------------------- | -------------------------------------------------------- |
| `rowSortingFeature`      | Click headers to sort; Shift-click for multi-sort.         | [Row sorting](../help/rows/row-sorting.md)               |
| `columnFilteringFeature` | Per-column filter menu, global search, filter row.         | [Filter overview](../help/filtering/overview.md)         |
| `rowPaginationFeature`   | Page slicing + the footer pager.                           | [Row pagination](../help/rows/row-pagination.md)         |
| `rowSelectionFeature`    | Checkbox column + Shift/Ctrl multi-select.                 | [Styling rows](../help/rows/styling-rows.md)             |
| `columnGroupingFeature`  | Group-by-column + aggregated footer summaries.             | [Grouping & aggregation](../help/grouping-aggregation.md)|
| `rowExpandingFeature`    | Tree / master-detail expand-collapse.                      | [Tree rows](../help/rows/tree-rows.md)                   |

## `tableFeatures(features)` factory

```ts
function tableFeatures<TFeatures extends Partial<TableFeatures>>(
  features: TFeatures,
): TFeatures
```

Identity at runtime - just a typed pass-through. Its job is to give
TypeScript a precise type for the `features` object that
`<SvGrid features={...}>` and `ColumnDef<TFeatures, TData>` both
consume.

## Row-model factories (headless)

Each feature has a matching row-model factory exported from the
package. When you use the `<SvGrid>` wrapper, the factories get wired
in for you. When you drop down to `createSvGrid` directly, register
them yourself:

```ts
import {
  createSvGrid,
  createCoreRowModel,
  createFilteredRowModel,
  createSortedRowModel,
  createGroupedRowModel,
  createExpandedRowModel,
  createPaginatedRowModel,
  tableFeatures,
  rowSortingFeature,
  columnFilteringFeature,
  rowPaginationFeature,
  sortFns,
  filterFns,
} from '@svgrid/grid'

const grid = createSvGrid({
  _features: tableFeatures({
    rowSortingFeature,
    columnFilteringFeature,
    rowPaginationFeature,
  }),
  _rowModels: {
    coreRowModel:       createCoreRowModel(),
    filteredRowModel:   createFilteredRowModel(),
    sortedRowModel:     createSortedRowModel(sortFns),
    paginatedRowModel:  createPaginatedRowModel(),
  },
  columns,
  data,
})
```

| Factory                    | Order in pipeline | Notes                                                              |
| -------------------------- | ----------------- | ------------------------------------------------------------------ |
| `createCoreRowModel`       | 1                 | Identity. Always required.                                         |
| `createFilteredRowModel`   | 2                 | Applies the grid's `columnFilters` state.                          |
| `createSortedRowModel`     | 3                 | Applies `sorting` state; comparator picked by column `editorType`.|
| `createGroupedRowModel`    | 4                 | Applies `grouping` state; emits group rows.                        |
| `createExpandedRowModel`   | 5                 | Filters out collapsed children.                                    |
| `createPaginatedRowModel`  | 6                 | Slices to the current page. NOT used by the wrapper - see below.   |

> **Wrapper pagination note.** The `<SvGrid>` wrapper does **not** put
> `paginatedRowModel` in the pipeline. It paginates **after** its own
> filter overlays so the filter UI sees the full dataset, not the
> visible page. See [Row pagination](../help/rows/row-pagination.md).

## Sort + filter function registries

### `sortFns`

```ts
import { sortFns } from '@svgrid/grid'

// sortFns.auto   - lexical, via String(a).localeCompare(String(b))
// sortFns.number - numeric; null / undefined count as 0
// sortFns.date   - new Date(value).getTime() difference
```

Pick a comparator yourself by setting the column's `editorType` -
`'number'`, `'date'`, `'datetime'` map to `sortFns.number` /
`sortFns.date` automatically.

### `filterFns`

```ts
import { filterFns } from '@svgrid/grid'

// includesString - case-insensitive substring. The DEFAULT.
// equals         - strict identity (===), so '30' does not match 30.
```

Two functions, because this registry backs the headless
`filteredRowModel` only. The richer operator set the `<SvGrid>` filter UI offers
(`between`, `regex`, `notContains`, `in`, the blank checks) is applied by the
renderer - see [Filter overview](../help/filtering/overview.md).

Reference one by name on a column-filter clause. Omit `fn` and you get
`includesString`:

```ts
const columnFilters = [
  { id: 'lang', value: 'rust' },                  // substring, case-insensitive
  { id: 'age', value: 30, fn: 'equals' as const }, // strict
]
```

Extend the registry yourself - it is a plain mutable object, so add a key and
name it from a clause:

```ts
import { filterFns } from '@svgrid/grid'

;(filterFns as Record<string, (value: unknown, query: unknown) => boolean>).inListCSV =
  (value, query) => {
    const items = String(query).split(',').map((s) => s.trim().toLowerCase())
    return items.includes(String(value ?? '').toLowerCase())
  }

// TypeScript does not know the new key, so the clause needs a cast.
const columnFilters = [{ id: 'lang', value: 'rust,go', fn: 'inListCSV' as never }]
```

## Features vs pipeline stages

They are separate switches, and mixing them up is the usual headless snag:

- A **feature** decides what a column reports - `getCanSort()`,
  `getCanFilter()` - and therefore what affordance the UI offers.
- A **stage** in `_rowModels` decides what actually happens to the rows.

Register `createSortedRowModel` without `rowSortingFeature` and the rows sort
while the headers insist they cannot be sorted. Register the feature without the
stage and the headers offer sorting that never reorders anything. Register both.

## See also

- [`<SvGrid>`](./SvGrid.md) - where features get passed in
- [Headless engine reference](./headless-engine.md) - the engine these wire into
- [`SvGridApi`](./SvGridApi.md) - imperative sort/filter/group setters
- [Why headless?](../why-headless.md) - when to use the row-model factories directly
