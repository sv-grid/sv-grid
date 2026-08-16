# Prompt: 94-conditional-formatting

Source: `examples/src/demos/94-conditional-formatting.svelte`
Live:   https://svgrid.com/demos/94-conditional-formatting/

## What this demo proves

94. Conditional formatting (color scale + data bars + icon sets)
----------------------------------------------------------------
Excel-style cell visualisations driven by per-column `cellRenderer`
snippets. No library change: each renderer reads the column's
min/max from the displayed dataset and paints accordingly.

  - colorScale   - red → yellow → green gradient
  - dataBar      - in-cell horizontal bar proportional to value
  - iconSet      - traffic-light icon based on threshold buckets
  - heatmap row  - background tint per cell mapped to value range

Toggle each formatter via the side panel to compare on / off.

## Imports

```ts
```

## Registered features

```ts
const features = tableFeatures({
  rowSortingFeature,
  columnFilteringFeature,
})
```

## How to use this prompt

Drop this file into your LLM's context window when asking it to
generate code matching this pattern. The MCP server exposes the
same content via the `listDemos` tool. See
[LLM grounding](../../../docs/help/llm-grounding.md) for details.
