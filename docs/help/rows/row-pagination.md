# Row pagination

Pagination is opt-in. Register the feature, register the row model, then
either turn it on with `showPagination` or drive its state from outside.
<div data-docs-demo="02-sort-filter-paginate" data-height="540"></div>

The examples on this page run against these rows:

```svelte {preamble}
<script lang="ts">
  import { SvGrid, type GridColumns } from '@svgrid/grid'

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

  const columns: GridColumns<Person> = [
    { field: 'name',       header: 'Name',       width: 200 },
    { field: 'department', header: 'Department', width: 150 },
    { field: 'city',       header: 'City',       width: 140 },
    { field: 'age',        header: 'Age',        width: 90 },
    { field: 'salary',     header: 'Salary',     width: 130, format: { type: 'currency', currency: 'USD' } },
  ]
</script>
```

```svelte {runnable}
<script lang="ts">
  import {
    SvGrid, tableFeatures,
    rowPaginationFeature, createPaginatedRowModel,
  } from '@svgrid/grid'

  const features = tableFeatures({ rowPaginationFeature })
</script>

<SvGrid {data} {columns} features={features} showPagination={true} />
```

The wrapper renders a footer with page nav and a page-size selector.

## Set the initial page size

```svelte
<SvGrid
  data={rows}
  columns={columns}
  features={features}
  showPagination={true}
  pageSize={25}
/>
```

The wrapper's footer renders 10 / 25 / 50 / 100 in the size selector
and lets the user change it at runtime. Jumping to a page from outside
or driving a server-side fetcher is best done by hiding the built-in
footer (`showPagination={false}`) and rendering your own controls -
see the [`09-server-side` demo](../../../examples/src/demos/09-server-side.svelte)
for the canonical pattern.

## Page size

The default is 10 unless you pass `pageSize`. The footer's size
selector picks 10 / 25 / 50 / 100; pass a different `pageSize` to seed
a different initial value.

## Pagination + virtualization

These two **work together** but they solve different problems. Use
virtualization when the page itself is large (>200 rows); use pagination
when you want explicit pages, when the user prints/exports, or when
server-side fetch returns pages.

For 100k-row + virtualized examples, pagination is off and the whole
filtered set is scrollable - see
[demos/06-large-dataset.svelte](../../../examples/src/demos/06-large-dataset.svelte).

## Try it

`pageable` turns the footer on and `pageSize` sets the slice. Sorting and
filtering run before pagination, so page 1 is always the first rows of the
result rather than the first rows of your array.

```svelte {runnable}
<SvGrid data={people} {columns} pageable pageSize={2} sortable filterable />
```

## See also

- [Server-side guide](../../getting-started.md#11-server-side-data)
- [Accessing rows](./accessing-rows.md)
