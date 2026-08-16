# Prompt: 07-grouping-aggregation

Source: `examples/src/demos/07-grouping-aggregation.svelte`
Live:   https://svgrid.com/demos/07-grouping-aggregation/

## What this demo proves

07. Grouping + aggregation
--------------------------
The grid's built-in grouping pipeline buckets rows by one or more
columns and renders a group row in their place. Aggregation here is
computed in the demo (the engine resolves shared values per group; this
component layers sum/avg on top for the visible "Salary" and
"Performance" columns via the row-summary footer).

## Imports

```ts
```

## Registered features

```ts
const features = tableFeatures({
  rowSortingFeature,
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
