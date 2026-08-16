# Prompt: 90-selection-api

Source: `examples/src/demos/90-selection-api.svelte`
Live:   https://svgrid.com/demos/90-selection-api/

## What this demo proves

90. Selection API + events
--------------------------
Drives cell selection programmatically and observes changes via the
`onCellSelectionChange` event:

  - `api.selectCells([[r1, c1, r2, c2]])` - select a rectangle
  - `api.getSelected()`                   - read the current rectangles
  - `onCellSelectionChange={(ranges) => …}` - subscribe to changes

Try the toolbar buttons (programmatic) and also drag a range with
the mouse (user-driven). Both paths fire the same event.

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

- `api.getCellValue(...)`
- `api.getSelected(...)`
- `api.selectCells(...)`

## How to use this prompt

Drop this file into your LLM's context window when asking it to
generate code matching this pattern. The MCP server exposes the
same content via the `listDemos` tool. See
[LLM grounding](../../../docs/help/llm-grounding.md) for details.
