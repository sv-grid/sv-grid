# Prompt: 64-filter-between-operator

Source: `examples/src/demos/64-filter-between-operator.svelte`
Live:   https://svgrid.com/demos/64-filter-between-operator/

## What this demo proves

64. Filter - `between` operator
------------------------------
The column-menu filter UI exposes a `between` operator for number
and date columns. It renders two inputs (`From` / `To`); the engine
keeps rows whose value is in `[from, to]` inclusive.

Drive it from the menu (three dots on a column header) or
imperatively via:

  api.setFilter('price', { operator: 'between', value: '100', valueTo: '500' })

`api.getFilters()` round-trips the same `{ operator, value, valueTo }`
shape so you can save filter sets to localStorage / URL params.

Text columns deliberately do not have a `between` operator (it's
rarely what users mean for strings).

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

- `api.getFilters(...)`
- `api.setFilter(...)`

## How to use this prompt

Drop this file into your LLM's context window when asking it to
generate code matching this pattern. The MCP server exposes the
same content via the `listDemos` tool. See
[LLM grounding](../../../docs/help/llm-grounding.md) for details.
