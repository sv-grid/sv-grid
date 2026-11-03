# Let an AI agent work in your base

An agent can do the first pass on a table your team works in: categorize the
new records, set a priority, draft a reply. The hard part is not the edit.
It is what comes after: seeing what the agent touched, what each field held
before, and having a person make the final call.

This tutorial builds that on a support inbox. The tickets live in a Supabase
table; SvGrid Base shows them to your team; Claude Code, connected through
the Supabase MCP server, triages them. Every change the agent makes shows up
in the base with its name on it, and people review it from a "Needs review"
view.

<!-- tutorial:mk-ai-agent-base -->
<figure class="docs-tutorial docs-tutorial-player" id="tutorial-mk-ai-agent-base" data-docs-tutorial="mk-ai-agent-base">
<video class="docs-tutorial-video" src="/tutorials/mk-ai-agent-base.mp4" poster="/tutorials/mk-ai-agent-base.poster.webp" width="960" height="540" controls playsinline preload="none" aria-label="An AI agent and your team, one table: Claude Code, Supabase and SvGrid Base, 78 second tutorial"><track kind="captions" srclang="en" label="English" src="/tutorials/mk-ai-agent-base.vtt">Your browser does not play embedded video. <a href="/tutorials/mk-ai-agent-base.mp4">Download the MP4</a>.</video>
<figcaption><strong>An AI agent and your team, one table: Claude Code, Supabase and SvGrid Base</strong> (1:18, with narration). <a href="https://www.youtube.com/watch?v=HNMV1rTaDzE" rel="noopener">Watch on YouTube</a></figcaption>
</figure>
<!-- /tutorial:mk-ai-agent-base -->

> SvGrid Base is part of the **Suite edition** of `@svgrid/enterprise`. Without a key it runs with a watermark.

The same thing in the page, with Postgres running in the browser and a
stand-in agent (keyword rules, so it needs no model or key). Press "Run the
triage agent", then open a ticket:

<div data-docs-demo="700-base-ai-triage" data-height="900"></div>

## 1. Make the table

Run this in the Supabase SQL editor. `updated_by` is the column the base reads
to say who changed a row; the agent writes its own id there, and the base
writes the signed-in user's.

```sql
create table public.tickets (
  id text primary key,
  subject text not null default '',
  customer text,
  message text,
  received timestamptz default now(),
  category text,
  priority text default 'Normal',
  reply text,
  review text,
  updated_by text
);

alter table public.tickets enable row level security;
create policy "team reads tickets" on public.tickets for select to authenticated using (true);
create policy "team updates tickets" on public.tickets for update to authenticated using (true) with check (true);

-- The base hears every change through Realtime.
alter publication supabase_realtime add table public.tickets;
```

The policies let users signed in through Supabase Auth read and update the
table, which is what your team does from the base. The agent does not go
through them: the MCP server works with your project's own access.

## 2. Show it as a base

The quickest start is `baseFromSupabase`, which reads the table and builds the
fields. A text column named `updated_by`, `modified_by` or `last_modified_by`
becomes a **Last modified by** field, and `created_by` a **Created by** field:

```ts
import { baseFromSupabase } from '@svgrid/enterprise/base'
import type { SupabaseClientLike, SupabaseRealtimeClientLike } from '@svgrid/enterprise'

// Your supabase-js client: createClient(url, key).
declare const supabase: SupabaseClientLike & SupabaseRealtimeClientLike
declare const url: string
declare const key: string

const tables = await baseFromSupabase({ client: supabase, url, key, tables: ['tickets'] })
```

For the inbox you want selects with fixed options, a review view and an
Approve button, so here the table is written out. The `source` is the same
Supabase table, with Realtime:

