# Prompt: 25-column-pinning

Source: `examples/src/demos/25-column-pinning.svelte`
Live:   https://svgrid.dev/#/demos/25-column-pinning

## What this demo proves

25. Column pinning + freezing
-----------------------------
Wide grid (8 generous columns ~2050px total) so horizontal scrolling
kicks in on any reasonable viewport. Company is pre-pinned to the
LEFT and Unit price to the RIGHT - they stay sticky while the middle
columns slide under them when you scroll.

Try it:
  - Scroll the grid horizontally - Company stays anchored on the left,
    Unit price on the right, the rest scroll between them.
  - Hover any middle-column header → click the ⋮ that appears →
    "Pin to left" / "Pin to right" / "Unpin column".

Note: column pinning requires `columnVirtualization={false}` because
the virtualizer recycles DOM nodes (which breaks sticky positioning).
The pin menu items are hidden when virtualization is on, so the
gating is automatic.

A programmatic `api.setColumnPinning(id, side)` is on the v1.x
roadmap; today the `initialColumnPinning` prop covers the on-mount
case and the column menu covers user-driven re-pinning.

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

- `api.setColumnPinning(...)`

## How to use this prompt

Drop this file into your LLM's context window when asking it to
generate code matching this pattern. The MCP server exposes the
same content via the `listDemos` tool. See
[LLM grounding](../../../docs/help/llm-grounding.md) for details.
