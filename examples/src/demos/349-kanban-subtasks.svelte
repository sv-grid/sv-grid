<script lang="ts">
  // Kanban board rendering is an Enterprise feature - register the renderer.
  import { enableBoardView } from "@svgrid/enterprise";
  enableBoardView();
  /**
   * 349. Cards with sub-tasks, badges & a detail drawer
   * ---------------------------------------------------
   * The default board card, made rich by config alone: label + due + assignee
   * badges, a sub-task checklist, and a quick-add composer. Click a card to open
   * the BUILT-IN detail drawer - an SvDrawer + SvForm rendered from the columns
   * with the UI-kit editors (text / date / select / number / colour). Toggle
   * "All fields" vs a customized subset. Same <SvGrid responsive={true}> - flip to Table to prove it.
   */
  import { SvGrid, tableFeatures, rowSortingFeature, columnFilteringFeature, type ColumnDef } from '@svgrid/grid'

  type Sub = { id: string; title: string; done: boolean }
  type Cmt = { id: string; text: string; author: string }
  type Task = {
    id: number
    title: string
    status: string
    priority: 'Low' | 'Medium' | 'High'
    labels: { text: string; color: string }[]
    due: string
    assignees: string[]
    comments: Cmt[]
    attachments: number
    cover: string
    subtasks: Sub[]
  }

  const features = tableFeatures({ rowSortingFeature, columnFilteringFeature })
  let view = $state<'board' | 'table'>('board')

  const TAG = { feature: '#3b82f6', bug: '#ef4444', docs: '#64748b', ux: '#8b5cf6', release: '#22c55e' }

  let seq = 100
  let cseq = 0
  let rows = $state<Task[]>([
    { id: 1, title: 'Ship board sub-tasks', status: 'in_progress', priority: 'High', labels: [{ text: 'feature', color: TAG.feature }], due: '2026-08-05', assignees: ['Sam Rivera'], comments: [{ id: 'c1', text: 'Looks solid', author: 'Lee' }, { id: 'c2', text: '+1', author: 'Ada' }], attachments: 1, cover: TAG.feature,
      subtasks: [{ id: 'a', title: 'Overlay model', done: true }, { id: 'b', title: 'Checklist UI', done: true }, { id: 'c', title: 'Quick-add', done: false }] },
    { id: 2, title: 'Fix overdue badge', status: 'todo', priority: 'High', labels: [{ text: 'bug', color: TAG.bug }], due: '2026-07-01', assignees: ['Lee Park'], comments: [{ id: 'c3', text: 'Repro on Safari', author: 'Sam' }], attachments: 0, cover: TAG.bug,
      subtasks: [{ id: 'a', title: 'Repro', done: false }, { id: 'b', title: 'Patch', done: false }] },
    { id: 3, title: 'Docs: card badges', status: 'todo', priority: 'Low', labels: [{ text: 'docs', color: TAG.docs }], due: '2026-08-20', assignees: ['Ada Cole'], comments: [], attachments: 2, cover: TAG.docs, subtasks: [] },
    { id: 4, title: 'Detail drawer', status: 'review', priority: 'Medium', labels: [{ text: 'feature', color: TAG.feature }, { text: 'ux', color: TAG.ux }], due: '2026-08-02', assignees: ['Sam Rivera', 'Lee Park'], comments: [{ id: 'c4', text: 'Ship it', author: 'Ada' }], attachments: 3, cover: TAG.ux,
      subtasks: [{ id: 'a', title: 'Wire onCardEdit', done: true }] },
    { id: 5, title: 'Release 1.4', status: 'done', priority: 'Low', labels: [{ text: 'release', color: TAG.release }], due: '2026-07-12', assignees: ['Ada Cole'], comments: [], attachments: 0, cover: TAG.release, subtasks: [] },
  ])

  function addComment(row: Task, text: string) {
    row.comments.push({ id: `n${++cseq}`, text, author: 'You' })
  }
  function deleteComment(row: Task, id: string | number) {
    row.comments = row.comments.filter((c) => c.id !== id)
  }

  const columns: ColumnDef<any, Task>[] = [
    { field: 'title', header: 'Task', editorType: 'text' },
    { field: 'priority', header: 'Priority', editorType: 'select', editorOptions: [
      { value: 'Low', label: 'Low' }, { value: 'Medium', label: 'Medium' }, { value: 'High', label: 'High' },
    ] },
    { field: 'due', header: 'Due date', editorType: 'date' },
    { field: 'status', header: 'Status', editorType: 'select', editorOptions: [
      { value: 'todo', label: 'To do' }, { value: 'in_progress', label: 'In progress' },
      { value: 'review', label: 'Review' }, { value: 'done', label: 'Done' },
    ] },
  ]

  const lanes = [
    { id: 'todo', title: 'To do' },
    { id: 'in_progress', title: 'In progress', color: '#f59e0b', wipLimit: 3 },
    { id: 'review', title: 'Review', color: '#8b5cf6' },
    { id: 'done', title: 'Done', color: '#22c55e' },
  ]

  // Built-in drawer: all columns, or a customized subset.
  let drawerScope = $state<'all' | 'core'>('all')

  function addCard(laneId: string, title?: string) {
    rows = [
      ...rows,
      { id: ++seq, title: title || 'New task', status: laneId, priority: 'Medium', labels: [], due: '', assignees: [], comments: [], attachments: 0, cover: '', subtasks: [] },
    ]
  }
