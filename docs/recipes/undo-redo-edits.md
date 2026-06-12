# Undo / redo for grid edits

> Live in [demo 55-state-maintenance](https://svgrid.com/#/demos/55-state-maintenance).

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

## See also

- [Demo 55-state-maintenance source](https://github.com/sv-grid/sv-grid/blob/main/examples/src/demos/55-state-maintenance.svelte)
- [Demo 55-state-maintenance prompt sidecar](https://github.com/sv-grid/sv-grid/blob/main/examples/src/demos/prompts/55-state-maintenance.md) - drop into an LLM context window
- [Recipes index](./index.md)
