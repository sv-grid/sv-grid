# Filtering - overview

Click any column header's filter icon to open the operator + value
popover; numeric and date columns range-bucket their distinct values
so the menu stays usable on big datasets:

<div data-docs-demo="03-excel-filters" data-height="460"></div>

SvGrid offers four filtering surfaces. You opt into the one(s) you need
through the `filterMode` prop on `<SvGrid>`:

| `filterMode` | What it shows |
| ------------ | ------------- |
| `'menu'` (default) | A "filter icon" in each header opens a per-column operator + value popover. |
| `'row'`            | A filter row under the header - one input per column. |
| `'global'`         | A single search box above the grid that searches all visible columns. |
| `'none'`           | No filter UI. Drive filters programmatically only. |

```svelte
<SvGrid {data} {columns} features={features} filterMode="row" />
```

Per-surface props (`showColumnFilters`, `showFilterRow`, `showGlobalFilter`)
override `filterMode` when set explicitly - useful when you want two
surfaces simultaneously.

## Feature registration

Filtering is gated by `columnFilteringFeature` plus
`createFilteredRowModel`. Both must be registered for the column filter UI
to actually filter rows:

```ts
import {
  tableFeatures, columnFilteringFeature, createFilteredRowModel,
} from 'sv-grid-community'

const features = tableFeatures({ columnFilteringFeature })
```

The wrapper auto-registers `createFilteredRowModel` when the feature is
present.

## Operators

All built-in operators:

| Operator      | Applies to | Behaviour |
| ------------- | ---------- | --------- |
| `contains`    | text       | case-insensitive substring |
| `equals`      | text, num, date, bool | strict equality (numeric where possible) |
| `startsWith`  | text       | case-insensitive prefix |
| `greaterThan` | num, date  | strict `>` |
| `lessThan`    | num, date  | strict `<` |
| `between`     | num, date  | inclusive range - requires `valueTo` |
| `isBlank`     | any        | empty / null / undefined / whitespace |

The set of operators offered per column depends on `editorType`:

| `editorType` | operators |
| ------------ | --------- |
| `'text'` (default) | contains, equals, startsWith, isBlank |
| `'number'` | equals, greaterThan, lessThan, isBlank |
| `'date'` / `'datetime'` | equals, lessThan, greaterThan, isBlank |
| `'checkbox'` | equals, isBlank |

## Built-in `filterFns`

For programmatic filtering (without the menu), pass a `filterFn` on the
column or use the headless `createFilteredRowModel` directly.

```ts
import { filterFns } from 'sv-grid-community'

filterFns.includesString(cellValue, query)
filterFns.equals(cellValue, query)
```

## See also

- [Text filter](./text-filter.md)
- [Number filter](./number-filter.md)
- [Date filter](./date-filter.md)
- [Set filter](./set-filter.md)
- [Filter API](./filter-api.md)
- [demos/03-excel-filters.svelte](../../../examples/src/demos/03-excel-filters.svelte)

## Frequently asked questions

### How do I filter a column in SvGrid?

Click a column header's filter icon to open the operator + value popover. Text
columns get `contains` / `equals` / `startsWith` / `isBlank`; number and date
columns add `greaterThan` / `lessThan` / `between`. Filtering is on by default
once the filtering feature is registered.

### Does SvGrid have Excel-style set filters?

Yes. A set filter shows a checklist of a column's distinct values so users can
include "active OR pending" with checkboxes. Numeric and date columns
range-bucket their values so the list stays usable on large datasets.

### Can I filter on the server?

Yes. Set `externalFilter` so the grid records filter state but your API does the
filtering. The grid emits the consolidated filter payload via `onFiltersChange`
for you to forward to the server.
