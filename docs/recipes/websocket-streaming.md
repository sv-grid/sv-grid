# WebSocket streaming with backpressure

> Live in [demo 34-realtime-orders](https://svgrid.com/#/demos/34-realtime-orders).

<div data-docs-demo="34-realtime-orders" data-height="480"></div>


## When

Live tick stream with pause / resume / disconnect-and-replay and per-tick delta merge.

## How

Key API surface:

- `onmessage merges into $state`
- `pause flag throttles applies`

See the demo source for the full implementation; this recipe pins the
pattern + the surface so you can copy-paste it confidently. The doc
page that explains the underlying feature in depth is linked from the
[recipes index](./index.md).

## See also

- [Demo 34-realtime-orders source](https://github.com/sv-grid/sv-grid/blob/main/examples/src/demos/34-realtime-orders.svelte)
- [Demo 34-realtime-orders prompt sidecar](https://github.com/sv-grid/sv-grid/blob/main/examples/src/demos/prompts/34-realtime-orders.md) - drop into an LLM context window
- [Recipes index](./index.md)