```ts
import { baseSource, type BaseTable } from '@svgrid/enterprise/base'
import {
  createSupabaseDataSource,
  createSupabaseRealtime,
  type EntitySchema,
  type SupabaseClientLike,
  type SupabaseRealtimeClientLike,
} from '@svgrid/enterprise'

// Your supabase-js client: createClient(url, key).
declare const client: SupabaseClientLike & SupabaseRealtimeClientLike

const schema: EntitySchema = {
  name: 'tickets',
  idField: 'id',
  fields: [
    { field: 'id', type: 'text', primaryKey: true },
    ...['subject', 'customer', 'message', 'category', 'priority', 'reply', 'review', 'updated_by'].map((field) => ({ field, type: 'text' as const })),
    { field: 'received', type: 'datetime' },
  ],
}

const options = (values: string[]) => values.map((value) => ({ value }))

export const tables: BaseTable[] = [
  {
    id: 'tickets',
    name: 'Tickets',
    primaryField: 'subject',
    data: [],
    columns: [
      { field: 'subject', header: 'Subject', fieldType: 'text' },
      { field: 'category', header: 'Category', fieldType: 'singleSelect', fieldProps: { options: options(['Billing', 'Bug', 'Account', 'Feature request']) } },
      { field: 'priority', header: 'Priority', fieldType: 'singleSelect', fieldProps: { options: options(['Urgent', 'High', 'Normal', 'Low']) } },
      { field: 'review', header: 'Review', fieldType: 'singleSelect', fieldProps: { options: options(['Needs review', 'Approved']) } },
      { field: 'updated_by', header: 'Last changed by', fieldType: 'lastModifiedBy' },
      { field: 'approve', header: 'Approve', fieldType: 'button', fieldProps: { label: 'Approve' } },
      { field: 'reply', header: 'Draft reply', fieldType: 'longText' },
      { field: 'customer', header: 'Customer', fieldType: 'email' },
      { field: 'message', header: 'Message', fieldType: 'longText' },
      { field: 'received', header: 'Received', fieldType: 'date', fieldProps: { dateFormat: 'friendly', time: true } },
    ],
    views: [
      { id: 'inbox', name: 'Inbox', type: 'grid', state: { sorting: [{ id: 'received', desc: true }] } },
      {
        id: 'review',
        name: 'Needs review',
        type: 'grid',
        state: { advancedFilter: { kind: 'fieldFilter', conjunction: 'and', conditions: [{ column: 'review', kind: 'select', op: 'is', value: 'Needs review' }] } },
      },
    ],
    automations: [
      {
        id: 'approve',
        name: 'Approve the triage',
        enabled: true,
        trigger: { type: 'button', field: 'approve' },
        actions: [{ type: 'updateRecord', values: { review: 'Approved' } }],
      },
    ],
    source: baseSource(createSupabaseDataSource({ client, table: 'tickets', schema }), {
      realtime: (onChange) => createSupabaseRealtime({ client, table: 'tickets', onChange }),
    }),
  },
]
```

The page puts it on screen:

```svelte
<script lang="ts">
  import { SvToaster } from '@svgrid/grid'
  import { SvBase, enableBase, type BaseTable } from '@svgrid/enterprise/base'

  enableBase()
  let { tables }: { tables: BaseTable[] } = $props()
</script>

<SvBase bind:tables editable showRowNumbers expandRows containerHeight={640} />
<SvToaster />
```

## 3. Give the agent a name

The base names whoever is in `updated_by` from its people list. Add the agent
to it, with an avatar, next to your team, and say who is signed in so your own
edits are credited to you:

```ts
import { setCurrentUser, setFieldUsers } from '@svgrid/enterprise/base'

setFieldUsers([
  { id: 'u1', name: 'Ana Ruiz', email: 'ana@example.com' },
  { id: 'u2', name: 'Ben Okafor', email: 'ben@example.com' },
  { id: 'agent', name: 'Triage agent', avatarUrl: '/agent.svg' },
])
setCurrentUser({ id: 'u1', name: 'Ana Ruiz' })
```

An id the list does not have shows as "Someone"; a change with no
`updated_by` at all as "Someone else".

## 4. Connect Claude Code to the database

The Supabase MCP server gives Claude Code an `execute_sql` tool on your
project. Create a personal access token under Account, Access tokens in the
Supabase dashboard, keep it in your environment as `SUPABASE_ACCESS_TOKEN`,
and scope the server to the one project:

