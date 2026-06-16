# `ColumnDef` reference

A column definition is the contract between the grid and one column of
data. Pass an array of these as the `columns` prop to `<SvGrid>`.

```ts
import type { ColumnDef } from 'sv-grid-core'

type Row = { id: string; firstName: string; salary: number; joinedAt: string }

const columns: ColumnDef<{}, Row>[] = [
  { field: 'firstName', header: 'First name' },
  {
    field: 'salary',
    header: 'Salary',
    format: { type: 'currency', currency: 'USD' },
    align: 'right',
  },
]
```

## Type

```ts
type ColumnDef<TFeatures, TData> = {
  // Identity
  id?: string
  field?: keyof TData & string
  accessorFn?: (row: TData) => unknown

  // Rendering
  header?: string | RenderFn
  footer?: string | RenderFn
  cell?:   string | RenderFn
  format?:    CellFormatConfig
  formatter?: CellFormatter<TData>

  // Layout
  width?: number
  align?: 'left' | 'right' | 'center'

  // Editing
  editorType?: 'text' | 'number' | 'date' | 'datetime' | 'checkbox'

  // Grouping (column groups - nested headers)
  columns?: Array<ColumnDef<TFeatures, TData>>
}
```

## Identity

One of `field`, `accessorFn`, or `id` must be set. The grid derives the
column id in that order:

1. Explicit `id` wins if present.
2. Otherwise `field` becomes the id.
3. Otherwise the column gets a synthetic id (`col_0_0`, etc.) - works
   but you can't reference it from the API.

| Field         | Type                              | Notes                                                                  |
| ------------- | --------------------------------- | ---------------------------------------------------------------------- |
| `id`          | `string`                          | Stable column id. Required when you use `accessorFn`.                  |
| `field`       | `keyof TData & string`            | Reads `row[field]`. The clean default.                                 |
| `accessorFn`  | `(row: TData) => unknown`         | Computed value. Pair with `id`.                                        |

## Rendering

| Field       | Type                                            | Notes                                                       |
| ----------- | ----------------------------------------------- | ----------------------------------------------------------- |
| `header`    | `string \| (ctx) => HeaderRender`               | Header label or render snippet/component.                   |
| `footer`    | `string \| (ctx) => HeaderRender`               | Footer label or render. Off by default.                     |
| `cell`      | `string \| (ctx) => CellRender`                 | Body cell render. Use `renderSnippet(YourSnippet, props)`.  |
| `format`    | `CellFormatConfig`                              | Built-in formatter; tree-shakeable. See below.              |
| `formatter` | `(value, row) => string`                        | One-off custom string. Cheaper than a `cell` render fn.     |

### `CellFormatConfig`

```ts
type CellFormatConfig =
  | { type: 'number';   options?: Intl.NumberFormatOptions; locales?: string | string[] }
  | { type: 'currency'; currency: string; options?: Intl.NumberFormatOptions; locales?: string | string[] }
  | { type: 'percent';  options?: Intl.NumberFormatOptions; locales?: string | string[] }
  | { type: 'date';     pattern?: string; options?: Intl.DateTimeFormatOptions; locales?: string | string[] }
  | { type: 'datetime'; pattern?: string; options?: Intl.DateTimeFormatOptions; locales?: string | string[] }
```

The grid caches the underlying `Intl.NumberFormat` /
`Intl.DateTimeFormat` instances by signature so format throughput stays
fast on large datasets.

### `pattern` for date/datetime

Built-in pattern tokens:

| Token  | Replaced with                |
| ------ | ---------------------------- |
| `y`    | 4-digit year                 |
| `yy`   | 2-digit year                 |
| `m`    | 2-digit month                |
| `mmm`  | Short month name             |
| `mmmm` | Long month name              |
| `d`    | 2-digit day                  |
| `H`    | 2-digit hour (24h)           |
| `h`    | 2-digit hour (12h)           |
| `M`    | 2-digit minute               |
| `s`    | 2-digit second               |
| `a`    | am / pm                      |

Example: `{ type: 'date', pattern: 'y-m-d' }` ⇒ `2026-06-05`.

## Layout

| Field   | Type                                 | Notes                                                                                 |
| ------- | ------------------------------------ | ------------------------------------------------------------------------------------- |
| `width` | `number`                             | Initial width in pixels. Falls back to the wrapper's `columnWidth` prop (default 140). |
| `align` | `'left' \| 'right' \| 'center'`      | Header + cell alignment. Inferred from `editorType` when omitted: number/date → right, checkbox → center, else left. |

## Editing

| Field        | Type                                                              | Notes                                                       |
| ------------ | ----------------------------------------------------------------- | ----------------------------------------------------------- |
| `editorType` | `'text' \| 'number' \| 'date' \| 'datetime' \| 'checkbox'`        | Required for the column to be inline-editable.              |

The grid uses `editorType` for two things: which inline editor to
mount when the user presses F2, AND which sort comparator to pick when
sorting. Set it even when you don't need editing if your column is
numeric or date-typed.

## Column groups

| Field     | Type                                       | Notes                                                       |
| --------- | ------------------------------------------ | ----------------------------------------------------------- |
| `columns` | `Array<ColumnDef<TFeatures, TData>>`       | Child columns. Renders this column-def as a header group.   |

Example:

```ts
const columns: ColumnDef<{}, Row>[] = [
  {
    id: 'name',
    header: 'Name',
    columns: [
      { field: 'firstName', header: 'First' },
      { field: 'lastName',  header: 'Last' },
    ],
  },
  { field: 'salary', header: 'Salary' },
]
```

## Custom-cell context

When `cell` is a function, it receives a `CellContext<TData>`:

```ts
type CellContext<TData> = {
  cell:    Cell<TData>
  row:     Row<TData>
  column:  Column<TData>
  table:   SvGrid<TData>
  getValue: () => unknown
}
```

You typically need `ctx.row.original` (the source row) and
`ctx.getValue()`:

```ts
import { renderSnippet } from 'sv-grid-core'

{
  id: 'name',
  header: 'Name',
  accessorFn: (r) => `${r.firstName} ${r.lastName}`,
  cell: (ctx) => renderSnippet(PersonCell, { row: ctx.row.original }),
}
```

## See also

- [`SvGrid`](./SvGrid.md) - where columns are passed in
- [`SvGridApi`](./SvGridApi.md) - imperative add/remove/visibility
- [Cell components](../help/cells/cell-components.md) - the snippet patterns
- [Cell data types](../help/cells/cell-data-types.md) - how `editorType` interacts with sort/filter
