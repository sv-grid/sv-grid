# Prompt: 10-custom-cells-and-themes

Source: `examples/src/demos/10-custom-cells-and-themes.svelte`
Live:   https://svgrid.com/demos/10-custom-cells-and-themes/

## What this demo proves

10. Custom cells + themes
-------------------------
Demonstrates `renderSnippet` for custom cell content, a density toggle
driven entirely by CSS custom properties, and a forced light/dark/
high-contrast theme switch. ARIA roles & focus styles come from the
grid's built-in a11y helpers - they do not need to be re-declared here.

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
