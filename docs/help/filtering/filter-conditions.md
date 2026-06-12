# Filter conditions

A "filter condition" is a `(column, operator, value)` triple. The grid
stores filter conditions in `state.columnFilters`.
<div data-docs-demo="03-excel-filters" data-height="540"></div>

## Shape

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

## AND vs. OR

Multiple filter conditions for **different columns** AND together. Two
filters on the **same column** are not natively supported - the second
write overwrites the first.

To express OR within a column (`status = active OR pending`), use the
[set filter](./set-filter.md) pattern.

To express OR across columns (`firstName = ada OR lastName = lovelace`),
do it outside the grid by filtering the data array before passing it in.

## Conditions via the imperative API

Apply or update conditions through the `SvGridApi` once it's available:

```svelte
<script lang="ts">
  import type { SvGridApi } from 'sv-grid-community'

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

## See also

- [Applying filters](./applying-filters.md)
- [Filter API](./filter-api.md)
