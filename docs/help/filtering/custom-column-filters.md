# Custom column filters

When the built-in operators and the set-filter pattern are not enough,
take over the filter pipeline.
<div data-docs-demo="03-excel-filters" data-height="540"></div>

## Option A - supply a `filterFn`

The simplest extension: register your own filter function and reference it
per column.

```ts
// types
declare module '@svgrid/grid' {
  interface FilterFnsRegistry {
    inListCSV: (value: unknown, query: string) => boolean
  }
}

// register
import { filterFns } from '@svgrid/grid'
;(filterFns as any).inListCSV = (value: unknown, query: string) => {
  const items = String(query).split(',').map((s) => s.trim().toLowerCase())
  return items.includes(String(value ?? '').toLowerCase())
}

// use
const columnFilters = [{ id: 'status', value: 'active,pending', fn: 'inListCSV' }]
```

`filterFns` is a plain object so monkey-patching works - but the
`FilterFnsRegistry` module augmentation is what tells TypeScript about the
new key.

## Option B - control the entire filter pipeline

Pass `externalFilter={true}` and feed the grid a pre-filtered array. The
grid still records the in-UI filter state (so the menu and chips light
up correctly) but does **not** filter rows itself - you do, in response
to the `onFiltersChange` callback. This is the path server-side data
sources, large remote datasets, and tree data take.

```svelte
<script lang="ts">
  let rawRows = $state<Person[]>([])
  let filters = $state<{ id: string; operator: string; value: string }[]>([])
  const filtered = $derived(myComplexFilter(rawRows, filters))
</script>

<SvGrid
  data={filtered}
  {columns}
  features={features}
  filterMode="menu"
  externalFilter={true}
  onFiltersChange={(next) => (filters = next.columns)}
/>
```

The same pattern exists for sort (`externalSort` + `onSortingChange`)
and works on the same grid - see the [server-side demo](../../../examples/src/demos/09-server-side.svelte).

If you only want a single pre-filtered array and don't need the grid's
filter UI at all, pass `filterMode="none"` instead and skip the
callbacks entirely.

## Option C - custom column UI

Render a custom header (via `header: () => renderSnippet(...)`) that
includes your own filter widget. Update controlled state from the widget;
the grid will react. See [Custom header components](../columns/custom-header-components.md).

## A predicate the operators cannot express

There is no per-column `filterFn`, so a custom rule lives outside the grid:
narrow the array, hand the result to `data`. Everything downstream - sort,
selection, the row count - follows the filtered set.

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
    active: boolean
  }

  const people: Person[] = [
    { id: 1, name: 'Ada Lovelace',   department: 'Engineering', city: 'London',   age: 36, salary: 142000, active: true },
    { id: 2, name: 'Grace Hopper',   department: 'Engineering', city: 'New York', age: 45, salary: 168000, active: true },
    { id: 3, name: 'Linus Torvalds', department: 'Platform',    city: 'Portland', age: 54, salary: 155000, active: false },
    { id: 4, name: 'Radia Perlman',  department: 'Networking',  city: 'Seattle',  age: 49, salary: 161000, active: true },
  ]

  let query = $state('')

  // Match on initials: "gh" finds Grace Hopper. No operator expresses this.
  function initials(p: Person) {
    return p.name.split(' ').map((w) => w[0]!.toLowerCase()).join('')
  }

  const shown = $derived(
    query.trim() ? people.filter((p) => initials(p).startsWith(query.trim().toLowerCase())) : people,
  )

  const columns: GridColumns<Person> = [
    { field: 'name',       header: 'Name',       width: 190 },
    { field: 'department', header: 'Department', width: 170 },
  ]
</script>

<input placeholder="Try: gh" bind:value={query} />

<SvGrid data={shown} {columns} sortable />
```


## Combining with the built-in filters

Your predicate and the column filters compose without knowing about each
other: yours narrows `data`, the grid narrows what it renders. Order does not
matter because both are pure.

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
    active: boolean
  }

  const people: Person[] = [
    { id: 1, name: 'Ada Lovelace',   department: 'Engineering', city: 'London',   age: 36, salary: 142000, active: true },
    { id: 2, name: 'Grace Hopper',   department: 'Engineering', city: 'New York', age: 45, salary: 168000, active: true },
    { id: 3, name: 'Linus Torvalds', department: 'Platform',    city: 'Portland', age: 54, salary: 155000, active: false },
    { id: 4, name: 'Radia Perlman',  department: 'Networking',  city: 'Seattle',  age: 49, salary: 161000, active: true },
  ]

  let activeOnly = $state(true)

  const shown = $derived(activeOnly ? people.filter((p) => p.active) : people)

  const columns: GridColumns<Person> = [
    { field: 'name',       header: 'Name',       width: 180 },
    { field: 'department', header: 'Department', width: 160 },
    { field: 'city',       header: 'City',       width: 140 },
  ]
</script>

<label><input type="checkbox" bind:checked={activeOnly} /> Active only</label>

<SvGrid data={shown} {columns} filterable filterMode="row" sortable />
```

## See also

- [Filter API](./filter-api.md)
- [Set filter](./set-filter.md)
