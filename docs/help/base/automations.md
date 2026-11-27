# Automations

An automation does something on its own when something happens to a
record: a task set to Done ticks its Done box, a new request goes to Todo, a
blocked task tells its owner, a button starts the work. Each table of a base
has its own, under "Automations" in the view bar.

<div data-docs-demo="504-project-tracker" data-height="680"></div>

In the demo, set a task's Status to Done, press Start in the Kick off
column, or send the Request a task form, then open "5 automations" and look
at Runs.

![An automation has three parts: when, only for records where, and do. What an action changes can set off other automations, up to four deep.](/docs-media/base-automation.svg)

## Add one

Open "Automations" in the view bar and press "+ New automation". The dialog
has three parts:

- **When**: what sets it off.
- **Only for records where**: a condition written with the view bar's
  filter, so it compares a select's option, a person, a linked record's name
  or "within the past week" the way the filter does. Leave it empty for
  every record.
- **Do**: the actions, in order.

![The Automations dialog: the list of automations with an on/off switch each, and the one picked: when Status changes, only for records where Status is Done, do update the record and show a notice.](/docs-media/base-automations.png)

Every change is kept as you make it. "Run now" tries the automation on the
record you pick, as if its trigger had happened.

## When

| Trigger | Runs |
|---|---|
| A record is created | When a record is added: "+ Add row", a form, a board lane, a calendar day, another automation. A record brought back by Restore or an undo of a delete is not created, and no rule runs for it |
| A record changes | When a record is edited; pick fields to run only when one of them changes. A link made from the other table counts: adding a guest to an event from Guests changes the event's Guests field |
| A record matches a condition | When a record starts to match the condition. It does not run again while the record keeps matching |
| A record enters a view | When a record starts to show in a view through its filter (`{ type: 'recordEntersView', view }`), read as the view has it then, so the trigger follows the view. Once; again only after the record has left the view. A view with no filter sets nothing off |
| A form is sent | When a form view sends a record; pick the form, or any form of the table |
| A button is pressed | When a Button field is pressed on a record, after the button's own action (a change it makes is in the record the steps read). `{pressed.name}`, `{pressed.email}` and `{pressed.id}` are the person who pressed it |
| At a scheduled time | Every day at 9, every Monday, every hour, or a cron expression: once for each record that matches the condition then, or once with no record |
| A webhook is received | On the server: a request to the automation's own address, with no record. The body's values are `{webhook.name}` in the steps ([below](#a-webhook-starts-it)) |

A paste or a fill that changes several cells of one record is one change to
it. An undo or a redo is no change: it runs no automation.

Duplicate, at the foot of an automation's settings, puts a copy right after it,
named "<name> copy" and switched off, so the two do not both run until you
turn it on; a webhook trigger gets an address of its own.

## Do

| Action | What it does |
|---|---|
| Update the record | Sets fields of the record that set it off |
| Create a record | Adds a record to any table of the base; "Link it back" fills a link field of the new record with the record that set it off |
| Delete the record | Deletes the record that set it off; inside "Find records", each record found. A table read from a server removes it as a person's delete does (`server.remove` of the runner, the table source's `remove` on the Node server) |
| Show a notice | A toast; `{Field name}` is that field of the record. `to` (user ids, or `field:<column id>` for the people a person field names) also sends it to their notifications when a server runs the automation |
| Color the record while it matches | Colors the whole row, or some fields, for as long as the record matches the condition |
| Call a webhook | POSTs the record (or a body you write) to a URL: a team chat, your API. Secrets as `{secret:NAME}`, read on the server only |
| Send an email | To, subject and text with field names; sent by the [server](#on-the-server) |
| Send a Slack, Teams or Google Chat message | A message to a channel through the address its chat app gave; only that app's own addresses ([below](#chat-messages)) |
| Send a text message (SMS or Viber) | A text to phone numbers, or a phone field, by SMS or by Viber; sent by the [server](#on-the-server) through your provider ([below](#text-messages)) |
| Find records and, for each, do | Steps run on every record of a table that matches a condition ([below](#if-and-find-records)) |
| If a condition holds, do | Then steps when the record matches, Otherwise steps when it does not |
| Ask AI | A prompt with field names; the answer goes into a field, and is `{ai}` in the next steps ([below](#ask-ai)) |
| Run a script | JavaScript in a sandbox in the browser, as Airtable's automation scripts ([below](#run-a-script)) |
| Your own actions | Anything the app adds with `registerAutomationAction` |

A webhook's URL, headers and body name fields in braces, and secrets as
`{secret:NAME}`; leave the body empty to send the record as JSON. A secret is
named only by the automation: what a record holds is data, so `{secret:NAME}`
typed into a field goes out as that text.

From the server a webhook does not call private or local addresses (`localhost`,
`10.x`, `192.168.x`, `169.254.169.254`, a name that resolves to one, an IPv6 form
that wraps one) and does not follow redirects. On Node it connects to the
addresses it checked, so a name cannot answer one way for the check and another
for the call; a name that does not resolve is not sent. A `fetch` of your own
passed to `createAutomationServer` gets the check but not that pin, and neither
does a runtime with no sockets of its own. For a webhook on your own network, set
`allowInternalWebhooks: true` on `createAutomationServer`.


![A server automation that calls a webhook: POST to https://chat.example.com/hooks/{secret:CHAT_HOOK} with the body {"text": "{Task} is blocked. Assignee: {Assignee}"}.](/docs-media/base-automation-webhook.png)

Values are written as the field shows them:

| Field | Write |
|---|---|
| Single or multiple select | The option's name: `Done`, `Bug, Risk` |
| Person | The person's name: `Ana Ruiz` |
| Checkbox | `true` or `false` |
| Number | `42`; in a percent field, `100%` |
| Date | `2026-11-01`, `today`, `today+7`, `today-1`, `now` |
| Link | A record's name, several with commas, or `{record}` for the record that set it off |
| Any text | Text with fields in braces: `{Task} follow-up` |
| Any field | Nothing, to clear it |

## If and Find records

"If a condition holds" runs its Then steps when the record matches the
condition, and its Otherwise steps when it does not. With no record (a
schedule, a webhook) only an "If" with no condition runs Then.

"Find records and, for each, do" reads the records of a table that match a
condition, at most the number you set (100, up to 1,000), and runs its steps
on each: in them `{Field}` is the found record's field, `{trigger.Field}` the
field of the record that set the automation off, and `{found}` how many were
found. "Update the record" there updates the found record.

```ts
{ type: 'repeat', table: 'tasks', condition: statusIs('Todo'), limit: 50, actions: [
  { type: 'updateRecord', values: { note: 'Waiting on {trigger.Task}' } },
] }
{ type: 'if', condition: statusIs('Done'), then: [{ type: 'notify', message: 'Shipped' }], else: [] }
```

A step can be inside an "If" or a "Find records", and one of those inside
another, but no deeper. A script or a color is a step of the automation
itself only.

## Chat messages

Paste the address the chat app gives for its channel:

| App | Where the address comes from | What is sent |
|---|---|---|
| Slack | Apps, Incoming Webhooks, Add to a channel (`https://hooks.slack.com/...`) | `{ "text": ... }` |
| Microsoft Teams | The channel's Workflows, "Post to a channel when a webhook request is received" (`*.logic.azure.com`, `*.powerplatform.com`) | An Adaptive Card with the text |
| Google Chat | The space's Apps and integrations, Webhooks (`https://chat.googleapis.com/...`) | `{ "text": ... }` |

The text names fields in braces. A message goes only to its app's own https
addresses, so a chat step cannot be pointed at any other server; an address
may name a secret (`{secret:SLACK_HOOK}`) on the server.

## Text messages

"Send a text message" sends a text to the numbers in **To**: written with their
country code (`+359 88 123 4567`), or a phone field in braces (`{Phone}`),
several apart with commas. The message names fields in braces. **Send by** is
SMS, or Viber, which your provider may send as an SMS to a phone that is not on
Viber.

The browser has no account to send texts with, so this step runs on the
[server](#on-the-server): give `createAutomationServer` a `sendText`, which gets
`{ to, text, channel }` and calls your SMS or Viber provider.

```ts
import { createAutomationServer, type BaseTable } from '@svgrid/enterprise/base'

// Your tables, and your SMS or Viber provider's client.
declare const tables: BaseTable[]
declare const texts: { send: (m: { phone: string; text: string; viber: boolean }) => Promise<unknown> }

export const automations = createAutomationServer({
  tables,
  sendText: ({ to, text, channel }) => Promise.all(to.map((phone) => texts.send({ phone, text, viber: channel === 'viber' }))),
})
```

## Ask AI

The prompt names fields in braces: `Write a two-line summary of {Name} for
the weekly report.` The answer goes into a text field of the record when you
pick one, and is `{ai}` in the steps after it. In the page the model is the
runner's `ai` option, on the server `createAutomationServer({ ai })`: a
function from a prompt to the answer, behind which you call your model, with
your key on your server.

```ts
createAutomationServer({ tables, ai: async (prompt) => (await anthropic.messages.create({ model, max_tokens: 1000, messages: [{ role: 'user', content: prompt }] })).content[0].text })
```

## Run a script

A script is JavaScript with Airtable's automation scripting objects:

```js
const { recordId, Status } = input.config()   // the record's fields, as text, by name
const tasks = base.getTable('Tasks')
const query = await tasks.selectRecordsAsync()
for (const r of query.records) {
  if (r.getCellValueAsString('Status') === 'Blocked') await tasks.updateRecordAsync(r.id, { Owner: 'Ana Ruiz' })
}
output.set('blocked', query.records.length)    // {script.blocked} in the next steps
```

`base.getTable(name)` has `selectRecordsAsync`, `updateRecordAsync`,
`updateRecordsAsync`, `createRecordAsync`, `createRecordsAsync`,
`deleteRecordAsync` and `deleteRecordsAsync`; a record has `id`, `name`,
`getCellValue` and `getCellValueAsString`. Values are written as the field
shows them, as in "Update the record". `console.log` lines are the step's
detail in the run history, and `fetch` calls https addresses that allow it.

It runs in the browser, in a sandboxed iframe with no access to the page, its
cookies or its storage, for up to 30 seconds and 1,000 calls to the base
(`runScript` from `@svgrid/enterprise/base` runs one with a bridge of your
own). The browser runner runs it in the page of the person who made the
change; the server runner (`createAutomationServer`) cannot run JavaScript of
a person's and fails the step, saying so. An app can hand a server run's
script to that person's page instead, as Artavolo does: pass
`scriptsInPage` to `<SvBaseAutomations>` so the editor does not warn.

## A webhook starts it

"A webhook is received" gives the automation an address of its own: the
editor shows it (`webhookUrl` on `<SvBaseAutomations>` turns the token into
your endpoint's URL) and makes a new one on request. Your endpoint hands the
request to the server runner:

```ts
// POST /hooks/[token]
export const POST = async ({ params, request }) => json(await automations.webhookReceived(params.token, await request.json()))
```

The JSON body's values are `{webhook.name}` in the steps, `{webhook.order.id}`
inside objects and `{webhook.items.0.sku}` in lists; `{webhook}` is the whole
body. The run has no record: "Create a record" with values from the body is
the usual first step. Anyone with the address can start the automation, so
keep it secret, and limit how often your endpoint takes a request.

## Runs

Every run is listed under Runs, newest first, with what each action did and
the record it ran on. A failed action stops the run there and says why.

Edit fields on more than 10,000 records asks first, and that question says how many
runs the change can start in the page and how long they will likely take: at the rate
runs went in this tab, or, before any did, from how long the server takes to answer. Untick
"Also run automations" to make the change without them. The choice holds for that change
only. An automation that runs on the server is not counted and cannot be skipped from here.

Runs in the page go one at a time, in the tab, after the change is saved. From 20 runs on, the top
bar says how far they are and about how long is left, with a Stop button. Stop drops the runs
not started and says how many, and those do not run later. Runs left when the tab closes do
not happen either, so the browser asks before it closes. For a change of hundreds of thousands of records,
run the automation on the server (`runOn: 'server'`).

![Runs: Task blocked on Paste URLs as attachments showed a notice; Done closes the task on Lightbox preview set Done to checked and Progress to 100%, then showed a notice; Start a task on Docs page set Status to In progress and Start to today.](/docs-media/base-automation-runs.png)

## In code

A table's automations are its `automations`, plain data you can store with
the rest of the table:

```ts
import type { BaseAutomation } from '@svgrid/enterprise/base'

const statusIs = (value: string) => ({
  kind: 'fieldFilter' as const,
  conjunction: 'and' as const,
  conditions: [{ column: 'status', kind: 'select' as const, op: 'is' as const, value }],
})

export const taskAutomations: BaseAutomation[] = [
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
    id: 'blocked',
    name: 'Open an issue for a blocked task',
    enabled: true,
    trigger: { type: 'recordMatches' },
    condition: statusIs('Blocked'),
    actions: [{ type: 'createRecord', table: 'issues', values: { title: 'Unblock {Task}', owner: '{Assignee}' }, linkField: 'task' }],
  },
]
```

```svelte
<script lang="ts">
  import { SvToaster } from '@svgrid/grid'
  import { SvBase, enableBase, type BaseTable } from '@svgrid/enterprise/base'
  import { taskAutomations } from '$lib/automations'

  enableBase()
  let { tasks, issues }: { tasks: BaseTable; issues: BaseTable } = $props()
  let tables = $state.raw([{ ...tasks, automations: taskAutomations }, issues])
</script>

<SvBase bind:tables editable onTablesChange={(t) => console.log('save', t)} />
<SvToaster />
```

Automations edited in the dialog reach `onTablesChange` with the rest of the
table. Automations need `<SvBase tables>`; one table is a list of one.
Notices show as a base's other notices do: see [Notices](./quick-start.md#notices).

## Your own actions

`registerAutomationAction` adds an action to the dialog's list. It runs in
the page, so call your own server for anything that needs a secret:

```ts
import { registerAutomationAction } from '@svgrid/enterprise/base'

registerAutomationAction('post-to-chat', {
  label: 'Post to the team chat',
  run: async ({ record, text }) => {
    if (!record) return 'No record'
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ message: `${text('Task')} needs a hand (${text('Assignee')})` }),
    })
    if (!res.ok) throw new Error(`Chat answered ${res.status}`)
    return 'Posted'
  },
})
```

An automation runs it with `{ type: 'run', action: 'post-to-chat' }`. What it
returns is the run's detail; what it throws is the run's error.

## Describe it in words

`setAutomationDrafter` puts a box at the top of the dialog, "Describe what
should happen". What the person writes goes to your app, which turns it into
an automation (with its own AI, say); the dialog adds it switched off and
selected, with a note to check each part before switching it on.

```ts
import { setAutomationDrafter } from '@svgrid/enterprise/base'

setAutomationDrafter({
  // Asked when the dialog opens: no box when it answers false.
  available: async () => (await fetch('/api/ai/status').then((r) => r.json())).available,
  // { automation } to add, { question } when the words do not say enough.
  draft: async (text, tableId) => {
    const res = await fetch(`/api/tables/${tableId}/automations/draft`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ text }),
    })
    if (!res.ok) throw new Error((await res.json()).error)
    return res.json()
  },
})
```

The automation is a `BaseAutomation` as the table keeps them; it gets a new
id. The automations page (`SvBaseAutomations`) has the same box at the top of
its list and asks with `tableId` `''`: answer `tableId` with the table the
automation belongs to, and it is added there. `words`, when given, shows under the note. A question shows under the box,
and so does the message of a rejected promise. Without a drafter there is no
box.

## Where they run

Each automation says where it runs, under "Runs in":

- **This browser** (the default): in the page of the person who made the
  change, right away and once. A change that arrives from someone else
  through [realtime](./data.md#changes-made-elsewhere) does not run it again
  in your page. Scheduled ones run while the base is open.
- **The server**: in your server, for every change to the database, whoever
  or whatever made it, with secrets and email. Set it up as below.

Either way, a change an automation makes is an ordinary change: with a
[source](./data.md), it is written to the database like an edit. What an
action changes can set off other automations, up to four deep; past that the
run stops and says so, so two automations that answer each other cannot loop.

## On the server

![Automations on the server: the base writes through your endpoint to the database; the automation server hears each change through the endpoint's audit hook or a database webhook, writes back through the same sources, and calls webhooks and sends email with secrets that stay on the server.](/docs-media/base-automation-server.svg)

`createAutomationServer` runs the automations set to "The server". It reads
the same tables, with the same automations, through sources of its own. It remembers
the last 10,000 records of a table it heard deleted: on a table with no `softDelete` an
undo writes the record again, and only that memory tells it from a new one, so such an
undo after a server restart reads as a creation.
Keep the tables in one module both sides import, each side handing in its
own way to reach the data:

```ts
// src/lib/tables.ts: the tables, for the browser and for the server.
import { baseSource, type BaseTable } from '@svgrid/enterprise/base'
import type { ServerDataSource } from '@svgrid/grid'

export function trackerTables(source: (table: string) => ServerDataSource<Record<string, unknown>>): BaseTable[] {
  return [
    {
      id: 'tasks',
      name: 'Tasks',
      primaryField: 'name',
      data: [],
      columns: [
        { field: 'name', header: 'Task', fieldType: 'text' },
        { field: 'status', header: 'Status', fieldType: 'singleSelect', fieldProps: { options: [{ value: 'Todo' }, { value: 'Blocked' }, { value: 'Done' }] } },
        { field: 'owner_email', header: 'Owner email', fieldType: 'email' },
      ],
      automations: [
        {
          id: 'blocked',
          name: 'Tell the team about a blocked task',
          enabled: true,
          runOn: 'server',
          trigger: { type: 'recordMatches' },
          condition: { kind: 'fieldFilter', conjunction: 'and', conditions: [{ column: 'status', kind: 'select', op: 'is', value: 'Blocked' }] },
          actions: [
            { type: 'webhook', url: 'https://hooks.slack.com/services/{secret:SLACK_HOOK}', body: '{"text": "{Task} is blocked"}' },
            { type: 'email', to: '{Owner email}', subject: '{Task} is blocked', body: 'Someone marked {Task} as blocked.' },
          ],
        },
      ],
      source: baseSource(source('tasks')),
    },
  ]
}
```

The server side, in a SvelteKit app:

The code on this page is for SvelteKit 2. On SvelteKit 3,
[these names differ](../../getting-started/sveltekit.md#on-sveltekit-3).

```ts
// src/lib/server/automations.ts
import pg from 'pg'
import { createAutomationServer } from '@svgrid/enterprise/base'
import { createSqlDataSource, type EntitySchema } from '@svgrid/enterprise'
import { env } from '$env/dynamic/private'
import { trackerTables } from '$lib/tables'

const pool = new pg.Pool({ connectionString: env.DATABASE_URL })
const schemas: Record<string, EntitySchema> = {
  tasks: {
    name: 'tasks',
    fields: [
      { field: 'id', type: 'text', primaryKey: true },
      { field: 'name', type: 'text' },
      { field: 'status', type: 'text' },
      { field: 'owner_email', type: 'text' },
    ],
  },
}

// Your mail provider's client.
declare const mailer: { send: (m: { from: string; to: string[]; subject: string; text: string }) => Promise<unknown> }

export const automations = createAutomationServer({
  tables: trackerTables((table) =>
    createSqlDataSource({
      schema: schemas[table]!,
      table,
      dialect: { placeholders: '$', ilike: true },
      execute: async (sql, params) => (await pool.query(sql, params)).rows,
    }),
  ),
  // {secret:SLACK_HOOK} in a webhook reads this. List what automations may use:
  // whoever writes an automation can send any secret named here to any URL.
  secrets: { SLACK_HOOK: env.SLACK_HOOK },
  sendEmail: (m) => mailer.send({ from: 'tracker@example.com', ...m }),
  // "Send a text message": { to, text, channel } to your SMS or Viber provider.
  // sendText: (m) => texts.send(m),
  onRun: (run) => {
    if (run.status !== 'ok') console.error('automation failed', run)
  },
})
```

Then tell it about changes, in whichever way fits your app:

- **Through your endpoint.** Pass its `audit` hook to `createKitHandlers`:
  every create, update and delete through the endpoint reaches it, with the
  record as stored. It compares with what it read last, so it needs a server
  that stays up between requests. A server that has just started reads its
  tables before the first write reaches the database: the hook has a `before`
  that `createKitHandlers` waits for. So each record of a pasted block is
  judged by what it held, and a record the write left as it was runs nothing.
  Columns the row carries that no field names, such as a tenant, are not
  compared.

  To keep an audit hook of your own, pass it as the second argument,
  `automations.audit('tasks', (entry) => log(entry))`. It is called first with
  each entry. A hook that wraps this one loses `before`; then the server reads
  its tables after the first write, and each record of that request goes by
  the fields the write named.

  ```ts
  // src/routes/api/[table]/+server.ts
  import { createKitHandlers, createSqlDataSource, type EntitySchema } from '@svgrid/enterprise'
  import { automations } from '$lib/server/automations'

  declare const schema: EntitySchema
  declare const source: ReturnType<typeof createSqlDataSource>

  export const { POST } = createKitHandlers({ schema, source, audit: automations.audit('tasks') })
  ```

- **From the database.** A Supabase database webhook, or a Postgres trigger
  that posts the old and new row, hands over both sides of the change.
  Nothing has to stay in memory, so it suits serverless hosts too:

  ```ts
  // src/routes/api/automations/changes/+server.ts
  import { error } from '@sveltejs/kit'
  import { env } from '$env/dynamic/private'
  import { automations } from '$lib/server/automations'

  export async function POST({ request }: { request: Request }) {
    if (request.headers.get('x-webhook-secret') !== env.WEBHOOK_SECRET) error(401, 'No')
    // Supabase sends { type, table, record, old_record }.
    const change = await request.json()
    await automations.recordChanged(change.table, { before: change.old_record, after: change.record })
    return new Response('ok')
  }
  ```

- **By reading the table again**, when all you know is that it changed:
  `automations.tableChanged('tasks')`.

Scheduled automations run on `tick()`. Call it once a minute: from a cron
job your host runs against an endpoint, or a timer in a long-running server.
Two ticks in one minute run them once.

```ts
// src/routes/api/automations/tick/+server.ts: called by your host's cron every minute.
import { automations } from '$lib/server/automations'

export async function POST() {
  const runs = await automations.tick()
  return new Response(JSON.stringify({ ran: runs.length }))
}
```

The server's runs show in the dialog next to the page's, tagged Server,
when the base can fetch them:

```ts
// src/routes/api/automations/runs/+server.ts
import { json } from '@sveltejs/kit'
import { automations } from '$lib/server/automations'

export function GET() {
  return json(automations.runs)
}
```

```svelte
<SvBase bind:tables editable serverRuns={() => fetch('/api/automations/runs').then((r) => r.json())} />
```

![Runs with the server's among them: Tell the team about a blocked task, tagged Server, posted to chat.example.com; Email the lead, tagged Server, sent the email; Done ticks the box ran in the page.](/docs-media/base-automation-server-runs.png)

The server ignores the echo of its own writes (the webhook the database
sends for a change it made), so one change runs each automation once.

The [Postgres demo](./postgres.md) runs a server in the page, standing in
for yours: set a task to Blocked and its chat message shows under "Sent by
the server"; run `update tasks set status = 'Blocked' where id = 't9'` and it
runs for that change too.

## Every automation on the server

An app whose server hears of every change (people, its API, AI agents)
can run all of a base's automations there and none in the page:

```svelte
<SvBase
  bind:tables
  editable
  automationsOnServer
  serverRuns={() => fetch('/api/automations/runs').then((r) => r.json())}
  runAutomation={(automation, tableId, recordId) =>
    fetch('/api/automations/run', { method: 'POST', body: JSON.stringify({ automation: automation.id, table: tableId, record: recordId }) })}
/>
```

With `automationsOnServer` the dialog offers no "Runs in", every
automation saved through it is `runOn: 'server'`, and none runs in the page.
`runAutomation` is "Run now" in the dialog and what a Button field does:
the page asks the server to run the automation on that record (or on none),
then reads the server's runs. A Promise that rejects shows its message in
the dialog, or as a notice for a button. Without `runAutomation` the dialog
says the automation runs on the server, and a Button field that only server
automations listen to does nothing in the page.

## A page of their own

The dialog shows one table's automations. `SvBaseAutomations` shows every
table's on a page, the way an app gives automations a section of their own:

- **On the left**, every automation of the base, with its table, what sets it
  off and an on/off switch, "+ Create automation" and "Run history".
- **In the middle**, the one picked as a flow of cards: its trigger, its
  condition, then its actions in order. A "+" between two cards adds an
  action there, and "+ Add an action" adds one at the end.
- **On the right**, the settings of the card picked: the trigger and its
  table, the condition, or the action, with its order and Remove. Under them,
  Test on a record of the table, and Delete automation.

Changing the trigger's table moves the automation to that table: its trigger
starts again there, and its condition and the fields its actions set go, as
they were the other table's fields.

```svelte
<script lang="ts">
  import { SvBaseAutomations, enableBase, type BaseAutomation, type BaseTable } from '@svgrid/enterprise/base'

  enableBase()

  let { tables }: { tables: BaseTable[] } = $props()

  // The page hands back a table's whole list after each change: store it with the table.
  function changed(tableId: string, automations: BaseAutomation[]) {
    tables = tables.map((t) => (t.id === tableId ? { ...t, automations } : t))
    void fetch(`/api/tables/${tableId}/automations`, { method: 'PUT', body: JSON.stringify(automations) })
  }
</script>

<SvBaseAutomations
  {tables}
  onChange={changed}
  onServer
  serverRuns={() => fetch('/api/automations/runs').then((r) => r.json())}
  runOnServer={(automation, tableId, recordId) =>
    fetch('/api/automations/run', { method: 'POST', body: JSON.stringify({ automation: automation.id, table: tableId, record: recordId }) })}
  records={(tableId) => fetch(`/api/tables/${tableId}/rows?limit=200`).then((r) => r.json())}
  height="100%"
/>
```

| Prop | Type | What it does |
|---|---|---|
| `tables` | `BaseTable[]` | The base's tables, each with its `automations`. |
| `onChange` | `(tableId, automations) => void` | A table's automations changed: its whole list, as `automations` on the table. |
| `onServer` | `boolean` | Every automation runs on the server, as `automationsOnServer`: no "Runs in" to pick. |
| `runOnServer` | `(automation, tableId, recordId) => Promise` | Test for an automation that runs on the server: your server runs it on that record (or on none). |
| `serverRuns` | `() => Promise<AutomationRun[]>` | The server's runs, for Run history. |
| `runner` | automation runner | Runs automations set to "This browser" when tested, and lists their runs. |
| `records` | `(tableId) => Promise<Row[]>` | Records to test on, for a table whose rows are on a server. Without it, the table's `data`. |
| `height` | `number \| string` | The page's height (default `'100%'`). |

The page and the dialog edit the same `automations`. When both are on one
page, keep one copy of the tables and hand each list the page gives back to
that copy, so a change in one is not undone by the other.

## See also

- [Keep a base in a database](./data.md)
- [Field types](../fields.md): the view bar's filter, which conditions use
