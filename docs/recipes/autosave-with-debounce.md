# Auto-save edits with debounce

Persist every cell edit to the server, debounced so a fast typer
generates one save, not twenty.

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

  const data = people

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
  import { SvGrid } from '@svgrid/grid'

  type Patch = { rowId: string; columnId: string; value: unknown }
  let pending = new Map<string, Patch>()  // dedupe per (rowId, columnId)
  let flushTimer: number | null = null

  function queue(rowId: string, columnId: string, value: unknown) {
    pending.set(`${rowId}::${columnId}`, { rowId, columnId, value })
    if (flushTimer !== null) clearTimeout(flushTimer)
    flushTimer = window.setTimeout(flush, 600)
  }

  async function flush() {
    flushTimer = null
    if (pending.size === 0) return
    const batch = [...pending.values()]
    pending.clear()
    try {
      await fetch('/api/patch', {
        method: 'POST',
        body: JSON.stringify({ patches: batch }),
      })
    } catch {
      // Re-enqueue on failure for next flush.
      for (const p of batch) pending.set(`${p.rowId}::${p.columnId}`, p)
    }
  }
</script>

<svelte:window onbeforeunload={flush} />

<SvGrid
  {data} {columns} features={features}
  onCellValueChange={(e) => queue(e.row.id, e.columnId, e.newValue)}
/>
```

Three details that make this production-grade:

- **Dedupe**. The map key collapses repeated edits to the same cell - only the latest value ships.
- **`beforeunload` flush**. Tab close before debounce fires? Still flushes.
- **Re-enqueue on failure**. Network blip is harmless; retries next tick.

For a more elaborate version with undo / redo, see
[demo 55 (State maintenance)](https://svgrid.com/demos/55-state-maintenance/).

## Try it

Edit a cell and watch the status line. Every commit fires `onCellValueChange`;
the timer collapses a burst of them into one save.

```svelte {runnable}
<script lang="ts">
  let status = $state('idle')
  let saves = $state(0)
  let timer: ReturnType<typeof setTimeout> | undefined

  // One trailing timer for the whole grid. Keying it per cell would save twice
  // when someone tabs from one edited cell straight into another.
  function queueSave() {
    status = 'pending'
    clearTimeout(timer)
    timer = setTimeout(() => {
      saves += 1
      status = 'saved'
    }, 800)
  }
</script>

<SvGrid {data} {columns} editable onCellValueChange={queueSave} />

<p>Status: <strong>{status}</strong> - {saves} save(s) sent</p>
```

## See also

- [Observability](../help/observability.md) - same callback, different sink
- [Demo 24 (Validation while editing)](https://svgrid.com/demos/24-validation/) - reject-and-rollback on validation failure
