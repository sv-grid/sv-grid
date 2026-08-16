# Prompt: 65-keyboard-shortcuts

Source: `examples/src/demos/65-keyboard-shortcuts.svelte`
Live:   https://svgrid.com/demos/65-keyboard-shortcuts/

## What this demo proves

65. Keyboard shortcuts + ARIA grid pattern
-----------------------------------------
  - `Ctrl/Cmd+K` open / close the command palette
  - `Ctrl/Cmd+/` toggle the keyboard cheat sheet
  - `g g`        jump to the first row (vim chord)
  - `G`          jump to the last row
  - `Esc`        close any open overlay

Overlays use plain `position: fixed` with z-index 9999 (no portals)
so they always render even when an ancestor creates a stacking
context. The document keydown listener bails when the target is a
text input, so typing "g" in the palette doesn't trigger the chord.

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

- `api.clearAllFilters(...)`

## How to use this prompt

Drop this file into your LLM's context window when asking it to
generate code matching this pattern. The MCP server exposes the
same content via the `listDemos` tool. See
[LLM grounding](../../../docs/help/llm-grounding.md) for details.
