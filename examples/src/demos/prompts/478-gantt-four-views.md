# Prompt: 478-gantt-four-views
<!-- hand-written: keep -->

Source: `examples/src/demos/478-gantt-four-views.svelte`
Live:   https://svgrid.com/demos/478-gantt-four-views/

## What this demo proves

478. One plan, four views: Grid, Gantt, Scheduler, Kanban
--------------------------------------------------------
One `<SvGrid>`, one array of rows, four renderers behind a
switch. Each view is the same grid with one prop - `gantt`,
`scheduler`, `board`, or none for the table - and every view
writes back through a callback to the same rows, so an edit in
one is the next one's data.

  1. **The switch is a prop.** `data`, `columns` and `getRowId`
     are shared; only the view prop changes.

  2. **Callbacks, never mutation.** `onCellValueChange`,
     `onTaskMove`, `onEventMove`, `onCardMove`: the view asks,
     the app writes the row.

  3. **One date shape.** Local timestamps with an exclusive end
     (`'2026-09-14T00:00'`). A date-only string is a calendar
     day to the Gantt and UTC midnight to the scheduler.

  4. **Phases and milestones are Gantt-only rows.** The other
     views get `rows.filter((r) => r.kind === 'task')`.

## Config shape

```ts
type Row = {
  id: string; name: string; kind: 'phase' | 'task' | 'milestone'
  phase: string; parentId: string | null; owner: string
  status: 'Backlog' | 'In progress' | 'Review' | 'Done'
  start: string; end: string   // local ISO, end exclusive
  progress: number; allDay: boolean; color: string
}

// Gantt: every row
gantt={{ startField: 'start', endField: 'end', parentField: 'parentId',
  milestoneField: 'milestone', progressField: 'progress', dependencies,
  editable: true, onTaskMove, onTaskResize, onProgressChange, onDependenciesChange }}

// Scheduler: the tasks, one lane per owner
scheduler={{ startField: 'start', endField: 'end', allDayField: 'allDay',
  resourceField: 'owner', resources, views: ['timelineWeek', 'timelineMonth'],
  editable: true, onEventMove, onEventResize }}

// Kanban: the tasks, one lane per status
board={{ groupBy: 'status', lanes, editable: true, onCardMove, card }}
```

## How to use this prompt

Drop this file into your LLM's context window when asking it to
generate code matching this pattern. The MCP server exposes the
same content via the `listDemos` tool. See
[LLM grounding](../../../docs/help/llm-grounding.md) for details.
