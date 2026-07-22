# Server-side filter with TanStack Query

Goal: drive the grid from a real API. Sort + filter + page round-trip
to the server; the response goes into [TanStack Query](https://tanstack.com/query)
so we get **caching, deduplication, request cancellation, retries,
optimistic updates, and stale-while-revalidate** for free.

<div data-docs-demo="09-server-side" data-height="480"></div>

The same pattern works with any data-fetching library (SWR for React,
swrev for Svelte, hand-rolled `$effect`). TanStack Query is what most
teams reach for in Svelte 5 today.

## Setup

```bash
pnpm add @tanstack/svelte-query@^5
```

```svelte
<!-- +layout.svelte (root) -->
<script lang="ts">
  import { QueryClient, QueryClientProvider } from '@tanstack/svelte-query'

  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,  // 30 s
        gcTime: 5 * 60_000, // 5 min
        retry: 1,
      },
    },
  })

  let { children } = $props()
</script>

<QueryClientProvider client={queryClient}>
  {@render children()}
</QueryClientProvider>
```

## The grid

The grid runs in `externalSort` + `externalFilter` mode so it records
the user's intent but doesn't try to re-order rows it didn't fetch.
Every change to sort / filter / page bumps the query key; TanStack
Query handles the rest.

```svelte
<script lang="ts">
  import {
    SvGrid, tableFeatures, rowSortingFeature, columnFilteringFeature,
    type ColumnDef,
  } from '@svgrid/grid'
  import { createQuery } from '@tanstack/svelte-query'

  const features = tableFeatures({ rowSortingFeature, columnFilteringFeature })

  type Person = { id: string; firstName: string; lastName: string; salary: number }

  type SortClause   = { id: string; desc: boolean }
  type FilterClause = { id: string; operator: string; value: string }

  let sort    = $state<SortClause[]>([])
  let filters = $state<FilterClause[]>([])
  let page    = $state(0)
  const pageSize = 25

  // The query key contains every input that affects the response.
  // TanStack Query caches per-key, so navigating back to a previous
  // sort/filter is instant.
  const query = createQuery({
    get queryKey() {
      return ['people', { sort, filters, page, pageSize }] as const
    },
    queryFn: async ({ signal }) => {
      const url = `/api/people?` + new URLSearchParams({
        sort:    JSON.stringify(sort),
        filters: JSON.stringify(filters),
        page:    String(page),
        size:    String(pageSize),
      })
      const res = await fetch(url, { signal })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      return res.json() as Promise<{ rows: Person[]; total: number }>
    },
    // While a new query is in flight, keep showing the previous page's
    // rows so the grid doesn't blank out on every keystroke.
    placeholderData: (prev) => prev,
  })

  const columns: ColumnDef<typeof features, Person>[] = [
    { field: 'firstName', header: 'First',  width: 160 },
    { field: 'lastName',  header: 'Last',   width: 160 },
    { field: 'salary',    header: 'Salary', width: 140,
      format: { type: 'currency', currency: 'USD' } },
  ]
</script>

<SvGrid
  data={$query.data?.rows ?? []}
  columns={columns}
  features={features}
  filterMode="menu"
  externalSort={true}
  externalFilter={true}
  loading={$query.isFetching}
  showPagination={false}
  onSortingChange={(next) => { sort    = next;          page = 0 }}
  onFiltersChange={(next) => { filters = next.columns;  page = 0 }}
/>

<nav>
  <button onclick={() => (page = Math.max(0, page - 1))}
          disabled={page === 0 || $query.isFetching}>‹ Prev</button>
  <span>
    Page {page + 1} of {$query.data ? Math.max(1, Math.ceil($query.data.total / pageSize)) : '?'}
  </span>
  <button onclick={() => (page = page + 1)}
          disabled={!$query.data || (page + 1) * pageSize >= $query.data.total || $query.isFetching}>Next ›</button>
</nav>

{#if $query.error}
  <div class="error">{($query.error as Error).message}</div>
{/if}
```

## What TanStack Query gives you here

| Concern                            | How it's solved                                                   |
| ---------------------------------- | ----------------------------------------------------------------- |
| Cancelling a stale request         | `queryFn` receives `signal`; pass it to `fetch`.                  |
| Deduplicating duplicate fetches    | Same query key → one in-flight request.                           |
| Not blanking the grid on refetch   | `placeholderData: (prev) => prev`.                                |
| Caching a page so back-nav is instant | Per-key cache, `staleTime: 30_000` keeps the page fresh.       |
| Retrying transient errors          | `retry: 1` (or a custom retry-delay).                             |
| Showing a loading state            | `$query.isFetching` → `<SvGrid loading={...}>`.                   |
| Errors surfaced to the UI          | `$query.error` is the typed Error from `queryFn`.                 |

## Optimistic edits with `onCellValueChange`

Inline edits should write through immediately AND tell TanStack Query
to invalidate the affected query so the next refetch picks up the
server's authoritative answer.

```svelte
<script lang="ts">
  import { useQueryClient, createMutation } from '@tanstack/svelte-query'

  const qc = useQueryClient()

  const editMutation = createMutation({
    mutationFn: async (e: { rowId: string; columnId: string; value: unknown }) => {
      const res = await fetch(`/api/people/${e.rowId}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ [e.columnId]: e.value }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
    },
    // Mark every 'people' page stale - the next visible refetch
    // pulls the new value.
    onSuccess: () => qc.invalidateQueries({ queryKey: ['people'] }),
  })
