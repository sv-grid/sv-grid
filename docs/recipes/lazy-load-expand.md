# Lazy-load expand on demand

> Live in [demo 31-lazy-tree-load](https://svgrid.com/#/demos/31-lazy-tree-load).

<div data-docs-demo="31-lazy-tree-load" data-height="480"></div>


## When

Tree rows where children are fetched only when the user expands their parent.

## How

Key API surface:

- `onExpand callback`
- `merge children into $state on resolve`

See the demo source for the full implementation; this recipe pins the
pattern + the surface so you can copy-paste it confidently. The doc
page that explains the underlying feature in depth is linked from the
[recipes index](./index.md).

## See also

- [Demo 31-lazy-tree-load source](https://github.com/sv-grid/sv-grid/blob/main/examples/src/demos/31-lazy-tree-load.svelte)
- [Demo 31-lazy-tree-load prompt sidecar](https://github.com/sv-grid/sv-grid/blob/main/examples/src/demos/prompts/31-lazy-tree-load.md) - drop into an LLM context window
- [Recipes index](./index.md)
