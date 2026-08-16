# Prompt: 96-high-contrast-theme

Source: `examples/src/demos/96-high-contrast-theme.svelte`
Live:   https://svgrid.com/demos/96-high-contrast-theme/

## What this demo proves

89. High-contrast theme preset
------------------------------
Procurement-grade accessibility theme. Every chrome surface uses
one of two ink colours (foreground / muted) on one background;
borders are 1 px solid; the accent colour is pure red on light /
pure yellow on dark for unmistakable focus rings; selection +
hover + zebra rows pick neighbouring tones with at least a 7:1
contrast ratio against text.

Drop the token block onto any wrapper to opt that subtree into
the high-contrast skin - the rest of the page stays normal so
users can switch on a per-section basis.

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