</script>

<section class="flex flex-col flex-1 min-h-0 gap-3">
  <div class="flex items-center justify-between gap-3 shrink-0">
    <div class="kb-note text-sm">
      The same <strong>&lt;SvGrid&gt;</strong>, two views. Rich cards from config alone.
      <strong>Double-click a card</strong> for the built-in detail drawer (SvDrawer +
      SvForm) - edit its fields and <strong>read / write / delete comments</strong> there
      (the comment badge on a card also opens the thread). Switch the drawer between all
      fields and a subset.
    </div>
    <div class="flex items-center gap-3 shrink-0">
      {#if view === 'board'}
        <div class="kb-switch inline-flex rounded-md border overflow-hidden text-sm">
          <button class="kb-seg px-2.5 py-1 {drawerScope === 'all' ? 'kb-seg-on' : ''}"
            onclick={() => (drawerScope = 'all')}>All fields</button>
          <button class="kb-seg px-2.5 py-1 {drawerScope === 'core' ? 'kb-seg-on' : ''}"
            onclick={() => (drawerScope = 'core')}>Core fields</button>
        </div>
      {/if}
      <div class="kb-switch inline-flex rounded-md border overflow-hidden text-sm">
        <button class="kb-seg px-3 py-1 {view === 'board' ? 'kb-seg-on' : ''}"
          onclick={() => (view = 'board')}>Board</button>
        <button class="kb-seg px-3 py-1 {view === 'table' ? 'kb-seg-on' : ''}"
          onclick={() => (view = 'table')}>Table</button>
      </div>
    </div>
  </div>

  <div class="flex-1 min-h-0">
    {#if view === 'board'}
      <SvGrid responsive={true}
      columnResize
        data={rows}
        columns={columns}
        getRowId={(r) => String(r.id)}
        containerHeight="100%"
        board={{
          groupBy: 'status',
          lanes,
          composer: true,
          subtasks: 'subtasks',
          labelsField: 'labels',
          dueField: 'due',
          assigneesField: 'assignees',
          commentsField: 'comments',
          onCommentAdd: addComment,
          onCommentDelete: deleteComment,
          attachmentsField: 'attachments',
          coverField: 'cover',
          laneSummary: (list) => `${list.length}`,
          onCardAdd: addCard,
          drawer: drawerScope === 'all'
            ? { title: (t) => t.title }
            : { fields: ['title', 'due', 'status'], title: (t) => t.title },
          onCardCommit: (e) => Object.assign(e.row, e.values),
          onCardMove: (e) => (e.row.status = e.toLane),
        }}
      />
    {:else}
      <SvGrid responsive={true}
      columnResize
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

  <footer class="kb-foot text-sm shrink-0">
    {rows.length} tasks · cards, badges, sub-tasks, composer and the detail drawer
    all come from <code>board</code> config - no bespoke drawer code.
  </footer>
</section>

<style>
  .kb-note { color: var(--sg-muted, #475569); }
  .kb-foot { color: var(--sg-muted, #64748b); }
  .kb-switch { border-color: var(--sg-border, #cbd5e1); }
  .kb-seg {
    background: transparent;
    color: var(--sg-fg, #0f172a);
    cursor: pointer;
  }
  .kb-seg-on {
    background: var(--sg-accent, #1e293b);
    color: var(--sg-on-accent, #fff);
  }
</style>
