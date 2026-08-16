# Prompt: 74-theme-integrations

Source: `examples/src/demos/74-theme-integrations.svelte`
Live:   https://svgrid.com/demos/74-theme-integrations/

## What this demo proves

74. Theme integrations - Ant Design / MUI / Fluent UI / Base Web / shadcn
------------------------------------------------------------------------
The grid renders entirely through CSS custom properties (`--sg-*`).
Drop a token preset onto any wrapper and every grid below picks it up.

Each preset here ships BOTH a light and a dark token set. The active
mode is read from the gallery's `[data-theme="dark"]` attribute on
`<html>`, so flipping the gallery's sun/moon swaps every preset's
tokens in lockstep.

Real-world integration: map your design system's tokens to `--sg-*`,
optionally inject `font-family` + accent overrides, and ship.

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
