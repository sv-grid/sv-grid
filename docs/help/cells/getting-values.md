# Getting values

You get cell values in three ways depending on context.
<div data-docs-demo="04-selection-copy-paste" data-height="540"></div>

## Inside a column definition

`field` does the obvious thing - `row[key]`:

```ts
{ field: 'firstName', header: 'First' }
```

Use `fieldFn` for anything computed:

```ts
{
  id: 'fullName',
  header: 'Full name',
  fieldFn: (row) => `${row.firstName} ${row.lastName}`,
}
```

## Inside a cell renderer

A `cell` callback receives a `CellContext`:

```ts
{
  field: 'salary',
  header: 'Salary',
  cell: (ctx) => {
    const value = ctx.getValue()          // unknown
    const row   = ctx.row.original         // your TData
    const all   = ctx.row.getAllCells()    // array of Cell
    return /* renderSnippet / string / etc. */
  },
}
```

`ctx.row.original` is the **raw row object** you passed in - handy when
you want sibling values without going through accessors.

## From outside the grid

After `onApiReady`:

```ts
const v = api.getCellValue(rowIndex, columnId)
api.setCellValue(rowIndex, columnId, newValue)
```

`rowIndex` is the index in the **source data array**, not the post-pipeline
displayed index.

## Reading by row id

There is no `api.getCellValueByRowId(rowId, columnId)` helper today. If you
need that, walk `api.getData()`:

```ts
function valueByRowId(api: SvGridApi<{}, Person>, rowId: string, col: string) {
  const data = api.getData()
  const idx = data.findIndex((r) => r.id === rowId)
  return idx === -1 ? undefined : api.getCellValue(idx, col)
}
```

## What the grid is showing

`api.getDisplayedRows()` returns the rows after filter and sort, which is what
you want for an export, a count, or anything a user would describe as "what is
on screen". The source array answers a different question.

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

  let api = $state<SvGridApi<{}, Person> | null>(null)
  let report = $state('(filter or sort, then read)')

  const columns: GridColumns<Person> = [
    { field: 'name',       header: 'Name',       width: 190 },
    { field: 'department', header: 'Department', width: 160 },
    { field: 'salary',     header: 'Salary',     width: 140,
      format: { type: 'currency', currency: 'USD' } },
  ]

  function read() {
    const shown = api?.getDisplayedRows() ?? []
    const total = shown.reduce((n, r) => n + (r.salary ?? 0), 0)
    report = shown.length + ' row(s), ' + total.toLocaleString('en-US', { style: 'currency', currency: 'USD' })
  }
</script>

<button type="button" onclick={read}>Read what is displayed</button>

<SvGrid data={people} {columns} sortable filterable filterMode="row" onApiReady={(next) => (api = next)} />

<p>{report}</p>
```

## The row behind the cell

A cell context carries `row.original` - your object, untouched. That is what a
renderer or a tooltip should read, because the formatted value has already lost
the type.

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
  }

  const people: Person[] = [
    { id: 1, name: 'Ada Lovelace',   department: 'Engineering', city: 'London',   age: 36, salary: 142000, joined: '2021-03-01' },
    { id: 2, name: 'Grace Hopper',   department: 'Engineering', city: 'New York', age: 45, salary: 168000, joined: '2019-07-15' },
    { id: 3, name: 'Linus Torvalds', department: 'Platform',    city: 'Portland', age: 54, salary: 155000, joined: '2020-01-20' },
    { id: 4, name: 'Radia Perlman',  department: 'Networking',  city: 'Seattle',  age: 49, salary: 161000, joined: '2022-09-05' },
    { id: 5, name: 'Barbara Liskov', department: 'Platform',    city: 'Boston',   age: 52, salary: 172000, joined: '2018-11-11' },
  ]

  import { renderSnippet } from '@svgrid/grid'

  const columns: GridColumns<Person> = [
    { field: 'name', header: 'Name', width: 190 },
    { field: 'salary', header: 'Salary', width: 200,
      // ctx.getValue() is the raw number; row.original is the whole row.
      cell: (ctx) => renderSnippet(Ratio, { row: ctx.row.original }) },
  ]
</script>

{#snippet Ratio(props: { row: Person })}
  <span>{Math.round(props.row.salary / props.row.age).toLocaleString()} per year of age</span>
{/snippet}

<SvGrid data={people} {columns} />
```

## See also

- [Cell components](./cell-components.md)
- [Accessing rows](../rows/accessing-rows.md)
