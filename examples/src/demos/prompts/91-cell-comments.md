# Prompt: 91-cell-comments

Source: `examples/src/demos/91-cell-comments.svelte`
Live:   https://svgrid.com/demos/91-cell-comments/

## What this demo proves

91. Cell comments + @-mentions
------------------------------
Sticky-note conversations attached to any cell. Right-click a
cell → "Add comment" opens an editor below the grid; a corner
triangle marks cells with active threads. Typing "@" inside the
editor opens a fuzzy-search picker over the team list and
inserts a chip.

Storage is a `commentsAdapter` namespace - the demo wires a local
one that mutates an in-memory map, but the contract is the same
for a remote adapter (REST / WebSocket).

What's worth stealing:

  - The "comment indicator" is a CSS triangle pseudo-element
    painted via a class added by the cell snippet. No extra
    overlay layer.
  - The @-mention picker tracks insertion position via the
    textarea's selectionStart so chips land where the user is
    typing.
  - Mentioned users get a notification badge in the team list.

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
