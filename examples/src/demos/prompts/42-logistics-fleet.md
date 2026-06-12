# Prompt: 42-logistics-fleet

Source: `examples/src/demos/42-logistics-fleet.svelte`
Live:   https://svgrid.dev/#/demos/42-logistics-fleet

## What this demo proves

42. Logistics / fleet ops
--------------------------
Live shipment dispatch board: ~80 in-flight loads, each ticking
progress, ETA, and the occasional alert. Built on top of the
`createStreamSim` helper from demo 34 so it inherits the same
pause / resume / reconnect surface for free.

What the dispatcher sees:

  - **Route lane** column with origin → destination + carrier
  - **Progress** column: gradient bar + percent, color-graded
    by lateness vs the original committed ETA
  - **Status pills** for in_transit / loading / delivered /
    delayed / exception
  - **ETA cells** showing the current promise, with a red
    "+2h" overlay when the stream has pushed it later than
    promised
  - **Alerts** column: a small chip cluster - temperature,
    route deviation, dwell time, etc.

The stream emits four event types: position / eta_shift /
status_change / alert_raised - exercising the same delta-merge
pipeline as the order stream demo, just with a different cell
vocabulary.

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
