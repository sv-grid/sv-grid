# Prompt: 67-context-menu

Source: `examples/src/demos/67-context-menu.svelte`
Live:   https://svgrid.dev/#/demos/67-context-menu

## What this demo proves

67. Context menu - row-level operations
--------------------------------------
Right-click on any row to open a context menu with row-level actions:

  - Edit row title  (focuses the first cell in edit mode)
  - Duplicate row   (api.addRow)
  - Move up / down  (rebuilds the data array)
  - Delete row      (api.removeRow)

The grid does not own a context menu - intentionally - so consumers
can stack their own. The pattern here uses a single floating menu
positioned at the pointer event, anchored to the row id.

## Imports

```ts
```

## Registered features

```ts
const features = tableFeatures({
  rowSortingFeature,
  rowSelectionFeature,
})
```

## SvGridApi methods called

- `api.addRow(...)`
- `api.removeRow(...)`

## How to use this prompt

Drop this file into your LLM's context window when asking it to
generate code matching this pattern. The MCP server exposes the
same content via the `listDemos` tool. See
[LLM grounding](../../../docs/help/llm-grounding.md) for details.
