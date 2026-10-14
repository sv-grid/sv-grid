<script lang="ts">
  /**
   * 517. Base on Supabase, live
   * ---------------------------
   * Two people on one Supabase project, side by side: each window is its own
   * `<SvBase>` with its own client. Change a task on one side and the other
   * shows it a moment later, through Supabase Realtime.
   *
   * Each table is `baseSource(createSupabaseDataSource(...))`, with
   * `realtime` from `createSupabaseRealtime`. A task's project is the
   * `project_id` foreign key; the Projects table's Tasks field is worked out
   * from it. A new record gets its id from the database (a uuid), and the
   * base keeps the one it gave the row in the page, so nothing jumps.
   *
   * Turn a window offline and edit there: the request fails, the base puts
   * the cell back and says why. Back online, it reads the tables again.
   *
   * The project here is in the page (`shared/mock-supabase.ts`), so the demo
   * needs no account. With a real one, the only change is the client:
   *   const client = createClient(PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY)
   */
  import { SvToaster } from '@svgrid/grid'
  import { SvBase, baseSource, enableBase, type BaseTable } from '@svgrid/enterprise/base'
  import { createSupabaseDataSource, createSupabaseRealtime, type EntitySchema } from '@svgrid/enterprise'
  import { usePeople } from '../shared/base-people'
  import { createMockProject, createMockSupabase } from '../shared/mock-supabase'

  enableBase()
  usePeople()

  const day = (offset: number) => {
    const d = new Date()
    d.setDate(d.getDate() + offset)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  }

  // The database both windows share.
  const project = createMockProject({
    projects: [
      { id: 'p1', name: 'Website relaunch', owner: 'u1' },
      { id: 'p2', name: 'Customer portal', owner: 'u2' },
    ],
    tasks: [
      { id: 't1', name: 'Wireframes', status: 'Done', assignee: 'u1', due: day(-6), project_id: 'p1' },
      { id: 't2', name: 'Visual design', status: 'In progress', assignee: 'u3', due: day(2), project_id: 'p1' },
      { id: 't3', name: 'CMS migration', status: 'Todo', assignee: 'u2', due: day(9), project_id: 'p1' },
      { id: 't4', name: 'Sign-in with SSO', status: 'In progress', assignee: 'u4', due: day(4), project_id: 'p2' },
      { id: 't5', name: 'Invoices page', status: 'Todo', assignee: 'u2', due: day(12), project_id: 'p2' },
      { id: 't6', name: 'Accessibility audit', status: 'Todo', assignee: null, due: day(15), project_id: null },
    ],
  })

  // What the Supabase source reads of each table: its columns and key.
  const SCHEMAS: Record<string, EntitySchema> = {
    tasks: {
      name: 'tasks',
      idField: 'id',
      fields: [
        { field: 'id', type: 'text', primaryKey: true },
        { field: 'name', type: 'text' },
        { field: 'status', type: 'text' },
        { field: 'assignee', type: 'text' },
        { field: 'due', type: 'date' },
        { field: 'project_id', type: 'text' },
      ],
    },
    projects: {
      name: 'projects',
      idField: 'id',
      fields: [
        { field: 'id', type: 'text', primaryKey: true },
        { field: 'name', type: 'text' },
        { field: 'owner', type: 'text' },
      ],
    },
  }

  const STATUS = [
    { value: 'Todo', color: '#64748b' },
    { value: 'In progress', color: '#2563eb' },
    { value: 'Blocked', color: '#dc2626' },
    { value: 'Done', color: '#16a34a' },
  ]

  class Win {
    tables = $state.raw<BaseTable[]>([])
    offline = $state(false)
    requests = $state<string[]>([])
    reconnect = new Set<() => void>()
    who: string
    constructor(who: string) {
      this.who = who
    }
  }

  /**
   * One person's window: a client of the shared project and the base's
   * tables on it. The table ids differ per window only because both bases
   * are on one page; in an app they are just 'tasks' and 'projects'.
   */
  function open(who: string, prefix: string): Win {
    const win = new Win(who)
    const client = createMockSupabase(project, {
      offline: () => win.offline,
      onRequest: (line) => {
        win.requests = [line, ...win.requests].slice(0, 3)
      },
    })
    const source = (table: string, links = {}) =>
      baseSource(createSupabaseDataSource({ client: client as never, table, schema: SCHEMAS[table]! }), {
        links,
        // Supabase makes the key: a new row is inserted without the page's id.
        serverIds: true,
        realtime: (onChange) => {
          win.reconnect.add(onChange)
          const live = createSupabaseRealtime({ client: client as never, table, onChange })
          return () => {
            win.reconnect.delete(onChange)
            live.unsubscribe()
          }
        },
      })
    win.tables = [
      {
        id: `${prefix}tasks`,
        name: 'Tasks',
        primaryField: 'name',
        data: [],
        columns: [
          { field: 'name', header: 'Task', width: 170, fieldType: 'text' },
          { field: 'status', header: 'Status', width: 120, fieldType: 'singleSelect', fieldProps: { options: STATUS } },
          { field: 'project', header: 'Project', width: 150, fieldType: 'link', fieldProps: { table: `${prefix}projects`, multiple: false, inverse: 'tasks' } },
          { field: 'assignee', header: 'Assignee', width: 140, fieldType: 'user' },
          { field: 'due', header: 'Due', width: 120, fieldType: 'date' },
        ],
        views: [
          { id: 'all', name: 'All tasks', type: 'grid', color: { mode: 'field', field: 'status' } },
          { id: 'board', name: 'Board', type: 'kanban', stackBy: 'status' },
        ],
        source: source('tasks', { project: { column: 'project_id' } }),
        props: { rowAdder: { label: 'Add task', defaults: () => ({ status: 'Todo' }) } },
      },
      {
        id: `${prefix}projects`,
        name: 'Projects',
        primaryField: 'name',
        data: [],
        columns: [
          { field: 'name', header: 'Project', width: 170, fieldType: 'text' },
          { field: 'owner', header: 'Owner', width: 140, fieldType: 'user' },
          { field: 'tasks', header: 'Tasks', width: 260, fieldType: 'link', fieldProps: { table: `${prefix}tasks`, multiple: true, inverse: 'project' } },
        ],
        source: source('projects'),
      },
    ]
    return win
  }

  const windows = [open('Ana', 'a-'), open('Ben', 'b-')]

  function setOffline(win: Win, offline: boolean) {
    win.offline = offline
    // Back online, a realtime client reconnects and the base reads again.
    if (!offline) for (const on of win.reconnect) on()
  }
