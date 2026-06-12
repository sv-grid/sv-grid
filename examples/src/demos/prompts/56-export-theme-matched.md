# Prompt: 56-export-theme-matched

Source: `examples/src/demos/56-export-theme-matched.svelte`
Live:   https://svgrid.dev/#/demos/56-export-theme-matched

## What this demo proves

56. Export - theme-matched styles (Pro)
--------------------------------------
Click any export button - the resulting file's header row, body rows,
and zebra stripes match whichever theme the grid is showing (light or
dark). The styles come from the live `--sg-*` CSS tokens the grid
already renders with, so a re-theme of the page re-themes the export.

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

- `api.exportData(...)`

## How to use this prompt

Drop this file into your LLM's context window when asking it to
generate code matching this pattern. The MCP server exposes the
same content via the `listDemos` tool. See
[LLM grounding](../../../docs/help/llm-grounding.md) for details.
