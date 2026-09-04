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

## Telling the grid what a string holds

A date that arrives as a string sorts alphabetically unless you say otherwise.
`cellDataType: 'dateString'` is that declaration, and it changes sorting and the
filter operators together.

```svelte {runnable}
<script lang="ts">
  import { SvGrid, type GridColumns, type SvGridApi } from '@svgrid/grid'

  type Person = {
    id: number
    name: string
    department: string
    city: string
    age: number
    salary: number
    joined: string
    active: boolean
    trend: number[]
  }

  const people: Person[] = [
    { id: 1, name: 'Ada Lovelace',   department: 'Engineering', city: 'London',   age: 36, salary: 142000, joined: '2021-03-01', active: true,  trend: [4, 6, 5, 9, 12, 11, 15] },
    { id: 2, name: 'Grace Hopper',   department: 'Engineering', city: 'New York', age: 45, salary: 168000, joined: '2019-07-15', active: true,  trend: [9, 8, 11, 10, 14, 16, 15] },
    { id: 3, name: 'Linus Torvalds', department: 'Platform',    city: 'Portland', age: 54, salary: 155000, joined: '2020-01-20', active: false, trend: [12, 10, 9, 7, 6, 6, 4] },
    { id: 4, name: 'Radia Perlman',  department: 'Networking',  city: 'Seattle',  age: 49, salary: 161000, joined: '2022-09-05', active: true,  trend: [3, 5, 4, 8, 7, 11, 13] },
  ]

  const columns: GridColumns<Person> = [
    { field: 'name',   header: 'Name',   width: 180 },
    // Without cellDataType this sorts as text, which puts 2019 after 2021-03.
    { field: 'joined', header: 'Joined', width: 150, cellDataType: 'dateString',
      format: { type: 'date', options: { dateStyle: 'medium' } } },
  ]
</script>

<SvGrid data={people} {columns} sortable filterable filterMode="menu" />
```


## Booleans

`cellDataType: 'boolean'` gives the column the true/false filter rather than a
text box, and pairs with the checkbox editor so reading and writing agree.

```svelte {runnable}
<script lang="ts">
  import { SvGrid, type GridColumns, type SvGridApi } from '@svgrid/grid'

  type Person = {
    id: number
    name: string
    department: string
    city: string
    age: number
    salary: number
    joined: string
    active: boolean
    trend: number[]
  }

  const people: Person[] = [
    { id: 1, name: 'Ada Lovelace',   department: 'Engineering', city: 'London',   age: 36, salary: 142000, joined: '2021-03-01', active: true,  trend: [4, 6, 5, 9, 12, 11, 15] },
    { id: 2, name: 'Grace Hopper',   department: 'Engineering', city: 'New York', age: 45, salary: 168000, joined: '2019-07-15', active: true,  trend: [9, 8, 11, 10, 14, 16, 15] },
    { id: 3, name: 'Linus Torvalds', department: 'Platform',    city: 'Portland', age: 54, salary: 155000, joined: '2020-01-20', active: false, trend: [12, 10, 9, 7, 6, 6, 4] },
    { id: 4, name: 'Radia Perlman',  department: 'Networking',  city: 'Seattle',  age: 49, salary: 161000, joined: '2022-09-05', active: true,  trend: [3, 5, 4, 8, 7, 11, 13] },
  ]

  const columns: GridColumns<Person> = [
    { field: 'name',   header: 'Name',   width: 190 },
    { field: 'active', header: 'Active', width: 120,
      cellDataType: 'boolean', editorType: 'checkbox' },
  ]
</script>

<SvGrid data={people} {columns} filterable filterMode="menu" editable />
```

## See also

- [Provided cell editors](../editing/provided-editors.md)
- [Filter conditions](../filtering/filter-conditions.md)