</script>

<section class="sbase">
  {#each windows as win (win.who)}
    <div class="sbase-win" class:is-offline={win.offline}>
      <header class="sbase-bar">
        <span class="sbase-dots" aria-hidden="true"><i></i><i></i><i></i></span>
        <span class="sbase-who">{win.who}'s browser</span>
        <label class="sbase-net">
          <input type="checkbox" checked={win.offline} onchange={(e) => setOffline(win, e.currentTarget.checked)} />
          Offline
        </label>
      </header>
      <div class="sbase-body">
        <SvBase bind:tables={win.tables} editable sortable showRowNumbers showRowSelection={false} rowHeight={34} containerHeight="100%" columnAdder={false} automations={false} />
      </div>
      <footer class="sbase-req" aria-label={`${win.who}'s last requests`}>
        {#each win.requests as r, i (i)}<code>{r}</code>{/each}
      </footer>
    </div>
  {/each}
  <SvToaster />
</section>

<style>
  .sbase { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; flex: 1; min-height: 520px; }
  @media (max-width: 900px) { .sbase { grid-template-columns: 1fr; } }
  .sbase-win {
    display: flex; flex-direction: column; min-width: 0; min-height: 480px; overflow: hidden;
    border: 1px solid var(--sg-border, #e2e8f0); border-radius: var(--sg-radius-lg, 10px); background: var(--sg-bg, #fff);
  }
  .sbase-win.is-offline { border-color: var(--sg-danger, #dc2626); }
  .sbase-bar {
    display: flex; align-items: center; gap: 10px; height: 34px; padding: 0 10px; font-size: 12px;
    color: var(--sg-muted, #64748b); background: var(--sg-header-bg, var(--sg-bg, #fff)); border-bottom: 1px solid var(--sg-border, #e2e8f0);
  }
  .sbase-dots { display: inline-flex; gap: 5px; }
  .sbase-dots i { width: 9px; height: 9px; border-radius: 50%; background: color-mix(in srgb, var(--sg-fg, #0f172a) 18%, transparent); }
  .sbase-who { flex: 1; font-weight: 600; color: var(--sg-fg, #0f172a); }
  .sbase-net { display: inline-flex; align-items: center; gap: 5px; cursor: pointer; }
  .sbase-net input { accent-color: var(--sg-danger, #dc2626); }
  .sbase-body { flex: 1; min-height: 0; display: flex; flex-direction: column; }
  .sbase-req {
    display: flex; flex-direction: column; gap: 2px; min-height: 52px; padding: 6px 10px; box-sizing: border-box;
    border-top: 1px solid var(--sg-border, #e2e8f0); font-size: 11px; color: var(--sg-muted, #64748b);
  }
  .sbase-req code { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; }
</style>
