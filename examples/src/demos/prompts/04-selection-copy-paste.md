# Prompt: 04-selection-copy-paste

Source: `examples/src/demos/04-selection-copy-paste.svelte`
Live:   https://svgrid.com/demos/04-selection-copy-paste/

## What this demo proves

04. Selection + copy/paste
--------------------------
Row checkboxes (selectionMode='both') + cell-range selection.
Built-in clipboard:
  - Ctrl/Cmd+C copies the active rectangular selection as TSV
  - Ctrl/Cmd+V pastes TSV from the clipboard into the same range
The selection summary footer below the grid is rolled by hand -
the grid exposes the selected-cell rectangle via the active-cell state.

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

## How to use this prompt

Drop this file into your LLM's context window when asking it to
generate code matching this pattern. The MCP server exposes the
same content via the `listDemos` tool. See
[LLM grounding](../../../docs/help/llm-grounding.md) for details.
