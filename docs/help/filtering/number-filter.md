# Number filter

A column with `editorType: 'number'` gets the **number** filter operator
set: `equals`, `notEquals`, `greaterThan`, `lessThan`, **`between`**, `in`,
`notIn`, `isBlank`, `isNotBlank`. The default operator is `equals`.
<div data-docs-demo="64-filter-between-operator" data-height="540"></div>

```ts
const columns: GridColumns<Person> = [
  { field: 'age',    header: 'Age',    editorType: 'number' },
  {
    field: 'salary', header: 'Salary', editorType: 'number',
    format: { type: 'currency', currency: 'USD' },
  },
]
```

## Range - `between`

Pick **Between** in the column menu's operator picker and the second
input ("To") appears next to the first ("From"). Both endpoints are
**inclusive**.

Programmatically:

```ts
api.setFilter('age', { operator: 'between', value: '18', valueTo: '65' })
```

Or via the headless filter helper:

```ts
import { applyExcelFilter } from '@svgrid/grid'

applyExcelFilter(72, { id: 'age', operator: 'between', value: 18, valueTo: 65 })
// → false (72 > 65)
```

The grid treats the filter as inactive when either endpoint is empty.
That way the user can type `from = 18` and the grid keeps showing
every row until they finish typing the `to` value too.

## Numeric input parsing

The filter value comes in from the DOM as a string. Use `parseEditorValue`
to convert:

```ts
import { parseEditorValue } from '@svgrid/grid'

parseEditorValue('number', '4.5')   // 4.5
parseEditorValue('number', 'abc')   // NaN - reject
```

The grid does this for you when the user types into a header filter.

## Locale

Number filters compare raw `Number(cellValue)` against `Number(filter.value)`.
They do not parse "1,234.50" or "1 234,50" - feed the column raw numbers,
and use a `format` on the column for display.

## Numeric operators

A numeric column offers the comparisons rather than the string ones - greater
than, less than, between. Nothing configures that; it follows the value type.

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
  }

  const people: Person[] = [
    { id: 1, name: 'Ada Lovelace',   department: 'Engineering', city: 'London',   age: 36, salary: 142000 },
    { id: 2, name: 'Grace Hopper',   department: 'Engineering', city: 'New York', age: 45, salary: 168000 },
    { id: 3, name: 'Linus Torvalds', department: 'Platform',    city: 'Portland', age: 54, salary: 155000 },
    { id: 4, name: 'Radia Perlman',  department: 'Networking',  city: 'Seattle',  age: 49, salary: 161000 },
    { id: 5, name: 'Barbara Liskov', department: 'Platform',    city: 'Boston',   age: 52, salary: 172000 },
  ]

  const columns: GridColumns<Person> = [
    { field: 'name',   header: 'Name',   width: 190 },
    { field: 'age',    header: 'Age',    width: 100, editorType: 'number' },
    { field: 'salary', header: 'Salary', width: 150, editorType: 'number',
      format: { type: 'currency', currency: 'USD' } },
  ]
</script>

<SvGrid data={people} {columns} filterable filterMode="menu" sortable />
```


## Between, from code

`between` is the one operator that needs a second bound. Pass `valueTo`
alongside `value` - the menu does the same thing when a user picks it.

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
  }

  const people: Person[] = [
    { id: 1, name: 'Ada Lovelace',   department: 'Engineering', city: 'London',   age: 36, salary: 142000 },
    { id: 2, name: 'Grace Hopper',   department: 'Engineering', city: 'New York', age: 45, salary: 168000 },
    { id: 3, name: 'Linus Torvalds', department: 'Platform',    city: 'Portland', age: 54, salary: 155000 },
    { id: 4, name: 'Radia Perlman',  department: 'Networking',  city: 'Seattle',  age: 49, salary: 161000 },
    { id: 5, name: 'Barbara Liskov', department: 'Platform',    city: 'Boston',   age: 52, salary: 172000 },
  ]

  let api = $state<SvGridApi<{}, Person> | null>(null)

  const columns: GridColumns<Person> = [
    { field: 'name',   header: 'Name',   width: 190 },
    { field: 'salary', header: 'Salary', width: 150,
      format: { type: 'currency', currency: 'USD' } },
  ]
</script>

<button type="button" onclick={() => api?.setFilter('salary', { operator: 'between', value: '150000', valueTo: '170000' })}>
  150k to 170k
</button>

<SvGrid data={people} {columns} filterable filterMode="menu" onApiReady={(next) => (api = next)} />
```

## See also

- [Filter conditions](./filter-conditions.md)
- [Number editor](../editing/provided-editors.md#number-editor)
