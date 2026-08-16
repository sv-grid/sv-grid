# Prompt: 20-industrial-dashboard

Source: `examples/src/demos/20-industrial-dashboard.svelte`
Live:   https://svgrid.com/demos/20-industrial-dashboard/

## What this demo proves

20. Industrial dashboard
------------------------
A plant-floor operations view: KPI cards on top, a live line-status
grid below it, and an active-alarms feed alongside. Everything ticks
on a 2-second cadence so OEE / throughput / alarms feel real.

Showcases stacking SvGrid alongside other UI in a real dashboard:

  - Aggregated KPI cards derived from grid data via `$derived`
  - Two SvGrid instances in one screen (line status + alarms)
  - Threshold-driven coloring on KPIs and cells
  - Acknowledge button inside an alarm cell (renderSnippet + closure)
  - Single tick loop drives line state, KPIs, and alarm spawn

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
