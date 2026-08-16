# Chart.js sync from grid filter state

> Live in [demo 73-chartjs-sync](https://svgrid.com/demos/73-chartjs-sync/).

<div data-docs-demo="73-chartjs-sync" data-height="480"></div>


## When

A chart that re-renders from api.getDisplayedRows() on every filter / sort change.

## How

Key API surface:

- `api.getDisplayedRows()`
- `onFiltersChange / onSortingChange`

See the demo source for the full implementation; this recipe pins the
pattern + the surface so you can copy-paste it confidently. The doc
page that explains the underlying feature in depth is linked from the
[recipes index](./index.md).

## See also

- [Demo 73-chartjs-sync source](https://github.com/sv-grid/sv-grid/blob/main/examples/src/demos/73-chartjs-sync.svelte)
- [Demo 73-chartjs-sync prompt sidecar](https://github.com/sv-grid/sv-grid/blob/main/examples/src/demos/prompts/73-chartjs-sync.md) - drop into an LLM context window
- [Recipes index](./index.md)
