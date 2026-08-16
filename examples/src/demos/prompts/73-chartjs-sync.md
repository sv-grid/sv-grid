# Prompt: 73-chartjs-sync

Source: `examples/src/demos/73-chartjs-sync.svelte`
Live:   https://svgrid.com/demos/73-chartjs-sync/

## What this demo proves

73. Real-time analytics dashboard - grid + multiple Chart.js views
-----------------------------------------------------------------
A trading-desk style dashboard. The grid is the data source of
truth; three Chart.js charts read the SAME displayed rows and
re-render on every tick AND every filter change:

  - Bar chart  · price per symbol
  - Line chart · price history (last 30 ticks per symbol, top 4)
  - Doughnut   · share of market-cap by sector

Pattern: derive `displayedRows` from the grid via
`api.getDisplayedRows()` inside an effect; charts subscribe to
`displayedRows` and call `chart.update('none')` for paint-free
refresh (no animation jitter on a 350ms tick cadence).

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

## SvGridApi methods called

- `api.getDisplayedRows(...)`

## How to use this prompt

Drop this file into your LLM's context window when asking it to
generate code matching this pattern. The MCP server exposes the
same content via the `listDemos` tool. See
[LLM grounding](../../../docs/help/llm-grounding.md) for details.
