# Conditional row coloring

> Live in [demo 62-conditional-styling](https://svgrid.com/#/demos/62-conditional-styling).

<div data-docs-demo="62-conditional-styling" data-height="480"></div>


## When

rowClass returns a class map per row; CSS does the rest.

## How

Key API surface:

- `<SvGrid rowClass={(ctx) => ({...})}>`

See the demo source for the full implementation; this recipe pins the
pattern + the surface so you can copy-paste it confidently. The doc
page that explains the underlying feature in depth is linked from the
[recipes index](./index.md).

## See also

- [Demo 62-conditional-styling source](https://github.com/sv-grid/sv-grid/blob/main/examples/src/demos/62-conditional-styling.svelte)
- [Demo 62-conditional-styling prompt sidecar](https://github.com/sv-grid/sv-grid/blob/main/examples/src/demos/prompts/62-conditional-styling.md) - drop into an LLM context window
- [Recipes index](./index.md)
