# Prompt: 78-million-rows

Source: `examples/src/demos/78-million-rows.svelte`
Live:   https://svgrid.com/demos/78-million-rows/

## What this demo proves

78. One million rows
--------------------
Row + column virtualization carrying a literal 1,000,000-row dataset
with sort, filter, group, scroll, and inline edit all enabled.

Generation is chunked through requestAnimationFrame so the UI keeps
painting while the heap fills. The row shape is intentionally lean
(9 fields) - at 1M rows that's the difference between ~250 MB and
an unresponsive tab.

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
