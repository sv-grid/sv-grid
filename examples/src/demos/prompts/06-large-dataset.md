# Prompt: 06-large-dataset

Source: `examples/src/demos/06-large-dataset.svelte`
Live:   https://svgrid.dev/#/demos/06-large-dataset

## What this demo proves

06. Large dataset, virtualized
------------------------------
Row + column virtualization make a wide grid scroll smoothly.

The user can scale the dataset up at runtime. The default is 10,000 rows
× 50 columns - a realistic enterprise size that mounts in well under a
second. The 100,000-row option pushes the grid hard; expect a brief
pause on mount, then smooth scrolling once the virtualizer is live.

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
