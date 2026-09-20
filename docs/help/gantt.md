# Gantt chart mode

Set one `gantt` prop and the grid renders its rows as a **task table beside a
time chart**: one bar per row, placed by its start and finish, nested into a
work-breakdown tree, with arrows between linked tasks. It is the same
`<SvGrid>`, the same `data` and `columns` - only the presentation changes.

Like [Kanban board mode](./rows/kanban-board.md) and the
[scheduler](./rows/scheduler.md), the Gantt is a pure **view of the grid**: it
renders the grid's already filtered, sorted and searched rows and writes back
only through callbacks - it never mutates your data.

> **Enterprise feature.** The `gantt` prop and its config types are part of the
> free grid, but the *renderer* ships in `@svgrid/enterprise`. Register it once
> and the view lights up:
>
> ```ts
> import { setLicenseKey, enableGanttView } from '@svgrid/enterprise'
> setLicenseKey('YOUR-KEY')   // omit to run soft-gated with a watermark
> enableGanttView()
> ```
>
> `installEnterprise(api)` also calls `enableGanttView()` for you. Without the
> renderer registered, a grid with a `gantt` prop shows an upgrade note.

<div data-docs-demo="474-gantt-intro" data-height="620"></div>

The whole of it is one prop. This is the grid above, with the columns it shows
in the task table and the fields the chart reads:

```svelte
<script lang="ts">
  import { SvGrid, type GridColumns, type GanttConfig } from '@svgrid/grid'
  import { enableGanttView } from '@svgrid/enterprise'

  enableGanttView()

  type Task = {
    id: string
    name: string
    owner: string
    start: string
    end?: string
    progress: number
    parentId: string | null
    milestone?: boolean
  }

  const data: Task[] = [
    { id: 'p1', name: 'Discovery', owner: 'Priya', start: '2026-09-07', progress: 0, parentId: null },
    { id: 't1', name: 'Interviews', owner: 'Priya', start: '2026-09-07', end: '2026-09-11', progress: 100, parentId: 'p1' },
    { id: 't2', name: 'Synthesis', owner: 'Marco', start: '2026-09-14', end: '2026-09-18', progress: 40, parentId: 'p1' },
    { id: 'm1', name: 'Brief signed off', owner: '-', start: '2026-09-21', progress: 0, parentId: null, milestone: true },
  ]

  const columns: GridColumns<Task> = [
    { field: 'name', header: 'Task', width: 200 },
    { field: 'owner', header: 'Owner', width: 100 },
  ]

  const gantt: GanttConfig<any, Task> = {
    startField: 'start',
    endField: 'end',
    progressField: 'progress',
    parentField: 'parentId',
    milestoneField: 'milestone',
    dependencies: [{ id: 'd1', from: 't1', to: 't2' }, { id: 'd2', from: 't2', to: 'm1' }],
  }
</script>

<SvGrid {data} {columns} getRowId={(r) => r.id} {gantt} />
```

## Pages

- [Getting started](./gantt/start.md): the one required option, how dates are read, bars and milestones, the task table, and the Gantt / Table toggle.
- [Work breakdown](./gantt/work-breakdown.md): phases from a parent field, rolled-up summary bars, collapse, and what a folded phase still does.
- [Dependencies](./gantt/dependencies.md): links and their four types, lag, violated and cyclic links, and auto-reschedule.
- [Editing](./gantt/editing.md): drag, resize, the progress grip, drawing links, the drawer and menu, keyboard, undo.
- [The axis and working time](./gantt/axis-and-working-time.md): zoom presets, the window, non-working days and holidays, the today line, folding weekends out.
- [Critical path, baselines and constraints](./gantt/critical-path.md): the planning layer - slack, the ringed chain, ghost bars, pinned dates.
- [Resource load](./gantt/resources.md): who is on what, the load histogram, capacity.
- [Custom bars, tooltips and menus](./gantt/customizing.md): the `task` and `tooltip` snippets, the context menu, colours and the CSS hooks.
- [The same rows as a grid, a scheduler and a board](./gantt/views.md): switching views over one array, and the date shape that keeps them in step.
- [Config reference](./gantt/api.md): every option on `GanttConfig` and the Enterprise `GanttProConfig`, with the page that explains it.

## More examples

### One plan, four views

The same rows as a table, a Gantt, a resource timeline and a Kanban board,
each writing back to the one array.

<div data-docs-demo="478-gantt-four-views" data-height="620"></div>

### Product roadmap

A year in quarters: initiatives per team with the owner and a status chip
drawn inside each bar, releases as milestones, and a status filter.

<div data-docs-demo="479-gantt-roadmap" data-height="620"></div>

### A programme of 640 tasks

Forty sites of sixteen linked tasks each, opening folded to one bar per
site, with the critical path across every chain and windowed rows.

<div data-docs-demo="480-gantt-program" data-height="640"></div>

### Portfolio office

A project console: a rail of projects, live KPIs, and a dockable workspace
with the editable plan over a risk register and a workload chart.

<div data-docs-demo="481-gantt-portfolio-console" data-height="700"></div>

## See also

- [Scheduler / calendar mode](./rows/scheduler.md) - the resource and booking
  view. Use it for appointments and shifts; use the Gantt for a project plan.
- [Kanban board mode](./rows/kanban-board.md) - the same rows as cards in lanes.
- [Tree data](./rows/tree-data.md) - hierarchy in the table itself.
