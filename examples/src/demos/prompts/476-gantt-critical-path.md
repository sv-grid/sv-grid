# Prompt: 476-gantt-critical-path
<!-- hand-written: keep -->

Source: `examples/src/demos/476-gantt-critical-path.svelte`
Live:   https://svgrid.com/demos/476-gantt-critical-path/

## What this demo proves

476. Critical path & baselines (Enterprise Gantt Pro)
------------------------------------------------------
A fit-out schedule with the planning layer on.

  1. **Critical path.** A forward pass gives each task its
     earliest start, a backward pass its latest; where they
     match there is no slack, and that chain sets the finish.
     Those bars and the arrows between them are ringed red.

  2. **Slack is a column.** `__slack` needs no definition and
     reads the days of room off the same pass.

  3. **A task in no link is never critical.** It is not on a
     path, so calling it critical would point at something the
     schedule does not turn on - even if it finishes last.

  4. **Baselines.** `baselineStartField` / `baselineEndField`
     draw a ghost bar under each task. Late against it and the
     ghost turns red; the tooltip gives the variance in days.

  5. **Constraints.** `SNET` pins a start, `FNLT` caps a finish.
     A cascade stops AT the cap and leaves the link drawn as
     unsatisfied, because a constraint and a dependency that
     disagree have no schedule satisfying both.

## Config shape

```ts
import type { GanttProConfig } from '@svgrid/enterprise'

const cfg: GanttProConfig<any, Task> = {
  startField: 'start', endField: 'end', parentField: 'parentId',
  progressField: 'progress', dependencies,
  tableColumns: ['name', 'trade', '__duration', '__slack'],

  criticalPath: true,
  onCriticalPathChange: (keys) => (criticalKeys = keys),
  baselineStartField: 'bStart',
  baselineEndField: 'bEnd',
  constraintField: 'con',        // 'SNET' | 'SNLT' | 'FNET' | 'FNLT' | 'MSO' | 'MFO'
  constraintDateField: 'conDate',
}
```

`GanttProConfig` is structurally assignable to the free grid's
`gantt` prop, so these extra fields type-check without the grid
knowing about them.

## Using the model directly

The pass is a pure function, so a report or a test can call it
without rendering anything:

```ts
import { criticalPath, slackDays } from '@svgrid/enterprise'

const result = criticalPath(times, dependencies)
result.critical            // Set<string> of task ids
result.finish              // the earliest the project can end
slackDays(result, 'task-7') // whole days of room
```

## How to use this prompt

Drop this file into your LLM's context window when asking it to
generate code matching this pattern. The MCP server exposes the
same content via the `listDemos` tool. See
[LLM grounding](../../../docs/help/llm-grounding.md) for details.
