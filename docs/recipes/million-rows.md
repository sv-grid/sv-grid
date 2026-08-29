---
noindex: true
---

# 1 million rows with virtualization

> Live in [demo 78-million-rows](https://svgrid.com/demos/78-million-rows/).

<div data-docs-demo="78-million-rows" data-height="480"></div>


## When

Row + column virtualization configured for very wide / very tall data.

## How

Key API surface:

- `virtualization={true}`
- `columnVirtualization={true}`
- `overscan + columnOverscan`

See the demo source for the full implementation; this recipe pins the
pattern + the surface so you can copy-paste it confidently. The doc
page that explains the underlying feature in depth is linked from the
[recipes index](./index.md).

## See also

- [Demo 78-million-rows source](https://github.com/sv-grid/sv-grid/blob/main/examples/src/demos/78-million-rows.svelte)
- [Demo 78-million-rows prompt sidecar](https://github.com/sv-grid/sv-grid/blob/main/examples/src/demos/prompts/78-million-rows.md) - drop into an LLM context window
- [Recipes index](./index.md)
