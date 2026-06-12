# Prompt: 81-mobile-card-view

Source: `examples/src/demos/81-mobile-card-view.svelte`
Live:   https://svgrid.dev/#/demos/81-mobile-card-view

## What this demo proves

81. Mobile card view
--------------------
On wide screens this is a normal SvGrid. Under a viewport breakpoint
(≤ 720 px) the grid hides and the same `$state` array renders as
touch-friendly cards. Tap a card to expand into an edit panel,
which writes back through `api.setCellValue` so dirty tracking,
filtering, and external observers see the same writes whether the
edit came from the desktop grid or the mobile card.

The headless engine is the single source of truth for both views.
Filter / sort state lives on `api`, so swiping between viewport
sizes preserves the user's working set.

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
