# Accessing rows

You can read the grid's current rows in three ways.
<div data-docs-demo="04-selection-copy-paste" data-height="540"></div>

## 1. From the imperative API

`api.getData()` returns the **underlying data array** - pre-sort, pre-filter,
pre-paginate. Use this when you want to know what the grid is showing
*before* its row model has been applied.

```svelte
<script lang="ts">
  let api: SvGridApi<{}, Person> | null = $state(null)
</script>

<SvGrid {data} {columns} features={{}} onApiReady={(next) => (api = next)} />

<button onclick={() => console.log(api?.getData().length)}>
  How many?
</button>
```

The reverse direction - write a cell - is also on `SvGridApi`:

```ts
api.setCellValue(rowIndex, columnId, value)
const v = api.getCellValue(rowIndex, columnId)
```

## 2. From the row model (post-pipeline)

For the rows the grid is **rendering** (after sort + filter + grouping +
pagination), you need the headless grid instance. The wrapper does not
expose it as a prop today; if you need post-pipeline access, instantiate
the headless engine yourself with `createSvGrid` and pass its computed
output into your own renderer. See
[`packages/grid/src/createGrid.svelte.ts`](../../../packages/grid/src/createGrid.svelte.ts).

A dedicated `api.getDisplayedRows()` is on the
[gap list](../missing-features.md).

## 3. From the source data directly

In most apps the cleanest path is "the parent owns the data array, the
grid reflects it". When you need to know what's in the grid, look at your
own state - not the grid.

```svelte
<script lang="ts">
  let rows = $state<Person[]>([])
</script>

<SvGrid data={rows} {columns} features={{}} />

<p>{rows.length} rows total.</p>
```

This works because data passed to `<SvGrid>` is treated as the authoritative
source - the grid never silently mutates it.

## Iterating

```ts
const data = api?.getData() ?? []
for (const row of data) {
  // ...
}
```

For thousands of rows in a hot loop, prefer indexed iteration:

```ts
const data = api!.getData()
for (let i = 0; i < data.length; i++) {
  const row = data[i]!
  // ...
}
```

## Source rows versus displayed rows

`getData` returns what you handed the grid. `getDisplayedRows` returns what
survived the filter and the sort. Confusing the two is behind most wrong export
counts and most "select all" bugs.

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

  let api = $state<SvGridApi<{}, Person> | null>(null)
  let counts = $state('(filter something, then read)')

  const columns: GridColumns<Person> = [
    { field: 'name',       header: 'Name',       width: 190 },
    { field: 'department', header: 'Department', width: 170 },
  ]

  function read() {
    const all = api?.getData() ?? []
    const shown = api?.getDisplayedRows() ?? []
    counts = 'source ' + all.length + ', displayed ' + shown.length
  }
</script>

<button type="button" onclick={read}>Compare</button>

<SvGrid data={seed} {columns} filterable filterMode="row" sortable onApiReady={(next) => (api = next)} />

<p>{counts}</p>
```

## Reaching one row by id

Once `getRowId` is set, a row is addressable by something stable rather than
by where it currently sits. Sort the grid first and the lookup still finds the
same person, which is the whole reason to bother with an id.

```svelte {runnable}
<script lang="ts">
  import { SvGrid, renderSnippet, type GridColumns, type SvGridApi } from '@svgrid/grid'

  type Person = {
    id: number
    name: string
    department: string
    city: string
    age: number
    salary: number
  }

  const seed: Person[] = [
    { id: 1, name: 'Ada Lovelace',   department: 'Engineering', city: 'London',   age: 36, salary: 142000 },
    { id: 2, name: 'Grace Hopper',   department: 'Engineering', city: 'New York', age: 45, salary: 168000 },
    { id: 3, name: 'Linus Torvalds', department: 'Platform',    city: 'Portland', age: 54, salary: 155000 },
    { id: 4, name: 'Radia Perlman',  department: 'Networking',  city: 'Seattle',  age: 49, salary: 161000 },
  ]

  let api = $state<SvGridApi<{}, Person> | null>(null)
  let found = $state('(nothing looked up)')

  const columns: GridColumns<Person> = [
    { field: 'id',   header: 'ID',   width: 80 },
    { field: 'name', header: 'Name', width: 190 },
    { field: 'city', header: 'City', width: 150 },
  ]

  function lookup(id: string) {
    const row = (api?.getData() ?? []).find((r) => String(r.id) === id)
    found = row ? row.name + ' - ' + row.city : 'no row with id ' + id
  }
</script>

<div>
  <button type="button" onclick={() => lookup('2')}>Find id 2</button>
  <button type="button" onclick={() => lookup('9')}>Find id 9</button>
</div>

<SvGrid data={seed} {columns} getRowId={(r) => String(r.id)} sortable onApiReady={(next) => (api = next)} />

<p>{found}</p>
```

## See also

- [Row data](./row-data.md)
- [Filter API](../filtering/filter-api.md)
