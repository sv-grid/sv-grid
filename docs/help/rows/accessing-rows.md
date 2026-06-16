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
[`packages/sv-grid-core/src/createGrid.svelte.ts`](../../../packages/sv-grid-core/src/createGrid.svelte.ts).

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

## See also

- [Row data](./row-data.md)
- [Filter API](../filtering/filter-api.md)
