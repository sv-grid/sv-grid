# Sparkline cell renderer

> Live in [demo 11-stock-market](https://svgrid.com/#/demos/11-stock-market).

## When

In-cell mini-charts of a value series, rendered via inline SVG.

## How

Key API surface:

- `renderSnippet(SparklineCell, { points: row.trend })`

See the demo source for the full implementation; this recipe pins the
pattern + the surface so you can copy-paste it confidently. The doc
page that explains the underlying feature in depth is linked from the
[recipes index](./index.md).

## See also

- [Demo 11-stock-market source](https://github.com/sv-grid/sv-grid/blob/main/examples/src/demos/11-stock-market.svelte)
- [Demo 11-stock-market prompt sidecar](https://github.com/sv-grid/sv-grid/blob/main/examples/src/demos/prompts/11-stock-market.md) - drop into an LLM context window
- [Recipes index](./index.md)
