# Gantt: dependencies

Links between tasks: the four types, lag and lead, where the links come from,
what a violated or cyclic link looks like, and the cascade that keeps every
link legal when a task moves.

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
    next?: string[]
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
    { id: 't1', name: 'Interviews', parentId: 'p1', start: at(0), end: at(4), progress: 100, owner: 'Priya', next: ['t2'] },
    { id: 't2', name: 'Synthesis', parentId: 'p1', start: at(5), end: at(11), progress: 40, owner: 'Marco', next: ['t3'] },
    { id: 'p2', name: 'Build', parentId: null, start: at(12), owner: 'Sven' },
    { id: 't3', name: 'Implementation', parentId: 'p2', start: at(12), end: at(25), progress: 10, owner: 'Sven', next: ['m1'] },
    { id: 't4', name: 'Documentation', parentId: 'p2', start: at(14), end: at(20), progress: 0, owner: 'Lena' },
    { id: 'm1', name: 'Launch', parentId: null, start: at(26), milestone: true },
  ])

  const dependencies: GanttDependency[] = [
    { id: 'd1', from: 't1', to: 't2' },
    { id: 'd2', from: 't2', to: 't3' },
    { id: 'd3', from: 't3', to: 'm1' },
  ]

  const columns: GridColumns<Task> = [
    { field: 'name', header: 'Task', width: 200 },
    { field: 'owner', header: 'Owner', width: 100 },
  ]

  function writeSpan(row: Task, start: Date, end: Date) {
    row.start = isoDay(start)
    const last = new Date(end.getTime() - 86_400_000)
    row.end = isoDay(last < start ? start : last)
  }
</script>
```

## Links and their types

Link tasks with predecessor -> successor **dependencies** and the chart draws an
arrow between them. `from` / `to` are **row ids** (your `getRowId`).

```svelte {runnable}
<SvGrid {data} {columns} getRowId={(r) => r.id}
  gantt={{
    startField: 'start', endField: 'end', parentField: 'parentId',
    dependencies,
  }} />
```

Four link types are supported, named for the two edges they join:

| `type` | Means | The arrow runs |
| --- | --- | --- |
| `FS` *(default)* | Finish-to-start: the successor starts once the predecessor finishes. | predecessor's finish -> successor's start |
| `SS` | Start-to-start: both start together (or the successor later). | start -> start |
| `FF` | Finish-to-finish: both finish together (or the successor later). | finish -> finish |
| `SF` | Start-to-finish: the successor cannot finish before the predecessor starts. | start -> finish |

An optional `lag` is in **days**, negative for a lead:

```ts
const dependencies: GanttDependency[] = [
  { id: 'd1', from: 'pour', to: 'cure', type: 'FS' },
  { id: 'd2', from: 'cure', to: 'frame', type: 'FS', lag: 2 },   // two days after curing
  { id: 'd3', from: 'frame', to: 'wire', type: 'SS', lag: 1 },   // wiring starts a day after framing does
  { id: 'd4', from: 'wire', to: 'inspect', type: 'FF', lag: -1 } // inspection wraps a day early
]
```

### How an arrow is routed

An arrow leaves the predecessor on the side its type names and arrives at the
successor on the other: a finish-anchored link (`FS`, `FF`) leaves the finish
rightwards, a start-anchored one (`SS`, `SF`) leaves the start leftwards, and
a link into a finish arrives from the right so it never runs the length of the
bar it points at. Two tasks scheduled **back to back** - the everyday case -
would need the arrow to hook round to reach the successor's start from the
left, so it drops straight into the top of the successor instead, head
pointing down; a milestone that follows its predecessor gets the same straight
drop onto its apex. Only a link whose successor sits *before* its predecessor
takes the long way round, along the boundary between the two rows.

## Where the links come from

Provide them as a flat `dependencies` array, or per row through
`dependencyField` - a field on the **predecessor** holding either an array of
`GanttDependency` objects, or just a list of its successors' ids (each
becomes an `FS` link from that row):

```svelte {runnable}
<SvGrid {data} {columns} getRowId={(r) => r.id}
  gantt={{ startField: 'start', endField: 'end', parentField: 'parentId', dependencyField: 'next' }} />
```

The per-row form suits rows that come from an API with a `successors` or
`next` column; the flat array suits a links table of its own. Both feed the
same graph. A per-row object may leave `from` out - it is the row - and `id`
out, in which case the link is named `from->to`.

## Violated and cyclic links

A link that is not currently satisfied - a successor sitting too early to be
legal - draws as a **dashed red arrow**. It is not an error: a plan mid-edit,
or one imported from a tool with different rules, can have several, and the
chart shows them rather than moving anything on its own.

Cyclic links are ignored rather than flagged: with a cycle there is no answer
to what "late" would mean, and ignoring them is what stops an auto-reschedule
from looping. A link pointing at a row the grid has filtered out simply draws
nothing.

A link into a **collapsed** phase re-anchors on that phase's summary bar, so
folding a phase never makes an arrow disappear; a link between two tasks of
the same folded phase is not drawn at all. See [work breakdown](./work-breakdown.md#collapse).

## Auto-reschedule

With dependencies present and [editing](./editing.md) on, moving or resizing
a task pushes its successors forward far enough to keep every link legal,
preserving each one's duration. The shifts arrive together in
`onDependenciesChange`, one entry per task that moved:

```svelte {runnable}
<SvGrid {data} {columns} getRowId={(r) => r.id}
  gantt={{
    startField: 'start', endField: 'end', parentField: 'parentId',
    dependencies,
    editable: true,
    onTaskMove: (e) => writeSpan(e.row, e.start, e.end),
    onTaskResize: (e) => writeSpan(e.row, e.start, e.end),
    onDependenciesChange: (moves) => {
      for (const m of moves) {
        const row = data.find((r) => r.id === m.id)
        if (row) writeSpan(row, m.start, m.end)
      }
    },
  }} />
```

Three rules:

- Cascading only ever pushes **forward** - it never pulls a task earlier.
  Slack is yours to keep.
- With `respectWorkingTime` (on by default) a cascaded start lands on a
  working day, stepping over weekends and `holidays`, and the pushed task
  keeps its working days - five days of work stay five days of work on the
  other side of a weekend.
- A [constraint](./critical-path.md#constraints) on a successor caps the
  cascade: the task stops at its ceiling and the link stays drawn as
  unsatisfied.

Set `autoReschedule: false` to draw the arrows without moving anything.

## Drawing and removing links

With `editable`, every bar grows a dot at each end on hover. Drag a dot onto
another bar and `onDependencyAdd` fires with the new link; the edge you drag
from and the half of the bar you drop on pick the type - finish to start is
`FS`, start to start `SS`, and so on. Right-click an arrow for **Remove
link**, which fires `onDependencyRemove` with its id.

A link that would close a **cycle**, or one that already exists, is refused:
both bars flash and no callback fires. The plan editing demo logs every one of
these callbacks as they happen:

<div data-docs-demo="475-gantt-editing" data-height="600"></div>

The view never edits the `dependencies` array itself. Add the link in
`onDependencyAdd` and pass the new array back in - a `$derived` config is the
usual way, as the demo does.

## See also

- [Critical path, baselines and constraints](./critical-path.md) - what the links mean for the schedule.
- [Editing](./editing.md) - every gesture and the callback it fires.
- [Sequenced bookings](../rows/scheduler.md) - the scheduler has the same links for ordered bookings.
