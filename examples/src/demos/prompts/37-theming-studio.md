# Prompt: 37-theming-studio

Source: `examples/src/demos/37-theming-studio.svelte`
Live:   https://svgrid.com/demos/37-theming-studio/

## What this demo proves

37. Theming studio
------------------
A live token playground. Move sliders / pick colors → the grid
restyles in real time. The "can I make it ours" answer for any
evaluator looking at this from a design-system perspective.

What's adjustable, and what CSS variable each control writes:

  - Brand accent  → --sg-accent       (header label, selection, focus)
  - Surface color → --sg-bg           (cell background)
  - Header bg     → --sg-header-bg
  - Border color  → --sg-border
  - Density       → row height (passed straight to the grid prop)
  - Radius        → --sg-radius       (cell rounding via override)
  - Font family   → wrapper `font-family`
  - Dark / light  → data-theme attribute on the wrapper

A "Copy CSS" pane at the bottom emits the full `:root { ... }`
snippet so the buyer can paste it straight into their stylesheet.
Settings persist across page reloads via localStorage so the demo
remembers the configuration the user landed on.

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
