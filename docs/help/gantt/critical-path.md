# Gantt: critical path, baselines and constraints

The planning layer: the chain of tasks with no slack, the dates the plan was
signed off with, and the dates a task is pinned to. All three are Enterprise
options on `GanttProConfig`, the superset of the free grid's config -
structurally assignable to the `gantt` prop, so the free grid never needs to
know about them:

```ts
import type { GanttProConfig } from '@svgrid/enterprise'

const cfg: GanttProConfig<any, Task> = { startField: 'start', /* ... */ }
```

```svelte {preamble}
<script lang="ts">
  import { SvGrid, type GridColumns, type GanttDependency } from '@svgrid/grid'
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
    milestone?: boolean
    bStart?: string
    bEnd?: string
    con?: string
    conDate?: string
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

  // A tight chain (interviews, synthesis, implementation) beside a short
  // branch with room (documentation), and a launch that must land by a date.
  let data = $state<Task[]>([
    { id: 'p1', name: 'Discovery', parentId: null, start: at(0), owner: 'Priya' },
    { id: 't1', name: 'Interviews', parentId: 'p1', start: at(0), end: at(4), progress: 100, owner: 'Priya', bStart: at(0), bEnd: at(3) },
    { id: 't2', name: 'Synthesis', parentId: 'p1', start: at(7), end: at(11), progress: 40, owner: 'Marco', bStart: at(4), bEnd: at(9) },
    { id: 'p2', name: 'Build', parentId: null, start: at(14), owner: 'Sven' },
    { id: 't3', name: 'Implementation', parentId: 'p2', start: at(14), end: at(25), progress: 10, owner: 'Sven', bStart: at(10), bEnd: at(23) },
    { id: 't4', name: 'Documentation', parentId: 'p2', start: at(14), end: at(18), progress: 0, owner: 'Lena', bStart: at(14), bEnd: at(18) },
    { id: 't5', name: 'Release', parentId: 'p2', start: at(28), end: at(30), progress: 0, owner: 'Lena', bStart: at(24), bEnd: at(26), con: 'FNLT', conDate: at(32) },
  ])

  const dependencies: GanttDependency[] = [
    { id: 'd1', from: 't1', to: 't2' },
    { id: 'd2', from: 't2', to: 't3' },
    { id: 'd3', from: 't3', to: 't5' },
    { id: 'd4', from: 't4', to: 't5' },
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

  const pro = (c: GanttProConfig<any, Task>) => c
</script>
```

## The critical path

`criticalPath: true` runs the two passes every planner knows: a forward one
giving each task its **earliest** start and finish, a backward one giving it its
**latest**. Where the two agree the task has no slack - it cannot slip a day
without moving the project's finish - and that chain, with the arrows along it,
is ringed in red.

```svelte {runnable}
<SvGrid {data} {columns} getRowId={(r) => r.id}
  gantt={pro({
    startField: 'start', endField: 'end', parentField: 'parentId',
    dependencies,
    criticalPath: true,
    tableColumns: ['name', '__duration', '__slack'],
    onCriticalPathChange: (keys) => console.log('critical', keys),
  })} />
```

The `__slack` column says how many whole **working** days of room each task
has; the critical ones read 0. A phase reports the least slack of the tasks
under it.

The passes run in working time, the same time the durations are in: a task's
length is its working days, its latest start is counted back over working
days, and a weekend between a task and its successor is not room. A five-day
task ending Friday whose successor starts Monday is critical - it cannot slip
a working day - where a calendar count would give it two days of slack. Set
`respectWorkingTime: false` to schedule in calendar time throughout.

Rules worth knowing, because each is a judgement call rather than arithmetic:

- **A task in no dependency is never critical**, however late it runs. It is not
  on any path, so calling it critical would point at something the schedule does
  not actually turn on. It still gets a slack figure for the `__slack` column.
