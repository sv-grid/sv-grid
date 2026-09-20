# Gantt: editing

Set `editable` and the chart becomes a plan you can change. This page lists
every gesture, the callback it fires and what arrives in it, then the drawer,
the context menu, the keyboard and undo.

The view **never mutates your rows**. It moves its own overlay so the drag is
live, and reports what it wants through a callback; writing the row is yours.
That is what lets the same rows feed a table, a scheduler and a board without
any of them fighting over the data.

```svelte {preamble}
<script lang="ts">
  import { SvGrid, type GridColumns, type GanttDependency } from '@svgrid/grid'
  import { enableGanttView } from '@svgrid/enterprise'

  enableGanttView()

  type Task = {
    id: string
    name: string
    owner?: string
    start: string
    end?: string
    progress?: number
    parentId?: string | null
    milestone?: boolean
  }

  const pad = (n: number) => String(n).padStart(2, '0')
  const isoDay = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
  const base = new Date()
  base.setHours(0, 0, 0, 0)
  base.setDate(base.getDate() - ((base.getDay() + 6) % 7))
  const at = (dayOffset: number) => {
    const d = new Date(base)
    d.setDate(d.getDate() + dayOffset)
    return isoDay(d)
  }

  let data = $state<Task[]>([
    { id: 'p1', name: 'Discovery', parentId: null, start: at(0), owner: 'Priya' },
    { id: 't1', name: 'Interviews', parentId: 'p1', start: at(0), end: at(4), progress: 100, owner: 'Priya' },
    { id: 't2', name: 'Synthesis', parentId: 'p1', start: at(5), end: at(11), progress: 40, owner: 'Marco' },
    { id: 'p2', name: 'Build', parentId: null, start: at(12), owner: 'Sven' },
    { id: 't3', name: 'Implementation', parentId: 'p2', start: at(12), end: at(25), progress: 10, owner: 'Sven' },
    { id: 'm1', name: 'Launch', parentId: null, start: at(26), milestone: true },
  ])

  let dependencies = $state<GanttDependency[]>([
    { id: 'd1', from: 't1', to: 't2' },
    { id: 'd2', from: 't2', to: 't3' },
    { id: 'd3', from: 't3', to: 'm1' },
  ])
  const holidays = [at(17)]

  const columns: GridColumns<Task> = [
    { field: 'name', header: 'Task', width: 200, editorType: 'text' },
    { field: 'owner', header: 'Owner', width: 100, editorType: 'text' },
    { field: 'start', header: 'Start', width: 110 },
    { field: 'end', header: 'Finish', width: 110 },
  ]

  // `end` is exclusive on the way back, and these rows store an inclusive
  // date-only finish, so it subtracts a day.
  function writeSpan(row: Task, start: Date, end: Date) {
    row.start = isoDay(start)
    const last = new Date(end.getTime() - 86_400_000)
    row.end = isoDay(last < start ? start : last)
  }
  let seq = 100
</script>
```

## Turning it on

```svelte {runnable}
<SvGrid {data} {columns} getRowId={(r) => r.id}
  gantt={{
    startField: 'start', endField: 'end', parentField: 'parentId',
    progressField: 'progress',
    dependencies,
    editable: true,
    history: true,
    drawer: true,
    onTaskMove: (e) => {
      writeSpan(e.row, e.start, e.end)
      // A phase carries its children: one callback, the whole batch.
      for (const s of e.subtree ?? []) writeSpan(s.row, s.start, s.end)
    },
    onTaskResize: (e) => writeSpan(e.row, e.start, e.end),
    onProgressChange: (e) => { e.row.progress = e.progress },
    onDependenciesChange: (moves) => {
      for (const m of moves) {
        const row = data.find((r) => r.id === m.id)
        if (row) writeSpan(row, m.start, m.end)
      }
    },
  }} />
```

> **`end` is exclusive on the way back.** Every callback hands you `start` and
> `end` as `Date`s with `end` the moment the task stops, which for a whole-day
> task is midnight after its last day. If your rows store an inclusive
> date-only finish, subtract a day when you write it:
>
> ```ts
> function writeSpan(row: Task, start: Date, end: Date) {
>   row.start = isoDay(start)
>   const last = new Date(end.getTime() - 86_400_000)
>   row.end = isoDay(last < start ? start : last)
> }
> ```
>
> Rows that store timestamps take the values as they come.

## What each gesture reports

