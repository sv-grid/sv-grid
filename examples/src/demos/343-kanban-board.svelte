<script lang="ts">
  // Kanban board rendering is an Enterprise feature - register the renderer.
  import { enableBoardView } from "@svgrid/enterprise";
  enableBoardView();
  /**
   * 343. Kanban board mode
   * ----------------------
   * The SAME <SvGrid responsive={true}>, same data + columns, rendered two ways: as a table, or
   * as a Kanban board by setting one `board` prop. Lanes are bucketed by the
   * `status` field; drag a card to another lane and `onCardMove` reassigns
   * that field on your own data (and reorders). WIP limits, an add-card
   * button, and a rich card snippet (assignee avatar + priority chip) round
   * it out.
   */
  import {
    SvGrid,
    SvAvatar,
    SvChip,
    tableFeatures,
    rowSortingFeature,
    type ColumnDef,
    type BoardCardMoveEvent,
    type BoardCardCommitEvent,
  } from '@svgrid/grid'

  type Task = {
    id: number
    title: string
    status: string
    assignee: string
    priority: 'Low' | 'Medium' | 'High'
    points: number
    comments: string[]
    attachments: number
  }

  let seq = 100
  let rows = $state<Task[]>([
    { id: 1, title: 'Design the board layout', status: 'backlog', assignee: 'Sam Rivera', priority: 'Medium', points: 3, comments: ['Start from the grid model', 'Agreed'], attachments: 1 },
    { id: 2, title: 'Lane drag + drop', status: 'in_progress', assignee: 'Lee Park', priority: 'High', points: 5, comments: ['Overlay approach works well'], attachments: 0 },
    { id: 3, title: 'Default card template', status: 'in_progress', assignee: 'Sam Rivera', priority: 'Medium', points: 2, comments: [], attachments: 2 },
    { id: 4, title: 'WIP limit styling', status: 'review', assignee: 'Ada Cole', priority: 'Low', points: 1, comments: ['Use the danger token'], attachments: 0 },
    { id: 5, title: 'Docs page', status: 'backlog', assignee: 'Lee Park', priority: 'Low', points: 2, comments: [], attachments: 0 },
    { id: 6, title: 'Ship 1.3.0', status: 'done', assignee: 'Ada Cole', priority: 'High', points: 8, comments: ['Tagged and released', 'Nice work all'], attachments: 3 },
    { id: 7, title: 'Keyboard DnD (a11y)', status: 'backlog', assignee: 'Sam Rivera', priority: 'High', points: 5, comments: ['APG pattern refs added'], attachments: 1 },
  ])

  const features = tableFeatures({ rowSortingFeature })

  const columns: ColumnDef<typeof features, Task>[] = [
    { field: 'title', header: 'Task', editorType: 'text', width: 240 },
    { field: 'assignee', header: 'Assignee', editorType: 'text', width: 140 },
    { field: 'priority', header: 'Priority', editorType: 'text', width: 110 },
    { field: 'points', header: 'Points', editorType: 'number', width: 90 },
    { field: 'status', header: 'Status', editorType: 'text', width: 130 },
  ]

  const lanes = [
    { id: 'backlog', title: 'Backlog' },
    { id: 'in_progress', title: 'In progress', color: '#f59e0b', wipLimit: 3 },
    { id: 'review', title: 'Review', color: '#8b5cf6' },
    { id: 'done', title: 'Done', color: '#22c55e' },
  ]

  let view = $state<'board' | 'table'>('board')
  let swimlane = $state<'none' | 'assignee'>('none')

  const chipVariant = (p: Task['priority']) =>
    p === 'High' ? 'danger' : p === 'Medium' ? 'warning' : 'neutral'

  // The board does the whole move itself (lane reassign + reorder) - drag-drop
  // and keyboard both just work with no code here. `onCardMove` is optional:
  // we mirror the new lane onto our own row so the Table view agrees (this is
  // also where you'd persist to a backend).
  function onCardMove(e: BoardCardMoveEvent<Task>) {
    e.row.status = e.toLane
    // Dragging across swimlane bands also reassigns the swimlane field.
    if (e.toSwimlane != null) e.row.assignee = e.toSwimlane
  }

  // The board's built-in editor already applied the edit to its overlay; we
  // mirror it onto our row so the Table view (and persistence) agree.
  function onCardCommit(e: BoardCardCommitEvent<Task>) {
    Object.assign(e.row, e.values)
  }

  function addCard(laneId: string) {
    rows = [
      ...rows,
      { id: ++seq, title: 'New task', status: laneId, assignee: 'Unassigned', priority: 'Medium', points: 1, comments: [], attachments: 0 },
    ]
  }

  // Right-click a card for a context menu: edit, a "Move to" submenu of the
  // other lanes (board-native ctx.moveTo), set priority, and delete.
  function cardMenu(row: Task, ctx: { lanes: { id: string; title?: string }[]; moveTo: (id: string) => void; edit: () => void }) {
    return [
      { label: 'Edit', onSelect: () => ctx.edit() },
      {
        label: 'Move to',
        children: ctx.lanes
          .filter((l) => l.id !== row.status)
          .map((l) => ({ label: l.title ?? l.id, onSelect: () => ctx.moveTo(l.id) })),
      },
      {
        label: 'Priority',
        children: (['Low', 'Medium', 'High'] as const).map((p) => ({
          label: p,
          onSelect: () => (row.priority = p),
        })),
      },
      { separator: true },
      { label: 'Delete', onSelect: () => (rows = rows.filter((r) => r !== row)) },
    ]
  }
