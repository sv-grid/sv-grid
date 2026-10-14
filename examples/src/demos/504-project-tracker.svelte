<script lang="ts">
  /**
   * 504. Project tracker
   * --------------------
   * A base with two tables, Tasks and Milestones, as tabs. The tasks are
   * built from field types (`@svgrid/enterprise/base`). Each
   * column says what it is with `fieldType` - single select with colored
   * options, multiple select, a date, a rating, a URL, an email, currency,
   * a checkbox - and the module fills in its editor, format and alignment,
   * and draws the cell for the types that need one (stars, links).
   *
   * More types: autonumber (No), a user field (Assignee, from setFieldUsers),
   * duration (Estimate), a number in percent format drawn as a bar
   * (Progress), a number in currency format (Budget), a link to the
   * Milestones table and a lookup of the linked milestone's date. Milestones
   * links back: each one lists its tasks, their average progress and their
   * budget, and linking a task to a milestone lists it there.
   *
   * Files is an attachment field: images as thumbnails, other files as chips.
   * Double-click it (or press Enter) to add, remove, reorder and preview.
   *
   * The All tasks view is colored by Status: a thin stripe at each row's
   * start (hover the row number for the status). A single select's column
   * menu can color the rows by it instead ("Color rows by this field").
   *
   * Task is the primary field (`primaryField`): always first and pinned, the
   * record's name. Drag the line at the pinned columns' edge (`pinSplitter`)
   * to pin more columns or fewer; it snaps to column edges.
   *
   * `SvBase` puts the view bar over the grid. Views: a grid, a Kanban
   * stacked by Status, a calendar by Due, a gallery with the first file as
   * the cover, and a form that adds a task. In any of them: Hide fields,
   * Filter (conditions per field type), Group, Sort, Color, Row height and
   * search; each view keeps its own. Space on a cell expands the record,
   * which also lists its changes and takes comments.
   *
   * A milestone chip opens that record (hover it for a preview, "Open in
   * Milestones" to go there); the link picker can create a milestone. Grouped, each group header has "+" for a
   * task already in it. Drop files on a Files cell to attach them; drag a
   * row by its number to reorder while nothing is sorted or grouped.
   *
   * Hover a row number for its checkbox and expand button. Ticking rows
   * brings up the selection bar: edit a field on all of them at once, or
   * delete them (it asks first).
   *
   * "+ Add row" under the last row (`rowAdder`) appends a task with the
   * defaults below and starts editing it. Double-click any cell to edit it.
   *
   * "+" after the last column (`columnAdder`) opens the field editor: a name,
   * a type and its properties. Each column's menu (`fieldMenu`) can edit,
   * insert, duplicate, hide or delete a field; changing a type converts the
   * values and says first how many cells would be cleared.
   *
   * Automations (`automations` on the Tasks table), opened from "5
   * automations" in the view bar:
   *  - an overdue task (due before today, not Done) gets a red Due cell and a
   *    notice;
   *  - a task that turns Blocked raises a notice naming its assignee;
   *  - setting Status to Done ticks Done and sets Progress to 100%;
   *  - Start in the Kick off column sets the task In progress from today;
   *  - a task sent with the Request a task form goes to Todo.
   * The dialog edits them (When, Only for records where, Do) and lists every
   * run with what each action did.
   */
  import { SvToaster, type SvGridApi } from '@svgrid/grid'
  import { SvBase, enableBase, type Attachment, type BaseAutomation, type BaseTable } from '@svgrid/enterprise/base'
  import { installEnterprise } from '@svgrid/enterprise'
  import { usePeople } from '../shared/base-people'

  enableBase()
  // The people for the Assignee field (shared by the Base demos), and "you".
  usePeople()
  const TEAM = ['u1', 'u2', 'u3', 'u4']

  type Task = {
    id: number
    task: string
    files?: Attachment[]
    status: string
    tags: string[]
    owner: string
    due: string
    start?: string
    dependsOn?: string[]
    priority: number
    budget: number
    spec: string
    done: boolean
    no?: number
    assignee?: string
    estimate?: number
    progress?: number
    milestone?: string[]
  }

  const STATUS = [
    { value: 'Todo', color: '#64748b' },
    { value: 'In progress', color: '#2563eb' },
    { value: 'Blocked', color: '#dc2626' },
    { value: 'Done', color: '#16a34a' },
  ]
  const TAGS = [
    { value: 'Design', color: '#9333ea' },
    { value: 'Backend', color: '#0891b2' },
    { value: 'Frontend', color: '#ea580c' },
    { value: 'Docs', color: '#65a30d' },
  ]

  // Placeholder images drawn here, so the demo needs no image host. With no
  // uploader set, files you add stay in this page as blob: URLs.
  function swatch(name: string, color: string, label: string): Attachment {
    const c = document.createElement('canvas')
    c.width = 160
    c.height = 120
    const g = c.getContext('2d')!
    g.fillStyle = color
    g.fillRect(0, 0, 160, 120)
    g.fillStyle = 'rgba(255,255,255,0.9)'
    g.font = '600 22px system-ui, sans-serif'
    g.fillText(label, 14, 68)
    return { id: name, url: c.toDataURL('image/png'), name, type: 'image/png', width: 160, height: 120 }
  }
  function doc(name: string, type: string, text: string): Attachment {
    const blob = new Blob([text], { type })
    return { id: name, url: URL.createObjectURL(blob), name, type, size: blob.size }
  }
  const FILES: Record<number, Attachment[]> = {
    1: [doc('registry-notes.txt', 'text/plain', 'Field types fill in the column.')],
    2: [swatch('cell-mock.png', '#9333ea', 'Cell'), swatch('dialog-mock.png', '#0891b2', 'Dialog'), doc('cell-spec.txt', 'text/plain', 'Thumbnails, chips, +N.')],
    4: [swatch('popup.png', '#ea580c', 'Popup')],
    6: [swatch('colors.png', '#16a34a', 'Colors'), swatch('dark.png', '#0f172a', 'Dark')],
  }

  let nextId = 13
  const DEPENDS_ON: Record<number, string[]> = { 3: ['1'], 5: ['3'], 7: ['6'], 8: ['12'], 9: ['5'], 11: ['8'] }
  /** A 'YYYY-MM-DD' date `days` later (or earlier). */
  const shift = (iso: string, days: number) => {
    const d = new Date(`${iso}T00:00:00Z`)
    d.setUTCDate(d.getUTCDate() + days)
    return d.toISOString().slice(0, 10)
  }
  // The dates below are written for a plan where today is 20 October 2026;
  // they move with the real today, so one task is always a day overdue.
  const now = new Date()
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
  const PLAN_DAY = Date.UTC(2026, 9, 20)
  const onPlan = (iso: string) => shift(today, Math.round((Date.parse(`${iso}T00:00:00Z`) - PLAN_DAY) / 86_400_000))
  const tasks: Task[] = [
    { id: 1, task: 'Field type registry', status: 'Done', tags: ['Backend'], owner: 'ana@example.com', due: '2026-10-14', priority: 5, budget: 1800, spec: 'svgrid.com/docs', done: true },
    { id: 2, task: 'Attachment cell', status: 'In progress', tags: ['Frontend', 'Design'], owner: 'ben@example.com', due: '2026-10-21', priority: 4, budget: 3200, spec: 'svgrid.com/docs/help/fields', done: false },
    { id: 3, task: 'Upload hook + adapters', status: 'Todo', tags: ['Backend'], owner: 'cleo@example.com', due: '2026-10-24', priority: 3, budget: 2400, spec: '', done: false },
    { id: 4, task: 'Column adder popup', status: 'Blocked', tags: ['Frontend'], owner: 'dev@example.com', due: '2026-10-28', priority: 4, budget: 2900, spec: 'javascript:alert(1)', done: false },
    { id: 5, task: 'Field editor: select options', status: 'Todo', tags: ['Design', 'Frontend'], owner: 'ana@example.com', due: '2026-10-30', priority: 3, budget: 1500, spec: '', done: false },
    { id: 6, task: 'Row colors by status', status: 'In progress', tags: ['Frontend'], owner: 'ben@example.com', due: '2026-10-19', priority: 2, budget: 900, spec: 'svgrid.com', done: false },
    { id: 7, task: 'Row adder in groups', status: 'Todo', tags: ['Frontend'], owner: 'cleo@example.com', due: '2026-11-03', priority: 2, budget: 700, spec: '', done: false },
    { id: 8, task: 'Docs page', status: 'Todo', tags: ['Docs'], owner: 'dev@example.com', due: '2026-11-05', priority: 3, budget: 600, spec: '', done: false },
    { id: 9, task: 'Lightbox preview', status: 'Todo', tags: ['Design'], owner: 'ana@example.com', due: '2026-11-07', priority: 1, budget: 1100, spec: '', done: false },
    { id: 10, task: 'Paste URLs as attachments', status: 'Todo', tags: ['Frontend'], owner: 'ben@example.com', due: '2026-11-10', priority: 2, budget: 800, spec: '', done: false },
    { id: 11, task: 'CSV export of attachments', status: 'Todo', tags: ['Backend'], owner: 'cleo@example.com', due: '2026-11-12', priority: 1, budget: 500, spec: '', done: false },
    { id: 12, task: 'e2e coverage', status: 'In progress', tags: ['Backend', 'Frontend'], owner: 'dev@example.com', due: '2026-10-26', priority: 5, budget: 1300, spec: '', done: false },
  ].map((t, i) => ({
    ...t,
    due: onPlan(t.due),
    files: FILES[t.id] ?? [],
    no: t.id,
    assignee: TEAM[i % TEAM.length]!,
    estimate: [5400, 10800, 7200, 14400, 3600, 9000][i % 6],
    progress: t.done ? 1 : [0.6, 0.15, 0.3, 0, 0.45, 0.8][i % 6],
    milestone: [i < 6 ? 'm1' : 'm2'],
    // Work starts a few days to two weeks before it is due.
    start: shift(onPlan(t.due), -[4, 9, 6, 12, 3, 7][i % 6]!),
    // The tasks this one waits for (a link to this same table).
    dependsOn: DEPENDS_ON[t.id] ?? [],
  }))

  // The second table: the Milestone field links to it, and it links back with
  // the tasks of each milestone, their average progress and their budget.
  // "+ Create" in the Milestone picker adds a milestone.
  const milestones = [
    { id: 'm1', name: 'Beta', date: onPlan('2026-10-31'), tasks: tasks.filter((t) => t.milestone?.[0] === 'm1').map((t) => String(t.id)) },
    { id: 'm2', name: 'Release', date: onPlan('2026-11-30'), tasks: tasks.filter((t) => t.milestone?.[0] === 'm2').map((t) => String(t.id)) },
  ]

  // The schema lives here, not in the grid: SvBase hands back every change
  // to the tables (`bind:tables`), fields and records alike.
  const taskColumns: any[] = [
    { field: 'task', header: 'Task', width: 230, fieldType: 'text' },
    { field: 'no', header: 'No', width: 92, fieldType: 'autoNumber' },
    { field: 'status', header: 'Status', width: 130, fieldType: 'singleSelect', fieldProps: { options: STATUS } },
    { field: 'kickoff', header: 'Kick off', width: 104, fieldType: 'button', fieldProps: { label: 'Start', color: '#2563eb' } },
    { field: 'tags', header: 'Tags', width: 190, fieldType: 'multiSelect', fieldProps: { options: TAGS } },
    { field: 'files', header: 'Files', width: 180, fieldType: 'attachment', fieldProps: { maxFiles: 10 } },
    { field: 'assignee', header: 'Assignee', width: 160, fieldType: 'user' },
    { field: 'owner', header: 'Owner', width: 170, fieldType: 'email' },
    { field: 'start', header: 'Start', width: 180, fieldType: 'date', fieldProps: { dateFormat: 'friendly' } },
    { field: 'due', header: 'Due', width: 200, fieldType: 'date', fieldProps: { dateFormat: 'friendly' } },
    { field: 'estimate', header: 'Estimate', width: 100, fieldType: 'duration', fieldProps: { durationFormat: 'h:mm' } },
    { field: 'progress', header: 'Progress', width: 150, fieldType: 'number', fieldProps: { format: 'percent', precision: 0, showBar: true, summary: 'avg' } },
    { field: 'milestone', header: 'Milestone', width: 130, fieldType: 'link', fieldProps: { table: 'milestones', multiple: false, inverse: 'tasks' } },
    { field: 'milestoneDate', header: 'Milestone date', width: 160, fieldType: 'lookup', fieldProps: { linkField: 'milestone', field: 'date' } },
    { field: 'dependsOn', header: 'Depends on', width: 200, fieldType: 'link', fieldProps: { table: 'tasks', multiple: true } },
    { field: 'priority', header: 'Priority', width: 120, fieldType: 'rating', fieldProps: { max: 5, icon: 'flag', color: '#f82b60' } },
    { field: 'budget', header: 'Budget', width: 136, description: 'Approved spend for the task', fieldType: 'number', fieldProps: { format: 'currency', symbol: '$', precision: 0, summary: 'sum' } },
    { field: 'spec', header: 'Spec', width: 200, fieldType: 'url' },
    { field: 'done', header: 'Done', width: 80, fieldType: 'checkbox', fieldProps: { icon: 'check', color: '#20c933' } },
  ]

  // What happens to tasks on its own, in the view bar's Automations. A
  // condition is the view bar's filter; a message names fields as {Task}.
  const notDone = { column: 'status', kind: 'select', op: 'isNot', value: 'Done' } as const
  const statusIs = (value: string) => ({ kind: 'fieldFilter' as const, conjunction: 'and' as const, conditions: [{ column: 'status', kind: 'select' as const, op: 'is' as const, value }] })
  const taskAutomations: BaseAutomation[] = [
    {
      id: 'overdue',
      name: 'Overdue task',
      enabled: true,
      trigger: { type: 'recordMatches' },
      condition: { kind: 'fieldFilter', conjunction: 'and', conditions: [{ column: 'due', kind: 'date', op: 'isBefore', value: { mode: 'today' } }, notDone] },
      actions: [
        { type: 'highlight', fields: ['due'], background: '#fee2e2', color: '#b91c1c' },
        { type: 'notify', message: '{Task} is overdue: it was due {Due}', severity: 'error' },
      ],
    },
    {
      id: 'blocked',
      name: 'Task blocked',
      enabled: true,
      trigger: { type: 'recordMatches' },
      condition: statusIs('Blocked'),
      actions: [{ type: 'notify', message: '{Task} is blocked ({Assignee})', severity: 'warning' }],
    },
    {
      id: 'done',
      name: 'Done closes the task',
      enabled: true,
      trigger: { type: 'recordUpdated', fields: ['status'] },
      condition: statusIs('Done'),
      actions: [
        { type: 'updateRecord', values: { done: 'true', progress: '100%' } },
        { type: 'notify', message: '{Task} is done', severity: 'success' },
      ],
    },
    {
      id: 'kickoff',
      name: 'Start a task',
      enabled: true,
      trigger: { type: 'button', field: 'kickoff' },
      actions: [{ type: 'updateRecord', values: { status: 'In progress', start: 'today' } }],
    },
    {
      id: 'request',
      name: 'Triage a request',
      enabled: true,
      trigger: { type: 'formSubmitted', view: 'form' },
      actions: [
        { type: 'updateRecord', values: { status: 'Todo', progress: '0%' } },
        { type: 'notify', message: 'New request: {Task}' },
      ],
    },
  ]

  // Saved views per table, as the view bar switches them. Each keeps its own
  // filter, sorts, groups, hidden fields, row height and colors from here on.
  let tables = $state.raw<BaseTable[]>([
    {
      id: 'tasks',
      name: 'Tasks',
      primaryField: 'task',
      data: tasks,
      columns: taskColumns,
      automations: taskAutomations,
      views: [
        { id: 'all', name: 'All tasks', type: 'grid', color: { mode: 'field', field: 'status' } },
        { id: 'board', name: 'By status', type: 'kanban', stackBy: 'status' },
        { id: 'calendar', name: 'Due dates', type: 'calendar', dateField: 'due', color: { mode: 'field', field: 'status' } },
        { id: 'gallery', name: 'Gallery', type: 'gallery', coverField: 'files' },
        { id: 'form', name: 'Request a task', type: 'form', formFields: ['task', 'status', 'tags', 'assignee', 'due', 'priority', 'files'], formDescription: 'Adds a row to the tracker.' },
      ],
      props: {
        rowDragManaged: true,
        rowAdder: { label: 'Add task', defaults: () => ({ id: nextId++, task: '', status: 'Todo', tags: [], priority: 0, budget: 0, done: false }) },
      },
    },
    {
      id: 'milestones',
      name: 'Milestones',
      primaryField: 'name',
      data: milestones,
      columns: [
        { field: 'name', header: 'Milestone', width: 180, fieldType: 'text' },
        { field: 'date', header: 'Date', width: 180, fieldType: 'date', fieldProps: { dateFormat: 'friendly' } },
        { field: 'tasks', header: 'Tasks', width: 320, fieldType: 'link', fieldProps: { table: 'tasks', multiple: true, inverse: 'milestone' } },
        { field: 'progress', header: 'Progress', width: 130, fieldType: 'rollup', fieldProps: { linkField: 'tasks', field: 'progress', aggregation: 'AVERAGE' } },
        { field: 'budget', header: 'Budget', width: 130, fieldType: 'rollup', fieldProps: { linkField: 'tasks', field: 'budget', aggregation: 'SUM' } },
      ],
      views: [{ id: 'milestones', name: 'All milestones', type: 'grid' }],
      props: { rowAdder: { label: 'Add milestone' } },
    },
  ])

  let added = $state(0)
  function onReady(api: SvGridApi<any, Task>) {
    installEnterprise(api)
  }
