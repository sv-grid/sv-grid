# Loading data from REST + GraphQL

Three shapes. Pick the one that matches your back-end; the grid
doesn't care which.

## REST: fetch on mount

The examples on this page run against these rows:

```svelte {preamble}
<script lang="ts">
  import { SvGrid, type GridColumns } from '@svgrid/grid'

  type Person = {
    id: number
    name: string
    email: string
    department: string
    age: number
    salary: number
    city: string
    startDate: string
    active: boolean
  }

  type Order = {
    id: string
    customer: string
    product: string
    quantity: number
    total: number
    status: 'pending' | 'shipped' | 'delivered'
    orderedAt: string
  }

  const people: Person[] = [
    { id: 1, name: 'Ada Lovelace',   email: 'ada@example.com',   department: 'Engineering', age: 36, salary: 142000, city: 'London',   startDate: '2021-03-01', active: true },
    { id: 2, name: 'Grace Hopper',   email: 'grace@example.com', department: 'Engineering', age: 45, salary: 168000, city: 'New York', startDate: '2019-07-15', active: true },
    { id: 3, name: 'Linus Torvalds', email: 'linus@example.com', department: 'Platform',    age: 54, salary: 155000, city: 'Portland', startDate: '2020-01-20', active: false },
    { id: 4, name: 'Radia Perlman',  email: 'radia@example.com', department: 'Networking',  age: 49, salary: 161000, city: 'Seattle',  startDate: '2022-09-05', active: true },
    { id: 5, name: 'Barbara Liskov', email: 'barbara@example.com', department: 'Platform',  age: 52, salary: 172000, city: 'Boston',   startDate: '2018-11-11', active: true },
  ]

  const columns: GridColumns<Person> = [
    { field: 'name',       header: 'Name',       width: 200 },
    { field: 'department', header: 'Department', width: 150 },
    { field: 'city',       header: 'City',       width: 140 },
    { field: 'age',        header: 'Age',        width: 90 },
    { field: 'salary',     header: 'Salary',     width: 130, format: { type: 'currency', currency: 'USD' } },
  ]
</script>
```

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

## More examples

### Loading from REST

Fetches rows from a public REST API with loading skeleton, retry, error surface, and a Reload button.

<div data-docs-demo="79-loading-from-rest" data-height="560"></div>

## See also

- [Server-side data](../help/server-side-data.md)
- [Server-side filter with TanStack Query](./server-side-filter-with-tanstack-query.md)
- [Cursor-based infinite scroll](./cursor-based-infinite-scroll.md)
