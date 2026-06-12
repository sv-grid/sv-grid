# Prompt: 48-crm-sales-pipeline

Source: `examples/src/demos/48-crm-sales-pipeline.svelte`
Live:   https://svgrid.dev/#/demos/48-crm-sales-pipeline

## What this demo proves

48. CRM - sales pipeline / deal board
--------------------------------------
The view every sales VP opens first thing Monday morning. Each row
is a deal; every column makes a decision someone has to defend on
Friday's forecast call.

  1. **Pipeline KPI strip.** Pipeline value, weighted value, win
     rate, average deal size, cycle time. Computed from the row
     set so filter/stage selection re-rolls the totals live.

  2. **Stage funnel chips.** Click a stage chip to scope the grid
     to that bucket. Counts on each chip refresh as deals advance.

  3. **Editable in place.** Owner, stage, probability and next
     step are inline-editable; the activity panel + KPIs reflect
     the new state on the next keystroke.

  4. **Deal detail aside.** Click any row -> right-side card with
     contact, recent activity, MEDDIC-ish health signals, and
     "advance / mark won / mark lost" buttons that mutate the row.

  5. **Forecast bar.** Per-stage weighted contribution rolled up
     against the quarter's quota, with a delta vs. plan.

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
