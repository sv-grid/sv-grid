# Prompt: 77-smart-chart

Source: `examples/src/demos/77-smart-chart.svelte`
Live:   https://svgrid.com/demos/77-smart-chart/

## What this demo proves

77. Smart.Chart integration (htmlelements.com)
---------------------------------------------
Real working integration: mounts a `<smart-chart>` web component
next to the grid and keeps its `dataSource` in sync with the rows
the grid is currently displaying. Filter the grid - the chart
re-aggregates. Use the chart-type pills to switch column → stacked
column → line → pie without remounting.

Loads `smart-webcomponents/source/modules/smart.chart.js` lazily on
first paint. The component registers `<smart-chart>` as a custom
element; properties are set imperatively after createElement.

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
