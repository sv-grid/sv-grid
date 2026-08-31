# Cell data types

The `editorType` field on a column tags the column with a type. This drives
three different behaviours:
<div data-docs-demo="01-quick-start" data-height="540"></div>

| Effect | Driven by `editorType` |
| ------ | --------------------- |
| Which inline editor opens on `F2` / double-click | yes - `text` / `number` / `date` / `datetime` / `checkbox` |
| Which sort comparator is used | yes - `number` and `date`/`datetime` pick non-default `sortFns` |
| Which filter operators the column menu offers | yes - text / number / date / checkbox sets differ |

## Setting it

```ts
const columns: GridColumns<Person> = [
  { field: 'firstName',  header: 'First',    editorType: 'text' },
  { field: 'age',        header: 'Age',      editorType: 'number' },
  { field: 'joinedAt',   header: 'Joined',   editorType: 'date' },
  { field: 'startTime',  header: 'Start',    editorType: 'datetime' },
  { field: 'active',     header: 'Active',   editorType: 'checkbox' },
]
```

Even if you do not enable inline editing, set `editorType` so sort and
filter behave correctly for the column's data type. A `number` column
without `editorType` sorts as lexical strings.

## `cellDataType` shorthand

`cellDataType` is a higher-level alias that resolves to the right `editorType`,
alignment, date `format`, and filter operators in one word - so you don't hand-set
each:

```ts
const columns = [
  { field: 'name',   cellDataType: 'text' },
  { field: 'age',    cellDataType: 'number' },     // number editor, right-aligned, numeric filters
  { field: 'active', cellDataType: 'boolean' },    // checkbox editor, centered
  { field: 'joined', cellDataType: 'date' },       // Date values, `{ type: 'date' }` format
  { field: 'due',    cellDataType: 'dateString' }, // ISO date STRINGS ('2026-06-27')
]
```

| `cellDataType` | resolves to `editorType` | + format |
| --- | --- | --- |
| `text` | `text` | - |
| `number` | `number` | - |
| `boolean` | `checkbox` | - |
| `date` | `date` | `{ type: 'date' }` |
| `dateString` | `date` | - |

Anything you set explicitly (`editorType`, `align`, `format`) always wins -
`cellDataType` only fills the gaps.

## Inferring types from the data

Set `inferColumnTypes` on the grid and any column that declares **neither**
`editorType` **nor** `cellDataType` has its type inferred from the first data
row (number / boolean / `Date` / ISO date-string / text):

```svelte
<SvGrid {data} {columns} inferColumnTypes />
```

## Built-in types

| `editorType` | accepted value space |
| ------------ | -------------------- |
| `'text'`     | strings |
| `'number'`   | numbers (or numeric strings) |
| `'date'`     | ISO date strings (`YYYY-MM-DD`) or `Date` |
| `'datetime'` | ISO datetime strings or `Date` |
| `'checkbox'` | booleans |

## Custom types

There is no plug-in "register a new cell data type" API. To use a custom
type:

- Render with a custom `cell` (see [Cell components](./cell-components.md))
- Sort with a custom value through `fieldFn` that normalises to a
  comparable primitive
- Filter with a custom operator UI in your own header component

## Editor value parsing

The editor receives a string from the DOM and converts to the canonical
value before commit. The implementation lives in
[`parseEditorValue`](../../../packages/grid/src/editors/cell-editors.ts).

```ts
import { parseEditorValue } from '@svgrid/grid'

parseEditorValue('number',   '42')      // 42
parseEditorValue('number',   'abc')     // NaN - caller should reject
parseEditorValue('checkbox', 'true')    // true
parseEditorValue('date',     '2026-05-27')  // '2026-05-27'
```

## See also

- [Provided cell editors](../editing/provided-editors.md)
- [Filter conditions](../filtering/filter-conditions.md)
