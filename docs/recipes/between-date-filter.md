# Between-operator filters for date ranges

> Live in [demo 64-filter-between-operator](https://svgrid.com/demos/64-filter-between-operator/).

<div data-docs-demo="64-filter-between-operator" data-height="480"></div>


## When

"From / to" date range as one filter, not two.

## How

Key API surface:

- `api.setFilter(id, { operator: 'between', value, valueTo })`

See the demo source for the full implementation; this recipe pins the
pattern + the surface so you can copy-paste it confidently. The doc
page that explains the underlying feature in depth is linked from the
[recipes index](./index.md).

## See also

- [Demo 64-filter-between-operator source](https://github.com/sv-grid/sv-grid/blob/main/examples/src/demos/64-filter-between-operator.svelte)
- [Demo 64-filter-between-operator prompt sidecar](https://github.com/sv-grid/sv-grid/blob/main/examples/src/demos/prompts/64-filter-between-operator.md) - drop into an LLM context window
- [Recipes index](./index.md)
