# Prompt: 66-custom-cell-editors

Source: `examples/src/demos/66-custom-cell-editors.svelte`
Live:   https://svgrid.com/demos/66-custom-cell-editors/

## What this demo proves

66. Custom cell editors - Feature health board
----------------------------------------------
A product team's quarterly feature-health review. Three hand-rolled
editors live inside snippet cells:

  - Color picker - the feature's swimlane / theme color
  - 5-star rating - customer satisfaction this quarter
  - Mood feedback - internal team sentiment

Snippet columns set `editable: false` so the grid does not start an
editor on click - the snippet's own controls handle writes through
`api.setCellValue`. Inner click handlers stop propagation so the
grid's cell-click handler does not fight the snippet input.

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
