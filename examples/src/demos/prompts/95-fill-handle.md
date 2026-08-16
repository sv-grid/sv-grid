# Prompt: 95-fill-handle

Source: `examples/src/demos/95-fill-handle.svelte`
Live:   https://svgrid.com/demos/95-fill-handle/

## What this demo proves

95. Excel-style fill handle
---------------------------
The grid ships with a corner fill handle on the active cell-range -
the same green square Excel and Google Sheets render. Drag it over
neighbouring cells to extend the range; the engine auto-detects what
to do:

  - 1 source cell        → copy that value
  - Numeric progression  → continue the series (10, 20 → 30, 40, 50)
  - Date / day sequence  → next dates / weekdays
  - Otherwise            → repeat the source values cyclically

No prop wiring is required - just `enableCellSelection`. This demo
walks through every case with explicit "do this then drag the handle"
captions so evaluators see the feature exists.

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

- `api.getSelected(...)`

## How to use this prompt

Drop this file into your LLM's context window when asking it to
generate code matching this pattern. The MCP server exposes the
same content via the `listDemos` tool. See
[LLM grounding](../../../docs/help/llm-grounding.md) for details.
