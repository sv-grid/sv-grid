# Prompt: 46-scheduler

Source: `examples/src/demos/46-scheduler.svelte`
Live:   https://svgrid.dev/#/demos/46-scheduler

## What this demo proves

46. Grid as a Scheduler
------------------------
Same playbook as the Gantt demo, smaller window: the wide cell is
a single-day timeline (07:00 - 20:00) and the rows are resources
(people on shift). Each resource has 0-N appointments laid out
by start / end. Click an appointment to load it into the side
detail panel; click an empty time slot to create a new one.

  1. **Per-resource timeline cell.** One absolutely-positioned
     block per appointment, sized by minutes-into-day. The grid
     itself does no time math - it just renders rows.

  2. **Now indicator.** A live red vertical line crosses every
     row at the current time; ticks every 30 seconds so the
     demo "moves" even with no interaction.

  3. **Click to select / edit.** Selected appointment is mirrored
     in a right-side detail card with editable title, type, time,
     and resource. Save flushes back into the row data - the
     grid is the source of truth, the form is a view.

  4. **KPI strip.** Booked hours, utilisation %, next-up - the
     stats every scheduler dashboard needs.

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
