# Gantt: getting started

The one option a Gantt needs, how it reads your dates, what a bar, a milestone
and a summary look like, and the task table beside the chart. The other Gantt
pages assume this one.

The examples on this page share one setup. The renderer ships in
`@svgrid/enterprise` and is registered once; the rows are anchored on the
current week so the today line is always in view.

```svelte {preamble}
<script lang="ts">
  import { SvGrid, type GridColumns, type GanttDependency } from '@svgrid/grid'
  import { enableGanttView, type GanttProConfig } from '@svgrid/enterprise'

  enableGanttView()

  // One row type wide enough for every example on this page.
  type Task = {
    id: string
    name: string
    owner?: string
    start: string
    end?: string
    days?: number
    progress?: number
    parentId?: string | null
    milestone?: boolean
    color?: string
    blockedBy?: string[]
    bStart?: string
    bEnd?: string
  }

  // Anchored on a Monday so the weekend shading is obvious in every sample.
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
    { id: 't1', name: 'Interviews', parentId: 'p1', start: at(0), end: at(4), progress: 100, owner: 'Priya', days: 3, color: '#7c3aed', bStart: at(0), bEnd: at(3) },
    { id: 't2', name: 'Synthesis', parentId: 'p1', start: at(5), end: at(11), progress: 40, owner: 'Marco', days: 5, color: '#7c3aed', bStart: at(4), bEnd: at(9) },
    { id: 'p2', name: 'Build', parentId: null, start: at(12), owner: 'Sven' },
    { id: 't3', name: 'Implementation', parentId: 'p2', start: at(12), end: at(25), progress: 10, owner: 'Sven', days: 10, color: '#2563eb', bStart: at(10), bEnd: at(23) },
    { id: 'm1', name: 'Launch', parentId: null, start: at(26), milestone: true, color: '#f59e0b' },
  ])

  const dependencies: GanttDependency[] = [
    { id: 'd1', from: 't1', to: 't2' },
    { id: 'd2', from: 't2', to: 't3' },
    { id: 'd3', from: 't3', to: 'm1' },
  ]
  const holidays = [at(17)]

  const columns: GridColumns<Task> = [
    { field: 'name', header: 'Task', width: 200 },
    { field: 'owner', header: 'Owner', width: 100 },
    { field: 'start', header: 'Start', width: 110 },
    { field: 'end', header: 'Finish', width: 110 },
  ]

  // The view reports what it wants and never writes your rows, so every editing
  // example needs this. `end` is exclusive on the way back, and these rows store
  // an inclusive date-only finish, so it subtracts a day.
  function writeSpan(row: Task, start: Date, end: Date) {
    row.start = isoDay(start)
    const last = new Date(end.getTime() - 86_400_000)
    row.end = isoDay(last < start ? start : last)
  }

  // The Enterprise config is a superset of the free grid's, so the `gantt` prop
  // accepts it - but an inline object literal is checked against the narrower
  // type. Real code writes `const cfg: GanttProConfig<any, Task> = { ... }`;
  // this one-liner is just so the Pro examples can stay inline.
  const pro = (c: GanttProConfig<any, Task>) => c
</script>
```

## The minimum

Point `gantt.startField` at the field holding each task's start. That is the
only required option. With an `endField` too, bars get their real length. The
title defaults to the first column's field.

```svelte {runnable}
<SvGrid {data} {columns} getRowId={(r) => r.id} gantt={{ startField: 'start', endField: 'end' }} />
```

`getRowId` matters more here than in a table: a dependency's `from` and `to`,
a parent field and the `collapsed` list all name rows by that id. Without it
the view makes up a key per row object, which keeps the chart stable but gives
your links nothing to point at.

## How dates are read

Three rules, worth knowing before you shape your data:

- **Days are local calendar days.** A date-only string is parsed as local
  midnight, never UTC. (`new Date('2026-09-14')` is UTC midnight, which west of
  Greenwich is the 13th - a bar a day early on every task.)
