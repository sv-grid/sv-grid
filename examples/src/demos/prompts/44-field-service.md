# Prompt: 44-field-service

Source: `examples/src/demos/44-field-service.svelte`
Live:   https://svgrid.dev/#/demos/44-field-service

## What this demo proves

44. Field service / dispatch board
----------------------------------
The dispatcher's daily view at a field-service company (HVAC,
telecom, utility, broadband). Every active job is a row sorted
by SLA. The board updates live as techs check in / out and as
customers move around their windows.

What the dispatcher does here:

  1. **Reassign a job.** Click the Tech cell, pick from the
     dropdown - gated by `editable: (ctx) => boolean` so jobs
     already marked "done" can't be re-assigned.

  2. **Bump priority.** Same story for the Priority cell:
     editable while the job is still open, locked once closed.

  3. **Read the timeline.** Each row's "Today" cell renders an
     inline status timeline: a striped bar marking
     received → en-route → on-site → resolved with the lengths
     of each segment proportional to the time spent in that
     state. Tells the dispatcher who is dwelling.

  4. **Watch tech capacity.** The right-hand panel shows each
     tech as a load gauge so over-loaded ones go red at a
     glance.

Live stream uses the same `createStreamSim` helper as demo #34
and #42 - emits status transitions and ETA shifts.

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