</script>

<SvGrid
  data={$query.data?.rows ?? []}
  columns={columns}
  features={features}
  enableInlineEditing={true}
  onCellValueChange={(e) =>
    $editMutation.mutate({ rowId: e.row.id, columnId: e.columnId, value: e.newValue })
  }
/>
```

The grid has already written the new value into its working copy by
the time `onCellValueChange` fires - the mutation is fire-and-forget.
If the server rejects the change, TanStack Query's refetch restores
the canonical value.

### Explicit rollback (no refetch)

For lower-latency UX or when the server response carries the previous
value, roll back manually instead of waiting for the next refetch. The
pattern: capture the prior value before mutating, and on error call
`api.setCellValue(rowIndex, columnId, priorValue)` to revert the cell.

```ts
const editMutation = createMutation({
  mutationFn: async (e: { rowId: string; columnId: string; value: unknown }) => {
    const res = await fetch(`/api/people/${e.rowId}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ [e.columnId]: e.value }),
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
  },
  // Capture the prior cell value AND row index before the mutation
  // runs - we'll need both to rollback on error.
  onMutate: async (e) => {
    const prior = api?.getCellValue(e.rowIndex, e.columnId)
    return { prior, rowIndex: e.rowIndex, columnId: e.columnId }
  },
  onError: (_err, _vars, ctx) => {
    if (api && ctx) api.setCellValue(ctx.rowIndex, ctx.columnId, ctx.prior)
    // Surface the failure - a toast, an inline chip, etc.
  },
  onSuccess: () => qc.invalidateQueries({ queryKey: ['people'] }),
})

// In your <SvGrid onCellValueChange>:
//   $editMutation.mutate({
//     rowId: e.row.id, columnId: e.columnId,
//     value: e.newValue, rowIndex: e.rowIndex,
//   })
```

`api.setCellValue(rowIndex, ...)` takes the data-array index, not the
row id. `onCellValueChange` provides both - capture `e.rowIndex` and
hand it to the mutation context. This works for both inline editors
AND any drawer / modal that funnels through `api.setCellValue` (see
[Form library bridge recipe](./form-library-bridge.md)).

## Visualising the query cache

While debugging cache misses or unexpected refetches, a small side
panel that lists every entry in the cache with its state is invaluable.
The QueryClient exposes `getQueryCache().getAll()` for exactly this.

```svelte
<script lang="ts">
  import { useQueryClient } from '@tanstack/svelte-query'

  const qc = useQueryClient()

  type Snap = { key: string; state: 'fetching' | 'fresh' | 'stale' | 'error' }
  let cacheView = $state<Snap[]>([])

  $effect(() => {
    const cache = qc.getQueryCache()
    const refresh = () => {
      cacheView = cache.getAll().slice(0, 12).map((q) => ({
        key: JSON.stringify(q.queryKey),
        state:
          q.state.fetchStatus === 'fetching' ? 'fetching'
          : q.state.status === 'error'      ? 'error'
          : q.state.isInvalidated           ? 'stale'
          :                                   'fresh',
      }))
    }
    const unsub = cache.subscribe(refresh)
    refresh()
    return unsub
  })
</script>

<aside class="cache-panel">
  <h3>Query cache · {cacheView.length} entries</h3>
  <ul>
    {#each cacheView as q (q.key)}
      <li class="state-{q.state}">
        <code>{q.key}</code>
        <span>{q.state}</span>
      </li>
    {/each}
  </ul>
</aside>
```

The cache subscriber fires for every state transition - including
optimistic mutations, error rollbacks, and the auto-invalidation from
`invalidateQueries`. Pair this with the [grid state inspector](./grid-state-inspector.md)
to debug edge cases where the grid and the cache disagree.

For visual polish, color-code the rows by state: green for `fresh`,
amber for `stale` / `fetching`, red for `error`. The page background
of your devtools panel can use `rgba(99,102,241,0.06)` for an
unobtrusive contrast.

## Notes

- **The query key shape matters.** TanStack Query JSON-stringifies the
  key to compare equality. Use stable property order in the object you
  pass; the example above relies on `sort`, `filters`, `page`,
  `pageSize` in that order.
- **`placeholderData` vs `keepPreviousData`** - v5 renamed
  `keepPreviousData` to `placeholderData: (prev) => prev`. The example
  uses the new shape.
- **The grid is paginated server-side**; the wrapper's built-in pager
  is off (`showPagination={false}`). You render your own pager that
  bumps `page` - that's the only handle TanStack Query needs to
  re-fetch.
- **Total-row counts** are part of the server response. Without them
  the pager can't show "Page X of Y"; with them, the grid stays
  cheap on memory because only one page is in flight at a time.

## See also

- [Server-side data](../help/server-side-data.md) - the patterns
  that apply regardless of which data-fetching library you use
- [`onFiltersChange`](../reference/SvGrid.md#onfilterschangefilters)
- Demo [`09-server-side`](../../examples/src/demos/09-server-side.svelte) -
  the runnable example, without TanStack Query (mock endpoint, 60 ms
  fake latency, abort wiring)
