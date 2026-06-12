# Prompt: 11-stock-market

Source: `examples/src/demos/11-stock-market.svelte`
Live:   https://svgrid.dev/#/demos/11-stock-market

## What this demo proves

11. Stock market - live updates
-------------------------------
Simulates a fast-moving market feed. A 250 ms interval randomly walks
each symbol's last price, bid/ask, and cumulative volume. Cells flash
green on an up-tick, red on a down-tick.

Implementation notes:
  - Rows are kept in `$state.raw` so the grid sees a single new array
    reference per tick instead of one mutation per cell.
  - A `pulses` map keyed by `${symbol}:${col}` is set when the cell
    changes. A 320 ms CSS animation reads `data-pulse="up|down"` on the
    cell DOM node and tints the background. The map is GC'd by the same
    tick that wrote the entry - old keys are dropped, not appended.
  - "Pause" stops the interval. Sort and selection still work paused.

Replace `tick()` with your WebSocket onMessage handler; the rest of the
grid wiring stays the same.

## Imports

```ts
```

## Registered features

```ts
const features = tableFeatures({
  rowSortingFeature,
})
```

## How to use this prompt

Drop this file into your LLM's context window when asking it to
generate code matching this pattern. The MCP server exposes the
same content via the `listDemos` tool. See
[LLM grounding](../../../docs/help/llm-grounding.md) for details.
