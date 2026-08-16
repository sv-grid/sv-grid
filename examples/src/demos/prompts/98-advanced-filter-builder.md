# Prompt: 98-advanced-filter-builder

Source: `examples/src/demos/98-advanced-filter-builder.svelte`
Live:   https://svgrid.com/demos/98-advanced-filter-builder/

## What this demo proves

98. Advanced filter builder (visual query builder)
--------------------------------------------------
A drag-and-drop AND/OR query builder, like Notion's filter panel
or Linear's view filters. Compose any number of rule rows ANDed
or ORed together; each rule picks (field × operator × value).
The filter runs entirely client-side over the dataset; we replace
the grid's data with the filtered subset on every change.

The grid's own column menu still works for ad-hoc filtering - this
is the "Saved view" / "Build a complex query" surface that ships
with every modern BI tool.

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
