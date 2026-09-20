# Gantt: work breakdown

A `parentField` turns flat rows into phases and the tasks under them. This page
covers the summary bar a phase draws, how its percent is worked out, collapse,
and what a folded phase still does for the links and the planning passes.

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
    { id: 'p2a', name: 'Back end', parentId: 'p2', start: at(12), owner: 'Sven' },
    { id: 't3', name: 'Data model', parentId: 'p2a', start: at(12), end: at(18), progress: 30, owner: 'Sven' },
    { id: 't4', name: 'API', parentId: 'p2a', start: at(19), end: at(25), progress: 0, owner: 'Sven' },
    { id: 't5', name: 'Front end', parentId: 'p2', start: at(15), end: at(29), progress: 0, owner: 'Mia' },
    { id: 'm1', name: 'Launch', parentId: null, start: at(30), milestone: true },
  ])

  const dependencies: GanttDependency[] = [
    { id: 'd1', from: 't1', to: 't2' },
    { id: 'd2', from: 't2', to: 't3' },
    { id: 'd3', from: 't3', to: 't4' },
    { id: 'd4', from: 't5', to: 'm1' },
  ]

  const columns: GridColumns<Task> = [
    { field: 'name', header: 'Task', width: 200 },
    { field: 'owner', header: 'Owner', width: 100 },
  ]
</script>
```

## Phases from a parent field

Set `parentField` to the field holding each row's **parent id** and the flat
rows nest into a tree, to any depth. A row with children gets a collapse
chevron and draws a **summary bar** rolled up from every descendant, so a phase
carries no dates of its own - there is nothing to keep in sync by hand.

```svelte {runnable}
<SvGrid {data} {columns} getRowId={(r) => r.id}
  gantt={{
    startField: 'start', endField: 'end',
    parentField: 'parentId',
    progressField: 'progress',
  }} />
```

Rows whose parent id matches no task become roots rather than vanishing, which
is what keeps a filtered-out phase from hiding its tasks. A cycle in the parent
links (a under b under a) is broken at the first repeat and the rows involved
become roots, so bad data cannot hang the render.

> **Do not also set `treeData`.** The Gantt owns its own tree because it needs
> every descendant - a collapsed phase still contributes to its summary bar -
> whereas `treeData` hides collapsed children from the view before the renderer
> sees them. Setting both makes summaries under-report, and the grid warns about
> it in development.

## How a summary rolls up

The summary bar spans the earliest start to the latest finish of every
descendant, collapsed ones included.

Its percent is **weighted by duration**, not by task count: a two-day task at
100% beside a six-day task at 0% reads as 25% done, not 50%. Weighting by count
would report progress the plan has not made. Descendants with no duration
(milestones) weigh nothing, so a parent holding only milestones falls back to
their plain mean.

The `__duration` column on a phase counts the working days of the rolled-up
span, and `__slack` reports the least slack of any task under it - a phase can
slip only as far as its tightest task, so the room after its own rollup would
be the wrong number.

`summaryBars: false` draws parents as ordinary bars instead of the thin spine,
for a plan where the phase rows carry real dates of their own.

## Collapse

Collapse is the Gantt's own state by default: click a chevron, or the
**Collapse all** / **Expand all** button in the toolbar. Hoist it with
`collapsed` and `onCollapseChange` to persist it, drive it from elsewhere, or
open a big plan folded:

```svelte {runnable}
<script lang="ts">
  let collapsed = $state<string[]>(['p2'])
</script>

<SvGrid {data} {columns} getRowId={(r) => r.id}
  gantt={{
    startField: 'start', endField: 'end', parentField: 'parentId',
    dependencies,
    collapsed,
    onCollapseChange: (next) => (collapsed = next),
  }} />
```

Fold a phase and three things hold:

- **The summary keeps the full span.** The rollup reads every task, visible
  or not.
- **Links into the phase re-anchor on its summary bar.** An arrow from a task
  outside the phase to a task inside it draws to the bar that now stands for
  it, rather than disappearing. A link between two tasks of the same folded
  phase draws nothing - both ends would land on the same bar.
- **The planning passes still see the tasks.** The critical path and the
  slack column are computed over the whole plan, so folding does not change
  which chain is critical; a folded phase over a critical task carries the
  ring on its summary bar. See [the planning layer](./critical-path.md).

The programme demo opens every one of its forty sites folded, which is how a
year of 640 tasks reads as forty bars:

<div data-docs-demo="480-gantt-program" data-height="640"></div>

## Moving a phase

With [editing](./editing.md) on, dragging a summary bar moves its **whole
subtree** by the same offset, and the one `onTaskMove` call carries the batch
in `subtree`. Resizing a summary bar is not offered: its length is its tasks'
length.

## See also

- [Getting started](./start.md) - the basics this page builds on.
- [Dependencies](./dependencies.md) - what a link into a folded phase does.
- [Tree data](../rows/tree-data.md) - hierarchy in the table itself, for when there is no chart.
