# Cell data types

A column has a data type and an editor, set separately. `cellDataType` says
what the values are; `editorType` says what edits them.
<div data-docs-demo="01-quick-start" data-height="540"></div>

| Effect | Driven by |
| ------ | --------- |
| Which sort comparator is used | `cellDataType`: `number` and `date` / `dateString` pick non-default `sortFns` |
| Which filter operators the column menu offers | `cellDataType`: text / number / date / boolean sets differ |
| Default alignment | `cellDataType`: numbers and dates right, booleans centered |
| Which inline editor opens on `F2` / double-click | `editorType` |

So a number column can be edited in a plain text box, a number input, or
any editor registered with `registerCellEditor`, and still sort, filter and
align as numbers:

```ts
const columns: GridColumns<Person> = [
  { field: 'firstName', header: 'First',  cellDataType: 'text' },
  { field: 'age',       header: 'Age',    cellDataType: 'number' },                       // number input
  { field: 'salary',    header: 'Salary', cellDataType: 'number', editorType: 'text' },   // typed as text
  { field: 'rating',    header: 'Rating', cellDataType: 'number', editorType: 'stars' },  // a registered editor
  { field: 'joined',    header: 'Joined', cellDataType: 'date' },
  { field: 'due',       header: 'Due',    cellDataType: 'dateString' },                   // ISO date strings
  { field: 'active',    header: 'Active', cellDataType: 'boolean' },
]
```

A column with no `editorType` gets the usual editor for its data type:

| `cellDataType` | default `editorType` | + format |
| --- | --- | --- |
| `text` | `text` | - |
| `number` | `number` | - |
| `boolean` | `checkbox` | - |
| `date` | `date` | `{ type: 'date' }` |
| `dateString` | `date` | - |

Anything you set explicitly (`editorType`, `align`, `format`) always wins.

A column that sets only a built-in `editorType` (`number`, `date`,
`datetime`, `checkbox`) and no `cellDataType` takes its data type from it, as
it always has: `{ editorType: 'number' }` still sorts and filters as numbers.

Set a data type even if you do not enable inline editing. Without one,
sorting falls back to the `auto` comparator: a column whose values are all
numbers still sorts numerically, but numbers stored as strings (`'10'`,
`'9'`) sort as text, and a column mixing numbers and text puts the numbers
first.

Every built-in comparator sorts blanks (`null`, `undefined`, `''`) first in
ascending order and last in descending. The `number` and `date` comparators
treat values they cannot parse (`'n/a'`, an invalid date) the same way.

## Inferring types from the data

Set `inferColumnTypes` on the grid and any column without a data type (no
`cellDataType`, and no `number` / `date` / `checkbox` editor) has it inferred
from the first data row (number / boolean / `Date` / ISO date-string / text),
whatever edits it:

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
