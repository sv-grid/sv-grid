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
} from 'sv-grid-community'

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
} from 'sv-grid-community'

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
import { sortFns } from 'sv-grid-community'

// sortFns.auto   - lexical (default for unknown / mixed types)
// sortFns.number - numeric, NaN-safe
// sortFns.date   - parsed via new Date(...)
```

Pick a comparator yourself by setting the column's `editorType` -
`'number'`, `'date'`, `'datetime'` map to `sortFns.number` /
`sortFns.date` automatically.

### `filterFns`

```ts
import { filterFns } from 'sv-grid-community'

// includesString, equalsString, arrIncludes,
// inNumberRange, isAfter, isBefore, isEmpty, isNotEmpty
```

Reference a filter function by name on a column-filter clause:

```ts
const columnFilters = [{ id: 'age', value: 30, fn: 'equals' }]
```

Extend the registry yourself - it's a plain mutable object:

```ts
import { filterFns } from 'sv-grid-community'

declare module 'sv-grid-community' {
  interface FilterFnsRegistry {
    inListCSV: (value: unknown, query: string) => boolean
  }
}

;(filterFns as any).inListCSV = (value, query) => {
  const items = String(query).split(',').map((s) => s.trim().toLowerCase())
  return items.includes(String(value ?? '').toLowerCase())
}
```

## See also

- [`<SvGrid>`](./SvGrid.md) - where features get passed in
- [`SvGridApi`](./SvGridApi.md) - imperative sort/filter/group setters
- [Why headless?](../why-headless.md) - when to use the row-model factories directly
