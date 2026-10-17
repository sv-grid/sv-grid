# Review what an agent changed

An agent can be Claude Code with an MCP server, a worker that calls a model,
or a script on a schedule. Whatever it is, and whatever database it writes to,
the review side in SvGrid Base is the same: the agent marks what it wrote, the
base hears of it, people see it and decide. This page sets that up piece by
piece. [Let an AI agent work in your base](./ai-agents.md) does it end to end
on Supabase with Claude Code.

> SvGrid Base is part of the **Suite edition** of `@svgrid/enterprise`. Without a key it runs with a watermark.

## 1. What the agent writes

Two columns do the work, besides whatever the agent fills in:

| Column | The agent writes | The base shows |
|---|---|---|
| `updated_by` | its own id, on every row it changes | a **Last modified by** field, and the name on each change |
| `review` | `'Needs review'` | a select a view filters on |

Name the agent in the people list, with your team, so the id becomes a name
and an avatar:

```ts
import { setFieldUsers } from '@svgrid/enterprise/base'

setFieldUsers([
  { id: 'u1', name: 'Ana Ruiz' },
  { id: 'agent', name: 'Triage agent', avatarUrl: '/agent.svg' },
])
```

A change that leaves `updated_by` as it was is credited to whoever was there
before, so the agent has to write it every time.

## 2. Hear the changes

A table hears of changes made in the database through its source's
`realtime` hook. With Supabase that is `createSupabaseRealtime`
([Keep a base in a database](./data.md#changes-made-elsewhere)). With
Postgres, MySQL or your own API behind an endpoint, a poll works, or a push
from your server:

```ts
import { baseSource } from '@svgrid/enterprise/base'
import { createKitDataSource } from '@svgrid/enterprise'

const endpoint = '/api/base?table=tickets'

// Read the table again every 5 seconds.
const polled = baseSource(createKitDataSource({ endpoint }), {
  realtime: (onChange) => {
    const timer = setInterval(onChange, 5000)
    return () => clearInterval(timer)
  },
})

// Or let the server say when: one message per change.
const pushed = baseSource(createKitDataSource({ endpoint }), {
  realtime: (onChange) => {
    const events = new EventSource('/api/changes')
    events.onmessage = () => onChange()
    return () => events.close()
  },
})
```

Either way the base reads the table again and compares it with what it read
last, so only what really moved is marked, and its own writes never are. A
poll reads the whole table each time (up to the source's `limit`); keep the
interval long on a big table.

## 3. A view for what needs review

A view's `state` holds its filter. This one shows the records the agent has
touched and nobody has approved:

```ts
import type { FieldView } from '@svgrid/enterprise/base'

const needsReview: FieldView = {
  id: 'review',
  name: 'Needs review',
  type: 'grid',
  state: {
    advancedFilter: { kind: 'fieldFilter', conjunction: 'and', conditions: [{ column: 'review', kind: 'select', op: 'is', value: 'Needs review' }] },
  },
}
```

## 4. Approve

A button field and an automation on it. Approve sets Review to Approved, and
the record leaves the view:

```ts
import type { BaseAutomation } from '@svgrid/enterprise/base'

export const buttons = [
  { field: 'approve', header: 'Approve', fieldType: 'button', fieldProps: { label: 'Approve' } },
]

export const automations: BaseAutomation[] = [
  {
    id: 'approve',
    name: 'Approve',
    enabled: true,
    trigger: { type: 'button', field: 'approve' },
    actions: [{ type: 'updateRecord', values: { review: 'Approved' } }],
  },
]
```

A person who disagrees with one field can also just change it. The edit is
written with `updated_by` set to them (the signed-in user, `setCurrentUser`),
and the record's activity shows it after the agent's.

## 5. What people see

Until someone opens the record, in a grid view:

- the cells the agent changed are tinted, and a record it added is tinted
  across the row;
- the row number has a dot: "Triage agent changed this record 2 minutes ago";
- the view bar says "10 changed by Triage agent"; a click marks them all
  seen.

The record's activity lists each change with the value before it crossed
out: "Triage agent changed Priority: Normal → High". Opening the record clears
its marks. Kanban and gallery cards are not marked.

## 6. React in code

`onRemoteChange` on `<SvBase>` hears each batch once it is in the page: here,
a notice when the agent has been at work.

```svelte
<script lang="ts">
  import { SvToaster, toast } from '@svgrid/grid'
  import { SvBase, enableBase, type BaseRemoteChange, type BaseTable } from '@svgrid/enterprise/base'

  enableBase()
  let { tables }: { tables: BaseTable[] } = $props()

  function onRemoteChange(changes: BaseRemoteChange[]) {
    const byAgent = changes.filter((c) => c.type !== 'delete' && c.record.updated_by === 'agent')
    if (byAgent.length) toast.info(`The agent changed ${byAgent.length} ticket${byAgent.length === 1 ? '' : 's'}`)
  }
</script>

<SvBase bind:tables {onRemoteChange} editable showRowNumbers expandRows containerHeight={640} />
<SvToaster />
```

Each change has its `table`, the record's `id`, the `record` as it is now
and, for an update, `fields`: `[{ field: 'priority', from: 'Normal', to: 'High' }]`.

## 7. An agent of your own

Any program that can write SQL fits. This one reads the new tickets, asks
your model, and writes each answer back with its id and the review flag:

```ts
import pg from 'pg'

// Your model call: the ticket in, the triage out.
declare function triage(ticket: { subject: string; message: string }): Promise<{ category: string; priority: string; reply: string }>

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL })
const { rows } = await pool.query('select id, subject, message from tickets where review is null')

for (const ticket of rows) {
  const t = await triage(ticket)
  await pool.query(
    "update tickets set category = $1, priority = $2, reply = $3, review = 'Needs review', updated_by = 'agent' where id = $4",
    [t.category, t.priority, t.reply, ticket.id],
  )
}
```

One UPDATE per record, as here, makes the changes arrive one at a time; a
single UPDATE for all of them arrives as one batch.

## What is kept, and where

- `updated_by` and every value the agent or a person wrote are in your
  database.
- The marks and the activity are in the page. After a reload the base shows
  the records as they are, without them.

For a history that lasts, keep it in the database: a trigger that copies each
change to an audit table, or the agent writing its own log next to the
UPDATE.

## Next

- [Let an AI agent work in your base](./ai-agents.md): Supabase and Claude
  Code, end to end.
- [Automations](./automations.md): conditions, webhooks and email.
- [People, comments and files](./collaboration.md): the people list and the
  record's activity.
