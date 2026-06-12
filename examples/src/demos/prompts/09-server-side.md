# Prompt: 09-server-side

Source: `examples/src/demos/09-server-side.svelte`
Live:   https://svgrid.dev/#/demos/09-server-side

## What this demo proves

09. Server-side data
--------------------
Sort, filter, and page are pushed to a mock "server" (an async function
over a large seeded dataset). Only the visible page is held in memory.
The dev-loop pattern:
  1. owning state is in this component
  2. an effect debounces (250 ms) and turns state into a query
  3. an AbortController cancels stale requests

The grid runs in `externalSort` + `externalFilter` mode so its built-in
sort/filter UI only updates the *query state* - the actual fetch goes
back to the endpoint, which sees the full 100k-row dataset.

Replace `mockEndpoint` with `fetch('/api/people?...')` and the rest of
the structure stays the same.

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
