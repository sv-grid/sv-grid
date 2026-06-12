# Prompt: 79-loading-from-rest

Source: `examples/src/demos/79-loading-from-rest.svelte`
Live:   https://svgrid.dev/#/demos/79-loading-from-rest

## What this demo proves

79. Loading from REST
---------------------
The everyday "fetch JSON, render rows" pattern, with the four states
every real LOB app needs:

  1. Loading - a skeleton grid so the layout doesn't jump
  2. Error   - typed error surface with a retry button
  3. Empty   - the API succeeded but returned nothing
  4. Ready   - rows mounted, sort / filter / scroll wired

The endpoint is public (jsonplaceholder.typicode.com), so this works
offline-of-your-backend during a demo and can be swapped for your own
fetch + auth headers in one place. Aborts in flight on unmount so a
fast reload doesn't leak a stale fetch.

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
