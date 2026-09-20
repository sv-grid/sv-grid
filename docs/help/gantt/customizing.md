# Gantt: custom bars, tooltips and menus

What the chart draws inside a bar, says on hover and offers on right-click are
all yours to replace: two snippets, a menu builder, and a handful of CSS
custom properties for the colours.

```svelte {preamble}
<script lang="ts">
  import { SvGrid, SvAvatar, type GridColumns, type MenuItem } from '@svgrid/grid'
  import { enableGanttView } from '@svgrid/enterprise'

  enableGanttView()

  type Task = {
    id: string
    name: string
    owner?: string
    status?: 'On track' | 'At risk' | 'Done'
    start: string
    end?: string
    progress?: number
    parentId?: string | null
    milestone?: boolean
    color?: string
  }

  const STATUS = { 'On track': '#2563eb', 'At risk': '#d97706', Done: '#16a34a' } as const

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
    { id: 'p1', name: 'Discovery', parentId: null, start: at(0) },
    { id: 't1', name: 'Interviews', parentId: 'p1', start: at(0), end: at(6), progress: 100, owner: 'Priya', status: 'Done', color: STATUS.Done },
    { id: 't2', name: 'Synthesis', parentId: 'p1', start: at(7), end: at(13), progress: 40, owner: 'Marco', status: 'At risk', color: STATUS['At risk'] },
    { id: 'p2', name: 'Build', parentId: null, start: at(14) },
    { id: 't3', name: 'Implementation', parentId: 'p2', start: at(14), end: at(27), progress: 10, owner: 'Sven', status: 'On track', color: STATUS['On track'] },
    { id: 'm1', name: 'Launch', parentId: null, start: at(28), milestone: true, color: '#f59e0b' },
  ])

  const columns: GridColumns<Task> = [
    { field: 'name', header: 'Task', width: 200 },
    { field: 'owner', header: 'Owner', width: 100 },
  ]

  const fmt = (d?: string) => (d ? new Date(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : '')
</script>
```

## The bar body

`task` is a snippet that receives the row and replaces the built-in label
inside a **task** bar. It gets the bar's full width and height and clips its
own overflow, so keep it to one line: an avatar, a name, a chip.

```svelte {runnable}
<script lang="ts">
  const cfg = {
    startField: 'start' as const, endField: 'end' as const, parentField: 'parentId' as const,
    progressField: 'progress' as const, milestoneField: 'milestone' as const, colorField: 'color' as const,
    task: bar,
  }
</script>

{#snippet bar(row: Task)}
  <span style="display:inline-flex; align-items:center; gap:6px; padding:0 6px; color:#fff; font-size:0.76rem; min-width:0">
    <SvAvatar name={row.owner ?? '?'} size={16} />
    <span style="overflow:hidden; text-overflow:ellipsis; white-space:nowrap; font-weight:600">{row.name}</span>
    <span style="padding:1px 6px; border-radius:999px; background:rgba(255,255,255,.22); font-size:0.66rem">{row.status}</span>
  </span>
{/snippet}

<SvGrid {data} {columns} getRowId={(r) => r.id} gantt={cfg} />
```

Two things the snippet does not touch. A phase's **summary bar** keeps its
plain label - the spine is a few pixels tall and has no room for a body - and a
**milestone** has no body at all. The progress fill still draws under the
snippet, so a bar with a body reads its percent the same way.

`labelPosition` is for the built-in label only: `'inside'` (the default, with
a fallback to the right of a bar too narrow for its text), always `'right'`, or
`'none'`.

## The tooltip

`tooltip: true` shows the built-in hover card: title, dates, working days and
percent, plus the resource, slack, baseline drift and constraint when those
options are on. Pass a snippet instead for your own:

```svelte {runnable}
<script lang="ts">
  const cfg = {
    startField: 'start' as const, endField: 'end' as const, parentField: 'parentId' as const,
    progressField: 'progress' as const, milestoneField: 'milestone' as const, colorField: 'color' as const,
    tooltip: tip,
    tooltipDelay: 200,
  }
</script>

{#snippet tip(row: Task)}
  <div style="display:flex; flex-direction:column; gap:3px">
    <strong>{row.name}</strong>
    {#if row.milestone}
      <span style="font-size:0.74rem; opacity:.85">Milestone on {fmt(row.start)}</span>
    {:else if row.parentId}
      <span style="font-size:0.74rem; opacity:.85">{row.owner} - {row.status} - {fmt(row.start)} to {fmt(row.end)}</span>
      <span style="font-size:0.74rem; opacity:.85">{row.progress}% done</span>
    {/if}
  </div>
{/snippet}

<SvGrid {data} {columns} getRowId={(r) => r.id} gantt={cfg} />
```

The card is positioned above the bar and portalled to the body, so it is never
clipped by the scroll container. `tooltipDelay` is the hover delay in ms
(default 400). Omit `tooltip` and there is none.

## The context menu

Right-click on a bar opens a menu of what the config makes possible: **Edit**
with the drawer, **Add subtask** with `onTaskAdd`, **Delete** with
`onTaskDelete`. `taskMenu` appends items of your own - return `MenuItem`s,
or `undefined` to add nothing for that row:

```svelte {runnable}
<script lang="ts">
  let last = $state('')
  const taskMenu = (row: Task): MenuItem[] | undefined => {
    if (!row.parentId) return undefined // nothing extra on a phase
    return [
      { label: `Open ticket for ${row.name}`, onSelect: () => (last = `ticket: ${row.name}`) },
      { label: 'Mark done', onSelect: () => { row.progress = 100; row.status = 'Done'; row.color = STATUS.Done } },
    ]
  }
</script>

<p style="margin:0 0 8px; font-size:0.8rem">Right-click a task. Last action: <code>{last || 'none'}</code></p>
<SvGrid {data} {columns} getRowId={(r) => r.id}
  gantt={{
    startField: 'start', endField: 'end', parentField: 'parentId',
    progressField: 'progress', milestoneField: 'milestone', colorField: 'color',
    taskMenu,
  }} />
```

With `editable` and `onDependencyRemove`, right-clicking an arrow offers to
remove that link.

## Colours and the CSS hooks

A bar takes its colour from `colorField` (per task) or `color` (all of them);
the fill inside it is a darker shade of the same colour, and the summary spine
a lighter one, so one field colours a whole phase. Colour by team, by status,
by trade - the roadmap demo colours by status and keeps the team in the table:

<div data-docs-demo="479-gantt-roadmap" data-height="620"></div>

The chrome reads the grid's `--sg-*` tokens, so a theme that restyles the
table restyles the chart. A few Gantt-specific properties sit on top, set them
on any ancestor:

| Property | Colours |
| --- | --- |
| `--sv-gantt-accent` | The default bar colour when a task has none. |
| `--sv-gantt-dep` | Dependency arrows. |
| `--sv-gantt-dep-bad` | Violated links, a broken constraint's outline and pin, the late baseline ghost. |
| `--sv-gantt-critical` | The critical path ring and its arrows. |

```css
.my-plan {
  --sv-gantt-critical: #b91c1c;
  --sv-gantt-dep: #64748b;
}
```

## See also

- [Editing](./editing.md) - the drawer and the gestures the menu items sit beside.
- [Theming with tokens](../tokens.md) - the `--sg-*` tokens the chrome reads.
- [SvMenu](../ui-components/sv-menu.md) - the `MenuItem` shape `taskMenu` returns.
