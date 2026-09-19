# Prompt: 477-gantt-resources
<!-- hand-written: keep -->

Source: `examples/src/demos/477-gantt-resources.svelte`
Live:   https://svgrid.com/demos/477-gantt-resources/

## What this demo proves

477. Resource load & a folded axis (Enterprise Gantt Pro)
---------------------------------------------------------
A field-service quarter, where the question is not "when" but
"who, and are they double-booked":

  1. **The histogram is per column, not per task.** One row per
     crew, one bar per axis column, counting the jobs that
     overlap it. On a day or week axis that is concurrency.

  2. **Only leaves count.** A phase is its children, so counting
     it too would book its owner twice for the same work.

  3. **Capacity is per resource.** A two-van crew takes two jobs
     at once; one person does not. Same strip, different ceiling,
     and only what is over it turns red.

  4. **Folding the axis changes the axis only.** Each run of
     non-working days shrinks to a hatched marker; working days
     keep their real width, and a bar that runs over a folded
     weekend still draws across it.

## Config shape

```ts
import type { GanttProConfig } from '@svgrid/enterprise'

const cfg: GanttProConfig<any, Job> = {
  startField: 'start', endField: 'end', parentField: 'parentId',
  progressField: 'progress',

  resourceField: 'crew',
  resources: [
    { id: 'North crew', title: 'North crew', capacity: 2 },
    { id: 'Specialist', title: 'Specialist', capacity: 1 },
  ],
  resourceHistogram: { capacityField: 'capacity', height: 96 },

  collapseWeekends: true,
  collapsedGapPx: 10,   // 0 removes the folded days outright
}
```

Omit `resources` and the strip's rows come from the data, in the
order the tasks first name them.

## Using the model directly

Both pieces are pure functions, so a report or a test can call
them without rendering anything:

```ts
import { resourceLoad, overallocations, ganttScale } from '@svgrid/enterprise'

const load = resourceLoad(assignments, columns, { capacityOf })
overallocations(load)          // ids of the crews that are over somewhere

const scale = ganttScale(from, to, 1400, {
  collapsed: (d) => d.getDay() === 0 || d.getDay() === 6,
})
scale.totalPx                  // the chart's width once folded
scale.xOf(someDate)            // and its date <-> pixel mapping
```

## How to use this prompt

Drop this file into your LLM's context window when asking it to
generate code matching this pattern. The MCP server exposes the
same content via the `listDemos` tool. See
[LLM grounding](../../../docs/help/llm-grounding.md) for details.
