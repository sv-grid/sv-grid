---
noindex: true
---

# Pin first column on horizontal scroll

> Live in [demo 25-column-pinning](https://svgrid.com/demos/25-column-pinning/).

<div data-docs-demo="25-column-pinning" data-height="480"></div>


## When

Wide grids where the row-label column must stay visible while the data scrolls horizontally.

## How

Key API surface:

- `api.setColumnPinning({ left: ['id'] })`

See the demo source for the full implementation; this recipe pins the
pattern + the surface so you can copy-paste it confidently. The doc
page that explains the underlying feature in depth is linked from the
[recipes index](./index.md).

## See also

- [Demo 25-column-pinning source](https://github.com/sv-grid/sv-grid/blob/main/examples/src/demos/25-column-pinning.svelte)
- [Demo 25-column-pinning prompt sidecar](https://github.com/sv-grid/sv-grid/blob/main/examples/src/demos/prompts/25-column-pinning.md) - drop into an LLM context window
- [Recipes index](./index.md)
