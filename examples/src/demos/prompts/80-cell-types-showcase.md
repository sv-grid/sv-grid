# Prompt: 80-cell-types-showcase

Source: `examples/src/demos/80-cell-types-showcase.svelte`
Live:   https://svgrid.com/demos/80-cell-types-showcase/

## What this demo proves

80. Cell types showcase - Vendor scorecard
------------------------------------------
Real procurement use case (annual vendor review) wired through every
cell type SvGrid ships:

  Built-in editors: text, number (currency), date, checkbox, list, chips
  Custom snippets:  color swatch (brand), 5-star rating (performance),
                    mood feedback (sentiment), progress bar (delivery
                    against commitments), status badge, owner avatar.

Snippet columns set `editable: false` so the grid doesn't try to start
an editor on click - the snippet's own controls handle writes through
`api.setCellValue`. Inner click handlers stop propagation so the cell
click doesn't fight the snippet input. The result: every cell type
usable in the same row, no edit-mode flicker.

## Imports

```ts
```

## Registered features

```ts
const features = tableFeatures({
  rowSortingFeature,
  columnFilteringFeature,
  columnGroupingFeature,
  rowExpandingFeature,
})
```

## SvGridApi methods called

- `api.setGroupBy(...)`

## How to use this prompt

Drop this file into your LLM's context window when asking it to
generate code matching this pattern. The MCP server exposes the
same content via the `listDemos` tool. See
[LLM grounding](../../../docs/help/llm-grounding.md) for details.
