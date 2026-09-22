---
seoTitle: Build a sprint board in Svelte - Kanban on the data grid
seoDescription: A sprint board on a Svelte data grid: lanes and a WIP limit, points per lane, swimlanes, a card editor, a composer and a menu, blocked cards, saved layout.
keywords: svelte kanban board, sprint board svelte, kanban swimlanes, kanban wip limit, board table toggle grid
---

# Build a sprint board

One `board` prop turns the grid into a Kanban board, and the
[Kanban reference](../rows/kanban-board.md) lists what the prop can say.
This page builds a sprint board the way a team would want it, one
option at a time on the same rows: lanes in the right order with a
limit on work in progress, story points rolled up per lane, a swimlane
per person, cards that open an editor, a way to add one and a menu on
each, blocked cards that stay put, the layout saved across reloads, and
the Table button that shows the same rows as a grid.

The board renderer ships in `@svgrid/enterprise`; `enableBoardView()`
once lights it up, and the `board` prop itself is part of the free grid.
The examples share a sprint's worth of tasks.

```svelte {preamble}
<script lang="ts">
  import { SvGrid, SvAvatar, SvChip, tableFeatures, rowSortingFeature, type GridColumns, type MenuItem, type BoardMenuContext } from '@svgrid/grid'
  import { enableBoardView } from '@svgrid/enterprise'

  enableBoardView()

  type Status = 'backlog' | 'in_progress' | 'review' | 'done'
  type Task = {
    id: number
    title: string
    status: Status
    assignee: string
    priority: 'Low' | 'Medium' | 'High'
    points: number
    labels: string[]
    blocked: boolean
    due: string
    created: string
  }
  const task = (id: number, title: string, status: Status, assignee: string, priority: Task['priority'], points: number, extra: Partial<Task> = {}): Task =>
    ({ id, title, status, assignee, priority, points, labels: [], blocked: false, due: '2026-10-02', created: '2026-09-14', ...extra })

  let tasks = $state<Task[]>([
    task(1, 'API auth flow', 'backlog', 'Sam', 'High', 5, { labels: ['api'] }),
    task(2, 'Rate limiting', 'backlog', 'Lee', 'Medium', 3, { labels: ['api'] }),
    task(3, 'Board drag-and-drop', 'in_progress', 'Lee', 'High', 8, { blocked: true, labels: ['ui'] }),
    task(4, 'Empty states', 'in_progress', 'Sam', 'Low', 2, { labels: ['ui'] }),
    task(5, 'Dark theme audit', 'review', 'Ada', 'Medium', 3, { due: '2026-09-18' }),
    task(6, 'Onboarding email', 'review', 'Ada', 'Low', 1),
    task(7, 'Release 1.3.0', 'done', 'Ada', 'High', 5),
    task(8, 'Docs for the export menu', 'done', 'Sam', 'Low', 2),
  ])

  const columns: GridColumns<Task> = [
    { field: 'title', header: 'Task', width: 240, editorType: 'text' },
    { field: 'assignee', header: 'Assignee', width: 110, editorType: 'select', editorOptions: ['Ada', 'Lee', 'Sam'] },
    { field: 'priority', header: 'Priority', width: 100, editorType: 'select', editorOptions: ['Low', 'Medium', 'High'] },
    { field: 'points', header: 'Points', width: 80, editorType: 'number' },
    { field: 'due', header: 'Due', width: 110, editorType: 'date' },
    { field: 'status', header: 'Status', width: 120 },
  ]
  const features = tableFeatures({ rowSortingFeature })

  const lanes = [
    { id: 'backlog', title: 'Backlog' },
    { id: 'in_progress', title: 'In progress', color: '#f59e0b', wipLimit: 2 },
    { id: 'review', title: 'Review', color: '#8b5cf6' },
    { id: 'done', title: 'Done', color: '#22c55e' },
  ]
  const points = (rows: Task[]) => `${rows.reduce((s, r) => s + r.points, 0)} pts`

  let nextId = 100
  // A new array, not a push: the grid takes the rows again when `data` is
  // a different reference, and an in-place push never reaches the board.
  const addTask = (lane: string, title = 'New task') => { tasks = [...tasks, task(++nextId, title, lane as Status, 'Sam', 'Low', 1)] }
</script>
```

## Lanes from a field

`groupBy` names the field whose value is the lane. With nothing else the
lanes are the distinct values in first-seen order and every row is a
default card built from the columns. Drag a card to another lane: the
board moves it itself, tracked in an overlay keyed by row id, and
`onCardMove` is where the app writes the new status back so the rows
and the board agree.

