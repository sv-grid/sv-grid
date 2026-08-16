# Prompt: 40-forms-master-detail

Source: `examples/src/demos/40-forms-master-detail.svelte`
Live:   https://svgrid.com/demos/40-forms-master-detail/

## What this demo proves

40. Forms-in-grid (master / detail edit)
----------------------------------------
The Salesforce / SAP pattern: a master grid on the left, a full
record-detail form on the right. Clicking a row loads it into the
form; editing any field updates the underlying record in real
time so the grid stays in lock-step.

Three production-feel pieces sit on top of the basic split view:

  1. **Tabbed sections.** A real record detail page rarely fits in
     one screen. Tabs (Profile / Billing / Contacts / Notes) keep
     the surface scrollable without forcing a 2,000-px form.

  2. **Dirty tracking + Save / Discard.** Every edit lives in a
     "draft" record. Commits apply atomically; Discard rolls back
     to the version the grid currently has. Useful for any record
     where a Submit step is meaningful.

  3. **Inline validation.** Email format, phone length, required
     fields - failures block Save and surface inline messages so
     the user knows what to fix.

Editing the form also writes through to the grid cell live, which
is what you'd want when forms-in-grid wraps a real-time backend:
other operators see the same record update as you type.

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
