# Prompt: 89-group-panel

Source: `examples/src/demos/89-group-panel.svelte`
Live:   https://svgrid.com/demos/89-group-panel/

## What this demo proves

89. Group Panel - drag & drop grouping
--------------------------------------
A DevExpress / Kendo / AG Grid-style "drag a column here to group"
panel. Drag chips from the palette into the panel to group by that
column; drag chips inside the panel to reorder grouping levels;
click a chip's × to ungroup. Everything is driven by the grid's
imperative API - `api.setGroupBy(columnIds)` - so the same demo
works against any data shape with no library changes.

The dataset is a multi-region SaaS pipeline so the multi-level
grouping is meaningful: try Region → Stage → Owner.

## Imports

```ts
```

## Registered features

```ts
const features = tableFeatures({
  rowSortingFeature,
  columnGroupingFeature,
  rowExpandingFeature,
  columnFilteringFeature,
})
```

## SvGridApi methods called

- `api.collapseAllGroups(...)`
- `api.expandAllGroups(...)`
- `api.setGroupBy(...)`

## How to use this prompt

Drop this file into your LLM's context window when asking it to
generate code matching this pattern. The MCP server exposes the
same content via the `listDemos` tool. See
[LLM grounding](../../../docs/help/llm-grounding.md) for details.