</script>

<section class="flex flex-col flex-1 min-h-0 gap-3">
  <div class="flex items-center justify-between gap-3 shrink-0">
    <div class="text-sm text-slate-600 dark:text-slate-300">
      The same grid, two views. Drag a card, or focus one and use <kbd>Space</kbd>
      + arrows. <strong>Double-click</strong> to edit, <strong>right-click</strong> for a
      context menu, search to filter, collapse a lane, and switch on swimlanes.
      <strong>In progress</strong> has an enforced WIP limit of 3.
    </div>
    <div class="inline-flex rounded-md border border-slate-300 dark:border-slate-600 overflow-hidden text-sm shrink-0">
      <button
        class="px-3 py-1 {view === 'board' ? 'bg-slate-800 text-white' : 'bg-transparent'}"
        onclick={() => (view = 'board')}>Board</button>
      <button
        class="px-3 py-1 {view === 'table' ? 'bg-slate-800 text-white' : 'bg-transparent'}"
        onclick={() => (view = 'table')}>Table</button>
    </div>
  </div>

  {#if view === 'board'}
    <div class="flex items-center gap-2 text-sm shrink-0">
      <span class="text-slate-500 dark:text-slate-400">Swimlanes:</span>
      <div class="inline-flex rounded-md border border-slate-300 dark:border-slate-600 overflow-hidden">
        <button
          class="px-2.5 py-0.5 {swimlane === 'none' ? 'bg-slate-800 text-white' : 'bg-transparent'}"
          onclick={() => (swimlane = 'none')}>None</button>
        <button
          class="px-2.5 py-0.5 {swimlane === 'assignee' ? 'bg-slate-800 text-white' : 'bg-transparent'}"
          onclick={() => (swimlane = 'assignee')}>By assignee</button>
      </div>
    </div>
  {/if}

  <div class="flex-1 min-h-0">
    {#if view === 'board'}
      <SvGrid responsive={true}
        data={rows}
        columns={columns}
        getRowId={(r) => String(r.id)}
        containerHeight="100%"
        board={{
          groupBy: 'status',
          lanes,
          editable: true,
          enforceWip: true,
          collapsibleLanes: true,
          swimlaneBy: swimlane === 'assignee' ? 'assignee' : undefined,
          collapsibleSwimlanes: true,
          commentsField: 'comments',
          attachmentsField: 'attachments',
          onCardMove,
          onCardCommit,
          onCardAdd: addCard,
          cardMenu,
          card: taskCard,
        }}
      />
    {:else}
      <SvGrid responsive={true}
        data={rows}
        columns={columns}
        features={features}
        getRowId={(r) => String(r.id)}
        sortable
        enableInlineEditing
        showPagination={false}
        rowHeight={36}
        containerHeight="100%"
        fitColumns
      />
    {/if}
  </div>

  <footer class="text-sm text-slate-500 dark:text-slate-400 shrink-0">
    {rows.length} tasks · {rows.reduce((s, r) => s + r.points, 0)} points
  </footer>
</section>

{#snippet taskCard(task: Task)}
  <div class="flex flex-col gap-2">
    <div class="font-semibold text-[0.84rem] leading-snug">{task.title}</div>
    <div class="flex items-center justify-between gap-2">
      <span class="inline-flex items-center gap-1.5 text-[0.74rem] text-slate-500 dark:text-slate-400">
        <SvAvatar name={task.assignee} size={20} />
        {task.assignee}
      </span>
      <SvChip variant={chipVariant(task.priority)}>{task.priority}</SvChip>
    </div>
    <div class="text-[0.7rem] text-slate-400">{task.points} pts</div>
  </div>
{/snippet}
