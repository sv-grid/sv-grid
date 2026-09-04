# Server-side data (load on demand)

When the rows live behind an API and there are too many to ship to the browser,
the server does the work: **sorting**, **filtering**, and **paging** become query
params, and it returns only the current page plus a total count. The headless
engine wraps that page and nothing else - it never sees the rest of the dataset.

Try it: search, click a header to sort, page through. Each change fires exactly
one request (watch the counter climb):

<div data-docs-demo="191-headless-server-side" data-height="520"></div>

## The shape of it

There is no local pipeline here - just `coreRowModel`. You own three things:

1. **The query state** (`pageIndex`, `pageSize`, `sort`, `desc`, `q`) - the
   inputs your API takes.
2. **A fetch that re-runs when that state changes** - an `$effect` is enough.
3. **The engine, wrapping only the page you got back.**

```svelte
<script lang="ts">
  import { createSvGrid, createCoreRowModel, tableFeatures, type ColumnDef } from '@svgrid/grid'

  type Row = { id: number; name: string; dept: string; salary: number }

  // 1. Query state - the inputs your endpoint takes.
  const pageSize = 8
  let pageIndex = $state(0)
  let sort = $state<'name' | 'dept' | 'salary'>('name')
  let desc = $state(false)
  let q = $state('')

  // Server response.
  let pageRows = $state<Row[]>([])
  let total = $state(0)
  let loading = $state(false)
  let reqSeq = 0

  // 2. Re-fetch whenever any query input changes. The sequence guard drops
  //    stale responses if a newer request resolves first (race-safe).
  $effect(() => {
    const query = { pageIndex, pageSize, sort, desc, q }
    const mine = ++reqSeq
    loading = true
    fetch(`/api/employees?${new URLSearchParams(query as never)}`)
      .then((r) => r.json())
      .then((res: { rows: Row[]; total: number }) => {
        if (mine !== reqSeq) return
        pageRows = res.rows
        total = res.total
        loading = false
      })
  })

  // 3. The engine wraps ONLY the returned page - no filtered/sorted/paginated
  //    row model, because the server already did all of that.
  const features = tableFeatures({})   // the server sorts, filters and pages
  const columns: ColumnDef<typeof features, Row>[] = [
    { field: 'name', header: 'Name' },
    { field: 'dept', header: 'Department' },
    { field: 'salary', header: 'Salary' },
  ]
  const table = $derived.by(() =>
    createSvGrid({
      _features: features,
      _rowModels: { coreRowModel: createCoreRowModel<Row>() },
      data: pageRows,
      columns,
    }),
  )
  const rows = $derived(table.getRowModel().rows)
  const pageCount = $derived(Math.max(1, Math.ceil(total / pageSize)))
</script>
```

Render `rows` however you like, and drive the query state from your controls:

```svelte
<input value={q} oninput={(e) => { q = e.currentTarget.value; pageIndex = 0 }} />

<table>
  <thead>
    <tr>
      {#each columns as col (col.field)}
        <th onclick={() => {
          if (sort === col.field) desc = !desc
          else { sort = col.field; desc = false }
          pageIndex = 0
        }}>
          {col.header}{sort === col.field ? (desc ? ' ▼' : ' ▲') : ''}
        </th>
      {/each}
    </tr>
  </thead>
  <tbody>
    {#each rows as r (r.id)}
      {@const row = r.original as Row}
      <tr><td>{row.name}</td><td>{row.dept}</td><td>{row.salary}</td></tr>
    {/each}
  </tbody>
</table>

<button onclick={() => (pageIndex -= 1)} disabled={pageIndex === 0 || loading}>Prev</button>
Page {pageIndex + 1} of {pageCount}
<button onclick={() => (pageIndex += 1)} disabled={pageIndex >= pageCount - 1 || loading}>Next</button>
```

## Why only `coreRowModel`?

Because the pipeline already ran - on the server. Adding
`filteredRowModel` / `sortedRowModel` / `paginatedRowModel` would make the engine
try to filter, sort and slice the **page** you already fetched, which is wrong: it
only has 8 of the 483 rows. Feed the engine the finished page and let it do the
one job left - wrap each item as a `Row` so your markup and any cell logic work
the same as everywhere else.

## Three things worth getting right

- **Reset the page on a new sort or filter.** A different sort or query produces a
  different result set, so `pageIndex = 0` - otherwise you can land on an
  out-of-range page.
- **Guard against out-of-order responses.** Fast typing fires overlapping
  requests; without the `reqSeq` check an early response can overwrite a later
  one. Increment a sequence number per request and ignore any response that is
  not the latest.
- **Debounce the search** if each keystroke hits a real network. A short
  `setTimeout` on `q` keeps you from firing a request per character.

## More examples

### Server-side rendering

SvelteKit-style SSR with a sandboxed pre-hydration snapshot.

<div data-docs-demo="19-ssr" data-height="460"></div>

## Sort, filter and page on the server

The three `external*` flags say "report, do not apply". The grid then renders
exactly the rows you hand it, and `rowCount` is what lets the pager show a total
it cannot count itself.

```svelte {runnable}
<script lang="ts">
  import { SvGrid, type GridColumns } from '@svgrid/grid'

  type Order = { id: string; customer: string; total: number }

  // Stands in for the database.
  const ALL: Order[] = Array.from({ length: 87 }, (_, i) => ({
    id: 'A-' + String(1000 + i),
    customer: ['Northwind', 'Contoso', 'Fabrikam'][i % 3]!,
    total: 60 + ((i * 53) % 800),
  }))

  const columns: GridColumns<Order> = [
    { field: 'id',       header: 'Ref',      width: 110 },
    { field: 'customer', header: 'Customer', width: 170 },
    { field: 'total',    header: 'Total',    width: 130,
      format: { type: 'currency', currency: 'USD' } },
  ]

  let pageIndex = $state(0)
  let pageSize = $state(10)
  let sorting = $state<Array<{ id: string; desc: boolean }>>([])

  // What a real endpoint would do, minus the network.
  const view = $derived.by(() => {
    let rows = [...ALL]
    const s = sorting[0]
    if (s) {
      rows.sort((a, b) => {
        const av = a[s.id as keyof Order], bv = b[s.id as keyof Order]
        const cmp = av < bv ? -1 : av > bv ? 1 : 0
        return s.desc ? -cmp : cmp
      })
    }
    return rows.slice(pageIndex * pageSize, (pageIndex + 1) * pageSize)
  })
</script>

<SvGrid
  data={view}
  {columns}
  getRowId={(r) => r.id}
  sortable
  externalSort
  onSortingChange={(next) => { sorting = next; pageIndex = 0 }}
  pageable
  externalPagination
  rowCount={ALL.length}
  {pageIndex}
  {pageSize}
  onPaginationChange={(p) => { pageIndex = p.pageIndex; pageSize = p.pageSize }}
/>

<p>Serving rows {pageIndex * pageSize + 1}-{Math.min((pageIndex + 1) * pageSize, ALL.length)} of {ALL.length}</p>
```

## See also

- [Row models](./row-models.md) - the local pipeline, for when the client owns the data
- [Controlled state](./controlled-state.md) - `state` in, `onXxxChange` out
- [Build a table from scratch](./build-a-table.md) - the rendering half
- [Server-side data (with `<SvGrid>`)](../server-side-data.md) - the same idea, wired for you
