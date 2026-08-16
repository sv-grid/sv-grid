# Prompt: 00-trading-desk

Source: `examples/src/demos/00-trading-desk.svelte`
Live:   https://svgrid.com/demos/00-trading-desk/

## What this demo proves

00. Trading desk - hero demo
----------------------------
The first demo a prospect sees. Ten thousand live securities with
sparklines, sector chips, pinned P&L, and a 500 ms tick stream that
flashes cells on price moves. Built on the same SvGrid primitives as
every other demo - no special hero APIs.

Highlights:
  - Row virtualization keeps 10,000 rows scrolling at 60 fps
  - Symbol pinned LEFT, P&L pinned RIGHT (sticky horizontal scroll)
  - Live tick: ~5 % of rows update every 500 ms, cells pulse green/red
  - Sparklines re-rendered from each row's rolling 30-point buffer
  - KPI strip recomputes across all 10k rows on every tick via $derived
  - Sector filter chips above the grid drive a $derived row slice

Implementation notes:
  - Rows live in `$state.raw` so the grid sees one new array reference
    per tick instead of 10k per-cell mutations
  - `pulses` map is replaced (not appended to) each tick - pulses GC
    themselves by being absent from the next tick's map
  - Sparkline path is recomputed only when the row reference changes
    (i.e. only ticked rows), so static rows pay no SVG cost

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
