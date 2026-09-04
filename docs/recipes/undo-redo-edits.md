---
noindex: true
---

# Undo / redo for grid edits

> Live in [demo 55-state-maintenance](https://svgrid.com/demos/55-state-maintenance/).

<div data-docs-demo="55-state-maintenance" data-height="480"></div>


## When

Maintain a history stack of cell edits; Ctrl+Z / Ctrl+Y replay backwards / forwards.

## How

Key API surface:

- `onCellValueChange records {rowId, field, before, after}`
- `Ctrl+Z replays inverse`

See the demo source for the full implementation; this recipe pins the
pattern + the surface so you can copy-paste it confidently. The doc
page that explains the underlying feature in depth is linked from the
[recipes index](./index.md).

## More examples

### Undo / redo (Ctrl+Z)

`api.undo()` / `api.redo()` + Ctrl+Z / Ctrl+Y / Ctrl+Shift+Z. 200-step bounded history; clearHistory after a successful save resets the baseline.

<div data-docs-demo="86-undo-redo" data-height="460"></div>

## Undo across several edits

The stack is per grid and survives sorting - undo walks the edits, not the
view. Change three cells, sort a column, then undo: the values come back in the
order you set them.

```svelte {runnable}
<script lang="ts">
  import { SvGrid, type GridColumns, type SvGridApi } from '@svgrid/grid'

  type Person = { id: number; name: string; city: string; salary: number }

  const people: Person[] = [
    { id: 1, name: 'Ada Lovelace',   city: 'London',   salary: 142000 },
    { id: 2, name: 'Grace Hopper',   city: 'New York', salary: 168000 },
    { id: 3, name: 'Linus Torvalds', city: 'Portland', salary: 155000 },
  ]

  const columns: GridColumns<Person> = [
    { field: 'name',   header: 'Name',   width: 190, editorType: 'text' },
    { field: 'city',   header: 'City',   width: 150, editorType: 'text' },
    { field: 'salary', header: 'Salary', width: 140, editorType: 'number',
      format: { type: 'currency', currency: 'USD' } },
  ]

  let api = $state<SvGridApi<{}, Person> | null>(null)
  let edits = $state(0)
</script>

<div>
  <button type="button" onclick={() => api?.undo()}>Undo</button>
  <button type="button" onclick={() => api?.redo()}>Redo</button>
  <span>{edits} edit(s) made</span>
</div>

<SvGrid
  data={people}
  {columns}
  getRowId={(r) => String(r.id)}
  editable
  sortable
  onCellValueChange={() => (edits += 1)}
  onApiReady={(next) => (api = next)}
/>
```

## See also

- [Demo 55-state-maintenance source](https://github.com/sv-grid/sv-grid/blob/main/examples/src/demos/55-state-maintenance.svelte)
- [Demo 55-state-maintenance prompt sidecar](https://github.com/sv-grid/sv-grid/blob/main/examples/src/demos/prompts/55-state-maintenance.md) - drop into an LLM context window
- [Recipes index](./index.md)
