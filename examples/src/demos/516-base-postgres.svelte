<script lang="ts">
  /**
   * 516. Base on Postgres
   * ---------------------
   * SvGrid Base with its tables in a real Postgres database: PGlite, Postgres
   * compiled to WebAssembly, running in this page. No server, no keys.
   *
   * Three tables, Tasks, Projects and Tags. Each `BaseTable` has a `source`:
   * `baseSource(createSqlDataSource(...))`. The base loads every record from
   * it, and each change you make becomes SQL: an UPDATE of the fields that
   * changed, an INSERT for a new record, a DELETE. The log under the base
   * lists each statement as it runs, with its parameters.
   *
   * Links are foreign keys and a junction table:
   *  - Task -> Project is `tasks.project_id`, a foreign key. The Projects
   *    table's Tasks field is worked out from it, so linking a task from the
   *    project's side writes the task's `project_id`.
   *  - Task <-> Tag goes through `task_tags`: adding a tag inserts a row
   *    there, removing one deletes it.
   *
   * Automations ("3 automations" in the view bar):
   *  - in the browser: Done ticks the box when a task's Status becomes Done.
   *    Its change is written like an edit: the log shows a second UPDATE.
   *  - on the server (`createAutomationServer`, here in the page standing in
   *    for your server): a task that turns Blocked posts to the team chat
   *    through a webhook whose URL names a secret, and a task set to Done
   *    emails the lead. The server hears every write to the database, so they
   *    also run for a change made with Run SQL. What they sent is listed under
   *    "Sent by the server", and their runs show under Runs in the dialog.
   *
   * "Run SQL" changes the database behind the base's back, the way another
   * user would; the source's `realtime` tells the base, which reads the table
   * again and shows what moved. Try:
   *   update tasks set status = 'Done' where priority >= 4
   *
   * Make a write fail: run
   *   alter table tasks add constraint not_blocked check (status <> 'Blocked') not valid
   * and set a task's Status to Blocked. The database refuses, the base puts
   * the cell back, and the tab bar and a notice say why.
   */
  import { onMount } from 'svelte'
  import { PGlite } from '@electric-sql/pglite'
  import { SvToaster } from '@svgrid/grid'
  import { SvBase, baseSource, createAutomationServer, enableBase, type AutomationServer, type BaseAutomation, type BaseTable } from '@svgrid/enterprise/base'
  import { createSqlDataSource, type EntitySchema } from '@svgrid/enterprise'
  import { usePeople } from '../shared/base-people'

  enableBase()
  usePeople()

  // ---- The database -----------------------------------------------------------

  const SCHEMA = `
    create table projects (
      id text primary key,
      name text not null default '',
      owner text,
      due date
    );
    create table tags (
      id text primary key,
      name text not null default ''
    );
    create table tasks (
      id text primary key,
      name text not null default '',
      status text,
      priority int,
      assignee text,
      due date,
      done boolean not null default false,
      project_id text references projects(id) on delete set null
    );
    create table task_tags (
      id serial primary key,
      task_id text not null references tasks(id) on delete cascade,
      tag_id text not null references tags(id) on delete cascade,
      unique (task_id, tag_id)
    );

    insert into projects values
      ('p1', 'Launch', 'u1', current_date + 21),
      ('p2', 'Billing revamp', 'u2', current_date + 45),
      ('p3', 'Mobile app', 'u3', current_date + 70);
    insert into tags values ('g1', 'Design'), ('g2', 'Backend'), ('g3', 'Frontend'), ('g4', 'Risk');
    insert into tasks (id, name, status, priority, assignee, due, done, project_id) values
      ('t1', 'Landing page copy', 'Done', 3, 'u1', current_date - 4, true, 'p1'),
      ('t2', 'Pricing table', 'In progress', 4, 'u2', current_date + 3, false, 'p1'),
      ('t3', 'Launch email', 'Todo', 2, 'u3', current_date + 9, false, 'p1'),
      ('t4', 'Invoice PDFs', 'In progress', 5, 'u4', current_date + 6, false, 'p2'),
      ('t5', 'Tax rules by country', 'Blocked', 4, 'u2', current_date + 12, false, 'p2'),
      ('t6', 'Card retries', 'Todo', 3, 'u1', current_date + 20, false, 'p2'),
      ('t7', 'Offline mode', 'Todo', 2, 'u3', current_date + 34, false, 'p3'),
      ('t8', 'Push notifications', 'Todo', 1, 'u4', current_date + 40, false, 'p3'),
      ('t9', 'Bug bash', 'Todo', 3, null, current_date + 18, false, null);
    insert into task_tags (task_id, tag_id) values
      ('t1', 'g1'), ('t2', 'g1'), ('t2', 'g3'), ('t4', 'g2'), ('t5', 'g2'), ('t5', 'g4'), ('t7', 'g3'), ('t8', 'g3');
  `

  // What the SQL source needs to know of each table: its columns and key.
  const schema = (name: string, fields: EntitySchema['fields']): EntitySchema => ({ name, idField: 'id', fields: [{ field: 'id', type: 'text', primaryKey: true }, ...fields] })
  const SCHEMAS = {
    projects: schema('projects', [
      { field: 'name', type: 'text' },
      { field: 'owner', type: 'text' },
      { field: 'due', type: 'date' },
    ]),
    tags: schema('tags', [{ field: 'name', type: 'text' }]),
    tasks: schema('tasks', [
      { field: 'name', type: 'text' },
      { field: 'status', type: 'text' },
      { field: 'priority', type: 'number' },
      { field: 'assignee', type: 'text' },
      { field: 'due', type: 'date' },
      { field: 'done', type: 'boolean' },
      { field: 'project_id', type: 'text' },
    ]),
    task_tags: { name: 'task_tags', idField: 'id', fields: [{ field: 'id', type: 'number', primaryKey: true }, { field: 'task_id', type: 'text' }, { field: 'tag_id', type: 'text' }] } as EntitySchema,
  }

  let db: PGlite
  let ready = $state(false)
  let failed = $state('')

  // ---- Every statement, for the log ------------------------------------------------

  /** Who ran a statement: the base, the server (its automations), or you with Run SQL. */
  type Who = 'base' | 'server' | 'you'
  type Entry = { n: number; sql: string; params: unknown[]; ms: number; who: Who; error?: string }
  let log = $state<Entry[]>([])
  let n = 0
  async function run(sql: string, params: unknown[] = [], who: Who = 'base'): Promise<Record<string, unknown>[]> {
    const started = performance.now()
    const entry: Entry = { n: ++n, sql, params, ms: 0, who }
    try {
      const res = await db.query(sql, params)
      return res.rows as Record<string, unknown>[]
    } catch (e) {
      entry.error = e instanceof Error ? e.message : String(e)
      throw e
    } finally {
      entry.ms = Math.round(performance.now() - started)
      // The count query beside each read adds nothing to read here.
      if (!sql.startsWith('SELECT COUNT(')) log = [entry, ...log].slice(0, 40)
      // The server hears the writes it did not make itself.
      if (!entry.error && who !== 'server') heardWrite(sql)
    }
  }

  // "Run SQL" tells the base the tables changed, as a realtime feed would.
  const listeners = new Set<() => void>()
  const realtime = (onChange: () => void) => {
    listeners.add(onChange)
    return () => listeners.delete(onChange)
  }

  // ---- The server ---------------------------------------------------------------
  // In an app this is your server: a SvelteKit route or a worker with the same
  // tables and sources, told of each change by createKitHandlers' audit hook
  // or a database webhook. Here it hears every write that reaches Postgres.

  let server: AutomationServer | null = null
  type Sent = { n: number; kind: 'Chat' | 'Email'; to: string; text: string }
  let sent = $state<Sent[]>([])
  let sentN = 0
  // The team chat's webhook: it gets a JSON message.
  const chatFetch = (async (url: string, init?: RequestInit) => {
    const text = String(JSON.parse(String(init?.body ?? '{}')).text ?? '')
    sent = [{ n: ++sentN, kind: 'Chat' as const, to: new URL(url).host, text }, ...sent]
    return new Response('{}', { status: 200 })
  }) as unknown as typeof fetch

  const waiting = new Set<string>()
  /** A write reached the database: the server reads that table again. */
  function heardWrite(sql: string) {
    const m = /^\s*(?:update|insert\s+into|delete\s+from)\s+"?(\w+)"?/i.exec(sql)
    const table = m?.[1]?.toLowerCase()
    if (!server || !table || !['tasks', 'projects', 'tags'].includes(table) || waiting.has(table)) return
    waiting.add(table)
    setTimeout(async () => {
      waiting.delete(table)
      const runs = (await server?.tableChanged(table)) ?? []
      // What it changed reaches the base the way another user's change would.
      if (runs.some((r) => r.steps.some((s) => s.action === 'Update record' || s.action === 'Create record'))) for (const on of listeners) on()
    }, 0)
  }

  const sql = (table: keyof typeof SCHEMAS, who: Who) =>
    createSqlDataSource({ schema: SCHEMAS[table], table, dialect: { placeholders: '$', ilike: true }, execute: (text, params) => run(text, params, who) })

  // ---- The base ------------------------------------------------------------------

  const STATUS = [
    { value: 'Todo', color: '#64748b' },
    { value: 'In progress', color: '#2563eb' },
    { value: 'Blocked', color: '#dc2626' },
    { value: 'Done', color: '#16a34a' },
  ]

  let tables = $state.raw<BaseTable[]>([])

  const statusIs = (value: string) => ({ kind: 'fieldFilter' as const, conjunction: 'and' as const, conditions: [{ column: 'status', kind: 'select' as const, op: 'is' as const, value }] })
  const AUTOMATIONS: BaseAutomation[] = [
    {
      id: 'done',
      name: 'Done ticks the box',
      enabled: true,
      trigger: { type: 'recordUpdated', fields: ['status'] },
      condition: statusIs('Done'),
      actions: [{ type: 'updateRecord', values: { done: 'true' } }],
    },
    {
      id: 'chat',
      name: 'Tell the team about a blocked task',
      enabled: true,
      runOn: 'server',
      trigger: { type: 'recordMatches' },
      condition: statusIs('Blocked'),
      actions: [{ type: 'webhook', url: 'https://chat.example.com/hooks/{secret:CHAT_HOOK}', body: '{"text": "{Task} is blocked. Assignee: {Assignee}"}' }],
    },
    {
      id: 'mail',
      name: 'Email the lead when a task is done',
      enabled: true,
      runOn: 'server',
      trigger: { type: 'recordUpdated', fields: ['status'] },
      condition: statusIs('Done'),
      actions: [{ type: 'email', to: 'lead@example.com', subject: '{Task} is done', body: '{Task} in {Project} was marked done.' }],
    },
  ]

  function build(who: Who): BaseTable[] {
    return [
      {
        id: 'tasks',
        name: 'Tasks',
        primaryField: 'name',
        data: [],
        columns: [
          { field: 'name', header: 'Task', width: 220, fieldType: 'text' },
          { field: 'status', header: 'Status', width: 130, fieldType: 'singleSelect', fieldProps: { options: STATUS } },
          { field: 'project', header: 'Project', width: 150, fieldType: 'link', fieldProps: { table: 'projects', multiple: false, inverse: 'tasks' } },
          { field: 'tags', header: 'Tags', width: 190, fieldType: 'link', fieldProps: { table: 'tags', multiple: true, inverse: 'tasks' } },
          { field: 'assignee', header: 'Assignee', width: 150, fieldType: 'user' },
          { field: 'due', header: 'Due', width: 150, fieldType: 'date', fieldProps: { dateFormat: 'friendly' } },
          { field: 'priority', header: 'Priority', width: 110, fieldType: 'rating', fieldProps: { max: 5, icon: 'flag', color: '#f82b60' } },
          { field: 'done', header: 'Done', width: 70, fieldType: 'checkbox' },
        ],
        views: [
          { id: 'all', name: 'All tasks', type: 'grid', color: { mode: 'field', field: 'status' } },
          { id: 'board', name: 'By status', type: 'kanban', stackBy: 'status' },
        ],
        source: baseSource(sql('tasks', who), {
          links: {
            project: { column: 'project_id' },
            tags: { through: sql('task_tags', who), from: 'task_id', to: 'tag_id' },
          },
          realtime,
        }),
        automations: AUTOMATIONS,
        props: { rowAdder: { label: 'Add task', defaults: () => ({ status: 'Todo', done: false }) } },
      },
      {
        id: 'projects',
        name: 'Projects',
        primaryField: 'name',
        data: [],
        columns: [
          { field: 'name', header: 'Project', width: 180, fieldType: 'text' },
          { field: 'owner', header: 'Owner', width: 150, fieldType: 'user' },
          { field: 'due', header: 'Due', width: 150, fieldType: 'date', fieldProps: { dateFormat: 'friendly' } },
          { field: 'tasks', header: 'Tasks', width: 280, fieldType: 'link', fieldProps: { table: 'tasks', multiple: true, inverse: 'project' } },
          { field: 'open', header: 'Tasks', width: 90, fieldType: 'count', fieldProps: { linkField: 'tasks' } },
        ],
        source: baseSource(sql('projects', who), { realtime }),
      },
      {
        id: 'tags',
        name: 'Tags',
        primaryField: 'name',
        data: [],
        columns: [
          { field: 'name', header: 'Tag', width: 160, fieldType: 'text' },
          { field: 'tasks', header: 'Tasks', width: 320, fieldType: 'link', fieldProps: { table: 'tasks', multiple: true, inverse: 'tags' } },
        ],
        source: baseSource(sql('tags', who), { realtime }),
      },
    ]
  }

  onMount(async () => {
    try {
      db = new PGlite()
      await db.exec(SCHEMA)
      tables = build('base')
      // The server reads the same tables through sources of its own.
      server = createAutomationServer({
        tables: build('server'),
        secrets: { CHAT_HOOK: 'T0DEMO-hook' },
        fetch: chatFetch,
        sendEmail: (m) => {
          sent = [{ n: ++sentN, kind: 'Email', to: m.to.join(', '), text: `${m.subject}: ${m.text}` }, ...sent]
        },
      })
      await server.prime()
      ready = true
    } catch (e) {
      failed = e instanceof Error ? e.message : String(e)
    }
  })

  // ---- Run SQL -------------------------------------------------------------------

  let query = $state("update tasks set status = 'Done' where priority >= 4")
  let result = $state('')
  async function runQuery() {
    result = ''
    try {
      const rows = await run(query, [], 'you')
      result = rows.length ? `${rows.length} row${rows.length === 1 ? '' : 's'}` : 'Done'
      for (const on of listeners) on()
    } catch (e) {
      result = e instanceof Error ? e.message : String(e)
    }
  }

  const paramsText = (p: unknown[]) => p.map((v) => (typeof v === 'string' ? `'${v}'` : v === null ? 'null' : String(v))).join(', ')
