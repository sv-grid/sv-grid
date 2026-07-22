<script lang="ts">
  /**
   * 350. Board structure: group-by switch + reorderable lanes
   * ---------------------------------------------------------
   * Change the lane axis at runtime (Status / Assignee / Priority) and the
   * board re-buckets live; drag a lane header to reorder the columns. Both are
   * built-in - the group-by switch resets card positions to the new field, and
   * lane order is tracked (and persists with `persistKey`).
   */
  import { SvGrid, tableFeatures, rowSortingFeature, columnFilteringFeature, type ColumnDef, type BoardCardMoveEvent } from '@svgrid/grid'

  type Task = { id: number; title: string; status: string; assignee: string; priority: string }

  const features = tableFeatures({ rowSortingFeature, columnFilteringFeature })
  let view = $state<'board' | 'table'>('board')
  let groupField = $state<'status' | 'assignee' | 'priority'>('status')

  let rows = $state<Task[]>([
    { id: 1, title: 'Auth refresh tokens', status: 'todo', assignee: 'Sam Rivera', priority: 'High' },
    { id: 2, title: 'Board DnD', status: 'in_progress', assignee: 'Lee Park', priority: 'High' },
    { id: 3, title: 'Default card', status: 'in_progress', assignee: 'Sam Rivera', priority: 'Medium' },
    { id: 4, title: 'WIP styling', status: 'review', assignee: 'Ada Cole', priority: 'Low' },
    { id: 5, title: 'Docs pass', status: 'todo', assignee: 'Lee Park', priority: 'Medium' },
    { id: 6, title: 'Release 1.4', status: 'done', assignee: 'Ada Cole', priority: 'High' },
    { id: 7, title: 'Keyboard a11y', status: 'todo', assignee: 'Sam Rivera', priority: 'High' },
  ])

  const columns: ColumnDef<any, Task>[] = [
    { field: 'title', header: 'Task', editorType: 'text' },
    { field: 'assignee', header: 'Assignee', editorType: 'text' },
    { field: 'priority', header: 'Priority', editorType: 'text' },
    { field: 'status', header: 'Status', editorType: 'text' },
  ]

  const statusLanes = [
    { id: 'todo', title: 'To do' },
    { id: 'in_progress', title: 'In progress', color: '#f59e0b' },
    { id: 'review', title: 'Review', color: '#8b5cf6' },
    { id: 'done', title: 'Done', color: '#22c55e' },
  ]

  function onCardMove(e: BoardCardMoveEvent<Task>) {
    ;(e.row as Record<string, unknown>)[groupField] = e.toLane
  }

  const GROUPS: Array<typeof groupField> = ['status', 'assignee', 'priority']
</script>

<section class="flex flex-col flex-1 min-h-0 gap-3">
  <div class="flex items-center justify-between gap-3 shrink-0 flex-wrap">
    <div class="text-sm text-slate-600 dark:text-slate-300">
      The same <strong>&lt;SvGrid&gt;</strong>, two views. Switch the lane axis live, and
      <strong>drag a lane header</strong> to reorder columns.
    </div>
    <div class="flex items-center gap-3 shrink-0">
      {#if view === 'board'}
        <label class="flex items-center gap-1.5 text-sm">
          Group by:
          <select
            class="px-2 py-1 rounded border border-slate-300 dark:border-slate-600 bg-transparent capitalize"
            bind:value={groupField}>
            {#each GROUPS as g (g)}<option value={g}>{g}</option>{/each}
          </select>
        </label>
      {/if}
      <div class="inline-flex rounded-md border border-slate-300 dark:border-slate-600 overflow-hidden text-sm">
        <button class="px-3 py-1 {view === 'board' ? 'bg-slate-800 text-white' : 'bg-transparent'}"
          onclick={() => (view = 'board')}>Board</button>
        <button class="px-3 py-1 {view === 'table' ? 'bg-slate-800 text-white' : 'bg-transparent'}"
          onclick={() => (view = 'table')}>Table</button>
      </div>
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
          groupBy: groupField,
          lanes: groupField === 'status' ? statusLanes : undefined,
          reorderableLanes: true,
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
    Grouped by <strong class="capitalize">{groupField}</strong> · {rows.length} tasks · drag a header to reorder.
  </footer>
</section>
