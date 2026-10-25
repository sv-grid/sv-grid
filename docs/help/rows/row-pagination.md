# Row pagination

Pagination is opt-in: `pageable` turns it on (the longer `showPagination`
does the same) and `pageSize` sets the slice. `<SvGrid>` pages its rows
itself, so there is nothing else to register. `rowPaginationFeature` and
`createPaginatedRowModel` are for the headless engine, where the row model
goes in `_rowModels.paginatedRowModel` of `createSvGridCore` (see
[Row models](../headless/row-models.md)); `<SvGrid>` has no `options` prop
to pass them through.
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
<SvGrid {data} {columns} pageable />
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
is best done by hiding the built-in footer (`showPagination={false}`)
and rendering your own controls - see the
[`09-server-side` demo](../../../examples/src/demos/09-server-side.svelte)
for the canonical pattern. A server-side fetcher keeps the footer: hand
`createServerDataSource` to the grid as `rowModel` and the pager reads the
server's count and drives the controller's `setPage` - see
[Server paging](../server/server-paging.md).

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

## Go to the page a row is on

`api.getRowPosition(id)` is where a row sits in the filtered, sorted rows
across every page, or `null` when a filter hides it. Divide by the page size
and `api.setPage` turns to that page, whatever order the user has sorted
into. The id is the one `getRowId` returns. With grouping, pages are counted
in groups and the division does not hold.

```svelte {runnable}
<script lang="ts">
  import { SvGrid, type SvGridApi } from '@svgrid/grid'

  let api = $state<SvGridApi<{}, Person> | null>(null)

  function showRow(id: string) {
    const position = api?.getRowPosition(id)
    if (api && position != null) api.setPage(Math.floor(position / api.getPageInfo().pageSize))
  }
</script>

<button onclick={() => showRow('4')}>Show Radia Perlman</button>
<SvGrid data={people} {columns} pageable pageSize={2} sortable getRowId={(r) => String(r.id)} onApiReady={(next) => (api = next)} />
```

`api.getPageInfo()` also returns `pageIndex` and `pageCount`, and
`api.setPageSize(n)` changes the slice from code.

## See also

- [Server-side guide](../../getting-started.md#11-server-side-data)
- [Accessing rows](./accessing-rows.md)
