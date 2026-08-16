# Prompt: 24-validation

Source: `examples/src/demos/24-validation.svelte`
Live:   https://svgrid.com/demos/24-validation/

## What this demo proves

24. Validation while editing
----------------------------
Per-column validators that run on every commit. Invalid edits are
rolled back via api.setCellValue(rowIndex, columnId, oldValue), the
cell flashes red briefly, and the rejection is logged in the
"Recent rejections" panel.

SvGrid v1.0 does not yet have a per-column `validate()` hook (it's on
the missing-features list). The pattern below - validate in
onCellValueChange + roll back via setCellValue - is the production
workaround. The same shape will adapt cleanly when the built-in hook
lands.

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

- `api.setCellValue(...)`

## How to use this prompt

Drop this file into your LLM's context window when asking it to
generate code matching this pattern. The MCP server exposes the
same content via the `listDemos` tool. See
[LLM grounding](../../../docs/help/llm-grounding.md) for details.
