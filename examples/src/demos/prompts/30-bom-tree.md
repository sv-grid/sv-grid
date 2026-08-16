# Prompt: 30-bom-tree

Source: `examples/src/demos/30-bom-tree.svelte`
Live:   https://svgrid.com/demos/30-bom-tree/

## What this demo proves

30. Bill of Materials - cost roll-up tree
-----------------------------------------
A bicycle BOM with 4 levels of nesting: the finished product breaks
down into assemblies (frame, wheels, drivetrain...), which break
down into sub-assemblies, which break down into individual parts.

Every NON-LEAF row's `quantity` is "1 per parent" and its
`unitCost` + `subtotal` are roll-ups: subtotal = sum(child.subtotal).
Leaf parts have an explicit quantity and unit cost. Change a leaf's
quantity (double-click) and the entire ancestor chain recomputes.

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
