<script lang="ts">
  /**
   * 705. SvGrid Base: undo and redo
   * -------------------------------
   * Ctrl+Z undoes what was done to a table, in the order it was done: a cell
   * edit, a paste, a record added or deleted, a field added, changed or
   * deleted. Ctrl+Shift+Z or Ctrl+Y redoes it. The Undo and Redo buttons at
   * the end of the tab bar say what the next press will do ("Undo delete 2
   * records").
   *
   * Undoing a deleted record puts it back where it was and brings its links
   * back: delete a task and its project stops listing it; undo, and the
   * project lists it again. Each table keeps its own history while you look
   * at another one.
   */
  import { SvToaster } from '@svgrid/grid'
  import { SvBase, enableBase, type BaseTable } from '@svgrid/enterprise/base'
  import { usePeople } from '../shared/base-people'

  enableBase()
  usePeople()

  const STATUS = [
    { value: 'Todo', color: '#94a3b8' },
    { value: 'In progress', color: '#2d7ff9' },
    { value: 'Blocked', color: '#f82b60' },
    { value: 'Done', color: '#20c933' },
  ]
  const TASKS: Array<[string, string, string, string, number]> = [
    ['Write the launch brief', 'p1', 'Done', 'u1', 3],
    ['Design the pricing page', 'p1', 'In progress', 'u3', 8],
    ['Record the product video', 'p1', 'Todo', 'u5', 6],
    ['Migrate invoices to the new schema', 'p2', 'Blocked', 'u2', 13],
    ['Backfill customer ids', 'p2', 'In progress', 'u4', 5],
    ['Load test the export job', 'p2', 'Todo', 'u2', 4],
    ['Interview three design partners', 'p3', 'Done', 'u6', 6],
    ['Summarize the interviews', 'p3', 'Todo', 'u6', 2],
  ]
  const tasks = TASKS.map(([task, project, status, owner, hours], i) => ({ id: `t${i + 1}`, task, project: [project], status, owner, hours }))
  const projects = [
    { id: 'p1', name: 'Website launch', lead: 'u1' },
    { id: 'p2', name: 'Billing migration', lead: 'u2' },
    { id: 'p3', name: 'Customer research', lead: 'u6' },
  ].map((p) => ({ ...p, tasks: tasks.filter((t) => t.project[0] === p.id).map((t) => t.id) }))

  let tables = $state.raw<BaseTable[]>([
    {
      id: 'undo-tasks',
      name: 'Tasks',
      primaryField: 'task',
      data: tasks,
      columns: [
        { field: 'task', header: 'Task', width: 280, fieldType: 'text' },
        { field: 'project', header: 'Project', width: 190, fieldType: 'link', fieldProps: { table: 'undo-projects', multiple: false, inverse: 'tasks' } },
        { field: 'status', header: 'Status', width: 130, fieldType: 'singleSelect', fieldProps: { options: STATUS } },
        { field: 'owner', header: 'Owner', width: 160, fieldType: 'user' },
        { field: 'hours', header: 'Estimate (h)', width: 120, fieldType: 'number', fieldProps: { format: 'integer' } },
      ],
      views: [{ id: 'all', name: 'All tasks', type: 'grid', color: { mode: 'field', field: 'status' } }],
      props: { rowAdder: { label: 'Add task', defaults: () => ({ status: 'Todo' }) } },
    },
    {
      id: 'undo-projects',
      name: 'Projects',
      primaryField: 'name',
      data: projects,
      columns: [
        { field: 'name', header: 'Project', width: 220, fieldType: 'text' },
        { field: 'lead', header: 'Lead', width: 160, fieldType: 'user' },
        { field: 'tasks', header: 'Tasks', width: 360, fieldType: 'link', fieldProps: { table: 'undo-tasks', multiple: true, inverse: 'project' } },
        { field: 'hours', header: 'Hours', width: 110, fieldType: 'rollup', fieldProps: { linkField: 'tasks', field: 'hours', aggregation: 'SUM' } },
      ],
      views: [{ id: 'all', name: 'All projects', type: 'grid' }],
    },
  ])
</script>

<section class="base-demo">
  <p class="base-demo-tip">
    Edit a few cells, delete a task (right-click a row, Delete record), delete a field from its header menu, then press
    <kbd>Ctrl</kbd>+<kbd>Z</kbd> until everything is back. The arrows at the top right show what the next undo and redo will do.
  </p>
  <SvBase
    bind:tables
    editable
    sortable
    showRowNumbers
    expandRows
    rowNumberWidth={64}
    showRowSelection={false}
    rowHeight={40}
    containerHeight="100%"
    selectionBar={['selectAll', 'editFields', 'deleteRows']}
    columnAdder
    fieldMenu
  />
  <SvToaster />
</section>

<style>
  .base-demo { display: flex; flex-direction: column; flex: 1; min-height: 480px; height: 100%; gap: 10px; }
  .base-demo-tip { margin: 0; font-size: 13px; line-height: 1.5; color: var(--sg-muted, #64748b); }
  .base-demo-tip kbd {
    padding: 1px 5px; font: inherit; font-size: 12px; border-radius: 4px;
    border: 1px solid var(--sg-border, #e2e8f0); background: color-mix(in srgb, var(--sg-fg, #0f172a) 7%, transparent); color: var(--sg-fg, #0f172a);
  }
</style>
