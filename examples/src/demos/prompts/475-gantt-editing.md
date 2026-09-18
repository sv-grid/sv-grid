# Prompt: 475-gantt-editing

Source: `examples/src/demos/475-gantt-editing.svelte`
Live:   https://svgrid.com/demos/475-gantt-editing/

## What this demo proves

475. Plan editing (Enterprise Gantt)
------------------------------------
Demo 474's plan with `editable: true`, plus a log panel listing
every callback the view fires.

  1. **The view never mutates a row.** It moves its own overlay and
     reports what it wants. The log panel is the complete record,
     and each handler is what actually writes the row.

  2. **A phase moves its subtree.** One `onTaskMove` carries the
     batch in `subtree`, so the write-back is one pass.

  3. **Edges resize, the diamond sets percent.** `onTaskResize`
     says which edge moved; `onProgressChange` steps in 5s.

  4. **Links are drawn, not just declared.** Drag a bar's end dot
     onto another bar. The edges pick FS / SS / FF / SF. A cycle
     or a duplicate is refused with a flash, not an exception.

  5. **Auto-reschedule respects working time.** Move a predecessor
     and successors slide forward over weekends and the holiday.

  6. **Undo replays the callbacks.** `Ctrl+Z` re-fires them with
     the reversed values, cascade included, so the data follows.

## Editing config

```ts
const ganttCfg: GanttConfig<any, Task> = {
  startField: 'start', endField: 'end', parentField: 'parentId',
  progressField: 'progress', milestoneField: 'milestone',
  dependencies, holidays,
  respectWorkingTime: true,
  editable: true,
  history: true,
  drawer: true,
  onTaskMove: (e) => { write(e.row, e.start, e.end); for (const s of e.subtree ?? []) write(s.row, s.start, s.end) },
  onTaskResize: (e) => write(e.row, e.start, e.end),
  onProgressChange: (e) => { e.row.progress = e.progress },
  onDependenciesChange: (moves) => { for (const m of moves) write(byId(m.id), m.start, m.end) },
  onDependencyAdd: (dep) => { dependencies = [...dependencies, dep] },
  onTaskAdd: (start, end, parentId) => { /* push a row */ },
  onTaskDelete: (row) => { rows = rows.filter((r) => r !== row) },
  onTaskCommit: (e) => Object.assign(e.row, e.values),
}
```

## The write-back gotcha

`onTaskMove` / `onTaskResize` hand you an EXCLUSIVE `end`. If your
rows store an inclusive date-only finish (the usual shape), subtract
a day on the way back:

```ts
function writeSpan(row: Task, start: Date, end: Date) {
  row.start = iso(start)
  const last = new Date(end.getTime() - 86_400_000)
  row.end = iso(last < start ? start : last)
}
```

## Keyboard

Arrow left / right move a day, with Shift a week, with Alt stretch
the finish. `+` / `-` step progress. `Enter` opens the drawer,
`Delete` removes, `Escape` cancels a drag, `Ctrl+Z` /
`Ctrl+Shift+Z` undo and redo.

## How to use this prompt

Drop this file into your LLM's context window when asking it to
generate code matching this pattern. The MCP server exposes the
same content via the `listDemos` tool. See
[LLM grounding](../../../docs/help/llm-grounding.md) for details.
