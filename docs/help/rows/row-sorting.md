# Row sorting

Sorting is a feature you opt into. Try it live - click any column
header to cycle `none → asc → desc → none`; shift-click adds the
column to the sort key list (multi-sort):

<div data-docs-demo="02-sort-filter-paginate" data-height="440"></div>



The examples on this page run against these rows:

```svelte {preamble}
<script lang="ts">
  import { SvGrid } from '@svgrid/grid'

  type Person = {
    id: number
    name: string
    email: string
    department: string
    age: number
    salary: number
    city: string
    startDate: string
    active: boolean
  }

  const people: Person[] = [
    { id: 1, name: 'Ada Lovelace',   email: 'ada@example.com',   department: 'Engineering', age: 36, salary: 142000, city: 'London',   startDate: '2021-03-01', active: true },
    { id: 2, name: 'Grace Hopper',   email: 'grace@example.com', department: 'Engineering', age: 45, salary: 168000, city: 'New York', startDate: '2019-07-15', active: true },
    { id: 3, name: 'Linus Torvalds', email: 'linus@example.com', department: 'Platform',    age: 54, salary: 155000, city: 'Portland', startDate: '2020-01-20', active: false },
    { id: 4, name: 'Radia Perlman',  email: 'radia@example.com', department: 'Networking',  age: 49, salary: 161000, city: 'Seattle',  startDate: '2022-09-05', active: true },
    { id: 5, name: 'Barbara Liskov', email: 'barbara@example.com', department: 'Platform',  age: 52, salary: 172000, city: 'Boston',   startDate: '2018-11-11', active: true },
  ]

  const data = people
</script>
```

```svelte
<script lang="ts">
  import {
    SvGrid, tableFeatures, rowSortingFeature, type ColumnDef,
  } from '@svgrid/grid'

  const features = tableFeatures({ rowSortingFeature })

  const columns: ColumnDef<typeof features, Person>[] = [
    { field: 'firstName', header: 'First name', editorType: 'text' },
    { field: 'age',       header: 'Age',        editorType: 'number' },
    { field: 'joinedAt',  header: 'Joined',     editorType: 'date' },
  ]
</script>

<SvGrid {data} {columns} features={features} />
```

Clicking a sortable header toggles `none → asc → desc → none`. Shift-click
adds the column to the sort key list (multi-sort).

## Sort functions

`sortFns` exposes the built-in comparators:

```ts
import { sortFns } from '@svgrid/grid'
// sortFns.auto    - lexical (default for unknown types)
// sortFns.number  - numeric, NaN-safe
// sortFns.date    - Date-parsed
```

The grid picks the comparator based on the column's `editorType`:

| editorType | comparator |
| ---------- | ---------- |
| `'number'` | `sortFns.number` |
| `'date'` \| `'datetime'` | `sortFns.date` |
| anything else | `sortFns.auto` |

If your column has a non-trivial type, set `editorType` even if you do not
want inline editing - it is what tells sort and filter how to behave.

## Programmatic sort

```ts
api.setSort('age', 'desc')   // sort by age descending
api.setSort('age', null)     // clear sort on this column
api.clearSort()              // clear all sort
```

`setSort` replaces any existing sort with a single clause. For
multi-column sort, the user clicks the second column header with
**Shift** held (the in-grid affordance). A multi-sort setter on the API
is tracked in [Missing features](../missing-features.md).

To observe sort changes from outside the grid:

```svelte
<SvGrid
  data={rows}
  columns={columns}
  features={features}
  onSortingChange={(next) => (sorting = next)}
/>
```

## Disable sort per column

Not yet first-class - there is no `enableSorting: false` field. To
prevent a column from being sortable, omit `rowSortingFeature` from
`tableFeatures(...)`, or render a custom header via `header: () =>
renderSnippet(...)` that doesn't bind to the sort button.

## Sorting + server-side data

When sort happens on the backend, pair `externalSort={true}` with
`onSortingChange` and round-trip the sort clauses through your
fetcher. See the [`09-server-side` demo](../../../examples/src/demos/09-server-side.svelte).

## Multi-column sort

Shift-click a second header and the sort becomes ordered: department first,
then salary within it. The order you click is the order applied, which is why
the header shows a position number once more than one is active.

```svelte {runnable}
<script lang="ts">
  import { SvGrid, type GridColumns, type SvGridApi } from '@svgrid/grid'

  type Person = {
    id: number
    name: string
    department: string
    city: string
    salary: number
    bio: string
  }

  const seed: Person[] = [
    { id: 1, name: 'Ada Lovelace',   department: 'Engineering', city: 'London',   salary: 142000,
      bio: 'Wrote the first algorithm intended for a machine, and the first account of what a general-purpose computer could do beyond arithmetic.' },
    { id: 2, name: 'Grace Hopper',   department: 'Engineering', city: 'New York', salary: 168000,
      bio: 'Built the first compiler and argued that programs should be written in something closer to English than to machine code.' },
    { id: 3, name: 'Linus Torvalds', department: 'Platform',    city: 'Portland', salary: 155000,
      bio: 'Wrote a kernel and, later, the version control system that most of the industry now runs on.' },
  ]

  const columns: GridColumns<Person> = [
    { field: 'department', header: 'Department', width: 170 },
    { field: 'name',       header: 'Name',       width: 180 },
    { field: 'salary',     header: 'Salary',     width: 140,
      format: { type: 'currency', currency: 'USD' } },
  ]
</script>

<SvGrid data={seed} {columns} sortable />
```


## Reading the sort model

`onSortingChange` reports the model as an ordered array, which is exactly the
shape you persist to a URL or hand to a server.

```svelte {runnable}
<script lang="ts">
  import { SvGrid, type GridColumns, type SvGridApi } from '@svgrid/grid'

  type Person = {
    id: number
    name: string
    department: string
    city: string
    salary: number
    bio: string
  }

  const seed: Person[] = [
    { id: 1, name: 'Ada Lovelace',   department: 'Engineering', city: 'London',   salary: 142000,
      bio: 'Wrote the first algorithm intended for a machine, and the first account of what a general-purpose computer could do beyond arithmetic.' },
    { id: 2, name: 'Grace Hopper',   department: 'Engineering', city: 'New York', salary: 168000,
      bio: 'Built the first compiler and argued that programs should be written in something closer to English than to machine code.' },
    { id: 3, name: 'Linus Torvalds', department: 'Platform',    city: 'Portland', salary: 155000,
      bio: 'Wrote a kernel and, later, the version control system that most of the industry now runs on.' },
  ]

  let model = $state('[]')

  const columns: GridColumns<Person> = [
    { field: 'name',   header: 'Name',   width: 190 },
    { field: 'city',   header: 'City',   width: 150 },
    { field: 'salary', header: 'Salary', width: 140,
      format: { type: 'currency', currency: 'USD' } },
  ]
</script>

<SvGrid
  data={seed}
  {columns}
  sortable
  onSortingChange={(s) => (model = JSON.stringify(s))}
/>

<p>Sort model: <code>{model}</code></p>
```

## See also

- [Filter API](../filtering/filter-api.md)
- [Server-side guide](../../getting-started.md#11-server-side-data)
