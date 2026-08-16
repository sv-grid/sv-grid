# Prompt: 17-accessibility

Source: `examples/src/demos/17-accessibility.svelte`
Live:   https://svgrid.com/demos/17-accessibility/

## What this demo proves

17. Accessibility
-----------------
SvGrid ships with the WAI-ARIA grid pattern built in:

  - role="grid" / role="row" / role="columnheader" / role="gridcell"
    are applied through the helpers in `src/a11y.ts`.
  - `aria-rowcount` / `aria-colcount` reflect the visible model.
  - Each row + cell gets an `aria-rowindex` / `aria-colindex`.
  - The active cell carries the focus and DOM `id`. Headers expose
    `aria-sort="ascending|descending|none"`.
  - Arrow keys move between cells. Home/End jump to row edges.
    Page Up/Down move by a page. F2 / Enter starts editing.
    Ctrl+Home / Ctrl+End jump to the grid edges.

This demo adds:

  - A live `role="status"` region that announces sort / filter /
    selection changes to screen readers.
  - A "Show ARIA state" panel that surfaces the values a screen
    reader would read for the active cell.
  - A high-contrast focus outline you can toggle.
  - A keyboard-shortcut cheat sheet pinned to the side.

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

## How to use this prompt

Drop this file into your LLM's context window when asking it to
generate code matching this pattern. The MCP server exposes the
same content via the `listDemos` tool. See
[LLM grounding](../../../docs/help/llm-grounding.md) for details.
