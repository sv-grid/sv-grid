# Prompt: 28-org-chart-tree

Source: `examples/src/demos/28-org-chart-tree.svelte`
Live:   https://svgrid.dev/#/demos/28-org-chart-tree

## What this demo proves

28. Org chart - tree grid
-------------------------
Five-level employee hierarchy (CEO -> VPs -> Directors -> Managers -> ICs)
rendered as an expand/collapse tree. The first column is a custom
cell template that indents by depth, draws connector lines between
parents and children, and rotates an SVG chevron on expand. The
other columns are regular SvGrid columns. Role pill, department,
headcount rollup (sum of descendants), and tenure round it out.

Pattern: keep a flat `allPeople` array plus an `expanded` map; the
visible row list is derived. The grid never has to know about the
hierarchy directly.

## Imports

```ts
```

## Registered features

```ts
const features = tableFeatures({
  rowSortingFeature,
})
```

## How to use this prompt

Drop this file into your LLM's context window when asking it to
generate code matching this pattern. The MCP server exposes the
same content via the `listDemos` tool. See
[LLM grounding](../../../docs/help/llm-grounding.md) for details.
