# Mobile card view with grid-on-desktop

> Live in [demo 81-mobile-card-view](https://svgrid.com/#/demos/81-mobile-card-view).

<div data-docs-demo="81-mobile-card-view" data-height="480"></div>


## When

Same data, two layouts. Auto-pivot below 720px or force one via a toolbar switch.

## How

Key API surface:

- `window.innerWidth listener`
- `shared $state array between the two views`

See the demo source for the full implementation; this recipe pins the
pattern + the surface so you can copy-paste it confidently. The doc
page that explains the underlying feature in depth is linked from the
[recipes index](./index.md).

## See also

- [Demo 81-mobile-card-view source](https://github.com/sv-grid/sv-grid/blob/main/examples/src/demos/81-mobile-card-view.svelte)
- [Demo 81-mobile-card-view prompt sidecar](https://github.com/sv-grid/sv-grid/blob/main/examples/src/demos/prompts/81-mobile-card-view.md) - drop into an LLM context window
- [Recipes index](./index.md)
