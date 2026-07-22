# Theme-matched xlsx export

> Live in [demo 56-export-theme-matched](https://svgrid.com/#/demos/56-export-theme-matched).

<div data-docs-demo="56-export-theme-matched" data-height="480"></div>


## When

Excel file colours follow the same --sg-* tokens the grid renders with.

## How

Key API surface:

- `api.exportData({ format: 'xlsx', styles: { ... } })`

See the demo source for the full implementation; this recipe pins the
pattern + the surface so you can copy-paste it confidently. The doc
page that explains the underlying feature in depth is linked from the
[recipes index](./index.md).

## See also

- [Demo 56-export-theme-matched source](https://github.com/sv-grid/sv-grid/blob/main/examples/src/demos/56-export-theme-matched.svelte)
- [Demo 56-export-theme-matched prompt sidecar](https://github.com/sv-grid/sv-grid/blob/main/examples/src/demos/prompts/56-export-theme-matched.md) - drop into an LLM context window
- [Recipes index](./index.md)