```json
{
  "mcpServers": {
    "supabase": {
      "command": "npx",
      "args": ["-y", "@supabase/mcp-server-supabase@0.14.0", "--project-ref=your-project-ref"]
    }
  }
}
```

The token can act on your whole Supabase account. Keep it out of the
repository and revoke it when the agent no longer needs it.

## 5. Give it the instruction

Save the JSON above as `mcp.json` and run Claude Code with only the SQL tool
allowed. The instruction goes in on standard input:

```bash
echo "Triage the new support tickets in public.tickets (review is null). Read them first. Then triage them one at a time: one execute_sql call per ticket, each a single UPDATE that sets category (Billing, Bug, Account or Feature request), priority (Urgent, High, Normal or Low), reply (a one-sentence draft reply to the customer), review = 'Needs review' and updated_by = 'agent'." \
  | claude -p --mcp-config mcp.json --strict-mcp-config --allowedTools mcp__supabase__execute_sql
```

Two parts of the instruction matter to the base. `updated_by = 'agent'` is
what puts the agent's name on its changes. `review = 'Needs review'` is what
puts each ticket in the review view. One UPDATE per ticket is optional; it
makes the changes arrive one by one instead of all at once.

## 6. Watch the changes land

Each UPDATE reaches the base through Realtime. Until someone opens the
record:

- the cells the agent changed are tinted;
- the row number has a dot; hover it for "Triage agent changed this record
  just now";
- the view bar counts the records, "10 changed by Triage agent"; a click on
  the count marks them all seen.

Open a ticket and its activity lists each change, the value before crossed
out and the value now: "Triage agent changed Priority: Normal → High".
Opening it clears its marks. The marks and the activity live in the page:
after a reload the base shows the records as they are, without them.

## 7. Review and approve

Switch to **Needs review**. Where you disagree, change the field: your edit is
written to the same table with `updated_by` set to you, and the record's
activity shows it under your name, after the agent's. Press **Approve** on
the rest: the automation sets Review to Approved and the ticket leaves the
view.

## AI fields

The agent above works from outside the base. An AI field works from inside
it: a field whose value a model writes for each record, from a prompt that
names the record's other fields.

<div data-docs-demo="716-base-ai-field" data-height="620"></div>

The answer is stored in the record, like a typed value. It sorts, filters,
exports and shows in footers without calling the model again, and anyone
allowed to edit the field can change it by hand.

```ts
import { setAIProvider } from '@svgrid/grid'
import type { BaseTable } from '@svgrid/enterprise/base'

// Once, at startup: a function from the request to the model's text.
// The key stays on your server; /api/ai calls the model with it.
setAIProvider(async ({ prompt, maxOutputTokens, signal }) => {
  const res = await fetch('/api/ai', { method: 'POST', body: JSON.stringify({ prompt, maxOutputTokens }), signal })
  return (await res.json()).text
})

export const products: BaseTable = {
  id: 'products',
  name: 'Products',
  primaryField: 'name',
  data: [{ id: 'p1', name: 'Ridge 40 pack', audience: 'Hikers', feature: 'A frame that carries 15 kg' }],
  columns: [
    { field: 'name', header: 'Name', fieldType: 'text' },
    { field: 'audience', header: 'Audience', fieldType: 'singleSelect', fieldProps: { options: [{ value: 'Hikers' }, { value: 'Climbers' }] } },
    { field: 'feature', header: 'Key feature', fieldType: 'text' },
    {
      field: 'pitch',
      header: 'Pitch',
      fieldType: 'ai',
      fieldProps: { prompt: 'Write a one-line pitch for {Name}, aimed at {Audience}, that mentions {Key feature}.' },
    },
  ],
}
```

`setAIProvider`, `getAIProvider` and `mockAIProvider` are the free AI helpers
of `@svgrid/grid`; the field uses whatever provider the app registered. The
provider gets the prompt with each `{Field name}` replaced by the value as
its cell shows it (a select's label, a person's name, a formatted date), and
an instruction to answer with JSON, `{"value": ...}`.

