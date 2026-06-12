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

## See also

- [Accessing rows](./accessing-rows.md)
- [Row pagination](./row-pagination.md)
- [Server-side guide](../../getting-started.md#11-server-side-data)
