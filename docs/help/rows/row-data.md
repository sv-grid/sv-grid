# Row data

Row data is whatever you pass to `<SvGrid data={...}>`. It is a
`ReadonlyArray<TData>` where `TData` is your row type. Any shape works;
the grid does not require a base class or interface.
<div data-docs-demo="01-quick-start" data-height="540"></div>

## Static

```svelte
<script lang="ts">
  const rows = [
    { id: '1', name: 'Ada',   age: 36 },
    { id: '2', name: 'Linus', age: 54 },
  ]
</script>
<SvGrid data={rows} {columns} features={{}} />
```

## Reactive

Use a Svelte 5 `$state` array. The grid re-derives its row model whenever
the array reference changes:

```svelte
<script lang="ts">
  let rows = $state<Person[]>([])
  $effect(() => { fetchPeople().then((next) => (rows = next)) })
</script>
<SvGrid data={rows} {columns} features={{}} />
```

In-place mutation works too - `rows.push(x)` or `rows[i] = y` - because
`$state` arrays are deep-reactive.

## Row identity (`getRowId`)

Without `getRowId`, the grid uses each row's array index as its id.
That's fine for static data, but selection / expansion / edit state
won't survive sorts, filters, or insertions.

For anything beyond a read-only grid, pass `getRowId`:

```svelte
<SvGrid
  data={rows}
  {columns}
  features={features}
  getRowId={(row, index) => row.id}
/>
```

The function fires per row at row-model build time. Return any stable
string - a database PK, a UUID, a slug. The same `id` then flows into
`onRowSelectionChange`, `onCellValueChange`, `api.getCellValue(...)`,
and every other API surface that takes a row id.

Available on both the `<SvGrid>` wrapper and the headless
`createSvGrid({ getRowId })` core.

## Empty state

The grid renders the `emptyMessage` prop when `data.length === 0`:

```svelte
<SvGrid data={[]} {columns} features={{}} emptyMessage="No people found." />
```

## Loading state

Pass `loading` to overlay a spinner / skeleton (the wrapper has a built-in
overlay layer):

```svelte
<SvGrid {data} {columns} features={{}} loading={isFetching} />
```

For controlled skeleton-row UX in virtualized server-side grids, see
[demos/09-server-side.svelte](../../../examples/src/demos/09-server-side.svelte).


## Replacing the array

Assigning a new array is the ordinary way to load data, and the grid re-derives
its row model from the new reference. Sort or filter state survives, because
neither is stored on the rows.

```svelte {runnable}
<script lang="ts">
  import { SvGrid, type GridColumns } from '@svgrid/grid'

  type Person = { id: number; name: string; city: string; salary: number }

  const seed: Person[] = [
    { id: 1, name: 'Ada Lovelace',   city: 'London',   salary: 142000 },
    { id: 2, name: 'Grace Hopper',   city: 'New York', salary: 168000 },
    { id: 3, name: 'Linus Torvalds', city: 'Portland', salary: 155000 },
    { id: 4, name: 'Radia Perlman',  city: 'Seattle',  salary: 161000 },
  ]

  let rows = $state<Person[]>([])
  let status = $state('empty')

  const columns: GridColumns<Person> = [
    { field: 'name',   header: 'Name',   width: 180 },
    { field: 'city',   header: 'City',   width: 150 },
    { field: 'salary', header: 'Salary', width: 140,
      format: { type: 'currency', currency: 'USD' } },
  ]

  // Stands in for a fetch. The grid never sees the difference.
  async function load() {
    status = 'loading'
    await new Promise((r) => setTimeout(r, 350))
    rows = seed.map((p) => ({ ...p }))
    status = rows.length + ' rows'
  }

  // Load once on mount, the way a page would.
  $effect(() => {
    load()
  })
</script>

<button type="button" onclick={load}>Load</button>
<button type="button" onclick={() => { rows = []; status = 'empty' }}>Clear</button>
<span>{status}</span>

<SvGrid data={rows} {columns} sortable />
```

## What getRowId buys you

Select a row in each grid, then sort by salary. The left grid keys rows by
array position, so the selection follows the slot rather than the person; the
right one keys by `id` and keeps hold of who you picked.

```svelte {runnable}
<script lang="ts">
  import { SvGrid, type GridColumns } from '@svgrid/grid'

  type Person = { id: number; name: string; city: string; salary: number }

  const seed: Person[] = [
    { id: 1, name: 'Ada Lovelace',   city: 'London',   salary: 142000 },
    { id: 2, name: 'Grace Hopper',   city: 'New York', salary: 168000 },
    { id: 3, name: 'Linus Torvalds', city: 'Portland', salary: 155000 },
    { id: 4, name: 'Radia Perlman',  city: 'Seattle',  salary: 161000 },
  ]

  const columns: GridColumns<Person> = [
    { field: 'name',   header: 'Name',   width: 160 },
    { field: 'salary', header: 'Salary', width: 130,
      format: { type: 'currency', currency: 'USD' } },
  ]
</script>

<p>No <code>getRowId</code> - selection is tied to the row index:</p>
<SvGrid data={seed} {columns} sortable selectionMode="row" />

<p>With <code>getRowId</code> - selection is tied to the person:</p>
<SvGrid data={seed} {columns} sortable selectionMode="row" getRowId={(r) => String(r.id)} />
```

## See also

- [Accessing rows](./accessing-rows.md)
- [Row pagination](./row-pagination.md)
- [Server-side guide](../../getting-started.md#11-server-side-data)
