# Column state

"Column state" is the bag of per-column settings that change at runtime:
visibility, width, pinning, sort, filter. SvGrid keeps these as separate
state slices inside the grid instance.
<div data-docs-demo="55-state-maintenance" data-height="540"></div>

## Slices

| Slice | Where it lives | How to read | How to write |
| ----- | -------------- | ----------- | ------------ |
| Visibility | `<SvGrid>` internal | `api.isColumnVisible(id)` | `api.setColumnVisible(id, visible)` |
| Width | `<SvGrid>` internal (resize handles) | drag the right edge of a header | - |
| Pinning | `<SvGrid>` internal | via column menu | via column menu |
| Sort | `state.sorting` | `grid.getState().sorting` | `api.setSort(id, dir)` / `api.clearSort()` |
| Filter | `state.columnFilters` | `grid.getState().columnFilters` | `api.setFilter(id, ...)` / `api.clearFilter(id)` |

## Persisting state

To round-trip column state (e.g. through `localStorage` or the URL),
subscribe via the wrapper's change callbacks and re-apply on mount
through the imperative API:

```svelte
<script lang="ts">
  import type { SvGridApi } from '@svgrid/grid'

  const KEY = 'people-grid-state'

  function loadState() {
    try { return JSON.parse(localStorage.getItem(KEY) ?? '{}') }
    catch { return {} }
  }
  const initial = loadState()

  let sorting = $state<Array<{ id: string; desc: boolean }>>(initial.sorting ?? [])
  let filters = $state<Array<{ id: string; operator: string; value: string }>>(
    initial.filters ?? [],
  )
  let api = $state<SvGridApi<typeof features, Person> | null>(null)

  $effect(() => {
    localStorage.setItem(KEY, JSON.stringify({ sorting, filters }))
  })
</script>

<SvGrid
  data={rows}
  columns={columns}
  features={features}
  filterMode="menu"
  onApiReady={(next) => {
    api = next
    // Re-apply saved state on first mount.
    for (const s of initial.sorting ?? []) api.setSort(s.id, s.desc ? 'desc' : 'asc')
    for (const f of initial.filters ?? []) api.setFilter(f.id, { operator: f.operator, value: f.value })
  }}
  onSortingChange={(next) => (sorting = next)}
  onFiltersChange={(next) => (filters = next.columns)}
/>
```

## Resetting state

There is no single "reset" API today. To revert:

- Sort: `api.clearSort()`
- Filters: iterate the active list and call `api.clearFilter(id)`
- Visibility: walk your columns and call `setColumnVisible(id, true)`

Wrap whichever subset you need into your own helper if you do this often.

## Gotchas

- Column **width** is currently tracked per column id inside the SvGrid
  component and is not exposed on `SvGridApi`. If you need to persist user
  resizes you'll have to read the cells after the grid renders or PR an
  accessor onto the API. See [missing-features.md](../missing-features.md).
- Column **pinning** is controlled by the column menu; there is no public
  setter on the API today. Same caveat as above.

## Hiding a column from code

There is no `hide` flag on a column definition - visibility is runtime state,
so it lives on the api. That is what lets a user's choice survive a column list
that changes underneath it.

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
  }

  const people: Person[] = [
    { id: 1, name: 'Ada Lovelace',   department: 'Engineering', city: 'London',   age: 36, salary: 142000 },
    { id: 2, name: 'Grace Hopper',   department: 'Engineering', city: 'New York', age: 45, salary: 168000 },
    { id: 3, name: 'Linus Torvalds', department: 'Platform',    city: 'Portland', age: 54, salary: 155000 },
    { id: 4, name: 'Radia Perlman',  department: 'Networking',  city: 'Seattle',  age: 49, salary: 161000 },
    { id: 5, name: 'Barbara Liskov', department: 'Platform',    city: 'Boston',   age: 52, salary: 172000 },
  ]

  let api = $state<SvGridApi<{}, Person> | null>(null)
  let showSalary = $state(true)

  function toggle() {
    showSalary = !showSalary
    api?.setColumnVisible('salary', showSalary)
  }

  const columns: GridColumns<Person> = [
    { field: 'name',       header: 'Name',       width: 190 },
    { field: 'department', header: 'Department', width: 160 },
    { field: 'salary',     header: 'Salary',     width: 140,
      format: { type: 'currency', currency: 'USD' } },
  ]
</script>

<button type="button" onclick={toggle}>{showSalary ? 'Hide' : 'Show'} salary</button>

<SvGrid data={people} {columns} onApiReady={(next) => (api = next)} />
```


## Sizing to the content

`autosizeColumn` measures the rendered cells and fits the column to them.
`autosizeAllColumns` does the lot - worth wiring to a toolbar button rather than
running on load, since it costs a measure pass.

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
  }

  const people: Person[] = [
    { id: 1, name: 'Ada Lovelace',   department: 'Engineering', city: 'London',   age: 36, salary: 142000 },
    { id: 2, name: 'Grace Hopper',   department: 'Engineering', city: 'New York', age: 45, salary: 168000 },
    { id: 3, name: 'Linus Torvalds', department: 'Platform',    city: 'Portland', age: 54, salary: 155000 },
    { id: 4, name: 'Radia Perlman',  department: 'Networking',  city: 'Seattle',  age: 49, salary: 161000 },
    { id: 5, name: 'Barbara Liskov', department: 'Platform',    city: 'Boston',   age: 52, salary: 172000 },
  ]

  let api = $state<SvGridApi<{}, Person> | null>(null)

  const columns: GridColumns<Person> = [
    { field: 'name',       header: 'Name',       width: 80 },
    { field: 'department', header: 'Department', width: 80 },
    { field: 'city',       header: 'City',       width: 80 },
  ]
</script>

<div>
  <button type="button" onclick={() => api?.autosizeColumn('name')}>Fit Name</button>
  <button type="button" onclick={() => api?.autosizeAllColumns()}>Fit all</button>
</div>

<SvGrid data={people} {columns} onApiReady={(next) => (api = next)} />
```

## See also

- [Column moving](./column-moving.md)
- [Column pinning](./column-pinning.md)
- [Updating definitions](./updating-definitions.md)
