<script lang="ts">
  // Kanban board rendering is an Enterprise feature - register the renderer.
  import { enableBoardView } from "@svgrid/enterprise";
  enableBoardView();
  /**
   * 344. Sprint board (swimlanes + WIP + points)
   * --------------------------------------------
   * An agile sprint board: status lanes crossed with a swimlane per assignee,
   * an enforced WIP limit on "In progress", and a story-point roll-up in every
   * lane header via `board.laneSummary`. Drag across a band to reassign the
   * assignee too.
   */
  import { SvGrid, SvAvatar, SvChip, tableFeatures, rowSortingFeature, columnFilteringFeature, type ColumnDef, type BoardCardMoveEvent, type BoardCardCommitEvent } from '@svgrid/grid'

  const features = tableFeatures({ rowSortingFeature, columnFilteringFeature })
  let view = $state<'board' | 'table'>('board')

  type Story = {
    id: number
    title: string
    status: string
    assignee: string
    points: number
    priority: 'Low' | 'Medium' | 'High'
  }

  let rows = $state<Story[]>([
    { id: 1, title: 'Auth: refresh tokens', status: 'in_progress', assignee: 'Sam Rivera', points: 5, priority: 'High' },
    { id: 2, title: 'Board drag-and-drop', status: 'in_progress', assignee: 'Lee Park', points: 8, priority: 'High' },
    { id: 3, title: 'Empty states', status: 'todo', assignee: 'Sam Rivera', points: 2, priority: 'Low' },
    { id: 4, title: 'Dark theme audit', status: 'review', assignee: 'Ada Cole', points: 3, priority: 'Medium' },
    { id: 5, title: 'Docs: board mode', status: 'todo', assignee: 'Lee Park', points: 3, priority: 'Medium' },
    { id: 6, title: 'Release 1.3.0', status: 'done', assignee: 'Ada Cole', points: 5, priority: 'High' },
    { id: 7, title: 'Keyboard a11y', status: 'todo', assignee: 'Sam Rivera', points: 5, priority: 'High' },
    { id: 8, title: 'Perf: virtual lanes', status: 'review', assignee: 'Lee Park', points: 8, priority: 'Medium' },
  ])

  const columns: ColumnDef<any, Story>[] = [
    { field: 'title', header: 'Story', editorType: 'text' },
    { field: 'assignee', header: 'Assignee', editorType: 'text' },
    { field: 'points', header: 'Points', editorType: 'number' },
    { field: 'priority', header: 'Priority', editorType: 'text' },
    { field: 'status', header: 'Status' },
  ]

  const lanes = [
    { id: 'todo', title: 'To do' },
    { id: 'in_progress', title: 'In progress', color: '#f59e0b', wipLimit: 2 },
    { id: 'review', title: 'Review', color: '#8b5cf6' },
    { id: 'done', title: 'Done', color: '#22c55e' },
  ]

  const chipVariant = (p: Story['priority']) => (p === 'High' ? 'danger' : p === 'Medium' ? 'warning' : 'neutral')

  const points = (list: Story[]) => list.reduce((s, r) => s + r.points, 0)

  function onCardMove(e: BoardCardMoveEvent<Story>) {
    e.row.status = e.toLane
    if (e.toSwimlane != null) e.row.assignee = e.toSwimlane
  }
  function onCardCommit(e: BoardCardCommitEvent<Story>) {
    Object.assign(e.row, e.values)
  }
</script>

<section class="flex flex-col flex-1 min-h-0 gap-3">
  <div class="flex items-center justify-between gap-3 shrink-0">
    <div class="kb-note text-sm">
      The same <strong>&lt;SvGrid&gt;</strong>, two views. Status lanes x an assignee
      swimlane; <strong>In progress</strong> caps at 2 (enforced); each header sums its
      story points.
    </div>
    <div class="kb-seg inline-flex rounded-md border overflow-hidden text-sm shrink-0">
      <button class="kb-seg-btn px-3 py-1 {view === 'board' ? 'kb-on' : ''}"
        onclick={() => (view = 'board')}>Board</button>
      <button class="kb-seg-btn px-3 py-1 {view === 'table' ? 'kb-on' : ''}"
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
          swimlaneBy: 'assignee',
        collapsibleSwimlanes: true,
          enforceWip: true,
          collapsibleLanes: true,
          editable: true,
          laneSummary: (list) => `${points(list as Story[])} pts`,
          swimlaneSummary: (list) => `${points(list as Story[])} pts`,
          onCardMove,
          onCardCommit,
          card: storyCard,
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
        showPagination={false}
        rowHeight={36}
        containerHeight="100%"
        fitColumns
      />
    {/if}
  </div>

  <footer class="kb-muted text-sm shrink-0">
    {rows.length} stories · {points(rows)} points committed
  </footer>
</section>

{#snippet storyCard(s: Story)}
  <div class="flex flex-col gap-1.5">
    <div class="font-semibold text-[0.82rem] leading-snug">{s.title}</div>
    <div class="flex items-center justify-between gap-2">
      <span class="kb-muted inline-flex items-center gap-1.5 text-[0.72rem]">
        <SvAvatar name={s.assignee} size={18} />
        {s.assignee.split(' ')[0]}
      </span>
      <span class="inline-flex items-center gap-1.5">
        <SvChip variant={chipVariant(s.priority)} size="sm">{s.priority}</SvChip>
        <span class="kb-muted text-[0.7rem] font-semibold">{s.points}</span>
      </span>
    </div>
  </div>
{/snippet}

<style>
  .kb-note  { color: var(--sg-muted, #475569); }
  .kb-muted { color: var(--sg-muted, #64748b); }
  .kb-seg   { border-color: var(--sg-border, #cbd5e1); }
  .kb-seg-btn {
    background: transparent;
    color: inherit;
    border: 0;
    cursor: pointer;
  }
  .kb-seg-btn.kb-on { background: var(--sg-accent, #1e293b); color: var(--sg-on-accent, #fff); }
</style>
