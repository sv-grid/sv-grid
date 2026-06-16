# Custom column filters

When the built-in operators and the set-filter pattern are not enough,
take over the filter pipeline.
<div data-docs-demo="03-excel-filters" data-height="540"></div>

## Option A - supply a `filterFn`

The simplest extension: register your own filter function and reference it
per column.

```ts
// types
declare module 'sv-grid-core' {
  interface FilterFnsRegistry {
    inListCSV: (value: unknown, query: string) => boolean
  }
}

// register
import { filterFns } from 'sv-grid-core'
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

## See also

- [Filter API](./filter-api.md)
- [Set filter](./set-filter.md)
