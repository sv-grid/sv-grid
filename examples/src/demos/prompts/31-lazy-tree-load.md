# Prompt: 31-lazy-tree-load

Source: `examples/src/demos/31-lazy-tree-load.svelte`
Live:   https://svgrid.com/demos/31-lazy-tree-load/

## What this demo proves

31. Lazy tree - load children on demand
---------------------------------------
A geographic hierarchy (Region -> Country -> State -> City) where
only the root regions are seeded up front. Clicking expand on any
node fires an async fetch (simulated 400-800ms via setTimeout) and
shows a "Loading..." row in place of the children until it
resolves.

Already-loaded subtrees are cached so the second expand is instant.
Keyboard: Right Arrow expands a collapsed node; Left Arrow collapses
an expanded one; Enter / Space toggle.

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
