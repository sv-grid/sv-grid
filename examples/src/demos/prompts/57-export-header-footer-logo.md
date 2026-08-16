# Prompt: 57-export-header-footer-logo

Source: `examples/src/demos/57-export-header-footer-logo.svelte`
Live:   https://svgrid.com/demos/57-export-header-footer-logo/

## What this demo proves

57. Export - branded xlsx (header + footer + logo) (Pro)
-------------------------------------------------------
Generates a single-sheet xlsx that opens with a branded page header
(PNG logo + company name + report subtitle) and a three-segment footer
(left: generated date, center: brand URL, right: Excel page-number
macros). All lines are forwarded via `ExportHeaderFooterLine[]` and the
wrapper translates them into Smart's `headerContent` rows; image lines
route through `addImageToCell` to embed a real picture.

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
