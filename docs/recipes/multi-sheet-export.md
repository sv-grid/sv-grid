# Multi-sheet xlsx export

> Live in [demo 59-export-multi-sheet](https://svgrid.com/demos/59-export-multi-sheet/).

<div data-docs-demo="59-export-multi-sheet" data-height="480"></div>


## When

One workbook, multiple tabs - one per group / region / period.

## How

Key API surface:

- `api.exportData({ format: 'xlsx', sheets: [{ label, rows }, ...] })`

See the demo source for the full implementation; this recipe pins the
pattern + the surface so you can copy-paste it confidently. The doc
page that explains the underlying feature in depth is linked from the
[recipes index](./index.md).

## See also

- [Demo 59-export-multi-sheet source](https://github.com/sv-grid/sv-grid/blob/main/examples/src/demos/59-export-multi-sheet.svelte)
- [Demo 59-export-multi-sheet prompt sidecar](https://github.com/sv-grid/sv-grid/blob/main/examples/src/demos/prompts/59-export-multi-sheet.md) - drop into an LLM context window
- [Recipes index](./index.md)
