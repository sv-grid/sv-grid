# Prompt: 03-excel-filters

Source: `examples/src/demos/03-excel-filters.svelte`
Live:   https://svgrid.com/demos/03-excel-filters/

## What this demo proves

03. Excel-style filters
-----------------------
The grid's built-in column menu exposes a per-column operator + value
filter - clicking the filter icon on a header opens it. This demo turns
that surface on and adds an "active filter chips" strip on top, driven
by the imperative API.

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

- `api.clearFilter(...)`
- `api.setFilter(...)`

## How to use this prompt

Drop this file into your LLM's context window when asking it to
generate code matching this pattern. The MCP server exposes the
same content via the `listDemos` tool. See
[LLM grounding](../../../docs/help/llm-grounding.md) for details.