| `fieldProps` | Default | What it does |
| --- | --- | --- |
| `prompt` | `''` | The instruction, with `{Field name}` (a header or a field key) for the record's values. The field editor shows an unknown name or the field's own name as an error, as it does for a formula, and will not save it. Renaming a field renames it in the prompt. |
| `output` | `'text'` | `'text'` stores text (edited as long text). `'singleSelect'` asks the model to pick one of `options` and refuses any other answer. `'number'` stores a number, shown with `precision` decimal places. |
| `auto` | `true` | Generate again when a field the prompt names is edited in that record, in the page where the edit is made (see [Changes from the database](#changes-from-the-database)). Off, the value changes only when someone asks. A record whose named fields are all empty is skipped. |
| `options` | `[]` | The options of a `'singleSelect'` output, as a select field's. |

How it behaves:

- Each cell has a button that generates that record. With `fieldMenu`, the
  column menu has **Generate for N empty records** and
  **Generate for all N records**, and **Stop generating** while some wait.
- Requests run three at a time over the page; `setAIFieldConcurrency(n)`
  changes that. A waiting or running cell shows a spinner. A failed one
  shows the error message (the model's error, or an answer that is not one
  of the options) until it is generated again or edited.
- Values are written through the grid's edit path, as a typed edit is:
  Ctrl+Z undoes one, `onCellValueChange` hears it, last modified fields are
  stamped and another AI field whose prompt names this one follows. The
  active cell and the selection stay where the person left them, and a
  value that arrives while someone is editing a cell waits for that edit to
  end.
- A protected field is generated only for the people allowed to edit it;
  for others the button is not shown and a call from code fails with a
  message, before any request is made.
- Without a provider, an empty cell says "No AI provider" and the button's
  title says to call `setAIProvider()`.
- A grid taken off the page (the component unmounted) drops its waiting
  requests and aborts the running ones through the request's `signal`.

From code:

```ts
import { cancelAIField, generateAIField } from '@svgrid/enterprise/base'

declare const api: unknown // from <SvBase onApiReady>

// 'empty' (the default), 'all', or a list of record ids.
const { written, failed } = await generateAIField(api, 'pitch', 'all')
cancelAIField(api, 'pitch')
```

### Changes from the database

An `auto` generation starts in the page where the edit was made. On a table
with a `source`, that page writes the new value to the database like any
other edit, and every other page with the base open receives it through
`realtime` as a change of its own. Those pages never call the model for it:
with ten people looking at a table, one edit costs one request.

A change made outside any `<SvBase>` (a server job, a script, a database
console, an agent) has no page that generated it, so its records keep their
old value. To generate them, call `regenerateAIFields` from `onRemoteChange`
in one page:

```ts
import { regenerateAIFields, type BaseRemoteChange } from '@svgrid/enterprise/base'

declare const api: unknown // from <SvBase onApiReady>

// <SvBase {tables} {onApiReady} onRemoteChange={generateForImports} />
function generateForImports(changes: BaseRemoteChange[]) {
  // Rows the nightly import wrote. Edits from other pages were generated there.
  void regenerateAIFields(api, changes.filter((c) => c.record.updated_by === 'import'))
}
```

It applies the rule an edit in the grid follows: for an update, each `auto`
field whose prompt names a field that moved, unless the change wrote that
AI field itself; for an insert, the record's empty AI fields. Deletes,
fields with `auto` off and records of a table the grid does not show are
skipped. The values are written through the grid, so they reach the
database and the other pages, and the page does not hear its own write.

Call it in one page only, or for changes a filter picks out (an author, a
service account). If every open page calls it for every change, each one
asks the model and writes, and the last answer wins. The other choice is to
generate on the server: your job calls the model and writes the value with
the record.

## Next

- [Review what an agent changed](./review-queue.md): the same review on any
  database, a toast for each batch of changes, and an agent of your own.
- [Keep a base in a database](./data.md#changes-made-elsewhere): how changes
  made elsewhere are read and marked.
- [Automations](./automations.md): more than one button.
