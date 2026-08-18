# Updating column definitions

There are two ways to change columns after the grid has mounted:

## 1. Reassign the `columns` prop

`<SvGrid columns={...}>` is reactive. Replace the array (or mutate a `$state`
array) and the grid re-derives its internal columns.

```svelte
<script lang="ts">
  let columns = $state<ColumnDef<{}, Person>[]>([
    { field: 'firstName', header: 'First name' },
    { field: 'age', header: 'Age' },
  ])

  function addCountry() {
    columns = [...columns, { field: 'country', header: 'Country' }]
  }
</script>

<button onclick={addCountry}>+ Country</button>
<SvGrid {columns} data={rows} features={{}} />
```

## 2. Use the imperative API

The wrapper exposes mutators via `onApiReady`:

```svelte
<script lang="ts">
  let api: SvGridApi<{}, Person> | null = $state(null)
</script>

<SvGrid {columns} data={rows} features={{}} onApiReady={(next) => (api = next)} />

<button onclick={() => api?.addColumn({ field: 'country', header: 'Country' })}>
  + Country
</button>
```

Available column mutators on `SvGridApi`:

| Method | What it does |
| ------ | ------------ |
| `addColumn(col, position?)` | Insert one column. `position` is `'left' \| 'right' \| number` (default `'right'`). |
| `addColumns(cols, position?)` | Insert many. |
| `removeColumn(id)` | Remove by column id (or field when no `id`). |
| `setColumnVisible(id, visible)` | Show / hide. |
| `isColumnVisible(id)` | Read visibility. |

The imperative path is the right choice when the column-change initiator is
**outside** the parent that owns the `columns` array - e.g. a toolbar
component that doesn't know about the data source.

## What is preserved when columns change

When you add or remove a column:

- Sort state survives if the sorted column is still present.
- Filter state for the removed column is discarded.
- Active-cell focus is clamped into bounds.
- Column widths set by the user via resize handles are preserved by column id.
- Pinning is preserved by column id.

When you **reorder** columns by reassigning the array, the grid renders them
in the new order; pinned-left and pinned-right groups retain their order
relative to themselves.

## Gotchas

- Anything that captures `ctx.column.columnDef` inside a `cell` callback will
  see the **new** column def after a swap. Don't cache it.
- If you reassign the entire `columns` array on every render, you'll pay the
  cost of re-deriving headers each time. Memoise it (build once with
  `$state.raw` or a one-time IIFE) for hot-loop components.

## See also

- [Column state](./column-state.md)
- [Column moving](./column-moving.md)