</script>

<section class="pgbase">
  {#if failed}
    <p class="pgbase-error">The database did not start: {failed}</p>
  {:else if !ready}
    <p class="pgbase-wait">Starting Postgres in the page…</p>
  {:else}
    <div class="pgbase-base">
      <SvBase
        bind:tables
        editable
        sortable
        showRowNumbers
        showRowSelection={false}
        expandRows
        rowHeight={34}
        containerHeight="100%"
        columnAdder={false}
        fieldMenu
        serverRuns={async () => server?.runs ?? []}
      />
    </div>
    <div class="pgbase-bottom">
    <div class="pgbase-db">
      <form class="pgbase-run" onsubmit={(e) => { e.preventDefault(); void runQuery() }}>
        <label for="pgbase-sql">Run SQL</label>
        <input id="pgbase-sql" bind:value={query} spellcheck="false" autocomplete="off" />
        <button type="submit">Run</button>
        {#if result}<span class="pgbase-result">{result}</span>{/if}
      </form>
      <ol class="pgbase-log" aria-label="SQL the base ran">
        {#each log as e (e.n)}
          <li class:is-error={!!e.error} data-who={e.who}>
            {#if e.who !== 'base'}<span class="pgbase-who">{e.who === 'server' ? 'Server' : 'You'}</span>{/if}
            <code>{e.sql}</code>
            {#if e.params.length}<span class="pgbase-params">[{paramsText(e.params)}]</span>{/if}
            <span class="pgbase-ms">{e.error ? e.error : `${e.ms} ms`}</span>
          </li>
        {/each}
      </ol>
    </div>
    <aside class="pgbase-sent" aria-label="Sent by the server">
      <h3>Sent by the server</h3>
      {#each sent as s (s.n)}
        <p><span class="pgbase-kind">{s.kind}</span> <span class="pgbase-to">{s.to}</span><br />{s.text}</p>
      {:else}
        <p class="pgbase-none">Set a task to Blocked or Done.</p>
      {/each}
    </aside>
    </div>
  {/if}
  <SvToaster />
</section>

<style>
  .pgbase { display: flex; flex-direction: column; flex: 1; min-height: 0; gap: 10px; }
  .pgbase-base { flex: 1 1 auto; min-height: 380px; display: flex; flex-direction: column; }
  .pgbase-wait, .pgbase-error { margin: 0; padding: 24px 0; color: var(--sg-muted, #64748b); }
  .pgbase-error { color: var(--sg-danger, #dc2626); }
  .pgbase-bottom { flex: 0 0 auto; display: grid; grid-template-columns: minmax(0, 1fr) 300px; gap: 10px; }
  @media (max-width: 900px) { .pgbase-bottom { grid-template-columns: 1fr; } }
  .pgbase-sent {
    height: 196px; overflow: auto; padding: 10px 12px; box-sizing: border-box; font-size: 12px;
    border: 1px solid var(--sg-border, #e2e8f0); border-radius: var(--sg-radius-lg, 10px);
    background: var(--sg-header-bg, var(--sg-bg, #fff)); color: var(--sg-fg, #0f172a);
  }
  .pgbase-sent h3 { margin: 0 0 6px; font-size: 12px; color: var(--sg-muted, #64748b); font-weight: 600; }
  .pgbase-sent p { margin: 0 0 8px; line-height: 1.4; }
  .pgbase-kind { font-weight: 700; }
  .pgbase-to, .pgbase-none { color: var(--sg-muted, #64748b); }
  .pgbase-db {
    flex: 0 0 auto; display: flex; flex-direction: column; gap: 8px; padding: 10px 12px;
    border: 1px solid var(--sg-border, #e2e8f0); border-radius: var(--sg-radius-lg, 10px);
    background: var(--sg-header-bg, var(--sg-bg, #fff)); color: var(--sg-fg, #0f172a);
  }
  .pgbase-run { display: flex; align-items: center; gap: 8px; font-size: 13px; }
  .pgbase-run label { color: var(--sg-muted, #64748b); white-space: nowrap; }
  .pgbase-run input {
    flex: 1; min-width: 0; height: 30px; padding: 0 8px; box-sizing: border-box;
    font: 12px/1 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    color: var(--sg-fg, #0f172a); background: var(--sg-bg, #fff);
    border: 1px solid var(--sg-border, #cbd5e1); border-radius: var(--sg-radius, 6px);
  }
  .pgbase-run input:focus-visible { outline: 2px solid var(--sg-accent, #2563eb); outline-offset: -1px; }
  .pgbase-run button {
    height: 30px; padding: 0 14px; border: 0; border-radius: var(--sg-radius, 6px); cursor: pointer;
    background: var(--sg-accent, #2563eb); color: var(--sg-accent-fg, #fff); font: inherit; font-weight: 600;
  }
  .pgbase-result { color: var(--sg-muted, #64748b); font-size: 12px; max-width: 40%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .pgbase-log {
    list-style: none; margin: 0; padding: 0; height: 150px; overflow: auto;
    font: 12px/1.5 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  }
  .pgbase-log li { display: flex; gap: 10px; align-items: baseline; padding: 3px 0; border-top: 1px solid var(--sg-border, #e2e8f0); }
  .pgbase-log li:first-child { border-top: 0; }
  .pgbase-log code { flex: 1; min-width: 0; overflow-wrap: anywhere; }
  .pgbase-params { color: var(--sg-muted, #64748b); overflow-wrap: anywhere; max-width: 35%; }
  .pgbase-ms { flex: none; color: var(--sg-muted, #64748b); }
  .pgbase-who { flex: none; padding: 0 5px; border-radius: 4px; font-size: 11px; border: 1px solid var(--sg-border, #cbd5e1); color: var(--sg-muted, #64748b); }
  .pgbase-log li[data-who='server'] code { color: var(--sg-muted, #64748b); }
  .pgbase-log li.is-error { flex-wrap: wrap; }
  /* A refused statement: the database's message on a line of its own. */
  .pgbase-log li.is-error .pgbase-ms { flex: 1 0 100%; color: var(--sg-danger, #dc2626); }
</style>
