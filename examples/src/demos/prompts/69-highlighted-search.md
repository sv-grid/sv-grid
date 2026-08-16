# Prompt: 69-highlighted-search

Source: `examples/src/demos/69-highlighted-search.svelte`
Live:   https://svgrid.com/demos/69-highlighted-search/

## What this demo proves

69. External search with highlighted matches
--------------------------------------------
A search input above the grid filters rows AND wraps the matching
substring inside each cell with a `<mark>` so the user can see
exactly what matched.

Implementation: pre-compute the filtered row set in a derived state;
render text columns through a snippet that splits the value around
the query.

## Imports

```ts
```

## Registered features

```ts
const features = tableFeatures({
  rowSortingFeature,
})
```

## How to use this prompt

Drop this file into your LLM's context window when asking it to
generate code matching this pattern. The MCP server exposes the
same content via the `listDemos` tool. See
[LLM grounding](../../../docs/help/llm-grounding.md) for details.
