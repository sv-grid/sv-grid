# Updating column definitions

There are two ways to change columns after the grid has mounted:

## 1. Reassign the `columns` prop

`<SvGrid columns={...}>` is reactive. Replace the array (or mutate a `$state`
array) and the grid re-derives its internal columns.

```svelte
<script lang="ts">
  let columns = $state<GridColumns<Person>>([
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

## More examples

### Autosize columns

api.autosizeColumn(id) and api.autosizeAllColumns() snap columns to the widest visible cell via canvas-based text measurement. The column header menu has an "Autosize" item that calls the same code. Manual drag-resize still works.

<div data-docs-demo="172-autosize-columns" data-height="460"></div>

## Columns that change at runtime

The column list is an ordinary prop, so deriving it from state is all a
"choose your columns" control needs. Rebuild the array and the grid follows -
no api call involved.

```svelte {runnable}
<script lang="ts">
  import { SvGrid, type GridColumns, type SvGridApi } from '@svgrid/grid'

  type Person = {
    id: number
    name: string
    email: string
    city: string
    age: number
    salary: number
  }

  const seed: Person[] = [
    { id: 1, name: 'Ada Lovelace',   email: 'ada@example.com',   city: 'London',   age: 36, salary: 142000 },
    { id: 2, name: 'Grace Hopper',   email: 'grace@example.com', city: 'New York', age: 45, salary: 168000 },
    { id: 3, name: 'Linus Torvalds', email: 'linus@example.com', city: 'Portland', age: 54, salary: 155000 },
  ]

  const ALL = ['name', 'email', 'city', 'age', 'salary'] as const
  let shown = $state<string[]>(['name', 'city', 'age'])

  const columns = $derived<GridColumns<Person>>(
    ALL.filter((f) => shown.includes(f)).map((f) => ({
      field: f,
      header: f[0].toUpperCase() + f.slice(1),
      width: 150,
    })),
  )

  function toggle(f: string) {
    shown = shown.includes(f) ? shown.filter((x) => x !== f) : [...shown, f]
  }
</script>

<div>
  {#each ALL as f}
    <button type="button" aria-pressed={shown.includes(f)} onclick={() => toggle(f)}>{f}</button>
  {/each}
</div>

<SvGrid data={seed} {columns} sortable />
```

## Reordering the same columns

Because the array is the source of truth, changing its order changes the grid.
That is the cheap version of column reordering when you want the order to come
from your own state rather than from a drag.

```svelte {runnable}
<script lang="ts">
  import { SvGrid, type GridColumns, type SvGridApi } from '@svgrid/grid'

  type Person = {
    id: number
    name: string
    email: string
    city: string
    age: number
    salary: number
  }

  const seed: Person[] = [
    { id: 1, name: 'Ada Lovelace',   email: 'ada@example.com',   city: 'London',   age: 36, salary: 142000 },
    { id: 2, name: 'Grace Hopper',   email: 'grace@example.com', city: 'New York', age: 45, salary: 168000 },
    { id: 3, name: 'Linus Torvalds', email: 'linus@example.com', city: 'Portland', age: 54, salary: 155000 },
  ]

  let order = $state<string[]>(['name', 'city', 'age'])

  const LABEL: Record<string, string> = { name: 'Name', city: 'City', age: 'Age' }

  const columns = $derived<GridColumns<Person>>(
    order.map((f) => ({ field: f as keyof Person & string, header: LABEL[f], width: 150 })),
  )

  function rotate() {
    order = [...order.slice(1), order[0]!]
  }
</script>

<button type="button" onclick={rotate}>Rotate columns</button>

<SvGrid data={seed} {columns} />
```

## See also

- [Column state](./column-state.md)
- [Column moving](./column-moving.md)
