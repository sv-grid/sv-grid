<script lang="ts">
  // Kanban board rendering is an Enterprise feature - register the renderer.
  import { enableBoardView } from "@svgrid/enterprise";
  enableBoardView();
  /**
   * 352. Epics -> stories (hierarchical cards)
   * ------------------------------------------
   * Point `board.childrenField` at a row's child rows and each card gains a
   * children count that expands to show its sub-cards inline - the Jira
   * epic -> stories shape. Each child shows its own title and status.
   */
  import { SvGrid, tableFeatures, rowSortingFeature, columnFilteringFeature, type ColumnDef, type BoardCardMoveEvent } from '@svgrid/grid'

  type Story = { id: number; title: string; status: string }
  type Epic = { id: number; title: string; status: string; owner: string; stories: Story[] }

  const features = tableFeatures({ rowSortingFeature, columnFilteringFeature })
  let view = $state<'board' | 'table'>('board')

  let rows = $state<Epic[]>([
    { id: 1, title: 'Kanban board mode', status: 'in_progress', owner: 'Sam Rivera', stories: [
      { id: 11, title: 'Drag & drop', status: 'done' },
      { id: 12, title: 'Keyboard move', status: 'done' },
      { id: 13, title: 'Virtualization', status: 'in_progress' },
    ] },
    { id: 2, title: 'Rich cards', status: 'in_progress', owner: 'Lee Park', stories: [
      { id: 21, title: 'Badges & tags', status: 'done' },
      { id: 22, title: 'Sub-tasks', status: 'done' },
      { id: 23, title: 'Comments', status: 'review' },
    ] },
    { id: 3, title: 'Server data source', status: 'todo', owner: 'Ada Cole', stories: [
      { id: 31, title: 'Grouping', status: 'todo' },
      { id: 32, title: 'Tree load-on-demand', status: 'todo' },
    ] },
    { id: 4, title: 'Studio 2.0', status: 'todo', owner: 'Sam Rivera', stories: [] },
    { id: 5, title: 'Docs overhaul', status: 'done', owner: 'Ada Cole', stories: [
      { id: 51, title: 'Kanban page', status: 'done' },
    ] },
  ])

  const columns: ColumnDef<any, Epic>[] = [
    { field: 'title', header: 'Epic', editorType: 'text' },
    { field: 'owner', header: 'Owner', editorType: 'text' },
    { field: 'status', header: 'Status' },
  ]

  const lanes = [
    { id: 'todo', title: 'To do' },
    { id: 'in_progress', title: 'In progress', color: '#f59e0b' },
    { id: 'review', title: 'Review', color: '#8b5cf6' },
    { id: 'done', title: 'Done', color: '#22c55e' },
  ]

  function onCardMove(e: BoardCardMoveEvent<Epic>) {
    e.row.status = e.toLane
  }

  const doneStories = (e: Epic) => e.stories.filter((s) => s.status === 'done').length
</script>

<section class="flex flex-col flex-1 min-h-0 gap-3">
  <div class="flex items-center justify-between gap-3 shrink-0">
    <div class="text-sm text-slate-600 dark:text-slate-300">
      The same <strong>&lt;SvGrid&gt;</strong>, two views. Each epic card shows its child
      <strong>stories</strong> - expand a card to see them inline, with their own status.
    </div>
    <div class="inline-flex rounded-md border border-slate-300 dark:border-slate-600 overflow-hidden text-sm shrink-0">
      <button class="px-3 py-1 {view === 'board' ? 'bg-slate-800 text-white' : 'bg-transparent'}"
        onclick={() => (view = 'board')}>Board</button>
      <button class="px-3 py-1 {view === 'table' ? 'bg-slate-800 text-white' : 'bg-transparent'}"
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
          childrenField: 'stories',
          editable: true,
          laneSummary: (list) => `${list.length}`,
          onCardMove,
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

  <footer class="text-sm text-slate-500 dark:text-slate-400 shrink-0">
    {rows.length} epics · {rows.reduce((s, e) => s + doneStories(e), 0)} of
    {rows.reduce((s, e) => s + e.stories.length, 0)} stories done
  </footer>
</section>
