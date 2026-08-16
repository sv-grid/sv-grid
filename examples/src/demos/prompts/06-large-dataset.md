# Prompt: 06-large-dataset

Source: `examples/src/demos/06-large-dataset.svelte`
Live:   https://svgrid.com/demos/06-large-dataset/

## What this demo proves

06. Large dataset, virtualized
------------------------------
Row + column virtualization make a wide grid scroll smoothly.

The data is a sales team where each rep carries a rolling monthly ledger -
Revenue / Units / Margin per month going back a couple of years. That's a
genuinely wide real-world shape (not placeholder "Metric N" columns), so
scrolling both axes exercises the virtualizer on data that means something.

The user can scale it up at runtime. The default is 10,000 rows × 55
columns - a realistic enterprise size that mounts in well under a second.
The 100,000-row option pushes the grid hard; expect a brief pause on
mount, then smooth scrolling once the virtualizer is live.

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
