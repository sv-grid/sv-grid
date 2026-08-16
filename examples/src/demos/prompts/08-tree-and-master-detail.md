# Prompt: 08-tree-and-master-detail

Source: `examples/src/demos/08-tree-and-master-detail.svelte`
Live:   https://svgrid.com/demos/08-tree-and-master-detail/

## What this demo proves

08. Tree data + master/detail
-----------------------------
The community build does not (yet) ship a dedicated tree-data row model,
so this demo flattens a synthetic file tree by hand and indents the
"name" column based on the row's depth. Expansion is toggled via the
row-expanding feature.

The lower grid demonstrates master/detail by mounting a second
`<SvGrid responsive={true}>` instance keyed to the selected master row.

## Imports

```ts
```

## Registered features

```ts
const features = tableFeatures({
  rowSortingFeature,
  rowExpandingFeature,
})
```

## How to use this prompt

Drop this file into your LLM's context window when asking it to
generate code matching this pattern. The MCP server exposes the
same content via the `listDemos` tool. See
[LLM grounding](../../../docs/help/llm-grounding.md) for details.
