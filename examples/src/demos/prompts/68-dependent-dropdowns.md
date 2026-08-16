# Prompt: 68-dependent-dropdowns

Source: `examples/src/demos/68-dependent-dropdowns.svelte`
Live:   https://svgrid.com/demos/68-dependent-dropdowns/

## What this demo proves

68. Smart dependent dropdowns - cascade + typeahead + invalid recovery
---------------------------------------------------------------------
Production-quality cascade editor for Country → State → City:

  - Typeahead inside each combobox. Filter narrows the option list
    as you type; arrow keys + Enter pick a value.
  - Editing Country resets State + City to a sensible default
    (the first valid option). Editing State resets City.
  - If the cascade is left in an inconsistent state (e.g. seed data
    where the city no longer belongs to the country), the cell turns
    amber and a one-click "Fix" repair button suggests a valid value.

The combobox itself is rendered as a custom `cell` snippet so the
editor and the display are the same element - no edit-mode flicker.

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
