# Prompt: 13-finances

Source: `examples/src/demos/13-finances.svelte`
Live:   https://svgrid.com/demos/13-finances/

## What this demo proves

13. Finances - account ledger
-----------------------------
A chequing/savings ledger with running balance, currency formatting,
category chips, and a status column. ~600 transactions across three
accounts; pick one with the dropdown to switch the view.

Running balance is computed ONCE in chronological order at load time
(and re-computed when the account changes) - so it's stable regardless
of how the user later sorts or filters the visible rows.

Showcases:
  - Pagination
  - Per-column filtering via the funnel menu
  - Currency + date formatters
  - Custom cell renderers for category chips and signed amounts
  - Row summaries (sum of money-in / money-out) in the footer

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
