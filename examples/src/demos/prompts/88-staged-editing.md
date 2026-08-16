# Prompt: 88-staged-editing

Source: `examples/src/demos/88-staged-editing.svelte`
Live:   https://svgrid.com/demos/88-staged-editing/

## What this demo proves

88. Staged / batch editing - compensation review (Pro)
------------------------------------------------------
Real-world scenario: comp review cycle. HR opens the grid with
proposed salary + bonus + level changes. Each edit goes into a
draft buffer instead of writing through; the right rail shows the
pending diff per employee with totals + the cost impact. The user
commits the whole batch atomically (one server roundtrip) or
reverts to the original snapshot.

Built on `createStagedEditing<TData>()` from @svgrid/enterprise. The grid
surface is plain SvGrid - the staging engine sits next to it.

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

- `api.setCellValue(...)`

## How to use this prompt

Drop this file into your LLM's context window when asking it to
generate code matching this pattern. The MCP server exposes the
same content via the `listDemos` tool. See
[LLM grounding](../../../docs/help/llm-grounding.md) for details.
