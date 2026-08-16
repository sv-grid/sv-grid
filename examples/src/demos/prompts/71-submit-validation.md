# Prompt: 71-submit-validation

Source: `examples/src/demos/71-submit-validation.svelte`
Live:   https://svgrid.com/demos/71-submit-validation/

## What this demo proves

71. Submit-time validation
--------------------------
Different from per-keystroke validation (demo 24). Here the user
edits freely and clicks "Submit" - the grid then runs a row-level
validator. Invalid rows are highlighted and listed in an errors
panel; the form blocks submission until every row passes.

Pattern: keep a `pending` map of unresolved edits; on Submit, run
the validator against the in-memory rows, derive `errors`, and only
push the payload to "the server" when `errors.length === 0`.

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
