# Prompt: 01-quick-start

Source: `examples/src/demos/01-quick-start.svelte`
Live:   https://svgrid.dev/#/demos/01-quick-start

## What this demo proves

01. Quick start
---------------
A realistic small grid you'd actually surface in an admin tool.
Wires up:
  - a row-number column ("#")
  - sortable headers
  - per-column filter row + the column menu's operator picker
  - row checkboxes for multi-row selection
  - cell range selection (click+drag, Shift+arrows)
  - inline editing (double-click or F2 on any cell)
  - column resize (drag the right edge of any header)

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

## How to use this prompt

Drop this file into your LLM's context window when asking it to
generate code matching this pattern. The MCP server exposes the
same content via the `listDemos` tool. See
[LLM grounding](../../../docs/help/llm-grounding.md) for details.
