# Undo / redo

There is **no built-in undo/redo stack** inside `<SvGrid>`. The grid emits
no per-edit event for an external stack to subscribe to, so undo/redo has
to be built on top of the data-snapshot approach.
<div data-docs-demo="55-state-maintenance" data-height="540"></div>

## Pattern - snapshot stack

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

## See also

- [Saving values](./saving-values.md)
- [demos/05-inline-editing.svelte](../../../examples/src/demos/05-inline-editing.svelte)
