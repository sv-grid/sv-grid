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

## Next

- [Review what an agent changed](./review-queue.md): the same review on any
  database, a toast for each batch of changes, and an agent of your own.
- [Keep a base in a database](./data.md#changes-made-elsewhere): how changes
  made elsewhere are read and marked.
- [Automations](./automations.md): more than one button.
