# Prompt: 59-export-multi-sheet

Source: `examples/src/demos/59-export-multi-sheet.svelte`
Live:   https://svgrid.com/demos/59-export-multi-sheet/

## What this demo proves

59. Export - multiple sheets (Pro)
---------------------------------
One xlsx, three tabs: a per-region split + an "All orders" overview.
The user picks a region in the grid; the export writes ALL regions
regardless of the current filter, each on its own sheet.

  await pro.exportData({
    format: 'xlsx',
    sheets: [
      { label: 'All',    rows: allOrders },
      { label: 'EMEA',   rows: orders.filter(...) },
      { label: 'APAC',   rows: orders.filter(...) },
      { label: 'AMER',   rows: orders.filter(...) },
    ],
  })

The grid keeps showing the filtered view. The export is a pure
snapshot of the data you hand it.

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

- `api.exportData(...)`

## How to use this prompt

Drop this file into your LLM's context window when asking it to
generate code matching this pattern. The MCP server exposes the
same content via the `listDemos` tool. See
[LLM grounding](../../../docs/help/llm-grounding.md) for details.
