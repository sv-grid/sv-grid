# Prompt: 53-excel-import

Source: `examples/src/demos/53-excel-import.svelte`
Live:   https://svgrid.dev/#/demos/53-excel-import

## What this demo proves

53. Excel / CSV / TSV / JSON import (Pro)
------------------------------------------
Schema-free importer. Pick a file (or paste text), the grid figures
out the source headers, the user fine-tunes the mapping + types +
which columns to skip, the parser produces a preview with
per-cell typed coercion + per-row validation errors, and the
commit button appends the rows into a grid whose columns were
auto-derived from the parsed shape.

Works with any data you throw at it - Orders, bank statements,
exported lookup tables, JSON arrays - because there's no
hardcoded target schema. The mapping panel lets you rename a
column, pick its type, or drop it; the grid below renders only
what the user kept.

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
