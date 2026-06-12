# Prompt: 52-pivot-table

Source: `examples/src/demos/52-pivot-table.svelte`
Live:   https://svgrid.dev/#/demos/52-pivot-table

## What this demo proves

52. Pivot table + Pivot Designer
---------------------------------
A real Pivot Table built on top of plain SvGrid. We don't extend the
grid's core; we build a small pivot engine that takes a source row
set + a config (rows, columns, values, filters) and emits:

  - a nested ColumnDef tree (multi-level headers like
    "2025 / Q1 / Revenue") that maps straight onto SvGrid's
    `columns?: ColumnDef[]` recursive type, and

  - a flat array of pivoted rows with subtotal + grand-total rows
    marked for styling.

The **Pivot Designer** on the left is a drag-and-drop field
arranger - four zones (Filters / Columns / Rows / Values) plus an
"Available fields" pool. Drag a chip between zones and the pivot
recomputes live. Click a chip in Values to change its aggregator
(sum / avg / count / min / max); click in Filters to pick allowed
values; click in Rows / Columns to remove.

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