| Gesture | Callback | What arrives |
| --- | --- | --- |
| Drag a bar | `onTaskMove` | `row`, the new `start` / `end`. The start lands on the nearest working day (Saturday goes back to Friday, Sunday on to Monday) and the task keeps its working days: a Monday-to-Friday task dropped on Wednesday ends the Tuesday after. Dragging a **phase** moves its whole subtree - each task landing on a working day at its own length - and fills `subtree` with one entry per task. |
| Drag an edge | `onTaskResize` | `row`, `start`, `end` and `edge` (`'start'` or `'end'`). A bar never shrinks below a day. |
| Drag the progress diamond | `onProgressChange` | `row` and `progress`, in whole 5% steps. Leaves only; a phase shows its rollup. |
| Drag a bar's end dot onto another bar | `onDependencyAdd` | The new `GanttDependency`; its `type` comes from the edges joined. |
| Right-click an arrow, **Remove link** | `onDependencyRemove` | The link's id. |
| Any move or resize with links | `onDependenciesChange` | The cascaded shifts, one `{ id, start, end }` per successor that moved. |
| Double-click empty space | `onTaskAdd` | `start`, `end` (one day) and the `parentId` of the row double-clicked in. |
| Drawer save | `onTaskCommit` | `row` and `values`, the edited fields. |
| **Delete** in the drawer or menu, or the Delete key | `onTaskDelete` | The `row`. |

A drag under three pixels counts as a click, so clicking a bar still opens the
drawer rather than nudging the plan by a day. A callback you leave out
disables its gesture: without `onTaskAdd` a double-click does nothing, without
`onTaskDelete` there is no Delete.

A drag that reaches the edge of the chart pane keeps going: the pane scrolls
under the pointer, faster the further past the edge it sits, until the pointer
comes back in. That is how a bar travels beyond what is on screen and how a
link reaches a bar that is not - hold the dot at the edge and the target
scrolls into view. A link drag scrolls the rows too. Dragging a task before
the plan's start grows the window on the left without the chart shifting
under the pointer; the same holds past the end. `Escape` at any point puts
everything back.

A task dropped **earlier than a link allows** stays where it was dropped, and
the link draws as [violated](./dependencies.md#violated-and-cyclic-links).
The cascade only ever runs downstream of what moved; it never corrects the
task you are holding.

Every one of these, logged as it happens:

<div data-docs-demo="475-gantt-editing" data-height="600"></div>

## Adding and deleting tasks

`onTaskAdd` is the create hook: a double-click on empty chart space fires it
with a one-day span at that date and the phase of the row it landed in, and
the context menu's **Add subtask** fires it with the right-clicked task as the
parent. Add the row to your data and it draws.

```svelte {runnable}
<SvGrid {data} {columns} getRowId={(r) => r.id}
  gantt={{
    startField: 'start', endField: 'end', parentField: 'parentId',
    editable: true,
    onTaskMove: (e) => writeSpan(e.row, e.start, e.end),
    onTaskResize: (e) => writeSpan(e.row, e.start, e.end),
    onTaskAdd: (start, end, parentId) => {
      data = [...data, {
        id: `n${++seq}`, name: 'New task', owner: 'TBD',
        start: isoDay(start), end: isoDay(new Date(end.getTime() - 86_400_000)),
        progress: 0, parentId: parentId ?? null,
      }]
    },
    onTaskDelete: (row) => { data = data.filter((r) => r.id !== row.id) },
  }} />
```

## The drawer

`drawer: true` opens a detail panel on click (or Enter) with **Start**,
**Finish** and **Progress** pinned above the column fields, each edited with
the column's `editorType`. Saving fires `onTaskCommit` with the values that
changed. The object form picks the fields:

```ts
drawer: { fields: ['name', 'owner'] }
```

`onTaskDelete` adds a Delete button to the drawer.

## The context menu

Right-click a bar for **Edit** (with the drawer), **Add subtask** (with
`onTaskAdd`) and **Delete** (with `onTaskDelete`). `taskMenu` appends your own
items - see [custom bars, tooltips and menus](./customizing.md#the-context-menu).
Right-click an arrow to remove the link it draws.

## Keyboard

Bars are focusable, so the whole plan is reachable without a mouse.

| Key | Does |
| --- | --- |
| `Left` / `Right` | Move a working day (Right from Friday lands on Monday). With `Shift`, a week. With `Alt`, stretch the finish instead. |
| `+` / `-` | Step progress by 5. |
| `Enter` | Open the drawer. |
| `Delete` | `onTaskDelete`. |
| `Escape` | Cancel the drag in progress, restoring the bar. |
| `Ctrl/Cmd+Z`, `Ctrl/Cmd+Shift+Z` (or `Ctrl+Y`) | Undo / redo, with `history`. |

## Undo and redo

`history: true` keeps a stack of moves, resizes and progress edits. Undo
**re-fires the callbacks** with the reversed values, cascade included, so your
data follows it back rather than drifting out of step with the chart. It is the
same mechanism as a fresh edit, which is why nothing extra is needed on your
side.

## See also

- [Dependencies](./dependencies.md) - auto-reschedule and drawing links.
- [The same rows as a grid, a scheduler and a board](./views.md) - the write-back pattern across views.
- [Undo / redo in the grid](../editing/undo-redo.md) - the table's own history.
