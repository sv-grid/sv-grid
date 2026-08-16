# Prompt: 92-nl-filter-bar

Source: `examples/src/demos/92-nl-filter-bar.svelte`
Live:   https://svgrid.com/demos/92-nl-filter-bar/

## What this demo proves

92. Natural-language filter bar
-------------------------------
Type a sentence ("EMEA Q3 over 100k", "active sales rep starting with A
younger than 35"); a deterministic mini-parser maps it to a chain of
`api.setFilter(columnId, ...)` calls plus an optional `setSort`.

The parser is rule-based, not ML-driven, so it stays fast, predictable,
and works offline. The same shape (token → intent → filter) is what
you'd hand to an LLM to JSON-out instead - swap the parser body for a
fetch and the rest of the wiring stays identical.

Supported phrasing:
  - "over 100k", "less than 50", "between 100 and 200"
  - "before 2026-06-01", "after Jan 1", "this month", "Q2"
  - "EMEA", "active", "engineering" (matches set-filter values)
  - "starting with A", "containing 'ada'"
  - "sort by salary desc" / "highest amount" / "lowest age"
  - "top 5 by salary", "top 10"

Tokens that don't resolve into a column drop into a generic "search"
filter on the title-like columns.

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
- `api.clearSort(...)`
- `api.setFilter(...)`
- `api.setSort(...)`

## How to use this prompt

Drop this file into your LLM's context window when asking it to
generate code matching this pattern. The MCP server exposes the
same content via the `listDemos` tool. See
[LLM grounding](../../../docs/help/llm-grounding.md) for details.
