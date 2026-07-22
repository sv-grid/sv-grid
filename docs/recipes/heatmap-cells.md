# Heatmap-tinted numeric cells

> Live in [demo 60-pivot-expandable](https://svgrid.com/#/demos/60-pivot-expandable).

<div data-docs-demo="60-pivot-expandable" data-height="480"></div>


## When

Bucket cell values into red/amber/neutral/green tints based on per-column min/max.

## How

Key API surface:

- `cellClass returns heat-1..heat-5 bucket classes`

See the demo source for the full implementation; this recipe pins the
pattern + the surface so you can copy-paste it confidently. The doc
page that explains the underlying feature in depth is linked from the
[recipes index](./index.md).

## See also

- [Demo 60-pivot-expandable source](https://github.com/sv-grid/sv-grid/blob/main/examples/src/demos/60-pivot-expandable.svelte)
- [Demo 60-pivot-expandable prompt sidecar](https://github.com/sv-grid/sv-grid/blob/main/examples/src/demos/prompts/60-pivot-expandable.md) - drop into an LLM context window
- [Recipes index](./index.md)
