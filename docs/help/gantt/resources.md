# Gantt: resource load

Who is on each task, and whether anyone is booked twice over. An Enterprise
option on `GanttProConfig`: `resourceField` names the assignee, and
`resourceHistogram` sums the assignments into a load strip under the chart.

```svelte {preamble}
<script lang="ts">
  import { SvGrid, type GridColumns } from '@svgrid/grid'
  import { enableGanttView, type GanttProConfig } from '@svgrid/enterprise'

  enableGanttView()

  type Task = {
    id: string
    name: string
    owner?: string
    start: string
    end?: string
    progress?: number
    parentId?: string | null
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

  // Priya is double-booked in the second week; Sven has two tasks that touch.
  let data = $state<Task[]>([
    { id: 'p1', name: 'Discovery', parentId: null, start: at(0), owner: '' },
    { id: 't1', name: 'Interviews', parentId: 'p1', start: at(0), end: at(4), progress: 100, owner: 'Priya' },
    { id: 't2', name: 'Survey design', parentId: 'p1', start: at(7), end: at(9), progress: 40, owner: 'Priya' },
    { id: 't3', name: 'Synthesis', parentId: 'p1', start: at(8), end: at(11), progress: 0, owner: 'Priya' },
    { id: 'p2', name: 'Build', parentId: null, start: at(14), owner: '' },
    { id: 't4', name: 'Data model', parentId: 'p2', start: at(14), end: at(18), progress: 10, owner: 'Sven' },
    { id: 't5', name: 'API', parentId: 'p2', start: at(18), end: at(25), progress: 0, owner: 'Sven' },
    { id: 't6', name: 'Front end', parentId: 'p2', start: at(16), end: at(25), progress: 0, owner: 'Mia' },
  ])

  const columns: GridColumns<Task> = [
    { field: 'name', header: 'Task', width: 200 },
    { field: 'owner', header: 'Owner', width: 100 },
  ]

  // Resources for the load strip, with a capacity field of their own.
  const crews = [
    { id: 'Priya', title: 'Priya', cap: 1 },
    { id: 'Sven', title: 'Sven', cap: 2 },
    { id: 'Mia', title: 'Mia', cap: 1 },
  ]

  function writeSpan(row: Task, start: Date, end: Date) {
    row.start = isoDay(start)
    const last = new Date(end.getTime() - 86_400_000)
    row.end = isoDay(last < start ? start : last)
  }

  const pro = (c: GanttProConfig<any, Task>) => c
</script>
```

## Naming the resource

`resourceField` on its own puts the assignee in the tooltip and gives the
histogram something to count:

```svelte {runnable}
<SvGrid {data} {columns} getRowId={(r) => r.id}
  gantt={pro({
    startField: 'start', endField: 'end', parentField: 'parentId',
    resourceField: 'owner',
    tooltip: true,
  })} />
```

## The load strip

`resourceHistogram` sums the assignments into a strip under the chart - one row
per resource, one bar per axis column, counting the tasks that touch it, with
anything past capacity in red. `true` takes the defaults (a capacity of one,
88 px tall); the object form names the capacity field on each resource and
sets the strip's height.

```svelte {runnable}
<SvGrid {data} {columns} getRowId={(r) => r.id}
  gantt={pro({
    startField: 'start', endField: 'end', parentField: 'parentId',
    resourceField: 'owner',
    resources: crews,
    resourceHistogram: { capacityField: 'cap', height: 80 },
    editable: true,
    onTaskMove: (e) => writeSpan(e.row, e.start, e.end),
    onTaskResize: (e) => writeSpan(e.row, e.start, e.end),
  })} />
```

Drag a task onto a column that is already full and the bar under it goes red;
the strip recomputes with every edit. It sticks to the bottom of the chart and
scrolls with the axis, so a column and its load are always in line.

## How a cell is counted

A cell's number is **how many of that resource's tasks overlap the column**,
not an average and not person-hours. On a day or week axis that is exactly
concurrency; on a coarser one it counts everything touching the column, which
reads high rather than low. Only **leaves** are counted - a phase is its
children, so counting it too would book its owner twice for the same work.

`resources` is the ordered list of who to show, as `{ id, title, ... }` -
the same shape the [scheduler](../rows/scheduler.md) uses, so one array can
serve both views. Omit it and the rows come from the data, in the order the
tasks first name them, each with a capacity of one. A resource in the list
with no tasks still gets a row, which is how an idle crew shows up.

## A field-service quarter

Two regional crews and one specialist, with a capacity of two for the crew
that runs two vans, and the weekends folded out of the axis:

<div data-docs-demo="477-gantt-resources" data-height="620"></div>

The portfolio console turns the same numbers into a chart - remaining working
days per owner - from the rows alone, without the strip:

<div data-docs-demo="481-gantt-portfolio-console" data-height="700"></div>

## See also

- [Critical path, baselines and constraints](./critical-path.md) - the rest of the planning layer.
- [Staffing board](../rows/scheduler.md) - the scheduler's utilization histogram, for shifts rather than tasks.
- [Config reference](./api.md#gantt-pro) - the Pro options in one table.
