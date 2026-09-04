# Column moving (drag to reorder)

There are two ways to move columns in sv-grid:

1. **`enableColumnReorder` prop** - the built-in drag-to-reorder UX. Every header becomes draggable, the grid paints a drop indicator, and the order is emitted via `onColumnOrderChange`. Recommended for v1.
2. **Reassign the `columns` prop** - the array order IS the display order, so you can swap items in your own state.

<div data-docs-demo="109-column-reorder-engine" data-height="540"></div>

## Built-in drag-to-reorder

The examples on this page run against these rows:

```svelte {preamble}
<script lang="ts">
  import { SvGrid, tableFeatures, rowSortingFeature, columnFilteringFeature } from '@svgrid/grid'

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

  const features = tableFeatures({ rowSortingFeature, columnFilteringFeature })

  const people: Person[] = [
    { id: 1, name: 'Ada Lovelace',   email: 'ada@example.com',   department: 'Engineering', age: 36, salary: 142000, city: 'London',   startDate: '2021-03-01', active: true },
    { id: 2, name: 'Grace Hopper',   email: 'grace@example.com', department: 'Engineering', age: 45, salary: 168000, city: 'New York', startDate: '2019-07-15', active: true },
    { id: 3, name: 'Linus Torvalds', email: 'linus@example.com', department: 'Platform',    age: 54, salary: 155000, city: 'Portland', startDate: '2020-01-20', active: false },
    { id: 4, name: 'Radia Perlman',  email: 'radia@example.com', department: 'Networking',  age: 49, salary: 161000, city: 'Seattle',  startDate: '2022-09-05', active: true },
    { id: 5, name: 'Barbara Liskov', email: 'barbara@example.com', department: 'Platform',  age: 52, salary: 172000, city: 'Boston',   startDate: '2018-11-11', active: true },
  ]

  let rows = $state<Person[]>(people)
</script>
```

```svelte
<script lang="ts">
  import { SvGrid, tableFeatures, rowSortingFeature, type GridColumns } from '@svgrid/grid'

  let columns: GridColumns<Person> = [
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
  let columns = $state<GridColumns<Person>>([
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

## Dragging a column

`enableColumnReorder` lets a user drag a header into a new position. The order
they choose is state, not configuration - the column list you pass stays the
starting point, not the law.

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

  const columns: GridColumns<Person> = [
    { field: 'name',       header: 'Name',       width: 180 },
    { field: 'department', header: 'Department', width: 160 },
    { field: 'city',       header: 'City',       width: 140 },
    { field: 'salary',     header: 'Salary',     width: 140,
      format: { type: 'currency', currency: 'USD' } },
  ]
</script>

<SvGrid data={people} {columns} enableColumnReorder sortable />
```


## Reordering with pinned edges

A pinned column stays pinned while the rest reorder around it, which is what
makes "keep the name visible, arrange the rest" work without extra handling.

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

  const columns: GridColumns<Person> = [
    { field: 'name',       header: 'Name',       width: 180 },
    { field: 'department', header: 'Department', width: 160 },
    { field: 'city',       header: 'City',       width: 140 },
    { field: 'age',        header: 'Age',        width: 90 },
  ]
</script>

<SvGrid
  data={people}
  {columns}
  enableColumnReorder
  initialColumnPinning={{ left: ['name'] }}
/>
```

## See also

- Demo 109: Column reorder (engine prop)
- Demo 104: Column reorder (user-land drag-handle pattern)
- `Saved views` recipe in `docs/recipes/saved-views.md`
- `api.setColumnPinning` and `api.getColumnPinning`
