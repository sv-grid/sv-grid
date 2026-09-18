# Prompt: 474-gantt-intro

Source: `examples/src/demos/474-gantt-intro.svelte`
Live:   https://svgrid.com/demos/474-gantt-intro/

## What this demo proves

474. Project plan (Enterprise Gantt)
------------------------------------
A 14-week software release as a Gantt: the task table on the
left, the time chart on the right, one bar per grid row.

Things this demo proves SvGrid can do:

  1. **One prop turns the grid into a Gantt.** `gantt={{ startField,
     endField, parentField, progressField }}` and the table becomes
     a plan. The `gantt` prop ships in the free grid; the renderer
     is `@svgrid/enterprise` via `enableGanttView()`.

  2. **Phases are rows, not a second data shape.** `parentField`
     nests the flat rows into a work-breakdown tree. A row with
     children draws a rolled-up summary bar, so a phase carries no
     dates of its own and nothing has to be kept in sync by hand.

  3. **Summary progress is weighted by duration.** Two days at
     100% beside six days at 0% is 25% done, not 50%. Weighting by
     task count reports progress the plan has not made.

  4. **Dependencies draw as arrows.** Finish-to-start links, with a
     violated one drawn dashed and red. Collapse a phase and any
     arrow into it re-points at the summary bar.

  5. **It is a view of the grid.** Toggle to the Table for the same
     rows; the search box filters both, because the Gantt draws
     whatever the grid hands it and never filters itself.

## Imports

```ts
import { SvGrid, type ColumnDef, type GanttConfig, type GanttDependency } from '@svgrid/grid'
import { enableGanttView, setLicenseKey } from '@svgrid/enterprise'
```

## Config shape

```ts
const ganttCfg: GanttConfig<any, Task> = {
  startField: 'start',
  endField: 'end',
  titleField: 'name',
  progressField: 'progress',
  parentField: 'parentId',
  milestoneField: 'milestone',
  colorField: 'color',
  tableColumns: ['name', 'owner', '__duration', '__progress'],
  dependencies,
  zoom: 'week',
  weekStartsOn: 1,
  tooltip: true,
}
```

`__duration` and `__progress` are built-in table columns: they need
no column definition, and read working days and percent off the
resolved bar.

## Date conventions worth copying

- Days are local calendar days.
- `end` is exclusive, EXCEPT a date-only string (`'2026-09-16'`),
  which is inclusive of that day. So `start: '2026-09-14', end:
  '2026-09-16'` is a three-day task.
- A row with a start but no end or duration is a milestone.

## How to use this prompt

Drop this file into your LLM's context window when asking it to
generate code matching this pattern. The MCP server exposes the
same content via the `listDemos` tool. See
[LLM grounding](../../../docs/help/llm-grounding.md) for details.
