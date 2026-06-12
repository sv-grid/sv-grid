# Prompt: 72-graphql-adapter

Source: `examples/src/demos/72-graphql-adapter.svelte`
Live:   https://svgrid.dev/#/demos/72-graphql-adapter

## What this demo proves

72. GraphQL adapter - server-side sort + filter + page
-----------------------------------------------------
Wires the grid to a GraphQL endpoint. Whenever the user sorts,
filters, or pages, the grid hands the state to the consumer via the
`externalSort` / `externalFilter` callbacks; we build a typed GraphQL
query from that state, send it, and re-set `data` from the response.

The endpoint here is a mock in-process resolver so the demo runs
stand-alone; swap `runQuery` for `fetch('/graphql', ...)` against
your own backend and the rest of the wiring is unchanged.

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
