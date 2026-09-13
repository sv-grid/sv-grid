# `ColumnDef` reference

A column definition is the contract between the grid and one column of
data. Pass an array of these as the `columns` prop to `<SvGrid>`.

```ts
import type { GridColumns } from '@svgrid/grid'

type Row = { id: string; firstName: string; salary: number; joinedAt: string }

const columns: GridColumns<Row> = [
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
  fieldFn?: (row: TData) => unknown

  // Rendering
  header?: string | RenderFn
  footer?: string | RenderFn
  cell?:   string | RenderFn
  format?:    CellFormatConfig
  formatter?: CellFormatter<TData>

  // Layout
  width?:   number
  visible?: boolean
  align?:   'left' | 'right' | 'center'

  // Editing
  editorType?: 'text' | 'number' | 'date' | 'datetime' | 'checkbox'

  // Grouping (column groups - nested headers)
  columns?: Array<ColumnDef<TFeatures, TData>>
}
```

## Identity

One of `field`, `fieldFn`, or `id` must be set. The grid derives the
column id in that order:

1. Explicit `id` wins if present.
2. Otherwise `field` becomes the id.
3. Otherwise the column gets a synthetic id (`col_0_0`, etc.) - works
   but you can't reference it from the API.

| Field         | Type                              | Notes                                                                  |
| ------------- | --------------------------------- | ---------------------------------------------------------------------- |
| `id`          | `string`                          | Stable column id. Required when you use `fieldFn`.                  |
| `field`       | `keyof TData & string`            | Reads `row[field]`. The clean default.                                 |
| `fieldFn`  | `(row: TData) => unknown`         | Computed value. Pair with `id`.                                        |

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
| `width`   | `number`                             | Initial width in pixels. Falls back to the wrapper's `columnWidth` prop (default 140). |
| `resizable` | `boolean`                          | Default `true`. Only consulted when the grid has `columnResize` on - it narrows that, it never enables anything. `false` removes this column's drag handle, so pointer drag, the arrow keys and double-click-to-autosize all go with it, and the column menu drops its Autosize item. Programmatic sizing still applies. |
| `visible` | `boolean`                            | Initial visibility. Set `false` to start the column hidden while still listing it in the Choose Columns / tool panel for the user to re-enable. Applied once at mount; after that `api.setColumnVisible` and user toggles win. On a group column, `false` hides the whole group's leaf columns. |
| `align`   | `'left' \| 'right' \| 'center'`      | Header + cell alignment. Inferred from `editorType` when omitted: number/date → right, checkbox → center, else left. |

## Editing

| Field        | Type                                                              | Notes                                                       |
| ------------ | ----------------------------------------------------------------- | ----------------------------------------------------------- |
| `editorType` | `'text' \| 'number' \| 'date' \| 'datetime' \| 'time' \| 'date-native' \| 'datetime-native' \| 'time-native' \| 'password' \| 'checkbox' \| 'list' \| 'chips' \| 'select' \| 'rich-select' \| 'autocomplete' \| 'textarea' \| 'color' \| 'rating'` (or any name registered with `registerCellEditor`) | Required for the column to be inline-editable. |

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
const columns: GridColumns<Row> = [
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
import { renderSnippet } from '@svgrid/grid'

{
  id: 'name',
  header: 'Name',
  fieldFn: (r) => `${r.firstName} ${r.lastName}`,
  cell: (ctx) => renderSnippet(PersonCell, { row: ctx.row.original }),
}
```

## The rest of the options

This page covers the options you reach for first. A column also accepts:

| Field | What it does |
| ----- | ------------ |
| `cellDataType` | `'text' \| 'number' \| 'boolean' \| 'date' \| 'dateString'` - fills in `editorType`, `align` and a date `format` in one go. Anything you set explicitly still wins. |
| `cellClass` | Class name(s) for this column's cells: a string, an array, or a per-cell function returning either, or a `{ class: boolean }` map. |
| `cellFlash` | Flash the cell when its value changes. `true` for the built-in animation, `{ className }` for your own. |
| `cellEditor` | A snippet that replaces the built-in editor, with `commit(value)` / `cancel()` helpers. Wins over `editorType`. |
| `editable` | `false` locks the column; `(ctx) => boolean` locks individual cells. The grid's `enableInlineEditing` still wins when off. |
| `editorOptions` | Options for the list-style editors. Bare values or `{ value, label }`, a `(row) => options` function for cascades, and either may return a Promise. |
| `editorMultiple` | The list / chips editors allow several values; the cell value becomes an array. |
| `editorSeparator` | How an array value is joined for the read-only display. Defaults to `', '`. |
| `validate` | Per-cell validation, run on every rendered cell (not just on edit). Return a string for the message, `false` for a bare invalid, `null` / `true` for valid. |
| `valueParser` | Transform a committed edit before it is written to the row. |
| `tooltip` | A string, or `(ctx) => string`, shown when the pointer rests on the cell. |
| `sortable` | `false` opts the column out of sorting, header clicks and `api.setSort` included. |
| `filterable` | `false` opts the column out of filtering, funnel and `api.setFilter` included. |
| `aggregate` | How the column rolls up into a group banner: `'sum' \| 'avg' \| 'min' \| 'max' \| 'count' \| 'countDistinct' \| 'extent' \| 'first'`, or a custom reducer. |
| `summary` | What the footer summary row shows for this column. Same aggregators; `false` leaves the cell blank. |
| `sparkline` | Render the cell as an in-cell sparkline. A `cell` renderer wins over it. |
| `formatter` | A display function for anything `format` cannot express. Returns a string. |
| `hideBelow` | In `responsive` mode, drop this column when the grid is narrower than this many pixels. |
| `colSpan` / `rowSpan` | Value-driven cell spanning. Feed `spansToMerges(rows, columns)` into `spreadsheetLayout` to apply them. |
| `columnGroupShow` | On a child of a collapsible group: `'open'` shows it only while the group is expanded, `'closed'` only while collapsed. |
| `openByDefault` | On a group column: start expanded instead of collapsed. |

Every option, with its full type and doc comment, is generated from the source
in [`reference/auto/svgrid-grid-core`](./auto/svgrid-grid-core.md), and the
behaviour of all of them is covered by `packages/grid/src/qa/qa.columndef.test.ts`.

## See also

- [`SvGrid`](./SvGrid.md) - where columns are passed in
- [`SvGridApi`](./SvGridApi.md) - imperative add/remove/visibility
- [Cell components](../help/cells/cell-components.md) - the snippet patterns
- [Cell data types](../help/cells/cell-data-types.md) - how `editorType` interacts with sort/filter
