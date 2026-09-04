# Cursor-based infinite scroll

Sparse-load a 100k-row audit log without paginating. Pattern:
debounce on scroll, fetch the next chunk by cursor, splice into
`$state`.

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

  const features = tableFeatures({ rowSortingFeature, columnFilteringFeature })

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
  import { SvGrid, type SvGridApi } from '@svgrid/grid'

  type Event = { id: string; ts: string; actor: string; action: string }
  let rows = $state<Event[]>([])
  let cursor = $state<string | null>(null)
  let loading = $state(false)
  let exhausted = $state(false)

  async function loadMore() {
    if (loading || exhausted) return
    loading = true
    try {
      const r = await fetch(`/api/events?cursor=${cursor ?? ''}&limit=200`)
      const { items, next } = await r.json() as { items: Event[]; next: string | null }
      rows = [...rows, ...items]
      cursor = next
      if (!next || items.length === 0) exhausted = true
    } finally {
      loading = false
    }
  }

  $effect(() => { void loadMore() })

  /** Wire the wrapper's scroll container to trigger near the end. */
  function onScroll(el: HTMLElement) {
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - 400) loadMore()
  }
</script>

<div onscroll={(e) => onScroll(e.currentTarget as HTMLElement)}
     style="height: 100%; overflow: auto;">
  <SvGrid data={rows} columns={columns} features={features}
    showPagination={false} virtualization={true} containerHeight="100%" />
  {#if loading}<p>Loading more…</p>{/if}
  {#if exhausted}<p>End of log.</p>{/if}
</div>
```

## Why cursor + not page number

For append-only logs (audit, time-series), page numbers shift
underneath you as new events arrive. Cursor (server-issued opaque
token) is stable.

## Cancellation

When the user filters mid-scroll, abort the in-flight fetch:

```ts
let controller: AbortController | null = null

async function loadMore() {
  controller?.abort()
  controller = new AbortController()
  const r = await fetch(`...`, { signal: controller.signal })
  ...
}
```

## Try it

The "server" here is a local slice, so the loading pattern is visible without a
backend: hold a cursor, append the next chunk, stop when it runs dry.

```svelte {runnable}
<script lang="ts">
  // Stand-in for the endpoint. A real one takes the cursor and returns the
  // next page plus the cursor after it.
  const all: Person[] = Array.from({ length: 40 }, (_, i) => {
    const base = people[i % people.length]!
    return { ...base, id: i + 1, name: base.name + ' #' + (i + 1) }
  })

  const PAGE = 10
  let loaded = $state<Person[]>(all.slice(0, PAGE))
  let cursor = $state(PAGE)

  const done = $derived(cursor >= all.length)

  function loadMore() {
    if (done) return
    loaded = [...loaded, ...all.slice(cursor, cursor + PAGE)]
    cursor += PAGE
  }
</script>

<SvGrid data={loaded} {columns} sortable />

<button type="button" onclick={loadMore} disabled={done}>
  {done
    ? 'All ' + all.length + ' rows loaded'
    : 'Load ' + PAGE + ' more (' + loaded.length + '/' + all.length + ')'}
</button>
```

## See also

- [Demo 33 (Server-side infinite scroll)](https://svgrid.com/demos/33-server-infinite/) - live
- [Server-side data](../help/server-side-data.md) - the full pattern catalog
- [Real-time / streaming](../help/real-time.md) - if events arrive PUSHED instead of PULLED
