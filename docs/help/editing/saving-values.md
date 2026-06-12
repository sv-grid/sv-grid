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

## See also

- [Parsing values](./parsing-values.md)
- [Validation](./validation.md)
- [Undo / redo](./undo-redo.md)
