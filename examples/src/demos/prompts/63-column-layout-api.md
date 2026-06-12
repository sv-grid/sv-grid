# Prompt: 63-column-layout-api

Source: `examples/src/demos/63-column-layout-api.svelte`
Live:   https://svgrid.dev/#/demos/63-column-layout-api

## What this demo proves

63. Column layout API - named "saved views"
------------------------------------------
Realistic pattern: an analyst sets up a layout (widths + pins) for a
specific job, saves it under a name, and switches between named views
later. Underneath:

  - `api.getColumnWidths()` + `api.getColumnPinning()` snapshot the
    current layout to a plain JSON object.
  - `api.setColumnWidth(id, w)` + `api.setColumnPinning({left,right})`
    restore it.

Views are auto-persisted to localStorage so they survive a reload.

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

- `api.getColumnPinning(...)`
- `api.getColumnWidths(...)`
- `api.setColumnPinning(...)`
- `api.setColumnWidth(...)`

## How to use this prompt

Drop this file into your LLM's context window when asking it to
generate code matching this pattern. The MCP server exposes the
same content via the `listDemos` tool. See
[LLM grounding](../../../docs/help/llm-grounding.md) for details.
