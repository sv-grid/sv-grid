<script lang="ts">
  /**
   * 700. An AI agent and your team, one table
   * -----------------------------------------
   * A support inbox in SvGrid Base, its tickets in a real Postgres database
   * (PGlite, Postgres compiled to WebAssembly, running in this page).
   *
   * "Run the triage agent" writes to the database, not to the page: for each
   * new ticket an UPDATE sets its category, priority, a draft reply, Review
   * to "Needs review", and `modified_by` to the agent. The log under the base
   * lists each statement. The base hears of the writes through the source's
   * `realtime` hook (with Supabase, `createSupabaseRealtime`), reads the
   * table again, and shows what moved:
   *  - the cells the agent changed are tinted, and the row has a dot, until
   *    someone opens the record;
   *  - the view bar says "10 changed by Triage agent"; a click marks them seen;
   *  - the record's Activity says "Triage agent changed Priority", with the
   *    value before, crossed out, and the value now. Who made a change is read
   *    from the row's "last modified by" field (`modified_by`).
   *
   * Then people review it. "Needs review" is a view filtered on Review. The
   * agent gets one wrong on purpose: "can't wait for Excel export" is a
   * feature request, not an urgent login problem. Set it right; your edit is
   * written with `modified_by` = you. Approve runs an automation that sets
   * Review to Approved, and the record leaves the view.
   *
   * The agent here is a stand-in: keyword rules, so the demo runs without a
   * model or a key. A real one (Claude Code with the Supabase MCP server, a
   * worker calling a model) writes the same UPDATE, and the base shows it the
   * same way.
   */
  import { onMount } from 'svelte'
  import { PGlite } from '@electric-sql/pglite'
  import { SvToaster } from '@svgrid/grid'
  import { SvBase, baseSource, enableBase, setFieldUsers, type BaseAutomation, type BaseTable, type FieldUser } from '@svgrid/enterprise/base'
  import { createSqlDataSource, type EntitySchema } from '@svgrid/enterprise'
  import { PEOPLE, usePeople } from '../shared/base-people'

  enableBase()
  usePeople()

  // The agent is a person the base can name: its id is what it writes to modified_by.
  const BOT = `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40"><rect width="40" height="40" rx="20" fill="#0f766e"/><rect x="10" y="13" width="20" height="16" rx="5" fill="#ccfbf1"/><circle cx="16" cy="21" r="2.4" fill="#0f766e"/><circle cx="24" cy="21" r="2.4" fill="#0f766e"/><rect x="18.5" y="7" width="3" height="6" rx="1.5" fill="#ccfbf1"/></svg>')}`
  const AGENT: FieldUser = { id: 'agent', name: 'Triage agent', avatarUrl: BOT }

  // ---- The database -----------------------------------------------------------

  const TICKETS: Array<[string, string, string]> = [
    ['Charged twice for October', 'mira@northwind.example', 'My card shows two charges for the October invoice.'],
    ["Can't log in after a password reset", 'tom@contoso.example', 'The reset link worked, but the new password is refused.'],
    ['Export to PDF cuts off the last column', 'li@fabrikam.example', 'Wide tables lose their last column in the PDF.'],
    ['Please add dark mode to the mobile app', 'sara@litware.example', 'Our team works night shifts.'],
    ['Invoice shows the wrong VAT number', 'jon@adatum.example', 'The VAT number on invoice 2291 is our old one.'],
    ["Love the new export, can't wait for Excel export", 'eva@tailspin.example', 'CSV works great for us. Any plans for .xlsx?'],
    ['The site is down for our whole team', 'raj@woodgrove.example', 'Every page returns an error since 9:10.'],
    ['How do I add a teammate?', 'ana@proseware.example', 'We hired someone and want to give them access.'],
    ['Refund for unused seats', 'kim@fourth.example', 'We removed 5 seats mid-month.'],
    ['Dashboard is slow with 50k rows', 'ola@wingtip.example', 'It takes several seconds to open since we imported last year.'],
  ]

  const SCHEMA = `
    create table tickets (
      id text primary key,
      subject text not null default '',
      customer text,
      message text,
      received timestamptz,
      category text,
      priority text,
      reply text,
      review text,
      assignee text,
      modified_by text
    );
    insert into tickets (id, subject, customer, message, received, priority, modified_by) values
    ${TICKETS.map(([s, c, m], i) => `('k${i + 1}', '${s.replace(/'/g, "''")}', '${c}', '${m.replace(/'/g, "''")}', now() - interval '${(i + 1) * 17} minutes', 'Normal', 'u2')`).join(',\n    ')};
  `
  const schema: EntitySchema = {
    name: 'tickets',
    idField: 'id',
    fields: [
      { field: 'id', type: 'text', primaryKey: true },
      ...['subject', 'customer', 'message', 'category', 'priority', 'reply', 'review', 'assignee', 'modified_by'].map((field) => ({ field, type: 'text' as const })),
      { field: 'received', type: 'datetime' },
    ],
  }

  let db: PGlite
  let ready = $state(false)
  let failed = $state('')

  // Every statement the agent ran, for the log.
  type Entry = { n: number; sql: string; params: unknown[] }
  let log = $state<Entry[]>([])
  let n = 0
  async function run(sql: string, params: unknown[] = [], who: 'base' | 'agent' = 'base') {
    const res = await db.query(sql, params)
    if (who === 'agent') log = [{ n: ++n, sql, params }, ...log].slice(0, 30)
    return res.rows as Record<string, unknown>[]
  }

  // The realtime feed: a write that reaches the database tells every base listening.
  const listeners = new Set<() => void>()
  const realtime = (onChange: () => void) => {
    listeners.add(onChange)
    return () => listeners.delete(onChange)
  }

  // ---- The base ------------------------------------------------------------------

  const CATEGORY = [
    { value: 'Billing', color: '#7c3aed' },
    { value: 'Bug', color: '#dc2626' },
    { value: 'Account', color: '#2563eb' },
    { value: 'Feature request', color: '#0d9488' },
  ]
  const PRIORITY = [
    { value: 'Urgent', color: '#dc2626' },
    { value: 'High', color: '#ea580c' },
    { value: 'Normal', color: '#2563eb' },
    { value: 'Low', color: '#64748b' },
  ]
  const REVIEW = [
    { value: 'Needs review', color: '#d97706' },
    { value: 'Approved', color: '#16a34a' },
  ]

  const AUTOMATIONS: BaseAutomation[] = [
    {
      id: 'approve',
      name: 'Approve the triage',
      enabled: true,
      trigger: { type: 'button', field: 'approve' },
      actions: [
        { type: 'updateRecord', values: { review: 'Approved' } },
        { type: 'notify', message: 'Approved: {Subject}', severity: 'success' },
      ],
    },
  ]

  const needsReview = { kind: 'fieldFilter' as const, conjunction: 'and' as const, conditions: [{ column: 'review', kind: 'select' as const, op: 'is' as const, value: 'Needs review' }] }

  function build(): BaseTable[] {
    return [
      {
        id: 'tickets',
        name: 'Tickets',
        primaryField: 'subject',
        data: [],
        columns: [
          { field: 'subject', header: 'Subject', width: 260, fieldType: 'text' },
          { field: 'category', header: 'Category', width: 140, fieldType: 'singleSelect', fieldProps: { options: CATEGORY } },
          { field: 'priority', header: 'Priority', width: 110, fieldType: 'singleSelect', fieldProps: { options: PRIORITY } },
          { field: 'review', header: 'Review', width: 130, fieldType: 'singleSelect', fieldProps: { options: REVIEW } },
          { field: 'approve', header: 'Approve', width: 100, fieldType: 'button', fieldProps: { label: 'Approve', color: '#16a34a' } },
          { field: 'reply', header: 'Draft reply', width: 300, fieldType: 'longText' },
          { field: 'modified_by', header: 'Last changed by', width: 160, fieldType: 'lastModifiedBy' },
          { field: 'customer', header: 'Customer', width: 200, fieldType: 'email' },
          { field: 'message', header: 'Message', width: 300, fieldType: 'longText' },
          { field: 'assignee', header: 'Assignee', width: 150, fieldType: 'user' },
          { field: 'received', header: 'Received', width: 170, fieldType: 'date', fieldProps: { dateFormat: 'friendly', time: true } },
        ],
        views: [
          { id: 'inbox', name: 'Inbox', type: 'grid', color: { mode: 'field', field: 'priority' }, state: { sorting: [{ id: 'received', desc: true }] } },
          { id: 'review', name: 'Needs review', type: 'grid', color: { mode: 'field', field: 'priority' }, state: { advancedFilter: needsReview } },
          { id: 'board', name: 'By priority', type: 'kanban', stackBy: 'priority' },
        ],
        source: baseSource(
          createSqlDataSource({ schema, table: 'tickets', dialect: { placeholders: '$', ilike: true }, execute: (text, params) => run(text, params) }),
          { realtime },
        ),
        automations: AUTOMATIONS,
        props: { rowAdder: false },
      },
    ]
  }
  let tables = $state.raw<BaseTable[]>([])
  // A new base for Reset: the marks and activity start over with the tickets.
  let generation = $state(0)

  async function start() {
    ready = false
    log = []
    db = new PGlite()
    await db.exec(SCHEMA)
    tables = build()
    generation += 1
    ready = true
  }

  onMount(async () => {
    // After the shared people: the agent is one more user the base can name.
    setFieldUsers([...PEOPLE, AGENT])
    try {
      await start()
    } catch (e) {
      failed = e instanceof Error ? e.message : String(e)
    }
  })

  // ---- The agent -------------------------------------------------------------------
  // Keyword rules standing in for a model, checked in order. The "can't" rule
  // is the one a person has to correct: it reads a happy customer as locked out.

  const RULES: Array<{ match: RegExp; category: string; priority: string; reply: string }> = [
    { match: /down|error/i, category: 'Bug', priority: 'Urgent', reply: 'We are on it and will update you within the hour.' },
    { match: /can't|cannot|log in/i, category: 'Account', priority: 'Urgent', reply: 'Sorry you are locked out. We have reset your sign-in; try again now.' },
    { match: /charged|refund|invoice|vat/i, category: 'Billing', priority: 'High', reply: 'Thanks for flagging this. Billing will correct it and email you a new invoice.' },
    { match: /slow|cuts off|wrong/i, category: 'Bug', priority: 'High', reply: 'Thanks for the report. We reproduced it and a fix is scheduled.' },
    { match: /how do i|teammate/i, category: 'Account', priority: 'Normal', reply: 'Open Settings, then Team, then Invite: they get an email to join.' },
    { match: /please add|plans for/i, category: 'Feature request', priority: 'Low', reply: 'Thanks for the idea. We have added it to the roadmap.' },
  ]
  const classify = (text: string) => RULES.find((r) => r.match.test(text)) ?? { category: 'Feature request', priority: 'Normal', reply: 'Thanks for writing. We will get back to you soon.' }

  let running = $state(false)
  let progress = $state('')
  async function runAgent() {
    if (running) return
    running = true
    try {
      const todo = await run(`select id, subject, message from tickets where review is null order by received`)
      for (const [i, t] of todo.entries()) {
        progress = `Triaging ${i + 1} of ${todo.length}`
        const r = classify(`${t.subject} ${t.message}`)
        // Billing tickets go to Ben; the rest stay unassigned for the team.
        await run(
          `update tickets set category = $1, priority = $2, reply = $3, review = 'Needs review', assignee = $4, modified_by = 'agent' where id = $5`,
          [r.category, r.priority, r.reply, r.category === 'Billing' ? 'u2' : null, t.id],
          'agent',
        )
        for (const on of listeners) on()
        await new Promise((res) => setTimeout(res, 450))
      }
      progress = todo.length ? `Triaged ${todo.length} tickets` : 'No new tickets'
    } finally {
      running = false
    }
  }

  const paramsText = (p: unknown[]) => p.map((v) => (typeof v === 'string' ? `'${v.length > 28 ? `${v.slice(0, 28)}...` : v}'` : v === null ? 'null' : String(v))).join(', ')
</script>

<section class="aitri">
  {#if failed}
    <p class="aitri-error">The database did not start: {failed}</p>
  {:else if !ready}
    <p class="aitri-wait">Starting Postgres in the page…</p>
  {:else}
    <div class="aitri-base">
      {#key generation}
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
        />
      {/key}
    </div>
    <div class="aitri-agent">
      <div class="aitri-bar">
        <button type="button" class="aitri-run" onclick={() => void runAgent()} disabled={running}>
          <img src={BOT} alt="" width="18" height="18" />Run the triage agent
        </button>
        <span class="aitri-progress" aria-live="polite">{progress}</span>
        <button type="button" class="aitri-reset" onclick={() => void start()} disabled={running}>Reset</button>
      </div>
      <ol class="aitri-log" aria-label="SQL the agent ran">
        {#each log as e (e.n)}
          <li><code>{e.sql}</code><span class="aitri-params">[{paramsText(e.params)}]</span></li>
        {:else}
          <li class="aitri-none">The agent writes to the database with SQL, never to the page. Its statements show here.</li>
        {/each}
      </ol>
    </div>
  {/if}
  <SvToaster />
</section>

<style>
  .aitri { display: flex; flex-direction: column; flex: 1; min-height: 0; gap: 10px; }
  .aitri-base { flex: 1 1 auto; min-height: 380px; display: flex; flex-direction: column; }
  .aitri-wait, .aitri-error { margin: 0; padding: 24px 0; color: var(--sg-muted, #64748b); }
  .aitri-error { color: var(--sg-danger, #dc2626); }
  .aitri-agent {
    flex: 0 0 auto; display: flex; flex-direction: column; gap: 8px; padding: 10px 12px;
    border: 1px solid var(--sg-border, #e2e8f0); border-radius: var(--sg-radius-lg, 10px);
    background: var(--sg-header-bg, var(--sg-bg, #fff)); color: var(--sg-fg, #0f172a);
  }
  .aitri-bar { display: flex; align-items: center; gap: 10px; font-size: 13px; }
  .aitri-run {
    display: inline-flex; align-items: center; gap: 8px; height: 32px; padding: 0 14px; border: 0; border-radius: var(--sg-radius, 6px);
    background: var(--sg-accent, #2563eb); color: var(--sg-accent-fg, #fff); font: inherit; font-weight: 600; cursor: pointer;
  }
  .aitri-run img { border-radius: 50%; }
  .aitri-run:disabled, .aitri-reset:disabled { opacity: 0.6; cursor: default; }
  .aitri-progress { color: var(--sg-muted, #64748b); }
  .aitri-reset {
    margin-inline-start: auto; height: 30px; padding: 0 12px; border: 1px solid var(--sg-border, #cbd5e1); border-radius: var(--sg-radius, 6px);
    background: var(--sg-bg, #fff); color: var(--sg-fg, #0f172a); font: inherit; cursor: pointer;
  }
  .aitri-log {
    list-style: none; margin: 0; padding: 0; height: 120px; overflow: auto;
    font: 12px/1.5 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  }
  .aitri-log li { display: flex; gap: 10px; align-items: baseline; padding: 3px 0; border-top: 1px solid var(--sg-border, #e2e8f0); }
  .aitri-log li:first-child { border-top: 0; }
  .aitri-log code { flex: 1; min-width: 0; overflow-wrap: anywhere; }
  .aitri-params { color: var(--sg-muted, #64748b); overflow-wrap: anywhere; max-width: 40%; }
  .aitri-none { color: var(--sg-muted, #64748b); font-family: inherit; }
  @media (max-width: 640px) { .aitri-params { display: none; } }
</style>
