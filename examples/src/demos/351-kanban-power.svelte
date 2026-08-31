<script lang="ts">
  // Kanban board rendering is an Enterprise feature - register the renderer.
  import { enableBoardView } from "@svgrid/enterprise";
  enableBoardView();
  /**
   * 351. Board power tools: filters, multi-select, flags, menus
   * ----------------------------------------------------------
   * A facet filter bar (by tag + assignee), card multi-select with bulk move
   * (click / Ctrl-click, then drag the group), a "blocked" flag, a card-age
   * badge, and both card + lane right-click menus - all from `board` config on
   * the built-in default card.
   */
  import { SvGrid, tableFeatures, rowSortingFeature, columnFilteringFeature, type ColumnDef, type BoardCardMoveEvent } from '@svgrid/grid'

  type Task = {
    id: number
    title: string
    status: string
    tags: string[]
    assignee: string
    blocked: boolean
    created: string
  }

  const features = tableFeatures({ rowSortingFeature, columnFilteringFeature })
  let view = $state<'board' | 'table'>('board')
  let selectedCount = $state(0)

  let seq = 100
  let rows = $state<Task[]>([
    { id: 1, title: 'Auth refresh tokens', status: 'todo', tags: ['backend'], assignee: 'Sam Rivera', blocked: false, created: '2026-07-10' },
    { id: 2, title: 'Board DnD polish', status: 'in_progress', tags: ['ui'], assignee: 'Lee Park', blocked: true, created: '2026-07-05' },
    { id: 3, title: 'Facet filter bar', status: 'in_progress', tags: ['ui', 'feature'], assignee: 'Sam Rivera', blocked: false, created: '2026-07-18' },
    { id: 4, title: 'Perf: virtual lanes', status: 'review', tags: ['perf'], assignee: 'Ada Cole', blocked: false, created: '2026-06-28' },
    { id: 5, title: 'Docs sweep', status: 'todo', tags: ['docs'], assignee: 'Lee Park', blocked: false, created: '2026-07-20' },
    { id: 6, title: 'Release 1.4', status: 'done', tags: ['release'], assignee: 'Ada Cole', blocked: false, created: '2026-07-01' },
    { id: 7, title: 'Keyboard a11y', status: 'todo', tags: ['ui'], assignee: 'Sam Rivera', blocked: true, created: '2026-07-12' },
  ])

  const columns: ColumnDef<any, Task>[] = [
    { field: 'title', header: 'Task', editorType: 'text' },
    { field: 'assignee', header: 'Assignee', editorType: 'text' },
    { field: 'status', header: 'Status' },
  ]

  let lanes = $state([
    { id: 'todo', title: 'To do' },
    { id: 'in_progress', title: 'In progress', color: '#f59e0b' },
    { id: 'review', title: 'Review', color: '#8b5cf6' },
    { id: 'done', title: 'Done', color: '#22c55e' },
  ])
  function renameLane(laneId: string, title: string) {
    const l = lanes.find((x) => x.id === laneId)
    if (l) l.title = title
  }

  function onCardMove(e: BoardCardMoveEvent<Task>) {
    e.row.status = e.toLane
  }

  function cardMenu(row: Task, ctx: { lanes: { id: string; title?: string }[]; moveTo: (id: string) => void }) {
    return [
      {
        label: 'Move to',
        children: ctx.lanes.filter((l) => l.id !== row.status).map((l) => ({ label: l.title ?? l.id, onSelect: () => ctx.moveTo(l.id) })),
      },
      { label: row.blocked ? 'Unblock' : 'Mark blocked', onSelect: () => (row.blocked = !row.blocked) },
      { separator: true },
      { label: 'Delete', onSelect: () => (rows = rows.filter((r) => r !== row)) },
    ]
  }

  function laneMenu(laneId: string, ctx: { cards: Task[]; addCard: (t?: string) => void }) {
    return [
      { label: 'Add card', onSelect: () => ctx.addCard('New task') },
      { label: `Clear lane (${ctx.cards.length})`, disabled: ctx.cards.length === 0, onSelect: () => (rows = rows.filter((r) => !ctx.cards.includes(r))) },
    ]
  }

  function addCard(laneId: string, title?: string) {
    rows = [...rows, { id: ++seq, title: title || 'New task', status: laneId, tags: [], assignee: 'Unassigned', blocked: false, created: new Date().toISOString().slice(0, 10) }]
  }
</script>

<section class="flex flex-col flex-1 min-h-0 gap-3">
  <div class="flex items-center justify-between gap-3 shrink-0">
    <div class="text-sm kb-note">
      The same <strong>&lt;SvGrid&gt;</strong>, two views. Filter by the chips, <strong>click</strong>
      / <kbd>Ctrl</kbd>-click to multi-select then drag the group, <strong>right-click</strong> a card
      or a lane header for menus, and <strong>double-click a lane title</strong> to rename.
      A <strong>Blocked</strong> card is locked - you can't drag it until you unblock it
      (right-click -> Unblock); the small badge is card age.
    </div>
    <div class="inline-flex rounded-md border overflow-hidden text-sm shrink-0 kb-seg">
      <button class="px-3 py-1 kb-seg-btn {view === 'board' ? 'is-on' : ''}"
        onclick={() => (view = 'board')}>Board</button>
      <button class="px-3 py-1 kb-seg-btn {view === 'table' ? 'is-on' : ''}"
        onclick={() => (view = 'table')}>Table</button>
    </div>
  </div>

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
          labelsField: 'tags',
          assigneesField: 'assignee',
          flagField: 'blocked',
          ageField: 'created',
          facets: ['tags', 'assignee'],
          selectable: true,
          onSelectionChange: (sel) => (selectedCount = sel.length),
          laneSummary: (list) => `${list.length}`,
          onCardMove,
          onCardAdd: addCard,
          onLaneRename: renameLane,
          cardMenu,
          laneMenu,
        }}
      />
    {:else}
      <SvGrid responsive={true}
        data={rows}
        columns={columns}
        features={features}
        getRowId={(r) => String(r.id)}
        sortable
        filterable
        enableInlineEditing
        rowHeight={36}
        containerHeight="100%"
        fitColumns
      />
    {/if}
  </div>

  <footer class="text-sm shrink-0 kb-note">
    {rows.length} tasks · {rows.filter((t) => t.blocked).length} blocked · {selectedCount} selected
  </footer>
</section>

<style>
  .kb-note { color: var(--sg-muted, #64748b); }
  .kb-seg { border-color: var(--sg-border, #cbd5e1); }
  .kb-seg-btn {
    background: transparent;
    color: var(--sg-fg, #0f172a);
  }
  .kb-seg-btn.is-on {
    background: var(--sg-accent, #1e293b);
    color: var(--sg-on-accent, #fff);
  }
</style>
