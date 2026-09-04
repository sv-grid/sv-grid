# Persist column layout to URL

Goal: when a user sorts, filters, or pages the grid, the URL updates so
that copy-pasting the link gives the recipient the same view. On
reload the grid restores from the URL.

## What lives in the URL

Stick to the slices that are cheap to serialise and unambiguous to
parse:

- **sort**: `Array<{ id, desc }>` → JSON
- **filters**: `Array<{ id, operator, value }>` → JSON
- **page** + **pageSize**: numbers

Column width, pinning, and visibility persist better in `localStorage`
than in the URL - they're per-user, not per-link. See
[Saved views](../help/saved-views.md) for that pattern.

## Implementation

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

  let rows = $state<Person[]>(people)

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
  import {
    SvGrid, tableFeatures, rowSortingFeature, columnFilteringFeature,
    type SvGridApi,
  } from '@svgrid/grid'

  const features = tableFeatures({ rowSortingFeature, columnFilteringFeature })

  type SortClause = { id: string; desc: boolean }
  type FilterClause = { id: string; operator: string; value: string }

  function readUrl() {
    if (typeof window === 'undefined') return { sort: [], filters: [], page: 0 }
    const p = new URLSearchParams(window.location.search)
    return {
      sort:    p.get('sort')    ? (JSON.parse(p.get('sort')!) as SortClause[])    : [],
      filters: p.get('filters') ? (JSON.parse(p.get('filters')!) as FilterClause[]) : [],
      page:    p.get('page')    ? Number(p.get('page')) : 0,
    }
  }
  const initial = readUrl()

  let sort    = $state<SortClause[]>(initial.sort)
  let filters = $state<FilterClause[]>(initial.filters)
  let page    = $state<number>(initial.page)
  let api     = $state<SvGridApi<typeof features, Order> | null>(null)

  // Debounced write-back so a rapid filter input doesn't hammer history.
  let writeTimer: ReturnType<typeof setTimeout> | null = null
  function writeUrl() {
    if (writeTimer) clearTimeout(writeTimer)
    writeTimer = setTimeout(() => {
      const p = new URLSearchParams()
      if (sort.length)    p.set('sort',    JSON.stringify(sort))
      if (filters.length) p.set('filters', JSON.stringify(filters))
      if (page > 0)       p.set('page',    String(page))
      const qs = p.toString()
      const next = qs ? `?${qs}` : window.location.pathname
      window.history.replaceState(null, '', next)
    }, 200)
  }

  $effect(() => { sort; filters; page; writeUrl() })

  // Restore on mount via the imperative API. The grid owns the UI
  // state; we re-apply through setSort/setFilter so the menus reflect
  // the restored values.
  function onApiReady(next: SvGridApi<typeof features, Order>) {
    api = next
    for (const s of initial.sort)    api.setSort(s.id, s.desc ? 'desc' : 'asc')
    for (const f of initial.filters) api.setFilter(f.id, { operator: f.operator as any, value: f.value })
  }
</script>

<SvGrid
  data={rows}
  columns={columns}
  features={features}
  filterMode="menu"
  showPagination={true}
  pageSize={25}
  onApiReady={onApiReady}
  onSortingChange={(next) => (sort = next)}
  onFiltersChange={(next) => (filters = next.columns)}
/>
```

## Notes

- **`replaceState` not `pushState`** - sort/filter changes shouldn't
  pollute the browser history. The user pressing Back should leave
  the page, not undo their last filter.
- **Debounce the write, not the read** - reading the URL on mount
  needs to be synchronous so the grid renders with the right state.
  The write-back is what's noisy.
- **`?sort=` URLs survive page reloads** without needing a server -
  the `URLSearchParams` parse happens client-side. Perfect for
  Vite/SvelteKit static deploys.
- **`hashchange`** is a fine alternative if your router uses `#/`
  (the gallery does). Replace `window.location.search` with
  `window.location.hash.split('?')[1]` and `window.history.replaceState`
  with `window.location.hash = ...`.
- **Sharing tip**: add a "Copy link" button next to the grid header
  that does `navigator.clipboard.writeText(window.location.href)`. The
  link is already the view.

## Try it

The sort state round-trips through a query string. Change the sort, watch the
link update; the parse direction is the same code read backwards.

```svelte {runnable}
<script lang="ts">
  import { SvGrid, type GridColumns } from '@svgrid/grid'

  type Person = { id: number; name: string; department: string; salary: number }

  const data: Person[] = [
    { id: 1, name: 'Ada Lovelace',   department: 'Engineering', salary: 142000 },
    { id: 2, name: 'Grace Hopper',   department: 'Engineering', salary: 168000 },
    { id: 3, name: 'Linus Torvalds', department: 'Platform',    salary: 155000 },
  ]

  const columns: GridColumns<Person> = [
    { field: 'name',       header: 'Name',       width: 190 },
    { field: 'department', header: 'Department', width: 160 },
    { field: 'salary',     header: 'Salary',     width: 130 },
  ]

  let sorting = $state<Array<{ id: string; desc: boolean }>>([])

  // Encoded compactly on purpose: "salary:desc" survives being pasted into
  // chat, which a JSON blob does not.
  const query = $derived(
    sorting.length
      ? '?sort=' + sorting.map((s) => s.id + (s.desc ? ':desc' : ':asc')).join(',')
      : '(no sort)',
  )
</script>

<SvGrid
  {data}
  {columns}
  sortable
  onSortingChange={(next) => (sorting = next)}
/>

<p>Shareable link: <code>{query}</code></p>
```

In a real app the `$derived` becomes a `replaceState` so the address bar tracks
the grid, and a `+page.ts` reads it back on load.

## See also

- [Filter API](../help/filtering/filter-api.md)
- [Row sorting](../help/rows/row-sorting.md)
- [Saved views](../help/saved-views.md) - for the multi-view picker
  pattern beyond URL state
