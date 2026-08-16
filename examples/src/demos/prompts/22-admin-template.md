# Prompt: 22-admin-template

Source: `examples/src/demos/22-admin-template.svelte`
Live:   https://svgrid.com/demos/22-admin-template/

## What this demo proves

22. Admin template
------------------
A compact replica of the full SvGrid Admin Template, in one file so
you can read it end-to-end. Sidebar nav + seven pages:
  - Dashboard: KPI cards + a small recent-orders grid
  - Orders:    5,000 rows + the full Pro export bar
  - Customers: 200 rows with inline editing on every column
  - Products:  inventory catalog with stock-level badges + category filter
  - Users:     team roster with role pills + last-login
  - Reports:   region rollups + revenue sparkline + period picker
  - Settings:  tabbed form (general / billing / integrations)

All styles are scoped to .sg-admin-shell so this demo doesn't bleed
tokens into the gallery chrome.

## Imports

```ts
```

## Registered features

```ts
const features = tableFeatures({
  rowSortingFeature,
  columnFilteringFeature,
  rowSelectionFeature,
  rowPaginationFeature,
})
```

## How to use this prompt

Drop this file into your LLM's context window when asking it to
generate code matching this pattern. The MCP server exposes the
same content via the `listDemos` tool. See
[LLM grounding](../../../docs/help/llm-grounding.md) for details.
