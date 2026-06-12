# Role-based editable columns

> Live in [demo 41-healthcare-emr](https://svgrid.com/#/demos/41-healthcare-emr).

## When

Different user roles can edit different cells; the grid hides editors per-row via the editable callback.

## How

Key API surface:

- `editable: (ctx) => ctx.row.original.allowedBy.includes(role)`

See the demo source for the full implementation; this recipe pins the
pattern + the surface so you can copy-paste it confidently. The doc
page that explains the underlying feature in depth is linked from the
[recipes index](./index.md).

## See also

- [Demo 41-healthcare-emr source](https://github.com/sv-grid/sv-grid/blob/main/examples/src/demos/41-healthcare-emr.svelte)
- [Demo 41-healthcare-emr prompt sidecar](https://github.com/sv-grid/sv-grid/blob/main/examples/src/demos/prompts/41-healthcare-emr.md) - drop into an LLM context window
- [Recipes index](./index.md)
