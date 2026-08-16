# Prompt: 82-conditional-form-schema

Source: `examples/src/demos/82-conditional-form-schema.svelte`
Live:   https://svgrid.com/demos/82-conditional-form-schema/

## What this demo proves

82. Conditional form schema
---------------------------
Declarative schema-driven field visibility and editability inside a
grid. Each column carries a `when` rule (or array of rules); the
runtime evaluates the rules against the row's current values and:

  - hides cells whose `visible.when` fails
  - disables editing on cells whose `editable.when` fails
  - shows a contextual reason ("locked: status is not 'pending'")

The pattern: instead of imperative checks scattered across columns,
define WHEN a field applies; SvGrid's `editable: (ctx) => boolean`
already supports per-cell rules - this demo layers a declarative
schema on top so designers can hand-tune workflows without touching
rendering code.

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

## How to use this prompt

Drop this file into your LLM's context window when asking it to
generate code matching this pattern. The MCP server exposes the
same content via the `listDemos` tool. See
[LLM grounding](../../../docs/help/llm-grounding.md) for details.