```svelte {runnable}
<SvGrid data={tasks} {columns} getRowId={(r) => String(r.id)}
  board={{ groupBy: 'status', onCardMove: (e) => (e.row.status = e.toLane as Status) }}
  containerHeight={420} />
```

`getRowId` matters here: the move overlay stays pinned to the right row
across adds, removes and re-sorts by it. The board is keyboard-operable
as well: Space grabs a focused card, the arrows move it between lanes
and up and down within one, Escape puts it back, and every step is
announced.

## The order, the colours and a limit

An explicit `lanes` list fixes the order and gives each lane a title, a
colour and a `wipLimit`. Past the limit the header shows `count/limit`
and is flagged; `enforceWip` makes it hard, so a drag that would push
In progress past two snaps back.

```svelte {runnable}
<SvGrid data={tasks} {columns} getRowId={(r) => String(r.id)}
  board={{ groupBy: 'status', lanes, enforceWip: true, onCardMove: (e) => (e.row.status = e.toLane as Status) }}
  containerHeight={420} />
```

## Points per lane

`laneSummary` receives a lane's cards and returns a short string for its
header: story points here, a dollar sum on a deal board. `searchable`
is on by default, so the box above the board narrows every lane as you
type, and the grid's column filters and sort flow through to the lanes
too.

```svelte {runnable}
<SvGrid data={tasks} {columns} getRowId={(r) => String(r.id)}
  board={{ groupBy: 'status', lanes, laneSummary: points, searchPlaceholder: 'Find a task...', onCardMove: (e) => (e.row.status = e.toLane as Status) }}
  containerHeight={420} />
```

## A swimlane per person

`swimlaneBy` splits the board into a band per value of a second field,
each band the full set of lanes with its own cards. Dragging into a
lane under another band reassigns that field too, so `onCardMove`
carries `toSwimlane`. `collapsibleSwimlanes` folds a band from its
header, and `swimlaneSummary` is the roll-up per band.

```svelte {runnable}
<SvGrid data={tasks} {columns} getRowId={(r) => String(r.id)}
  board={{
    groupBy: 'status', lanes, laneSummary: points, swimlaneSummary: points,
    swimlaneBy: 'assignee', collapsibleSwimlanes: true,
    onCardMove: (e) => { e.row.status = e.toLane as Status; if (e.toSwimlane != null) e.row.assignee = e.toSwimlane },
  }}
  containerHeight={520} />
```

Drag one of Lee's cards into Ada's band: it is Ada's now. Because
`groupBy` is reactive, the lane axis can change at runtime too, bind it
to a Status / Assignee / Priority selector and the board re-buckets.

## Open a card

`editable` gives the board its built-in editor: double-click a card, or
F2 on a focused one, and the fields the columns declare an `editorType`
for become inputs. `drawer` opens a fuller `SvDrawer` + `SvForm` with
the UI-kit editors instead, all fields or the ones you list. Either way
the board applies the edit to its overlay and fires `onCardCommit` with
the changed fields, which is where the app persists.

```svelte {runnable}
<SvGrid data={tasks} {columns} getRowId={(r) => String(r.id)}
  board={{
    groupBy: 'status', lanes, laneSummary: points,
    drawer: { fields: ['title', 'assignee', 'priority', 'points', 'due'], title: (row) => row.title, side: 'right' },
    onCardCommit: (e) => Object.assign(e.row, e.values),
    onCardMove: (e) => (e.row.status = e.toLane as Status),
  }}
  containerHeight={420} />
```

The drawer does not close on an outside click, so a select opened
inside it or a stray click never loses an edit; Save, Escape or the
close button do. `onCardEdit` takes precedence over both when the app
has an editor of its own.

## Add a card, and a menu on each

`onCardAdd` puts a `+` on every lane header and fires with the lane;
`composer` adds a type-a-title box at the bottom of each lane that
calls the same hook with the title. `cardMenu` returns the items for a
right-click (or a long press), and its `ctx` carries `moveTo(laneId)`
and `edit()` so a Move to submenu is one line.

```svelte {runnable}
<script lang="ts">
  const cardMenu = (row: Task, ctx: BoardMenuContext<Task>): MenuItem[] => [
    { label: 'Edit', onSelect: ctx.edit },
    { label: 'Move to', children: ctx.lanes.filter((l) => l.id !== row.status).map((l) => ({ label: l.title ?? l.id, onSelect: () => ctx.moveTo(l.id) })) },
    { separator: true },
    { label: 'Remove', onSelect: () => (tasks = tasks.filter((t) => t.id !== row.id)) },
  ]
</script>

<SvGrid data={tasks} {columns} getRowId={(r) => String(r.id)}
  board={{
    groupBy: 'status', lanes, laneSummary: points, editable: true,
    composer: true, onCardAdd: (lane, title) => addTask(lane, title || 'New task'),
    cardMenu,
    onCardCommit: (e) => Object.assign(e.row, e.values),
    onCardMove: (e) => (e.row.status = e.toLane as Status),
  }}
  containerHeight={440} />
```

