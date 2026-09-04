# Saving values

When the user commits an edit, the new value is written into the grid's
**internal data copy**. The grid does **not** mutate the array you passed
in via the `data` prop - it keeps its own working copy so an undo / cancel
is possible without touching your state.

To round-trip edits back to your source there are two patterns.

Live demo - typed editors, dirty tracking, save button:

<div data-docs-demo="05-inline-editing" data-height="500"></div>

## Pattern A - `onCellValueChange` (recommended)

The wrapper fires `onCellValueChange` whenever an inline edit commits.
The payload contains everything you need to forward the edit to a server,
update a cached aggregate, or push to an undo stack:

```svelte
<script lang="ts">
  type Event = {
    rowIndex: number
    columnId: string
    oldValue: unknown
    newValue: unknown
    row: Person
  }

  function onCellValueChange(event: Event) {
    // 1. ship the change
    savePersonField(event.row.id, event.columnId, event.newValue)
    // 2. update derived data (totals, dependencies, etc.)
    // see the cascade-editing demo for the full pattern
  }
</script>

<SvGrid
  {data}
  {columns}
  features={features}
  enableInlineEditing={true}
  onCellValueChange={onCellValueChange}
/>
```

The wrapper has already written the parsed value into the row by the
time the callback fires, so `event.row` reflects the post-edit state.
The [`18-cascade-editing` demo](../../../examples/src/demos/18-cascade-editing.svelte) wires this
into a recompute pipeline.

## Pattern B - read a snapshot from the API

Useful for batch saves, "click Save to commit" UIs, or diffing against a
before-snapshot:

```svelte
<script lang="ts">
  let api = $state<SvGridApi<typeof features, Person> | null>(null)

  function captureChanges() {
    if (!api) return
    const after = api.getData()
    // diff against your before-snapshot, send to server, etc.
  }
</script>

<SvGrid {data} {columns} features={features}
  enableInlineEditing
  onApiReady={(next) => (api = next)} />

<button onclick={captureChanges}>Save</button>
```

The [`05-inline-editing` demo](../../../examples/src/demos/05-inline-editing.svelte) shows
this pattern with dirty-cell tracking against an `initial` snapshot.

## Sync data both ways

Replacing the `data` prop forces the grid to re-read it. To mirror the
grid's internal copy back into a parent `$state` so other UI can react,
use `onCellValueChange`:

```svelte
<script lang="ts">
  let rows = $state<Person[]>([...])
  function onCellValueChange(e: { rowIndex: number; row: Person }) {
    rows = rows.map((r, i) => (i === e.rowIndex ? e.row : r))
  }
</script>

<SvGrid data={rows} {columns} features={features}
  enableInlineEditing
  onCellValueChange={onCellValueChange} />
```

## Persisting one cell

The event tells you exactly what changed - which row, which column, from what
to what. That is enough for a PATCH, and it is why you rarely need to diff the
whole row.

```svelte {runnable}
<script lang="ts">
  import { SvGrid, type GridColumns, type SvGridApi } from '@svgrid/grid'

  type Person = {
    id: number
    name: string
    email: string
    city: string
    age: number
    salary: number
  }

  const seed: Person[] = [
    { id: 1, name: 'Ada Lovelace',   email: 'ada@example.com',   city: 'London',   age: 36, salary: 142000 },
    { id: 2, name: 'Grace Hopper',   email: 'grace@example.com', city: 'New York', age: 45, salary: 168000 },
    { id: 3, name: 'Linus Torvalds', email: 'linus@example.com', city: 'Portland', age: 54, salary: 155000 },
  ]

  let rows = $state<Person[]>(seed.map((p) => ({ ...p })))
  let log = $state<string[]>([])

  // What you would send. A real one awaits fetch and reverts on failure.
  function save(field: string, id: number, value: unknown) {
    log = ['PATCH /people/' + id + ' { ' + field + ': ' + JSON.stringify(value) + ' }', ...log].slice(0, 4)
  }

  const columns: GridColumns<Person> = [
    { field: 'name', header: 'Name', width: 180, editorType: 'text' },
    { field: 'city', header: 'City', width: 150, editorType: 'text' },
    { field: 'age',  header: 'Age',  width: 90,  editorType: 'number' },
  ]
</script>

<SvGrid
  data={rows}
  {columns}
  getRowId={(r) => String(r.id)}
  editable
  onCellValueChange={(e) => save(e.columnId, e.row.id, e.newValue)}
/>

<ul>
  {#each log as line}<li><code>{line}</code></li>{/each}
</ul>
```

## Rolling back a failed save

A save that fails has to put the value back, or the screen quietly disagrees
with the server. Holding the old value across the await is the whole trick.

```svelte {runnable}
<script lang="ts">
  import { SvGrid, type GridColumns, type SvGridApi } from '@svgrid/grid'

  type Person = {
    id: number
    name: string
    email: string
    city: string
    age: number
    salary: number
  }

  const seed: Person[] = [
    { id: 1, name: 'Ada Lovelace',   email: 'ada@example.com',   city: 'London',   age: 36, salary: 142000 },
    { id: 2, name: 'Grace Hopper',   email: 'grace@example.com', city: 'New York', age: 45, salary: 168000 },
    { id: 3, name: 'Linus Torvalds', email: 'linus@example.com', city: 'Portland', age: 54, salary: 155000 },
  ]

  let rows = $state<Person[]>(seed.map((p) => ({ ...p })))
  let status = $state('idle')

  // Fails on purpose for anything under 18, to show the rollback path.
  async function persist(row: Person, field: string, value: unknown, previous: unknown) {
    status = 'saving'
    await new Promise((r) => setTimeout(r, 500))
    if (field === 'age' && Number(value) < 18) {
      (row as Record<string, unknown>)[field] = previous
      status = 'rejected by server, rolled back'
      return
    }
    status = 'saved'
  }

  const columns: GridColumns<Person> = [
    { field: 'name', header: 'Name', width: 180, editorType: 'text' },
    { field: 'age',  header: 'Age',  width: 100, editorType: 'number' },
  ]
</script>

<SvGrid
  data={rows}
  {columns}
  editable
  onCellValueChange={(e) => persist(e.row, e.columnId, e.newValue, e.oldValue)}
/>

<p>Status: <strong>{status}</strong> (try an age under 18)</p>
```

## See also

- [Parsing values](./parsing-values.md)
- [Validation](./validation.md)
- [Undo / redo](./undo-redo.md)
