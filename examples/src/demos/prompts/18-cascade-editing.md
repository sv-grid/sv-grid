# Prompt: 18-cascade-editing

Source: `examples/src/demos/18-cascade-editing.svelte`
Live:   https://svgrid.com/demos/18-cascade-editing/

## What this demo proves

18. Cascade editing (linked list editors)
-----------------------------------------
Classic dependent-dropdown pattern: pick a Region and the Country
editor's options narrow to that region; pick a Country and the City
options narrow further (and Currency auto-fills from the country).

Two pieces of machinery do this:

  1. `editorOptions` accepts a `(row) => options` function. The
     grid evaluates it whenever the editor opens, so the Country
     column sees the row's current Region and returns the right
     list. Same for City -> Country.

  2. `onCellValueChange` cascades the new value forward. When a
     Region changes, we use the api to reset Country / City to a
     valid default for that region (otherwise the old country
     would remain visible even though it's no longer valid).

Bottom row shows column totals - Quantity and Unit price use
`format` so the summary reads "$1,234.50", not "1234.5".

## Imports

```ts
```

## Registered features

```ts
const features = tableFeatures({
  rowSortingFeature,
})
```

## SvGridApi methods called

- `api.setCellValue(...)`

## How to use this prompt

Drop this file into your LLM's context window when asking it to
generate code matching this pattern. The MCP server exposes the
same content via the `listDemos` tool. See
[LLM grounding](../../../docs/help/llm-grounding.md) for details.
