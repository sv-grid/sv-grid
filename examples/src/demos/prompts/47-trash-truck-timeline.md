# Prompt: 47-trash-truck-timeline

Source: `examples/src/demos/47-trash-truck-timeline.svelte`
Live:   https://svgrid.dev/#/demos/47-trash-truck-timeline

## What this demo proves

47. Trash truck timeline (animated)
------------------------------------
Public-works dispatcher view. Every truck row gets a wide
"Route" cell that lays out the day's stops along a time axis.
A live truck SVG drives between stops in real time, so the
board "moves" even when no one is interacting.

  1. **Animated trucks.** The truck icon is positioned by `left%`
     with a CSS transition so it glides between stops. A subtle
     bounce keyframe + spinning wheels suggest motion.

  2. **Stop ETAs vs actuals.** Each stop shows its scheduled
     time. The cell paints a "completed" zone behind the truck
     so you can see how far through the route it is.

  3. **Live tick.** `now` updates every 2 seconds; cells reflow
     smoothly because positions are pure derived state.

  4. **Status pills, fill level, KPIs.** Real-world ops surface:
     out-of-service alarms, fill-level capacity, completion %.

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
