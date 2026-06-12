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

## See also

- [Filter conditions](./filter-conditions.md)
- [Applying filters](./applying-filters.md)
- [Missing features](../missing-features.md) - `api.getFilters()` would be nice.