- **`end` is exclusive, except a date-only string is inclusive of its day.** So
  `{ start: '2026-09-14', end: '2026-09-16' }` is the **three-day** task a person
  typing those dates means. A value carrying a time (a `Date`, epoch-ms, or an
  ISO string with `T`) is taken literally.
- **A task with a start but no end and no duration is a milestone** - it renders
  as a diamond.

Instead of an end you can give a length in **working days** with
`durationField`. A three-day task starting Thursday ends Tuesday, because the
weekend is skipped:

```svelte {runnable}
<SvGrid {data} {columns} getRowId={(r) => r.id}
  gantt={{ startField: 'start', durationField: 'days', nonWorkingDays: [0, 6] }} />
```

If the same rows also feed the [scheduler](../rows/scheduler.md), store
timestamps rather than date-only strings - [the views page](./views.md#one-date-shape-for-every-view)
explains why.

## Bars, progress and milestones

| Option | What it draws |
| --- | --- |
| `progressField` | A 0-100 fill inside the bar, and the rollup on parents. |
| `milestoneField` | A diamond instead of a bar. A zero-length task is one anyway. |
| `colorField` / `color` | The bar's accent, per task or for all of them. |
| `summaryBars` | `false` draws parents as ordinary bars instead of a rolled-up spine. |
| `labelPosition` | `'inside'` (default, falling back to the right when the bar is too narrow), `'right'`, or `'none'`. |
| `rowHeight` | Height of one task row, default 32. |

```svelte {runnable}
<SvGrid {data} {columns} getRowId={(r) => r.id}
  gantt={{
    startField: 'start', endField: 'end', parentField: 'parentId',
    progressField: 'progress',
    milestoneField: 'milestone',
    colorField: 'color',
    labelPosition: 'right',
  }} />
```

A bar's label sits inside it when it fits and to the right of it when it does
not, so a two-day task at a coarse zoom is still named. A summary bar's label is
always outside: the spine is too thin to carry text.

## The task table

The left pane lists the same rows. By default it shows every column that has a
`field`; name and order them with `tableColumns`, which also accepts three
built-ins that need no column definition:

- **`__duration`** - the task's length in working days.
- **`__progress`** - a small meter plus the percent.
- **`__slack`** - days of room before the task would move the project finish.
  Needs `criticalPath` (see [the planning layer](./critical-path.md)); blank
  without it.

```svelte {runnable}
<SvGrid {data} {columns} getRowId={(r) => r.id}
  gantt={{
    startField: 'start', endField: 'end', parentField: 'parentId',
    progressField: 'progress',
    tableColumns: ['name', 'owner', '__duration', '__progress'],
    tableWidth: 340,
    rowHeight: 34,
  }} />
```

Drag the divider to resize the pane. The table and the chart share one
scroll container, so their rows can never drift apart.

The pane is a compact list, not a second grid: it has no inline editing or
per-column menus. Sorting and filtering happen on the grid itself, which is why
the usual pattern is a **Gantt / Table toggle** over the same rows - flip the
`gantt` prop off and the full table is back, with every column feature.

<div data-docs-demo="474-gantt-intro" data-height="620"></div>

## Search, filter and sort flow through

The Gantt draws the rows the grid hands it, after filtering and sorting. So the
search box above the chart, any column filters, and the sort order all apply
without the view knowing about them. Sorting reorders tasks **within each
phase**; children stay under their parent.

The search box is the grid's global filter, shown by default; `searchable:
false` hides it and `searchPlaceholder` renames it.

## The chart fills its pane

A short plan at a coarse zoom is narrower than the space beside the task
table. Rather than stop two thirds of the way across and leave the rest blank,
the ticks stretch to fill the pane; a plan wider than the pane scrolls at the
preset's natural tick width. The chart opens with today a third of the way in,
so most of what is on screen is what comes next.

## See also

- [Work breakdown](./work-breakdown.md) - phases, rolled-up summary bars and collapse.
- [Dependencies](./dependencies.md) - links, arrows and auto-reschedule.
- [Config reference](./api.md) - every option in one table.
