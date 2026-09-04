# Saved views (localStorage)

Per-user grid layouts. Each "view" snapshots column widths, pinning,
sort, filter, page index, and (optionally) grouping. Switching views
restores the snapshot.

The examples on this page run against these rows:

```svelte {preamble}
<script lang="ts">
  import { SvGrid, type GridColumns, tableFeatures, rowSortingFeature, columnFilteringFeature } from '@svgrid/grid'

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

  const features = tableFeatures({ rowSortingFeature, columnFilteringFeature })

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
  import { SvGrid, type SvGridApi } from '@svgrid/grid'

  type View = {
    name: string
    widths:  Record<string, number>
    pinning: { left: string[]; right: string[] }
    sort:    Array<{ id: string; desc: boolean }>
    filters: Record<string, { operator: string; value: string; valueTo?: string }>
  }

  const KEY = 'svgrid:views'
  let api = $state<SvGridApi<typeof features, Order> | null>(null)
  let views = $state<View[]>(JSON.parse(localStorage.getItem(KEY) ?? '[]'))

  function save(name: string) {
    if (!api) return
    const v: View = {
      name,
      widths:  api.getColumnWidths(),
      pinning: api.getColumnPinning(),
      sort:    [], // hook into your sort state
      filters: api.getFilters(),
    }
    views = [...views.filter((x) => x.name !== name), v]
    localStorage.setItem(KEY, JSON.stringify(views))
  }

  function load(v: View) {
    if (!api) return
    for (const [id, w] of Object.entries(v.widths)) api.setColumnWidth(id, w)
    api.setColumnPinning(v.pinning)
    for (const [id, f] of Object.entries(v.filters)) api.setFilter(id, f as never)
  }
</script>

<div class="view-bar">
  {#each views as v (v.name)}
    <button onclick={() => load(v)}>{v.name}</button>
  {/each}
  <button onclick={() => save(prompt('Name?') ?? 'View')}>Save current</button>
</div>

<SvGrid data={rows} columns={columns} features={features}
  onApiReady={(next) => (api = next)} />
```

## GDPR / HIPAA tip

The snapshot stores column STATE only - never row VALUES. If you
were to save `api.getDisplayedRows()` you'd land row data in
localStorage; don't. See [GDPR + data residency](../compliance/gdpr.md).

## Try it

A view is a snapshot you can switch back to. Held in memory here; the only
change for a real app is where `views` is read from and written to.

```svelte {runnable}
<script lang="ts">
  type View = { name: string; groupBy: string[]; summary: boolean }

  const views: View[] = [
    { name: 'Flat',          groupBy: [],             summary: false },
    { name: 'By department', groupBy: ['department'], summary: true },
    { name: 'By city',       groupBy: ['city'],       summary: true },
  ]

  let current = $state<View>(views[0]!)
</script>

<div>
  {#each views as view (view.name)}
    <button type="button" aria-pressed={current.name === view.name} onclick={() => (current = view)}>
      {view.name}
    </button>
  {/each}
</div>

<SvGrid
  data={rows}
  {columns}
  groupBy={current.groupBy}
  summary={current.summary}
  groupable
  sortable
/>
```

## See also

- [Demo 63 (Column layout API)](https://svgrid.com/demos/63-column-layout-api/) - live
- [State maintenance](../help/state-maintenance.md) - undo/redo + bookmarks + JSON IO
- [Persist column layout to URL](./persist-column-layout-to-url.md) - shareable links
