# Loading data from REST + GraphQL

Three shapes. Pick the one that matches your back-end; the grid
doesn't care which.

## REST: fetch on mount

```svelte
<script lang="ts">
  import { SvGrid, tableFeatures, rowSortingFeature } from '@svgrid/grid'
  const features = tableFeatures({ rowSortingFeature })
  let rows = $state<Order[]>([])
  let loading = $state(true)
  let error = $state<string | null>(null)

  $effect(() => {
    (async () => {
      try {
        const r = await fetch('/api/orders')
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        rows = await r.json()
      } catch (e) {
        error = String(e)
      } finally {
        loading = false
      }
    })()
  })
</script>

<SvGrid data={rows} columns={columns} features={features} {loading} {error} />
```

The grid's `loading` + `error` props render a built-in overlay; you
don't need to gate the `<SvGrid>` mount.

## REST: server-side sort / filter / page

When the dataset is bigger than ~10k rows, push sort + filter to the
server and use `externalSort` / `externalFilter`:

```svelte
<SvGrid
  {data}
  columns={columns}
  features={features}
  externalSort={true}
  externalFilter={true}
  onSortingChange={async (clauses) => { data = await fetchPage({ sort: clauses }) }}
  onFiltersChange={async (f)       => { data = await fetchPage({ filters: f.columns }) }}
/>
```

See [server-side filter with TanStack Query](./server-side-filter-with-tanstack-query.md)
for cancellation, debounce, and request dedup.

## GraphQL

Same shape, different transport. The grid still receives a flat
array; the GraphQL layer is just how you obtain it.

```ts
import { request, gql } from 'graphql-request'

async function fetchOrders(vars: { page: number; sort?: string; filter?: object }) {
  const q = gql`
    query Orders($page: Int!, $sort: String, $filter: OrderFilter) {
      orders(page: $page, sort: $sort, filter: $filter) {
        items { id company product sellDate quantity price country }
        total
      }
    }
  `
  return request('/graphql', q, vars)
}
```

Live in [demo 72 (GraphQL adapter)](https://svgrid.com/demos/72-graphql-adapter/)
- includes a side panel showing the generated GraphQL document.

## See also

- [Server-side data](../help/server-side-data.md)
- [Server-side filter with TanStack Query](./server-side-filter-with-tanstack-query.md)
- [Cursor-based infinite scroll](./cursor-based-infinite-scroll.md)
