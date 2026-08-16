# Prompt: 60-pivot-expandable

Source: `examples/src/demos/60-pivot-expandable.svelte`
Live:   https://svgrid.com/demos/60-pivot-expandable/

## What this demo proves

60. Sales pipeline - pivot analytics dashboard (Pro)
----------------------------------------------------
Production-feel pivot view modelled on PowerBI / Tableau pivots:

  - Page header with title, breadcrumbs, last-refresh timestamp,
    refresh / export actions.
  - 4 KPI tiles with sparkline trends per region.
  - Filter rail: region chips + measure toggles + density toggle.
  - Pivot grid in a "card" container with heat-map tinting, pinned
    row-header column, distinct subtotal / grand-total styling.
  - Toolbar tools: expand-all, collapse-all, export xlsx.

## Imports

```ts
```

## Registered features

```ts
const features = tableFeatures({
  rowSortingFeature,
})
```

## SvGridApi methods called

- `api.exportData(...)`
- `api.setColumnPinning(...)`

## How to use this prompt

Drop this file into your LLM's context window when asking it to
generate code matching this pattern. The MCP server exposes the
same content via the `listDemos` tool. See
[LLM grounding](../../../docs/help/llm-grounding.md) for details.
