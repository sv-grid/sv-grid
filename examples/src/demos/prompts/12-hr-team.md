# Prompt: 12-hr-team

Source: `examples/src/demos/12-hr-team.svelte`
Live:   https://svgrid.com/demos/12-hr-team/

## What this demo proves

12. HR team directory
---------------------
A directory of ~80 employees with the columns an HR app actually needs:
person (avatar + name), title, level, team, manager, location, start
date, tenure, status, comp.

Showcases:
  - `columnGroupingFeature` with a default group-by ("team")
  - `renderSnippet` for the avatar cell and status badge
  - A derived `tenure` column (no `field` - `fieldFn`)
  - Sort by any column; group rows fold to a summary line

## Imports

```ts
```

## Registered features

```ts
const features = tableFeatures({
  rowSortingFeature,
  columnFilteringFeature,
  columnGroupingFeature,
  rowExpandingFeature,
})
```

## SvGridApi methods called

- `api.setGroupBy(...)`

## How to use this prompt

Drop this file into your LLM's context window when asking it to
generate code matching this pattern. The MCP server exposes the
same content via the `listDemos` tool. See
[LLM grounding](../../../docs/help/llm-grounding.md) for details.
