# Prompt: 54-columns-hierarchy

Source: `examples/src/demos/54-columns-hierarchy.svelte`
Live:   https://svgrid.com/demos/54-columns-hierarchy/

## What this demo proves

54. Columns hierarchy + manager
--------------------------------
A real production pattern for grids with too many columns to fit
comfortably on screen. The left panel exposes the column tree
itself: every group has a chevron + checkbox, every leaf has a
checkbox. Toggle a group's chevron to "collapse it into a single
summary column" - the children disappear from the grid, replaced
by one synthetic column showing the group's most-load-bearing
value. Toggle a checkbox to hide / show a leaf or an entire
subtree.

What the demo proves:

  1. **Real nested column-group headers** - the grid renders one
     `<tr>` per depth, with proper colSpan. Same machinery the
     pivot demo uses.

  2. **Dynamic column trees.** The columns prop is a $derived
     computed from a small `treeState` $state. Every checkbox
     and chevron in the side panel triggers a re-derivation; the
     grid swaps its column tree in place.

  3. **Group "summary" columns.** When a group is collapsed,
     rather than hiding it outright, the demo emits one synthetic
     column with a summary cell snippet. This is the pattern
     every reporting grid eventually wants.

  4. **Reorder via the side panel.** Drag a leaf chip between
     siblings within a group; the column order updates live.

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
