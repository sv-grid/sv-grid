# Prompt: 85-tooltips-and-notes

Source: `examples/src/demos/85-tooltips-and-notes.svelte`
Live:   https://svgrid.com/demos/85-tooltips-and-notes/

## What this demo proves

85. Tooltips and per-cell notes
-------------------------------
Two complementary annotation layers:

  - Column-level `tooltip` (static string OR `(ctx) => string`)
    renders as a native `title=` so hovering ANY cell in that
    column shows the same explanation.

  - Per-cell `notes` (a `{ [rowId]: { [columnId]: string } }` prop
    on `<SvGrid responsive={true}>`) paints a corner indicator + makes the note
    text the hover tooltip. You own storage; the grid renders
    the indicator.

Click the "+ note" button on any selected cell to add / edit /
delete one; the note round-trips through plain state, so a real
app saves them via your `/api/notes` endpoint.

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
