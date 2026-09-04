# Undo / redo

There is **no built-in undo/redo stack** inside `<SvGrid>`. The grid emits
no per-edit event for an external stack to subscribe to, so undo/redo has
to be built on top of the data-snapshot approach.
<div data-docs-demo="55-state-maintenance" data-height="540"></div>

## Pattern - snapshot stack

The examples on this page run against these rows:

```svelte {preamble}
<script lang="ts">
  import { SvGrid, type GridColumns, type SvGridApi } from '@svgrid/grid'

  type Person = {
    id: number
    name: string
    department: string
    city: string
    age: number
    salary: number
  }

  const people: Person[] = [
    { id: 1, name: 'Ada Lovelace',   department: 'Engineering', city: 'London',   age: 36, salary: 142000 },
    { id: 2, name: 'Grace Hopper',   department: 'Engineering', city: 'New York', age: 45, salary: 168000 },
    { id: 3, name: 'Linus Torvalds', department: 'Platform',    city: 'Portland', age: 54, salary: 155000 },
    { id: 4, name: 'Radia Perlman',  department: 'Networking',  city: 'Seattle',  age: 49, salary: 161000 },
    { id: 5, name: 'Barbara Liskov', department: 'Platform',    city: 'Boston',   age: 52, salary: 172000 },
  ]

  const columns: GridColumns<Person> = [
    { field: 'name',       header: 'Name',       width: 190, editorType: 'text' },
    { field: 'department', header: 'Department', width: 150, editorType: 'text' },
    { field: 'city',       header: 'City',       width: 130, editorType: 'text' },
    { field: 'age',        header: 'Age',        width: 80,  editorType: 'number' },
    { field: 'salary',     header: 'Salary',     width: 130, editorType: 'number', format: { type: 'currency', currency: 'USD' } },
  ]
</script>
```

```svelte
<script lang="ts">
  type Snapshot = Person[]

  let rows = $state<Person[]>(initial)
  let past = $state<Snapshot[]>([])
  let future = $state<Snapshot[]>([])
  const LIMIT = 50

  // Whenever rows change because of an edit, push the previous state onto `past`.
  let last = JSON.stringify(rows)
  $effect(() => {
    const next = JSON.stringify(rows)
    if (next === last) return
    past = [...past.slice(-LIMIT), JSON.parse(last)]
    future = []
    last = next
  })

  function undo() {
    const prev = past.at(-1)
    if (!prev) return
    future = [rows.map((r) => ({ ...r })), ...future].slice(0, LIMIT)
    rows = prev.map((r) => ({ ...r }))
    past = past.slice(0, -1)
    last = JSON.stringify(rows)
  }

  function redo() {
    const next = future[0]
    if (!next) return
    past = [...past, rows.map((r) => ({ ...r }))].slice(-LIMIT)
    rows = next.map((r) => ({ ...r }))
    future = future.slice(1)
    last = JSON.stringify(rows)
  }
</script>

<svelte:window onkeydown={(e) => {
  const meta = e.ctrlKey || e.metaKey
  if (meta && e.key === 'z' && !e.shiftKey) { e.preventDefault(); undo() }
  if (meta && ((e.key === 'z' && e.shiftKey) || e.key === 'y')) { e.preventDefault(); redo() }
}} />

<SvGrid data={rows} {columns} features={features} enableInlineEditing />
```

## Why JSON snapshots

Without a per-edit event from the grid, the safest store of "previous
state" is a deep copy of the row array. For a 5,000-row grid the snapshot
is a few hundred KB - fine. For a 100,000-row grid, switch to a row-diff
stack:

```ts
type Diff = { rowId: string; column: string; before: unknown; after: unknown }
```

…and apply it during undo/redo. The per-edit event needed to compute that
cleanly is on the [gap list](../missing-features.md).

## Tracked at

[Missing features](../missing-features.md) - first-class undo stack with
`onCellValueChange` to drive it.

## More examples

### Undo / redo (Ctrl+Z)

`api.undo()` / `api.redo()` + Ctrl+Z / Ctrl+Y / Ctrl+Shift+Z. 200-step bounded history; clearHistory after a successful save resets the baseline.

<div data-docs-demo="86-undo-redo" data-height="460"></div>

## Try it

Edit a few cells, then step backwards. `canUndo` and `canRedo` are what the
buttons should read - a disabled button is better than one that silently does
nothing.

```svelte {runnable}
<script lang="ts">
  let api = $state<SvGridApi<{}, Person> | null>(null)
  let version = $state(0)

  // The api's undo state is not reactive on its own; bumping a counter after
  // every edit is what re-reads canUndo/canRedo for the button labels.
  const touch = () => (version += 1)
</script>

<div>
  <button type="button" disabled={!(version >= 0 && api?.canUndo())} onclick={() => { api?.undo(); touch() }}>
    Undo
  </button>
  <button type="button" disabled={!(version >= 0 && api?.canRedo())} onclick={() => { api?.redo(); touch() }}>
    Redo
  </button>
</div>

<SvGrid
  data={people}
  {columns}
  editable
  onCellValueChange={touch}
  onApiReady={(next) => (api = next)}
/>
```

## See also

- [Saving values](./saving-values.md)
- [demos/05-inline-editing.svelte](../../../examples/src/demos/05-inline-editing.svelte)
