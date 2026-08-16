# Prompt: 99-top-n-filter

Source: `examples/src/demos/99-top-n-filter.svelte`
Live:   https://svgrid.com/demos/99-top-n-filter/

## What this demo proves

99. Top N / Bottom N filter
---------------------------
The "show me the top 10 by revenue" toolbar that every BI tool ships.
Pick a metric, pick N, pick top / bottom; the grid filters to those
rows ranked by that metric. Composes with the column-menu filters -
top-N runs on whatever's already visible, so "top 5 in EMEA" works.

Pure user-land: we sort a copy of the data and slice. No library
change required.

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
