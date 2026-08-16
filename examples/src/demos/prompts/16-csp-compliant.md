# Prompt: 16-csp-compliant

Source: `examples/src/demos/16-csp-compliant.svelte`
Live:   https://svgrid.com/demos/16-csp-compliant/

## What this demo proves

16. CSP-compliant grid
----------------------
SvGrid does not use `eval`, `new Function(...)`, inline `<script>` tags,
or injected inline event handlers - so it runs cleanly under a strict
Content Security Policy. This demo:

  1. Documents the recommended CSP header that lets the grid render +
     stay fully interactive.
  2. Runs a CSP self-check at mount time. We try to construct a
     function via `new Function(...)` (the headline thing a strict CSP
     blocks). The result tells you whether the page's *current* policy
     allows it.
  3. Listens for `securitypolicyviolation` events for the lifetime of
     this section and displays them in a log - if the grid (or anything
     else inside this section) breaks the policy, you'll see it here.
  4. Renders a fully-featured grid below to prove every feature works
     under the documented CSP.

## Imports

```ts
```

## Registered features

```ts
const features = tableFeatures({
  rowSortingFeature,
  columnFilteringFeature,
  rowSelectionFeature,
})
```

## How to use this prompt

Drop this file into your LLM's context window when asking it to
generate code matching this pattern. The MCP server exposes the
same content via the `listDemos` tool. See
[LLM grounding](../../../docs/help/llm-grounding.md) for details.
