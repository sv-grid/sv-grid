# Row pagination

Pagination is opt-in. Register the feature, register the row model, then
either turn it on with `showPagination` or drive its state from outside.
<div data-docs-demo="02-sort-filter-paginate" data-height="540"></div>

```svelte
<script lang="ts">
  import {
    SvGrid, tableFeatures,
    rowPaginationFeature, createPaginatedRowModel,
    type ColumnDef,
  } from 'sv-grid-core'

  const features = tableFeatures({ rowPaginationFeature })
</script>

<SvGrid {data} {columns} features={features} showPagination={true} />
```

The wrapper renders a footer with page nav and a page-size selector.

## Set the initial page size

```svelte
<SvGrid
  data={rows}
  columns={columns}
  features={features}
  showPagination={true}
  pageSize={25}
/>
```

The wrapper's footer renders 10 / 25 / 50 / 100 in the size selector
and lets the user change it at runtime. Jumping to a page from outside
or driving a server-side fetcher is best done by hiding the built-in
footer (`showPagination={false}`) and rendering your own controls -
see the [`09-server-side` demo](../../../examples/src/demos/09-server-side.svelte)
for the canonical pattern.

## Page size

The default is 10 unless you pass `pageSize`. The footer's size
selector picks 10 / 25 / 50 / 100; pass a different `pageSize` to seed
a different initial value.

## Pagination + virtualization

These two **work together** but they solve different problems. Use
virtualization when the page itself is large (>200 rows); use pagination
when you want explicit pages, when the user prints/exports, or when
server-side fetch returns pages.

For 100k-row + virtualized examples, pagination is off and the whole
filtered set is scrollable - see
[demos/06-large-dataset.svelte](../../../examples/src/demos/06-large-dataset.svelte).

## See also

- [Server-side guide](../../getting-started.md#11-server-side-data)
- [Accessing rows](./accessing-rows.md)