- **Cyclic links are ignored**, exactly as the cascade ignores them: a cycle has
  no legal schedule, so there is no earliest or latest to compute through it.
- **Folding a phase changes nothing.** The passes run over every task, visible
  or not, and a folded phase over a critical task carries the ring on its
  summary bar. Filtering is different: the Gantt only ever sees the rows the
  grid hands it, so a task the search box hides is out of the schedule until
  it is back.
- **It recomputes on every edit.** Drag a critical task shorter and the title
  passes to whichever chain is longest next; `onCriticalPathChange` fires each
  time with the task ids.

The pass is a pure function, so a report, a KPI or a test can call it without
rendering anything:

```ts
import { criticalPath, slackDays, makeCalendar } from '@svgrid/enterprise'

const result = criticalPath(times, dependencies, makeCalendar()) // times: Map<id, { start: Date; end: Date }>
result.critical              // Set<string> of task ids
result.finish                // the earliest the project can end
slackDays(result, 'task-7')  // whole working days of room (calendar days without the calendar)
```

The portfolio console's risk register is exactly that call: the open tasks
with under three days of slack, from the same pass the chart draws.

<div data-docs-demo="481-gantt-portfolio-console" data-height="700"></div>

## Baselines

`baselineStartField` / `baselineEndField` draw the originally agreed dates as a
**ghost bar** under each task. Where the plan now finishes later than the
baseline did, the ghost turns red and the tooltip says by how many days.

```svelte {runnable}
<SvGrid {data} {columns} getRowId={(r) => r.id}
  gantt={pro({
    startField: 'start', endField: 'end', parentField: 'parentId',
    baselineStartField: 'bStart', baselineEndField: 'bEnd',
    tooltip: true,
  })} />
```

Baselines are per task. A phase draws none of its own - its drift is the
drift of its tasks - and the programme demo counts the sites running late from
the same two fields.

## Constraints

`constraintField` pins a task's dates in the classic planning vocabulary, with
the date itself in `constraintDateField`:

| Constraint | Means |
| --- | --- |
| `ASAP` *(default)* | Schedule as early as the links allow. |
| `ALAP` | As late as possible. |
| `MSO` / `MFO` | Must start / finish **on** the date. |
| `SNET` / `SNLT` | Start no earlier / no later than. |
| `FNET` / `FNLT` | Finish no earlier / no later than. |

```svelte {runnable}
<SvGrid {data} {columns} getRowId={(r) => r.id}
  gantt={pro({
    startField: 'start', endField: 'end', parentField: 'parentId',
    dependencies,
    constraintField: 'con', constraintDateField: 'conDate',
    editable: true,
    tooltip: true,
    onTaskMove: (e) => writeSpan(e.row, e.start, e.end),
    onTaskResize: (e) => writeSpan(e.row, e.start, e.end),
    onDependenciesChange: (moves) => {
      for (const m of moves) {
        const row = data.find((r) => r.id === m.id)
        if (row) writeSpan(row, m.start, m.end)
      }
    },
  })} />
```

A constrained task draws a **pin at the date the constraint names** - a flag
at the top of its row and a dashed tick down through it - which stays put
while the bar is dragged toward it. The tooltip spells the rule out. A task
whose own dates already break its rule gets a dashed red outline and a red
pin.

More usefully, the **cascade respects the ceiling**: pushing a chain into a
task that must finish by a contract date stops *at* the date and leaves the
link drawn as unsatisfied, rather than overrunning it silently. Drag
Implementation to the right above and watch Release stop at its pin. A
constraint and a dependency that disagree have no schedule satisfying both, so
showing the conflict beats breaking one of them behind your back.

All three together, on a fit-out with two pinned tasks:

<div data-docs-demo="476-gantt-critical-path" data-height="620"></div>

## See also

- [Dependencies](./dependencies.md) - the links the passes run over.
- [Resource load](./resources.md) - the other half of the planning layer.
- [Config reference](./api.md#gantt-pro) - the Pro options in one table.
