# Prompt: 62-conditional-styling

Source: `examples/src/demos/62-conditional-styling.svelte`
Live:   https://svgrid.dev/#/demos/62-conditional-styling

## What this demo proves

62. Conditional styling - support ticket queue
---------------------------------------------
Enterprise-style triage board, modelled on Linear / Zendesk's queue
views. Two hooks do the heavy lifting:

  - `rowClass(ctx)` adds row-level state classes (`breach`, `risk`,
    `done`) - a thin vertical accent strip on the leftmost cell.
  - `cellClass(ctx)` paints subtle column-level chips (status pills,
    priority dots, plan badges) and a calm horizontal load bar.

The aim is tonal, not loud: low-saturation backgrounds, single-bar
accents, type that stays readable. Numbers + dates use tabular nums.

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
