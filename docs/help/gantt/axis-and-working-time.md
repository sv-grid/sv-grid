# Gantt: the axis and working time

The time axis: its five presets and how to move between them, the window it
spans, the today line, non-working days and holidays, and the Enterprise
option that folds weekends out of the chart.

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
    { id: 't4', name: 'Hardening', parentId: 'p2', start: at(26), end: at(39), progress: 0, owner: 'Lena' },
    { id: 'm1', name: 'Launch', parentId: null, start: at(40), milestone: true },
  ])
  const holidays = [at(17)]

  const columns: GridColumns<Task> = [
    { field: 'name', header: 'Task', width: 200 },
    { field: 'owner', header: 'Owner', width: 100 },
  ]

  const pro = (c: GanttProConfig<any, Task>) => c
</script>
```

## Zoom presets

Five axis presets, each a tick unit under a coarser grouping row:

| `zoom` | Ticks | Grouped by | Tick width |
| --- | --- | --- | --- |
| `day` | days (named) | weeks | 48 px |
| `week` *(default)* | days | months | 28 px |
| `month` | weeks | months | 40 px |
| `quarter` | months | quarters | 96 px |
| `year` | months | years | 72 px |

```svelte {runnable}
<SvGrid {data} {columns} getRowId={(r) => r.id}
  gantt={{ startField: 'start', endField: 'end', parentField: 'parentId', zoom: 'month' }} />
```

The toolbar shows a zoom stepper over `zoomLevels` (all five by default; a
single entry hides it), and `Ctrl`/`Cmd`+wheel over the chart steps it too,
keeping the date under the pointer fixed. `onZoomChange` reports the change.
`zoom` is the preset the chart **opens** on; the stepper owns it afterwards.

```svelte {runnable}
<SvGrid {data} {columns} getRowId={(r) => r.id}
  gantt={{
    startField: 'start', endField: 'end', parentField: 'parentId',
    zoom: 'quarter',
    zoomLevels: ['month', 'quarter', 'year'],
    onZoomChange: (z) => console.log('zoom', z),
  }} />
```

Pick the ladder for the plan. A sprint reads at `day` / `week`; a roadmap at
`month` / `quarter` / `year`, which is what the roadmap demo does:

<div data-docs-demo="479-gantt-roadmap" data-height="620"></div>

## The window

The axis spans the first start to the last finish plus `rangePaddingDays` (7)
of slack on each side, clamped by `minDate` / `maxDate`. A drag cannot leave
the clamped window either.

Tick widths are the axis's **natural** size, the one it scrolls at. When the
whole window is narrower than the pane beside the task table the ticks stretch
to fill it, so a short plan at a coarse zoom never stops two thirds of the way
across. The chart opens with today a third of the way in (or the first task,
when today is outside the window).

A dashed **today line** crosses the chart; `todayLine: false` hides it.

## Non-working days and holidays

Non-working days are shaded, and every duration and cascade calculation skips
them: a `durationField` of three days starting Thursday ends Tuesday, and a
cascaded start never lands on a Sunday.

```svelte {runnable}
<SvGrid {data} {columns} getRowId={(r) => r.id}
  gantt={{
    startField: 'start', endField: 'end', parentField: 'parentId',
    nonWorkingDays: [0, 6],   // Sun + Sat, the default
    holidays,
    weekStartsOn: 1,
    zoom: 'week',
  }} />
```

| Option | Meaning |
| --- | --- |
| `nonWorkingDays` | Weekday numbers, 0 = Sunday. Default `[0, 6]`. |
| `holidays` | Specific dates (a `Date`, epoch-ms or ISO string each) that are off. |
| `showNonWorking` | Shade the columns. Default `true`. |
| `weekStartsOn` | First day of the week for the `day` and `month` presets' tick grouping, 0-6. Default 0. |
| `respectWorkingTime` | Schedule in working time: a moved or cascaded task lands on a working day and keeps its working length; slack is in working days. Default `true`. |

Shading is drawn for the day-granular presets. At `month` and coarser a tick
spans several days and is never wholly off, so the shading is skipped rather
than painting a partial column.

## Folding weekends out of the axis

**Enterprise.** `collapseWeekends` takes the whole non-working days out of the
timeline and leaves a narrow hatched marker where each run was, so a quarter
fits in the width a month used to take. Working days keep their real size -
nothing is squashed - and a task that does run over a folded weekend still
draws across it.

```svelte {runnable}
<SvGrid {data} {columns} getRowId={(r) => r.id}
  gantt={pro({
    startField: 'start', endField: 'end', parentField: 'parentId',
    zoom: 'week', collapseWeekends: true, collapsedGapPx: 10,
  })} />
```

`collapsedGapPx: 0` removes the folded days outright: Friday's finish and
Monday's start land on the same pixel. Only the day-granular presets (`day`,
`week`) have weekend columns to fold; at `month` and coarser a tick is never
wholly non-working, so the option is ignored rather than shrinking a week by
part of itself. The resource demo has a toggle for it:

<div data-docs-demo="477-gantt-resources" data-height="620"></div>

## See also

- [Getting started](./start.md) - how dates and durations are read.
- [Dependencies](./dependencies.md) - the cascade that respects working time.
- [Config reference](./api.md) - the axis options in one table.
