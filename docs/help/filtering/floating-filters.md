# Floating filters

"Floating filters" are the always-visible filter inputs that sit **between** the
header row and the body. In SvGrid the filter row is **per-operator and
per-type**: each cell has a funnel to pick the operator, the value input matches
the column's type, and `between` shows a second inline "To" input.
<div data-docs-demo="179-floating-filters" data-height="520"></div>

## Enable the filter row

```svelte
<SvGrid {data} {columns} features={features} filterMode="row" />
```

## Per-operator, per-type

- **Operator per cell** - click the funnel in a filter-row cell to switch the
  operator (`contains`, `equals`, `greaterThan`, `between`, `isBlank`, …). The
  chosen operator drives that column's filtering; it is the same value the column
  menu uses, so the two surfaces stay in sync.
- **Input matches the column** - a `number` column gets a number input, a `date`
  column a date picker, text a text input. This is driven by the column's
  `editorType`.
- **`between` inline** - selecting Between shows a second **To** input right in
  the row, so ranges work without opening the full menu.

```ts
const columns = [
  { field: 'age', header: 'Age', editorType: 'number' },   // number input
  { field: 'joinedAt', header: 'Joined', editorType: 'date' }, // date picker
  { field: 'name', header: 'Name', editorType: 'text' },   // text input
]
```

To show both the filter row and the column-menu funnel, set both surfaces:

```svelte
<SvGrid
  {data} {columns} features={features}
  showFilterRow={true}
  showColumnFilters={true}
/>
```

## The filter row

`showFilterRow` puts a persistent input under every header. It wins over
`filterMode` when both are set, which is how you get a filter row alongside the
menu rather than instead of it.

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
    { field: 'name',       header: 'Name',       width: 190 },
    { field: 'department', header: 'Department', width: 160 },
    { field: 'age',        header: 'Age',        width: 90, editorType: 'number' },
  ]
</script>

<SvGrid data={people} {columns} filterable showFilterRow sortable />
```


## Row and menu together

The row handles the common case in one keystroke; the menu behind each header
still carries the full operator list for the times that is not enough.

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
    { field: 'city',   header: 'City',   width: 150 },
    { field: 'salary', header: 'Salary', width: 150, editorType: 'number',
      format: { type: 'currency', currency: 'USD' } },
  ]
</script>

<SvGrid data={people} {columns} filterable filterMode="menu" showFilterRow />
```

## See also

- [Overview](./overview.md)
- [Filter conditions](./filter-conditions.md) - two conditions per column
- [Custom header components](../columns/custom-header-components.md)
