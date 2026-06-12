# Prompt: 05-inline-editing

Source: `examples/src/demos/05-inline-editing.svelte`
Live:   https://svgrid.dev/#/demos/05-inline-editing

## What this demo proves

05. Inline editing
------------------
Typed editors per column. Edits are tracked locally (dirty markers) and
applied on "Save". `enableInlineEditing` enables double-click / F2 to edit;
the wrapper exposes the cell-edit life-cycle through the API.

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

- `api.getData(...)`

## How to use this prompt

Drop this file into your LLM's context window when asking it to
generate code matching this pattern. The MCP server exposes the
same content via the `listDemos` tool. See
[LLM grounding](../../../docs/help/llm-grounding.md) for details.
