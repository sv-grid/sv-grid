# Prompt: 26-list-chips-editors

Source: `examples/src/demos/26-list-chips-editors.svelte`
Live:   https://svgrid.dev/#/demos/26-list-chips-editors

## What this demo proves

26. List + chips editors (single & multi-select)
------------------------------------------------
Two new built-in editors:

  editorType: 'list'   - native <select>. With editorMultiple it
                         becomes <select multiple>; the cell stores
                         an array of option values.

  editorType: 'chips'  - removable-token editor. With options it
                         shows a picker; without options it is
                         free-form (type, Enter to add). With
                         editorMultiple the cell stores an array
                         and renders chips when not editing.

Both honor `editorOptions` (string|number|{value,label}[]) and
`editorSeparator` (display join for list/single-array cells).

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
