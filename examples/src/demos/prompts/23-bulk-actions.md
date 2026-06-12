# Prompt: 23-bulk-actions

Source: `examples/src/demos/23-bulk-actions.svelte`
Live:   https://svgrid.dev/#/demos/23-bulk-actions

## What this demo proves

23. Bulk actions toolbar
------------------------
The Gmail / Linear / Asana pattern: when one or more rows is selected,
a sticky action bar slides in above the grid offering bulk operations
(mark, delete, export). Click "Clear" or uncheck rows to dismiss.

The wiring is small: onRowSelectionChange tells you which rows are
selected; the toolbar reads that array and dispatches mutations back
to the rows state.

## Imports

```ts
```

## Registered features

```ts
const features = tableFeatures({
  rowSortingFeature,
  columnFilteringFeature,
  rowSelectionFeature,
})
```

## SvGridApi methods called

- `api.clearRowSelection(...)`

## How to use this prompt

Drop this file into your LLM's context window when asking it to
generate code matching this pattern. The MCP server exposes the
same content via the `listDemos` tool. See
[LLM grounding](../../../docs/help/llm-grounding.md) for details.
