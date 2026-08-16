# Prompt: 32-manufacturing-ops

Source: `examples/src/demos/32-manufacturing-ops.svelte`
Live:   https://svgrid.com/demos/32-manufacturing-ops/

## What this demo proves

32. Manufacturing operations
----------------------------
What a plant-floor "Today's runs" screen typically looks like in a
MES (Manufacturing Execution System):

  - KPI cards across the top: total throughput, average OEE, defect
    rate, on-time completion. Tick once every 5 seconds so the
    numbers feel "live" without burning CPU.
  - A wide grid of active production runs: line, product, batch
    size, status, OEE, yield, defects, ETA.
  - Status pills, color-coded OEE bar, defect heat coloring.

The data is fully synthetic but plausible - feel free to swap in a
real WebSocket / SSE source where `runs` is reassigned every tick.

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
