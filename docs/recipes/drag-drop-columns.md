# Drag-drop columns to reorder

> Live in [demo 54-columns-hierarchy](https://svgrid.com/#/demos/54-columns-hierarchy).

## When

Re-order columns by dragging them in a side panel; live grid reflects the new order.

## How

Key API surface:

- `api.setColumnPinning({...})`
- `your reordering callback updates the columns prop`

See the demo source for the full implementation; this recipe pins the
pattern + the surface so you can copy-paste it confidently. The doc
page that explains the underlying feature in depth is linked from the
[recipes index](./index.md).

## See also

- [Demo 54-columns-hierarchy source](https://github.com/sv-grid/sv-grid/blob/main/examples/src/demos/54-columns-hierarchy.svelte)
- [Demo 54-columns-hierarchy prompt sidecar](https://github.com/sv-grid/sv-grid/blob/main/examples/src/demos/prompts/54-columns-hierarchy.md) - drop into an LLM context window
- [Recipes index](./index.md)
