# Prompt: 43-compliance-queue

Source: `examples/src/demos/43-compliance-queue.svelte`
Live:   https://svgrid.dev/#/demos/43-compliance-queue

## What this demo proves

43. Compliance / regulatory queue
---------------------------------
Submissions waiting on review, sorted by SLA age. The view a
compliance officer would live in during the work day - every
column reinforces "this is the regulated record of record":

  - **SLA badge** turns yellow at 50 % of remaining time, orange
    at 80 %, red at breach. Updates live via a 30-second tick.

  - **Workflow column** is editable only by roles whose approver
    level matches the case's current step. Lower levels see it
    locked, upper levels see it open - same pattern as the
    permissions demo, narrowed to one column.

  - **Approver chain** shows L1 / L2 / L3 with a ✓ stamp once
    each level has signed off and an empty seat once a level is
    blocked / pending.

  - **Immutable history popover** opens when you click a case
    id. Every status change in the case's lifetime appears in
    order, oldest first, with the actor + a timestamp the
    officer can quote in a regulatory audit response.

A "Submit / Reject / Return" toolbar lets the current role act
on the selected case - the actions are gated to match how a real
approval workflow would behave (only your level can advance to
the next; reject ends the case; return sends it back a level).

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
