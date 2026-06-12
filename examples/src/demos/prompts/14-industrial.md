# Prompt: 14-industrial

Source: `examples/src/demos/14-industrial.svelte`
Live:   https://svgrid.dev/#/demos/14-industrial

## What this demo proves

14. Industrial - IoT sensor floor
---------------------------------
A factory-floor sensor dashboard: ~120 readings across four production
lines, ticking every 700 ms. Each row carries threshold bands
(critical-low / warn-low / warn-high / critical-high) and the status
column is computed from the live reading against those bands. The Trend
column is an inline SVG sparkline of the last 24 readings.

Showcases:
  - Live updates with `$state.raw` swap-the-array pattern
  - Threshold-driven status badges
  - SVG sparklines as a custom cell
  - Group by line / sensor type / status
  - Row summaries (sensor count per group)

## Imports

```ts
```

## Registered features

```ts
const features = tableFeatures({
  rowSortingFeature,
  columnFilteringFeature,
  columnGroupingFeature,
  rowExpandingFeature,
})
```

## SvGridApi methods called

- `api.setGroupBy(...)`

## How to use this prompt

Drop this file into your LLM's context window when asking it to
generate code matching this pattern. The MCP server exposes the
same content via the `listDemos` tool. See
[LLM grounding](../../../docs/help/llm-grounding.md) for details.
