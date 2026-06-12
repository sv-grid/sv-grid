# Kanban board over the same `$state`

> Live in [demo 76-kanban-board](https://svgrid.com/#/demos/76-kanban-board).

## When

One <SvGrid> with columns = lanes, rows pivoted by status. HTML5 drag-drop moves cards between lanes.

## How

Key API surface:

- `pivot the source array into row × lane slots`
- `drag/drop events on cells`

See the demo source for the full implementation; this recipe pins the
pattern + the surface so you can copy-paste it confidently. The doc
page that explains the underlying feature in depth is linked from the
[recipes index](./index.md).

## See also

- [Demo 76-kanban-board source](https://github.com/sv-grid/sv-grid/blob/main/examples/src/demos/76-kanban-board.svelte)
- [Demo 76-kanban-board prompt sidecar](https://github.com/sv-grid/sv-grid/blob/main/examples/src/demos/prompts/76-kanban-board.md) - drop into an LLM context window
- [Recipes index](./index.md)
