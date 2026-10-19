# Custom column filters

When the built-in operators and the set-filter pattern are not enough,
give the column its own filter, or take over the filter pipeline.
<div data-docs-demo="03-excel-filters" data-height="540"></div>

## Your own filter control: `customFilter`

A column's `customFilter` replaces the operator condition with your own
model and control: a range slider that holds `[min, max]`, a tag picker that
holds `string[]`, a "last N days" widget that holds a number.

- `predicate(model)` returns the row test. It runs once per filter change,
  so parse dates or build a `Set` there, not inside the returned function.
  The test gets the column's value and the row's data.
- `menu` is a snippet for the filter menu and the tool panel's Filters tab.
  `floating` is one for the floating filter row. Each falls back to the
  other, so one snippet can serve all three.
- The snippet receives `{ column, model, setModel, surface, values, close }`.
  `setModel(null)` clears the filter. `values()` returns the column's
  distinct values under the other columns' filters, the same list the Values
  checklist shows.

```svelte {runnable}
<script lang="ts">
  import { SvGrid, type CustomFilterContext, type GridColumns } from '@svgrid/grid'

  type Deal = { id: number; company: string; stage: string; amount: number }

  const deals: Deal[] = [
    { id: 1, company: 'Northwind',  stage: 'Proposal',    amount: 4200 },
    { id: 2, company: 'Contoso',    stage: 'Negotiation', amount: 18500 },
    { id: 3, company: 'Fabrikam',   stage: 'Closed won',  amount: 32000 },
    { id: 4, company: 'Tailspin',   stage: 'Proposal',    amount: 950 },
    { id: 5, company: 'Litware',    stage: 'Negotiation', amount: 27400 },
    { id: 6, company: 'Adventure',  stage: 'Closed won',  amount: 12800 },
  ]

  type Range = [number, number]

  const columns: GridColumns<Deal> = [
    { field: 'company', header: 'Company', width: 160 },
    { field: 'stage',   header: 'Stage',   width: 140 },
    {
      field: 'amount',
      header: 'Amount',
      width: 220,
      format: { type: 'currency', currency: 'USD' },
      customFilter: {
        predicate: ([min, max]: Range) => (value) => {
          const n = Number(value)
          return n >= min && n <= max
        },
        menu: amountRange,
        floating: amountRange,
      },
    },
  ]
</script>

{#snippet amountRange(f: CustomFilterContext<Deal, Range>)}
  {@const max = f.model?.[1] ?? 40000}
  <label style="display: flex; align-items: center; gap: 6px; font-size: 12px;">
    <input
      type="range"
      min="0"
      max="40000"
      step="1000"
      value={max}
      oninput={(e) => {
        const next = Number(e.currentTarget.value)
        f.setModel(next >= 40000 ? null : [0, next])
      }}
    />
    <span>{max >= 40000 ? 'Any' : `up to ${max.toLocaleString()}`}</span>
  </label>
{/snippet}

<SvGrid data={deals} {columns} filterable filterMode="row" />
```

The model is ANDed with the column's operator condition and its Values
checklist, and is part of the rest of the filter state:

- `api.setCustomFilter(columnId, model)` sets it, `null` clears it, and
  `api.getCustomFilter(columnId)` reads it. `api.clearFilter` and
  `api.clearAllFilters` clear it with everything else.
- `api.getState()` returns `customFilters` while any model is set, and
  `api.setState({ customFilters })` restores them. Keep the model
  JSON-serializable if you save views.
- `onFiltersChange` reports active models under `custom`, keyed by column id.
  With `externalFilter` the grid only records the model, so a server
  translates it into its query; `createServerDataSource` forwards it as
  `filterModel.custom`.
- An inactive model filters nothing and does not light the funnel. By
  default `null`, `undefined`, `''` and `[]` are inactive; pass
  `isActive(model)` for anything else.
- `showValues: false` drops the Values checklist from the menu when it adds
  nothing, as for a slider over thousands of distinct prices.

A `customFilter` with only `predicate` keeps the built-in UI; the model is
then set only through the API.

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

## A control that lives outside the grid

When the filter control sits outside the grid, narrowing the array is the
shortest path: filter it, hand the result to `data`. Everything downstream -
sort, selection, the row count - follows the filtered set. For a control in
the grid's own filter surfaces, use `customFilter` above.

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
