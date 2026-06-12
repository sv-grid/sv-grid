# Prompt: 34-realtime-orders

Source: `examples/src/demos/34-realtime-orders.svelte`
Live:   https://svgrid.dev/#/demos/34-realtime-orders

## What this demo proves

34. Real-time / streaming - Order operations
--------------------------------------------
A live order-ops view fed by a WebSocket-style event stream. The
grid mounts with a small backlog, then pushed events flow in:

  - `order.created` → new row at the top
  - `order.updated` → in-place merge with a brief field-level flash
  - `order.cancelled` → row marked as cancelled (kept visible for
    two seconds so the operator can see what changed, then dropped)

Things this demo is built to surface for an enterprise buyer:

  1. Stable identity. Rows are keyed by order id, so virtualisation
     keeps scroll position rock-steady when a delta lands. No
     "jumping" rows.

  2. Out-of-order safety. Each event carries `seq` + `rowVersion`.
     A late event for an already-newer row is ignored, the standard
     enterprise streaming-merge guarantee.

  3. Pause / resume with backlog. Hitting Pause stops applying
     deltas but the stream keeps buffering. The KPI strip shows the
     backlog count growing; Resume drains it in order.

  4. Disconnect / reconnect. The simulator can drop the connection
     for a configurable interval. The status pill flips through
     open → reconnecting → open, and the gap in the event log
     stays visible so the operator knows what they missed.

  5. Throughput control. Slider runs the stream from a calm 1
     event / sec up to a 50 event / sec firehose - shows the grid
     stays smooth at the high end.

Editable columns (Priority, Notes) live entirely client-side; the
stream never overwrites them, so there's no merge conflict to
resolve at the cell level. Onboarding edits to the wire would be a
call to the same `onCellValueChange` callback the demo already
wires up.

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
