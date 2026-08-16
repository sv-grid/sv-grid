# Prompt: 86-undo-redo

Source: `examples/src/demos/86-undo-redo.svelte`
Live:   https://svgrid.com/demos/86-undo-redo/

## What this demo proves

86. Undo / redo
---------------
Every inline cell edit pushes onto the grid's history stack.
`Ctrl/Cmd+Z` undoes; `Ctrl/Cmd+Y` (or `Ctrl/Cmd+Shift+Z`) redoes.
The imperative API exposes the same surface for toolbar buttons:

  - `api.undo()`        → reverts the most recent edit; returns false when empty
  - `api.redo()`        → re-applies the most recently undone edit
  - `api.canUndo()` / `api.canRedo()`
  - `api.clearHistory()` → call after a successful server save

The history is bounded at 200 steps so a long editing session can't
grow the buffer unbounded.

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

- `api.canRedo(...)`
- `api.canUndo(...)`
- `api.clearHistory(...)`
- `api.redo(...)`
- `api.undo(...)`

## How to use this prompt

Drop this file into your LLM's context window when asking it to
generate code matching this pattern. The MCP server exposes the
same content via the `listDemos` tool. See
[LLM grounding](../../../docs/help/llm-grounding.md) for details.
