# Filter API

Two surfaces - pick based on whether the caller is inside or outside the
component that owns the grid state.
<div data-docs-demo="64-filter-between-operator" data-height="540"></div>

## `SvGridApi` (imperative)

Available via `<SvGrid onApiReady={(api) => /* … */}>`.

```ts
api.setFilter(
  columnId: string,
  filter: { operator: SvGridFilterOperator; value?: string } | null,
): void

api.clearFilter(columnId: string): void
```

`SvGridFilterOperator` is the union: `'contains' | 'equals' | 'startsWith'
| 'greaterThan' | 'lessThan' | 'isBlank'`.

Passing `null` clears the filter on that column.

```ts
api.setFilter('status',     { operator: 'equals',      value: 'active' })
api.setFilter('age',        { operator: 'greaterThan', value: '30' })
api.setFilter('email',      { operator: 'contains',    value: '@example.com' })
api.setFilter('department', null)        // clear
api.clearFilter('age')                   // same effect, sugared
```

The wrapper internally writes into the `columnFilters` state slice and
re-runs the filtered row model.

## Observe filter state

For history, persistence, or server-side, subscribe via
`onFiltersChange`:

```svelte
<script lang="ts">
  let filters = $state<Array<{
    id: string
    operator: string
    value: string
    selectedValues?: Array<string>
  }>>([])
  let globalFilter = $state('')
</script>

<SvGrid
  data={rows}
  columns={columns}
  features={features}
  filterMode="menu"
  onFiltersChange={(next) => { filters = next.columns; globalFilter = next.global }}
/>
```

The callback receives a consolidated `{ global, columns }` shape so the
three internal stores (global search, per-column operator filter, facet
checklist) collapse into one payload you can serialise.

For server-side / external pipelines, also set `externalFilter={true}`
so the grid doesn't filter the rows locally - see [Custom column
filters](./custom-column-filters.md).

## Read the current filters

From the imperative API there is no `getFilters()` getter today - read the
underlying state via the grid instance:

```ts
const grid = api as unknown as { /* internals are not part of the public type */ }
```

This is not a stable surface. If you need to read filters from outside,
control the state.

## Setting a filter from code

`setFilter(columnId, { operator, value })` applies the same filter the menu
would, so a "show me only Platform" button and the UI end up in one state rather
than two.

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
    { field: 'name',       header: 'Name',       width: 190 },
    { field: 'department', header: 'Department', width: 160 },
    { field: 'salary',     header: 'Salary',     width: 140,
      format: { type: 'currency', currency: 'USD' } },
  ]
</script>

<div>
  <button type="button" onclick={() => api?.setFilter('department', { operator: 'equals', value: 'Platform' })}>
    Platform only
  </button>
  <button type="button" onclick={() => api?.setFilter('department', null)}>Clear</button>
</div>

<SvGrid data={people} {columns} filterable filterMode="menu" onApiReady={(next) => (api = next)} />
```


## Reading what is applied

`getFilters()` returns the live model, which is what you persist to a URL or a
saved view. Apply a filter above and the shape below is what you would store.

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
  let model = $state('(no filters)')

  const columns: GridColumns<Person> = [
    { field: 'name',       header: 'Name',       width: 190 },
    { field: 'department', header: 'Department', width: 160 },
    { field: 'age',        header: 'Age',        width: 90 },
  ]
</script>

<button type="button" onclick={() => (model = JSON.stringify(api?.getFilters() ?? {}, null, 2))}>
  Read the filter model
</button>

<SvGrid data={people} {columns} filterable filterMode="row" onApiReady={(next) => (api = next)} />

<pre>{model}</pre>
```

## See also

- [Filter conditions](./filter-conditions.md)
- [Applying filters](./applying-filters.md)
- [Missing features](../missing-features.md) - `api.getFilters()` would be nice.
