# Prompt: 05-inline-editing

Source: `examples/src/demos/05-inline-editing.svelte`
Live:   https://svgrid.com/demos/05-inline-editing/

## What this demo proves

05. Inline editing
------------------
Typed editors per column with a professional save/reset workflow.
Department uses a list dropdown; Country uses a list with the seed's
country codes; status is a list of three values. Edits are tracked
locally (dirty markers) and applied on "Save".

What this demo shows:
  - Per-column `editorType` selection - text / number / date / list /
    checkbox - plus formatted display values.
  - Live dirty-cell + dirty-row counts surfaced in a KPI strip.
  - Save / Reset controls disabled until something changes; clicking
    Save persists the edits into the local "server" snapshot so the
    dirty markers clear and Reset goes back to the last save point.

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
