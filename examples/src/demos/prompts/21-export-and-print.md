# Prompt: 21-export-and-print

Source: `examples/src/demos/21-export-and-print.svelte`
Live:   https://svgrid.dev/#/demos/21-export-and-print

## What this demo proves

21. Export + Print (Pro)
------------------------
Demonstrates the @svgrid/enterprise feature pack: download the visible grid to
Excel, PDF, CSV, TSV, or HTML, and open a printable view in a new window.

The grid itself is plain @svgrid/grid. Pro is installed via
installEnterprise(api) which adds api.exportData(...) and api.print(...) onto
the same SvGridApi object you already have.

## Imports

```ts
```

## Registered features

```ts
const features = tableFeatures({
  rowSortingFeature,
  columnFilteringFeature,
  rowSelectionFeature,
})
```

## SvGridApi methods called

- `api.exportData(...)`
- `api.print(...)`

## How to use this prompt

Drop this file into your LLM's context window when asking it to
generate code matching this pattern. The MCP server exposes the
same content via the `listDemos` tool. See
[LLM grounding](../../../docs/help/llm-grounding.md) for details.
