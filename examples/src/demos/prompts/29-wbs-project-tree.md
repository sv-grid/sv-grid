# Prompt: 29-wbs-project-tree

Source: `examples/src/demos/29-wbs-project-tree.svelte`
Live:   https://svgrid.com/demos/29-wbs-project-tree/

## What this demo proves

29. WBS - Work Breakdown Structure
----------------------------------
Project plan tree: PHASE -> TASK -> SUBTASK. The interesting bit is
the `% complete` rollup - leaf tasks have a user-entered percent,
and every ancestor's percent is derived as the weighted average of
its descendants (weighted by `effort` in person-days). Owner + due
date + status round out the schema.

Editing is on for the leaf rows only - try double-clicking a
subtask's "% complete" and watch the parent task / phase percentages
recompute as you commit.

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
