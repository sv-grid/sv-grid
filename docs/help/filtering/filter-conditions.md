# Filter conditions

A "filter condition" is a `(column, operator, value)` triple. The grid
stores filter conditions in `state.columnFilters`.
<div data-docs-demo="03-excel-filters" data-height="540"></div>

## Shape

The examples on this page run against these rows:

```svelte {preamble}
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

  const columns: GridColumns<Person> = [
    { field: 'name',       header: 'Name',       width: 190 },
    { field: 'department', header: 'Department', width: 150 },
    { field: 'city',       header: 'City',       width: 130 },
    { field: 'age',        header: 'Age',        width: 80 },
    { field: 'salary',     header: 'Salary',     width: 130, format: { type: 'currency', currency: 'USD' } },
  ]
</script>
```

```ts
type ColumnFilter = {
  id: string                         // column id
  value: unknown                     // operator-specific value
  fn?: keyof typeof filterFns        // optional explicit filter function
}
type ColumnFiltersState = ColumnFilter[]
```

Through the wrapper, the menu uses a richer per-column representation
(operator + value) - the wrapper converts between the two when state
crosses the boundary.

## Multiple conditions on one column (AND / OR)

A single column can hold **two** conditions joined by `AND` or `OR` - a
numeric band, an either/or text match, an outlier filter. In the UI, open a
column's funnel menu and click **"+ Add condition"**, pick a second operator +
value, and toggle **AND / OR**. From the API, pass the second condition to
`setFilter`:

```ts
// salary band: > 80,000 AND < 150,000
api.setFilter('salary', {
  operator: 'greaterThan', value: '80000',
  operator2: 'lessThan',   value2: '150000',
  join: 'AND',
})

// age outliers: < 25 OR > 60
api.setFilter('age', {
  operator: 'lessThan',    value: '25',
  operator2: 'greaterThan', value2: '60',
  join: 'OR',
})
```

<div data-docs-demo="178-multi-condition-filter" data-height="520"></div>

Conditions on **different columns** always AND together. For a set / value
checklist ("status in {active, pending}") use the [set filter](./set-filter.md);
for OR **across** columns, use the [advanced filter builder](../../../examples/src/demos/98-advanced-filter-builder.svelte).

## Conditions via the imperative API

Apply or update conditions through the `SvGridApi` once it's available:

```svelte
<script lang="ts">
  import type { SvGridApi } from '@svgrid/grid'

  let api = $state<SvGridApi<typeof features, Person> | null>(null)

  function applyDefaults() {
    if (!api) return
    api.setFilter('department', { operator: 'equals', value: 'Engineering' })
    api.setFilter('age',        { operator: 'equals', value: '30' })
  }
</script>

<SvGrid
  data={rows}
  columns={columns}
  features={features}
  filterMode="menu"
  onApiReady={(next) => (api = next)}
/>
<button onclick={applyDefaults}>Apply defaults</button>
```

## Clearing

```ts
api.clearFilter('department')   // single column
```

A `clearAllFilters()` helper is on the
[Missing features](../missing-features.md) list. Until then, iterate
the columns you know are filtered and call `clearFilter` per id - the
list of currently-filtered columns is reported by `onFiltersChange`.

```ts
columnFilters = []
```

## Try it

Open a column's filter menu and the operator list is typed to the column: the
text columns offer contains / equals / starts with, and Age and Salary offer the
numeric comparisons and between. Nothing configures that - it follows the value.

```svelte {runnable}
<SvGrid data={people} {columns} filterable filterMode="menu" sortable />
```

## See also

- [Applying filters](./applying-filters.md)
- [Filter API](./filter-api.md)