</script>

<section class="tracker">
  <p class="tracker-note">
    Columns are declared by field type. The URL in row 4 is a <code>javascript:</code> value: it stays text.
    {#if added}<span class="tracker-added">{added} task{added === 1 ? '' : 's'} added</span>{/if}
  </p>
  <div class="tracker-grid">
    <SvBase
      bind:tables
      editable
      sortable
      showRowNumbers
      expandRows
      pinSplitter
      summary
      rowNumberWidth={64}
      showRowSelection={false}
      rowHeight={34}
      containerHeight="100%"
      selectionBar={['selectAll', 'editFields', 'deleteRows']}
      onRowAdd={() => (added += 1)}
      columnAdder
      fieldMenu
      onApiReady={onReady}
    />
  </div>
  <!-- The automations' notices. -->
  <SvToaster />
</section>

<style>
  .tracker { display: flex; flex-direction: column; flex: 1; min-height: 0; gap: 8px; }
  .tracker-note { margin: 0; font-size: 13px; color: var(--sg-muted, #64748b); }
  .tracker-note code { font-size: 12px; }
  .tracker-added { margin-inline-start: 8px; color: var(--sg-fg, #0f172a); }
  .tracker-grid { flex: 1; min-height: 420px; display: flex; flex-direction: column; }
</style>
