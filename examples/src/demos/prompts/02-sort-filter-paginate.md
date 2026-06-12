# Prompt: 02-sort-filter-paginate

Source: `examples/src/demos/02-sort-filter-paginate.svelte`
Live:   https://svgrid.dev/#/demos/02-sort-filter-paginate

## What this demo proves

02. Sort · Filter · Paginate
----------------------------
Three most-asked-for features wired together against a 5,000-row dataset.
  - multi-column sort (shift-click headers)
  - per-column filter row (text/number)
  - pagination footer with page-size selector
State is owned by this component so it can be persisted (here: in URL).

## Imports

```ts
```

## Registered features

```ts
const features = tableFeatures({
  rowSortingFeature,
  columnFilteringFeature,
  rowPaginationFeature,
})
```

## How to use this prompt

Drop this file into your LLM's context window when asking it to
generate code matching this pattern. The MCP server exposes the
same content via the `listDemos` tool. See
[LLM grounding](../../../docs/help/llm-grounding.md) for details.
