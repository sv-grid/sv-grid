# Prompt: 97-side-drawer-edit

Source: `examples/src/demos/97-side-drawer-edit.svelte`
Live:   https://svgrid.com/demos/97-side-drawer-edit/

## What this demo proves

97. Side-drawer edit form
-------------------------
The Linear / Notion pattern: click a row, a polished form slides in
from the right with every field, atomic Save / Cancel, dirty-state
indicator, validation summary, and keyboard escape. The grid is the
"list" view; the drawer is the "detail" view - lighter weight than
a full master/detail page, more useful than inline editing for
records with > 4-5 fields.

The drawer's editor is just plain Svelte - it mutates a draft copy
of the record, then commits on Save by replacing the corresponding
grid row.

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