## Blocked, due and labelled

The default card grows a badge row from your fields: `labelsField` for
chips, `dueField` for a date that turns red when overdue, `ageField` for
a relative age, `assigneesField` for avatar initials. `flagField` marks
a blocked card with a red corner, and a blocked card is locked from
moving until it is unblocked, so blocking does something. `facets` puts
a chip bar above the board that filters by the listed fields.

```svelte {runnable}
<SvGrid data={tasks} {columns} getRowId={(r) => String(r.id)}
  board={{
    groupBy: 'status', lanes, laneSummary: points,
    labelsField: 'labels', dueField: 'due', ageField: 'created', assigneesField: 'assignee', flagField: 'blocked',
    facets: ['labels', 'assignee'],
    onCardMove: (e) => (e.row.status = e.toLane as Status),
  }}
  containerHeight={460} />
```

Try to drag Board drag-and-drop out of In progress: it stays, with the
Blocked badge saying why. `flagBlocksMoves: false` keeps the flag
visual only.

## Your own card

A `card` snippet replaces the default card body with anything: an
avatar, a chip, a progress bar from the UI kit. It receives the row,
and the badge row still draws under it.

```svelte {runnable}
<SvGrid data={tasks} {columns} getRowId={(r) => String(r.id)}
  board={{ groupBy: 'status', lanes, card: taskCard, dueField: 'due', onCardMove: (e) => (e.row.status = e.toLane as Status) }}
  containerHeight={440} />

{#snippet taskCard(t: Task)}
  <div style="font-weight: 600; font-size: 13px">{t.title}</div>
  <div style="display: flex; align-items: center; gap: 8px; margin-top: 6px">
    <SvAvatar name={t.assignee} size={20} />
    <SvChip variant={t.priority === 'High' ? 'danger' : 'neutral'}>{t.priority}</SvChip>
    <span style="font-size: 12px; margin-left: auto">{t.points} pts</span>
  </div>
{/snippet}
```

## Saved across reloads

`persistKey` saves the board's layout to `localStorage` under the key:
card positions and order, per-card edits, collapsed lanes, and restores
it on load. It is an overlay on the data, so with `onCardMove` mirrored
to the store the two stay in sync; `onLayoutChange` gives the same
layout to write elsewhere. Reload this page after a drag:

```svelte {runnable}
<SvGrid data={tasks} {columns} getRowId={(r) => String(r.id)}
  board={{ groupBy: 'status', lanes, persistKey: 'svgrid-docs-sprint-board', onCardMove: (e) => (e.row.status = e.toLane as Status) }}
  containerHeight={420} />
```

## The Table button

It is one grid. The same `data`, `columns` and `getRowId` with the
`board` prop absent is the table, sortable and editable, with the card
you moved already in its new status. Every board in the gallery ships
this switch, because it is the point.

```svelte {runnable}
<script lang="ts">
  let view = $state<'board' | 'table'>('board')
</script>

<div style="display: flex; gap: 4px; margin-bottom: 8px">
  <button type="button" onclick={() => (view = 'board')} aria-pressed={view === 'board'}>Board</button>
  <button type="button" onclick={() => (view = 'table')} aria-pressed={view === 'table'}>Table</button>
</div>
{#if view === 'board'}
  <SvGrid data={tasks} {columns} getRowId={(r) => String(r.id)}
    board={{ groupBy: 'status', lanes, laneSummary: points, editable: true, onCardCommit: (e) => Object.assign(e.row, e.values), onCardMove: (e) => (e.row.status = e.toLane as Status) }}
    containerHeight={420} />
{:else}
  <SvGrid data={tasks} {columns} {features} getRowId={(r) => String(r.id)} sortable editable rowHeight={34} containerHeight={420} />
{/if}
```

<div data-docs-demo="344-kanban-sprint" data-height="620"></div>

<div data-docs-demo="349-kanban-subtasks" data-height="620"></div>

## See also

- [Kanban board mode](../rows/kanban-board.md) - the reference: `BoardConfig` field by field, hierarchical cards, virtualized lanes, sub-tasks, comments, the ten board demos.
- [Scheduler: a booking calendar](../scheduler/booking-calendar.md) - the other view of the same rows, built the same way.
- [Editing](../editing/overview.md) - the `editorType` a column declares, which the card editor and the drawer read.
- [Saved views](../saved-views.md) - persisting a layout somewhere other than `localStorage`.
