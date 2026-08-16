# Prompt: 19-ssr

Source: `examples/src/demos/19-ssr.svelte`
Live:   https://svgrid.com/demos/19-ssr/

## What this demo proves

19. Server-side rendering
-------------------------
SvGrid produces meaningful, semantic HTML *before* client-side JS runs.
In a SvelteKit (or any Svelte SSR) setup, calling `render(SvGrid,
{ props })` from `svelte/server` returns a string of `<table>` markup
with the data baked in - that's the response the user's first paint
sees, before hydration takes over interactivity.

Demonstrating real SSR end-to-end requires a server runtime, which the
Vite dev gallery doesn't have. Instead this demo proves the same point
with a runtime trick:

  1. Render the live grid below as you'd normally do.
  2. "Snapshot" button captures the grid's current DOM as a string.
     That HTML is byte-for-byte close to what SSR would emit
     (Svelte's SSR renderer + the hydration renderer share the same
     output for a static initial state).
  3. The snapshot is injected into a sandboxed iframe with `csp` set
     to deny scripts. If the grid is meaningful pre-JS, the iframe
     will show the data anyway - which is the SSR / SEO promise.

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
