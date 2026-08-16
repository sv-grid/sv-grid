# Prompt: 87-find-in-grid

Source: `examples/src/demos/87-find-in-grid.svelte`
Live:   https://svgrid.com/demos/87-find-in-grid/

## What this demo proves

87. Find-in-grid
----------------
Press <kbd>Ctrl/Cmd+F</kbd> anywhere on the grid to open the
find overlay. Type to search across every cell value; press
<kbd>Enter</kbd> for next match, <kbd>Shift+Enter</kbd> for
previous, <kbd>Esc</kbd> to close. Each match activates the
cell and scrolls it into view.

The same surface is on the API for command palettes:

  api.openFind()
  api.setFindQuery('error')
  api.getFindHits()
  api.closeFind()

The grid does linear-scan matching - good enough for the typical
10k row × 30 column working set. For larger views, debounce
setFindQuery in your own code or wire the search through a server
endpoint.

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

- `api.closeFind(...)`
- `api.getFindHits(...)`
- `api.openFind(...)`
- `api.setFindQuery(...)`

## How to use this prompt

Drop this file into your LLM's context window when asking it to
generate code matching this pattern. The MCP server exposes the
same content via the `listDemos` tool. See
[LLM grounding](../../../docs/help/llm-grounding.md) for details.
