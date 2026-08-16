# Prompt: 36-reporting-workspace

Source: `examples/src/demos/36-reporting-workspace.svelte`
Live:   https://svgrid.com/demos/36-reporting-workspace/

## What this demo proves

36. Reporting / analytics workspace
-----------------------------------
A sales pipeline through a reporting lens: group rows by one or
two dimensions, see live aggregates per numeric column, switch
aggregators (sum / avg / min / max / count), save the whole view
under a name, and restore it later from a sidebar.

What this demo proves to a buyer:

  1. **The grid IS the reporting surface.** Group-by is a built-in
     table feature, not a bolt-on. The same grid you use for ops
     becomes the pivot view by passing a `grouping` array.

  2. **Aggregators are configurable per column.** A revenue column
     probably wants `sum`, a probability column wants `avg`, a
     deal id wants `count`. The user picks per column inside the
     panel - no code change to add a new aggregator.

  3. **Saved views with localStorage persistence.** Three starter
     views ship by default ("Pipeline by region", "Owner
     performance", "Stage by region"). Users can save their own -
     named, time-stamped, restorable, removable. Built on the
     shared `createSavedViews` helper so other demos can reuse it.

  4. **Live KPI strip** recomputes whenever the grouping / filter
     state changes, so the workspace feels reactive instead of
     "click apply to refresh."

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
