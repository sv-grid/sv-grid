# Prompt: 70-multi-grid-sync

Source: `examples/src/demos/70-multi-grid-sync.svelte`
Live:   https://svgrid.dev/#/demos/70-multi-grid-sync

## What this demo proves

70. Multi-grid sync - shared $state
----------------------------------
Two grids over a single Svelte 5 `$state` array. Edit a cell in
either - the other re-renders immediately because both grids read
the same reactive reference.

No grid-to-grid wiring is needed; this is the natural Svelte
pattern. The demo also shows that filter / sort state is per-grid
(each grid's view is independent) while the data they project is
shared.

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
