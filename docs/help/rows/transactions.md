# Transactions

`api.applyTransaction({ add, update, remove })` applies a batch of row
mutations in a **single** data update - one re-render for the whole batch,
not one per row. It's the path to use for high-frequency / streaming feeds
(WebSocket deltas, tick data) where calling `addRow` / `setCellValue` per row
would thrash.

<div data-docs-demo="145-transaction-api" data-height="480"></div>

```ts
const result = api.applyTransaction({
  add:    [newOrder],                          // appended
  update: [{ ...order, price: nextPrice }],    // matched by id
  remove: ['ORD-1001', staleRowRef],           // by id OR row reference
})
// result -> { added: 1, updated: 1, removed: 2 }
```

## Matching

- **`add`** - rows are appended to the data.
- **`update`** - each row is matched to an existing row by **id**, then
  replaced. Set `getRowId` so the grid can compute ids; without it, updates
  can't be matched.
- **`remove`** - accepts row **ids** (needs `getRowId`) and/or row **object
  references** (always works). Unknown ids are silently ignored.

The call returns the counts actually applied, so you can log or reconcile.

## Why batch

Each `applyTransaction` produces exactly one new data array and therefore one
reactive update, regardless of how many rows changed. On a live feed that
emits dozens of deltas per second, batching them per animation frame (or per
WebSocket message) keeps the grid smooth where per-row calls would not.

```ts
// buffer deltas, flush once per frame
let buffer: Delta[] = []
socket.onmessage = (e) => { buffer.push(JSON.parse(e.data)); schedule() }

function schedule() {
  requestAnimationFrame(() => {
    api.applyTransaction({
      add:    buffer.filter((d) => d.type === 'add').map((d) => d.row),
      update: buffer.filter((d) => d.type === 'update').map((d) => d.row),
      remove: buffer.filter((d) => d.type === 'remove').map((d) => d.id),
    })
    buffer = []
  })
}
```

## Notes

- The grid owns its data after mount; read the current rows back with
  `api.getData()` (which reflects applied transactions).
- Selection, expansion, and edit state keyed by `getRowId` survive a
  transaction - that's the point of a stable row id.

See the live [Transaction API](https://svgrid.com/demos/145-transaction-api/)
demo.

## Add, update and remove in one pass

`applyTransaction` takes the three operations together and applies them once,
so the grid re-renders a single time rather than three. `update` and `remove`
match on `getRowId`, which is why a stable id is the prerequisite.

```svelte {runnable}
<script lang="ts">
  import { SvGrid, type GridColumns, type SvGridApi } from '@svgrid/grid'

  type Person = {
    id: number
    name: string
    department: string
    city: string
    salary: number
    bio: string
  }

  const seed: Person[] = [
    { id: 1, name: 'Ada Lovelace',   department: 'Engineering', city: 'London',   salary: 142000,
      bio: 'Wrote the first algorithm intended for a machine, and the first account of what a general-purpose computer could do beyond arithmetic.' },
    { id: 2, name: 'Grace Hopper',   department: 'Engineering', city: 'New York', salary: 168000,
      bio: 'Built the first compiler and argued that programs should be written in something closer to English than to machine code.' },
    { id: 3, name: 'Linus Torvalds', department: 'Platform',    city: 'Portland', salary: 155000,
      bio: 'Wrote a kernel and, later, the version control system that most of the industry now runs on.' },
  ]

  let rows = $state<Person[]>(seed.map((p) => ({ ...p })))
  let api = $state<SvGridApi<{}, Person> | null>(null)
  let result = $state('(no transaction yet)')

  const columns: GridColumns<Person> = [
    { field: 'name',   header: 'Name',   width: 180 },
    { field: 'city',   header: 'City',   width: 140 },
    { field: 'salary', header: 'Salary', width: 140,
      format: { type: 'currency', currency: 'USD' } },
  ]

  function run() {
    const out = api?.applyTransaction({
      add: [{ id: 4, name: 'Radia Perlman', department: 'Networking', city: 'Seattle', salary: 161000, bio: 'Designed the spanning tree protocol.' }],
      update: [{ ...rows[0]!, city: 'Cambridge' }],
      remove: ['3'],
    })
    result = JSON.stringify(out)
  }
</script>

<button type="button" onclick={run}>Add one, move Ada, drop Linus</button>

<SvGrid data={rows} {columns} getRowId={(r) => String(r.id)} onApiReady={(next) => (api = next)} />

<p>Result: <code>{result}</code></p>
```


## Why the id matters

Without `getRowId` the grid falls back to array position, and a transaction
that removes row 1 renumbers everything after it. Ids are what make "update the
row I mean" survive a sort or a concurrent insert.

```svelte {runnable}
<script lang="ts">
  import { SvGrid, type GridColumns, type SvGridApi } from '@svgrid/grid'

  type Person = {
    id: number
    name: string
    department: string
    city: string
    salary: number
    bio: string
  }

  const seed: Person[] = [
    { id: 1, name: 'Ada Lovelace',   department: 'Engineering', city: 'London',   salary: 142000,
      bio: 'Wrote the first algorithm intended for a machine, and the first account of what a general-purpose computer could do beyond arithmetic.' },
    { id: 2, name: 'Grace Hopper',   department: 'Engineering', city: 'New York', salary: 168000,
      bio: 'Built the first compiler and argued that programs should be written in something closer to English than to machine code.' },
    { id: 3, name: 'Linus Torvalds', department: 'Platform',    city: 'Portland', salary: 155000,
      bio: 'Wrote a kernel and, later, the version control system that most of the industry now runs on.' },
  ]

  let rows = $state<Person[]>(seed.map((p) => ({ ...p })))
  let api = $state<SvGridApi<{}, Person> | null>(null)

  const columns: GridColumns<Person> = [
    { field: 'id',   header: 'ID',   width: 80 },
    { field: 'name', header: 'Name', width: 190 },
    { field: 'city', header: 'City', width: 150 },
  ]
</script>

<div>
  <button type="button" onclick={() => api?.applyTransaction({ remove: ['2'] })}>
    Remove id 2
  </button>
  <button type="button" onclick={() => api?.applyTransaction({ update: [{ ...rows[0]!, city: 'Oxford' }] })}>
    Update id 1
  </button>
</div>

<SvGrid data={rows} {columns} getRowId={(r) => String(r.id)} sortable onApiReady={(next) => (api = next)} />
```
