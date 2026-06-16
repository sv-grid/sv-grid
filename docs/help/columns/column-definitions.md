# Column definitions

A `ColumnDef` tells SvGrid how to read a value out of a row, how to render it,
and which features apply to it. The grid below is built from a handful
of `ColumnDef`s - look at the [source](https://svgrid.com/#/demos/01-quick-start) to see how each shape maps to a column behaviour:

<div data-docs-demo="01-quick-start" data-height="460"></div>


## Minimal

```ts
import type { ColumnDef } from 'sv-grid-core'

type Person = { firstName: string; age: number; status: string }

const columns: ColumnDef<{}, Person>[] = [
  { field: 'firstName', header: 'First name' },
  { field: 'age',       header: 'Age' },
  { field: 'status',    header: 'Status' },
]
```

## Properties

| Property | Type | Purpose |
| --- | --- | --- |
| `id` | `string` | Stable column id. Required when you use `accessorFn` and no `field`. |
| `field` | `keyof TData & string` | Reads `row[key]`. |
| `accessorFn` | `(row) => unknown` | Computes the value. |
| `header` | `string` \| `(ctx) => unknown` | String, or a function returning a `renderSnippet` / `renderComponent`. |
| `cell` | `(ctx) => unknown` | Same shape as `header`, for body cells. |
| `footer` | `string` \| `(ctx) => unknown` | Footer cell. |
| `editorType` | `'text' \| 'number' \| 'date' \| 'datetime' \| 'checkbox'` | Inline editor type. |
| `format` | `CellFormatConfig` | Built-in `number`, `currency`, `percent`, `date`, `datetime` formatters. |
| `formatter` | `(ctx) => string` | Custom formatter - runs after `field` / `accessorFn`. |
| `columns` | `ColumnDef[]` | Children - turns this column into a column **group**. |
| `width` | `number` | Initial width in pixels (overrides the grid's `columnWidth`). |

See [`packages/sv-grid-core/src/core.ts`](../../../packages/sv-grid-core/src/core.ts).

## Accessor vs. accessorFn

`field` is the common case. Use `accessorFn` when the value is
computed or comes from a nested object:

```ts
const columns: ColumnDef<{}, Person>[] = [
  { field: 'firstName', header: 'First' },
  {
    id: 'fullName',
    header: 'Full name',
    accessorFn: (row) => `${row.firstName} ${row.lastName}`,
  },
]
```

Whenever you use `accessorFn` you must supply an `id` - there is no string key
to derive one from.

## Format vs. formatter vs. cell

| You want | Use |
| -------- | --- |
| Locale-aware number / currency / percent / date | `format` |
| A custom string transformation | `formatter` |
| Custom HTML (avatars, pills, progress, sparklines) | `cell` with `renderSnippet` |

`format` is purely declarative and locale-aware - prefer it for anything
numeric or temporal:

```ts
{ field: 'salary', header: 'Salary',
  format: { type: 'currency', currency: 'USD', options: { maximumFractionDigits: 0 } } }

{ field: 'joinedAt', header: 'Joined',
  format: { type: 'date', pattern: 'y-m-d' } }

{ field: 'utilization', header: 'Utilization',
  format: { type: 'percent', valueIsPercentPoints: true } } // 42 -> 42%
```

`formatter` runs after the accessor; the result is what gets displayed
(and what gets copied to the clipboard during cell selection).

`cell` is the most powerful - see [Cell components](../cells/cell-components.md).

## TypeScript

Pass the row type as the second generic; the column's `field` is then
checked against the row's keys:

```ts
const columns: ColumnDef<{}, Person>[] = [
  { field: 'firstName' },   // ✅
  // { field: 'first_name' } // ✗ compile error
]
```

The first generic is the **feature set** - derive it from `tableFeatures` so
feature-specific column properties light up:

```ts
const features = tableFeatures({ rowSortingFeature, columnFilteringFeature })
type Features = typeof features

const columns: ColumnDef<Features, Person>[] = [/* … */]
```

## See also

- [Updating definitions](./updating-definitions.md)
- [Column state](./column-state.md)
- [Custom header components](./custom-header-components.md)
- Example: [`02-sort-filter-paginate.svelte`](../../../examples/src/demos/02-sort-filter-paginate.svelte)
