# Column moving (drag to reorder)

There are two ways to move columns in sv-grid:

1. **`enableColumnReorder` prop** - the built-in drag-to-reorder UX. Every header becomes draggable, the grid paints a drop indicator, and the order is emitted via `onColumnOrderChange`. Recommended for v1.
2. **Reassign the `columns` prop** - the array order IS the display order, so you can swap items in your own state.

<div data-docs-demo="109-column-reorder-engine" data-height="540"></div>

## Built-in drag-to-reorder

```svelte
<script lang="ts">
  import { SvGrid, tableFeatures, rowSortingFeature, type ColumnDef } from 'sv-grid-community'

  let columns: ColumnDef<{}, Person>[] = [
    { field: 'firstName', header: 'First name' },
    { field: 'lastName',  header: 'Last name' },
    { field: 'age',       header: 'Age' },
    { field: 'salary',    header: 'Salary' },
  ]

  // Persist the order so it survives reloads. The grid drives this -
  // we just remember the latest array it emitted.
  let order = $state<string[]>(
    JSON.parse(localStorage.getItem('my-grid-order') ?? '[]'),
  )
  $effect(() => {
    if (order.length) localStorage.setItem('my-grid-order', JSON.stringify(order))
  })
</script>

<SvGrid
  data={rows}
  columns={columns}
  features={features}
  enableColumnReorder={true}
  columnOrder={order}
  onColumnOrderChange={(next) => (order = [...next])}
/>
```

When `enableColumnReorder` is `true`, the grid:

- Sets `draggable=true` on every header (`<th data-svgrid-header-col>`).
- Paints a vertical drop indicator before / after the hovered header.
- On drop, updates its internal order and fires `onColumnOrderChange(orderedIds)`.
- Respects column pinning - dragging across pin zones is allowed, but a column dropped into a pin zone stays in that zone's natural slot.

### Props

| Prop | Type | Notes |
| --- | --- | --- |
| `enableColumnReorder` | `boolean` | Defaults to `false`. Set `true` to opt in. |
| `columnOrder` | `ReadonlyArray<string>` | Initial / controlled order. Reassign to drive externally. |
| `onColumnOrderChange` | `(order: string[]) => void` | Fires after each change (user drag or `api.setColumnOrder`). |

### Imperative API

`SvGridApi` exposes two methods for command-palette / shortcut wiring:

```ts
api.setColumnOrder(['symbol', 'price', 'name', 'pe'])
const current = api.getColumnOrder()
```

`setColumnOrder` accepts a subset of ids; columns not in the array keep their existing relative position after the listed ones. Unknown ids are skipped.

## Pin groups + reorder

Column reorder composes cleanly with column pinning:

```svelte
<SvGrid
  data={rows}
  columns={columns}
  features={features}
  enableColumnReorder={true}
  onApiReady={(api) => {
    api.setColumnPinning({ left: ['symbol'], right: ['changePct'] })
  }}
/>
```

The reorder logic operates on the column ids; the pin grouping is then layered on top, so left-pinned columns stay on the left and right-pinned on the right.

## Reassign the columns prop (no `enableColumnReorder`)

If you prefer to own the order entirely in user-land (e.g. a dropdown picker rather than drag):

```svelte
<script lang="ts">
  let columns = $state<ColumnDef<{}, Person>[]>([
    { field: 'firstName', header: 'First name' },
    { field: 'lastName',  header: 'Last name' },
    { field: 'age',       header: 'Age' },
  ])

  function swap(i: number, j: number) {
    const next = columns.slice()
    ;[next[i], next[j]] = [next[j]!, next[i]!]
    columns = next
  }
</script>
```

This was the only option before `enableColumnReorder` shipped. Demo 104 shows a user-land header-drag pattern built on top of this approach.

## Persisting + saved views

The emitted `string[]` is JSON-serialisable, so the most common pattern is:

- Save to `localStorage` for "remember my last layout".
- Save under a name for "Saved views" feature (combine with column widths, pinning, and filter state).
- Serialise to a URL param for shareable views.

## See also

- Demo 109: Column reorder (engine prop)
- Demo 104: Column reorder (user-land drag-handle pattern)
- `Saved views` recipe in `docs/recipes/saved-views.md`
- `api.setColumnPinning` and `api.getColumnPinning`
