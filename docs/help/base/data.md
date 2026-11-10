# Keep a base in a database

A base can keep its records in your database instead of the page. Give a
table a `source` and `<SvBase>` loads the records from it when it opens, then
writes every change back: a cell edit, a pasted range, a new record, a
deleted one, a link made from either side. Postgres, MySQL, SQLite, Supabase
and any REST API work the same way, because each is reached through the
data source contract the grid already uses.

<div data-docs-demo="516-base-postgres" data-height="760"></div>

The demo above is SvGrid Base on a real Postgres database running in the
page (PGlite). Change a status and the log shows the `UPDATE` it ran.

## How it fits together

![SvGrid Base keeps every record in the page. The writer compares the tables with what the database holds and sends inserts, updates and deletes through baseSource to a data source, which talks to Postgres, Supabase or your API.](/docs-media/base-data-flow.svg)

- **The page holds every record of a table.** Views, filters, groups,
  summaries, colors and automations all work on those records, so they stay
  instant. A table with more records than the page should hold (10,000 by
  default) is read from the database a part at a time instead, by itself: see
  [A table of millions](#a-table-of-millions).
- **The writer sends what changed.** After each change it compares the
  tables with what the database holds and queues an `INSERT` for a new
  record, an `UPDATE` with only the fields that changed, or a `DELETE`. The
  writes go one at a time, in order, so an update never overtakes the insert
  of its own record.
- **A refused write goes back.** When the database says no (a constraint, a
  row level security policy, a network error), the cell returns to what the
  database holds, the end of the tab bar says why in plain words, and a notice
  names the record and the field. What the database said is in the tooltip, or
  through an endpoint in the server log, because it names tables and values:
  [what a person reads](./postgres.md#3-one-endpoint-per-table).
- **Changes made elsewhere come in.** With `realtime`, the base reads a table
  again when someone else changed it and takes what moved, without writing
  anything back.

## Give a table a source

`baseSource` wraps any data source:

```ts
import { baseSource, type BaseTable } from '@svgrid/enterprise/base'
import { createRestDataSource } from '@svgrid/enterprise'

const tasks: BaseTable = {
  id: 'tasks',
  name: 'Tasks',
  primaryField: 'name',
  data: [],
  columns: [
    { field: 'name', header: 'Task', fieldType: 'text' },
    { field: 'status', header: 'Status', fieldType: 'singleSelect', fieldProps: { options: [{ value: 'Todo' }, { value: 'Done' }] } },
  ],
  source: baseSource(createRestDataSource({ url: '/api/tasks' })),
}
```

```svelte
<script lang="ts">
  import { SvToaster } from '@svgrid/grid'
  import { SvBase, enableBase, type BaseTable } from '@svgrid/enterprise/base'

  enableBase()
  let { tables }: { tables: BaseTable[] } = $props()
</script>

<SvBase bind:tables editable />
<SvToaster />
```

`data` can start empty: the base fills it. A write that is refused shows a notice
and the tab bar says so; see [Notices](./quick-start.md#notices).

The data sources that ship with `@svgrid/enterprise`:

| Source | Talks to | Tutorial |
|---|---|---|
| `createSupabaseDataSource` | Supabase (PostgREST), from the browser | [Build a base on Supabase](./supabase.md) |
| `createSqlDataSource` | Any SQL database, through an `execute(sql, params)` you write. It reads and writes the columns on its schema and no others; `wholeRecords: true` reads and writes every column, for a source in the same process as the page, and `createKitHandlers` refuses one | [Build a base on Postgres](./postgres.md) |
| `createKitDataSource` | Your SvelteKit endpoint, which runs `createSqlDataSource` on the server | [Build a base on Postgres](./postgres.md) |
| `createRestDataSource` | A JSON API: `GET`, `POST`, `PATCH`, `DELETE` | [Build a base on your API](./rest-api.md) |
| `createInMemoryDataSource` | An array, for tests and prototypes | |

Your own source works too: an object with `getRows`, `createRow`,
`updateRow` and `deleteRow` (the grid's `ServerDataSource`).

## Link fields

![How link fields are stored. A link to one record is a foreign key column. A link to many records is a junction table with one row per pair. The field that links back is not stored.](/docs-media/base-links.svg)

In the page a link field holds record ids. `links` says how each one is kept:

```ts
import { baseSource } from '@svgrid/enterprise/base'
import { createRestDataSource } from '@svgrid/enterprise'

const taskTags = createRestDataSource({ url: '/api/task_tags' })

const source = baseSource(createRestDataSource({ url: '/api/tasks' }), {
  links: {
    // A link to one record: the column with the linked record's id.
    project: { column: 'project_id' },
    // A link to many records: a junction table, one row per pair.
    tags: { through: taskTags, from: 'task_id', to: 'tag_id' },
  },
})
```

The field that links back (a project's Tasks, when tasks have a Project
field) is worked out in the page from the other side and never stored. Link
a task from the project's side and the base writes that task's
`project_id`. A link field that is neither in `links` nor the other side of
one is written as it is, a list of ids, which suits a Postgres `text[]` or a
`jsonb` column.

A list (a multiple select, a vote, a sparkline) goes to its column as that column takes
it: an array to `text[]`, JSON to `json` and `jsonb`, and JSON text to a text column, on
MySQL, SQL Server and SQLite too. It reads back as the list it was.

## Keys the base can use

A record needs one column that names it. When a base reads a database:

- A table with a primary key of one column is a table.
- A table keyed by both ends, `order_tags (order_id, tag_id, primary key (order_id, tag_id))`,
  with both columns foreign keys, is a link to many, like a junction with its own `id`. A
  link goes by the whole key, so removing a tag deletes that one pair. A tenant column in
  the key, named in `tenantColumn`, is part of the key and no end of the link. Other columns
  on such a table are not read and not written: a new link gives them their defaults, one
  that is `NOT NULL` with no default refuses the link, and the server log names them. A
  pair whose two ends the base does not hold, by their keys, is left out.
- Any other table with a composite key, or with no primary key, is left out of the base, a
  view included. The rest of the base opens, and the log names the table and says why.
  Nothing runs on part of a key, because a delete by one column of two reaches every row
  that shares it.

`keys` brings such a table in, when one of its columns is unique:

```ts
export const { GET, POST } = createBaseEndpoint({ execute, allTables: true, public: true, keys: { v_orders: 'id' } })
```

That is your word for it: nothing checks, and a delete reaches every row that holds the
value. `baseFromDatabase` and `baseFromSupabase` take it too. On Supabase the key comes
from the API description; a project that does not show that to the key in use has only a
column named `id` to go by.

### Foreign keys of more than one column

A foreign key of more than one column, as a database keeps tenants apart with,
`foreign key (tenant, customer_id) references customers (tenant, id)`, is a link through
`customer_id` to that tenant's customer, when `tenantColumn` names `tenant` on both tables.
The tenant column stays the read-only tenant, not a link. It works the same in a pair
table, `(tenant, order_id) -> orders (tenant, id)`. Any other key of more than one column,
three columns or two without the tenant, links nothing: its columns are plain values and
the log names the key. A key links only to a table its bare name reaches: on Postgres a
table of any schema on the search path, unless a table of that name in an earlier schema
hides it (a key to a hidden table stays a plain value); on SQL Server the user's default
schema; on MySQL the connected database. The other table still has to be one the base
serves. Supabase does not describe a key of more than one column, so there
neither column is a link.

## Record ids

A new record gets an id in the page at once, so it can be edited and linked
before the database answers. By default that id is its key in the database
too: give the key column a text type.

When the database makes the key (a `serial` column, a `uuid` with a default),
set `serverIds: true`. The record is inserted without the page's id, and the
writer keeps the page id for the grid and translates to the database id for
every later write and every link that points at the record.

## What a write answers

The row a server answers is the truth. After a write the cell, the record and the views
show what was stored: a value a `before*` hook or a trigger changed, a tenant the scope
stamped, a default on a new record. A number the column rounded shows rounded. Undo goes
back from what was stored. A block of Edit fields or of a range on a big table answers with
what hooks changed, and a trigger's work on such a block shows when the view reads the rows
again. On a table the page holds, a paste, a clear or an Undo of 20 records or more is
written in blocks, and each block's records are read back once it lands, so a trigger's
work shows at once there too.

The answer is the row the write left, not a teammate's write a moment later. Postgres and
SQLite say it in the write itself (`RETURNING`). SQL Server writes and reads it back in one
transaction of one batch. MySQL has no way to do either in one statement: give
`createSqlDataSource` (or `baseFromDatabase`, `createBaseEndpoint`) its `transaction` and the
write and its read go in one. Without it a teammate's write to the same cell in the moment
between the two is taken for yours, and an Undo of yours can then write over theirs.

## What is not written

Fields the page works out are never sent: formula, lookup, rollup, count and
button fields, and the field that links back. Add any other field to `skip`
to keep it in the page only.

## What a cell holds

A base reads dates, times, bigints and decimals as the database writes them, as
text. A SQL source asks for a text copy of each such column
(`to_json(col) #>> '{}'` on Postgres, `CAST(col AS CHAR)` on MySQL) beside the
column itself, so sorting and filtering still use the real column.

| Column | What the page holds | What people see |
|---|---|---|
| `date` | `2026-03-08` | That day, in any zone |
| `timestamp`, `datetime` | `2026-03-08T02:30:00.123456` | That wall clock, in any zone |
| MySQL `timestamp` | The wall clock of the connection's `time_zone` | That wall clock, in any zone |
| `timestamptz` | `2026-03-14T22:00:00.654321+00:00` | That moment, in the viewer's zone |
| `bigint`, `numeric`, `decimal` | Text past what a JS number holds | Every digit |
| `json`, `jsonb` | The text the database writes | Every digit: a driver's `JSON.parse` would round a number past 2^53 |

A time someone types keeps its wall clock on a column without a zone, and is that
moment on a `timestamptz`. An undo or a restore writes back the text it read, so
nothing moves by a zone or loses digits past the millisecond.

The days of a filter and the months of a chart are the viewer's. On a column of moments
(Postgres `timestamptz`, SQL Server `datetimeoffset`, SQLite text that ends in a zone)
"is 8 March", "today" and "within the past week" keep the records whose moment falls on
those days where the person is, and a chart counts each record in the month it reads as
there, across a change of the clocks too. The page sends each date condition with the
moments its days start and end (`moments` on the condition), since a server has no zone
of the viewer's, and `createSqlDataSource` compares them on such a column. A date and a
wall clock, a MySQL `TIMESTAMP` among them, compare their days and read the same everywhere.
On Supabase, say which columns hold moments: `supabaseFieldFilter(columns, { moments: (def) => def.field === 'starts_at' })`.
Without that, a condition there compares the database's days.

Over PostgREST (Supabase) a date already arrives as text. A JSON number cannot
carry more than about 15 digits, so the first read that shows a longer one reads
that column again with `col::text`, and later reads bring the copy along. A change
that arrives through Realtime is plain JSON: such a number in it is rounded until
the next read.

JSON in a `text` or `longText` field shows as JSON text. A change goes back as
JSON; text that is not valid JSON is refused with a message and the cell goes back. A
`jsonb` column writes its own spaces and key order, and that is no change: nobody is told
of one. Over PostgREST a JSON column arrives as JSON, so a number past 2^53 in it is rounded.

Opening a cell and leaving it writes nothing, whatever the field shows.

## Changes made elsewhere

![An edit, step by step: Ana's base sends the field that changed, the database tells every subscriber, and Ben's base reads the table again and takes what moved.](/docs-media/base-realtime.svg)

`realtime` takes a function that calls `apply` with what changed and returns a
function that stops listening. With Supabase, hand it Realtime's events as
they come:

```ts
import { baseSource } from '@svgrid/enterprise/base'
import {
  createSupabaseDataSource,
  createSupabaseRealtime,
  type EntitySchema,
  type SupabaseClientLike,
  type SupabaseRealtimeClientLike,
} from '@svgrid/enterprise'

// Your supabase-js client: createClient(url, anonKey).
declare const client: SupabaseClientLike & SupabaseRealtimeClientLike
declare const schema: EntitySchema

const source = baseSource(createSupabaseDataSource({ client, table: 'tasks', schema }), {
  realtime: (apply) => createSupabaseRealtime({ client, table: 'tasks', onChange: apply }),
})
```

The base updates just the records a change names: the other records keep
their objects, so the grid redraws one row, not 50,000, and the table is not
read again. A burst of changes (an agent updating 200 records) goes into the
page as one update.

Any other feed works the same way: a WebSocket message, a server-sent event,
a poll. Call `apply` with the changes, as the database has the records
(its column names, its ids):

```ts
import { baseSource, type BaseChangeInput } from '@svgrid/enterprise/base'
import type { ServerDataSource } from '@svgrid/grid'

declare const tasksSource: ServerDataSource<Record<string, unknown>>

const source = baseSource(tasksSource, {
  realtime: (apply: (changes?: BaseChangeInput) => void) => {
    const socket = new WebSocket('wss://example.com/tasks')
    socket.onmessage = (m) => {
      const { type, id, row, changed } = JSON.parse(m.data)
      if (type === 'update' && changed) apply([{ type: 'update', id, fields: changed }])
      else if (type === 'delete') apply([{ type: 'delete', id }])
      else apply([{ type, record: row }])
    }
    return () => socket.close()
  },
})
```

| A change | Carries |
|---|---|
| `{ type: 'insert', record }` | The new record, with its key column. |
| `{ type: 'update', id, record }` | The whole record as it is now. |
| `{ type: 'update', id, fields }` | Just the columns that changed. |
| `{ type: 'delete', id }` | The key of the record that went. |

A change that comes back from the page's own write (the database tells every
listener, the page that wrote it included) moves nothing and is not reported.
An update with `fields` for a record the page does not have, and `apply()`
with nothing, read the whole table again. An update with `id` alone reads that one record.

### A feed on an endpoint

`baseFromEndpoint` takes one `feed` for the whole base. It opens when the first table
listens and closes with the last. Each message names its table, a junction table
included, and a change in a junction reaches the record it starts from:

```ts
import { baseFromEndpoint } from '@svgrid/enterprise/base'

const tables = await baseFromEndpoint('/api/base', {
  feed: (apply) => {
    const events = new EventSource('/api/base/feed')
    events.onmessage = (e) => {
      // { "table": "orders", "changes": [{ "type": "update", "id": "o1", "fields": { "status": "Paid" } }] }
      const { table, changes } = JSON.parse(e.data)
      apply(table, changes)
    }
    // After a reconnect, changes may have been missed: every table reads again.
    let opened = false
    events.onopen = () => {
      if (opened) apply()
      opened = true
    }
    return () => events.close()
  },
})
```

`apply(table)` with no changes reads that table again, and `apply()` reads every table again.

Keep it to one connection. A browser opens at most six connections to one host over
HTTP/1.1, which is what a Vite or Node dev server speaks, and a connection held open by a
feed is one of them. With a feed per table on a base of six tables and junctions, no write
reaches the server. `realtime: (table, apply) => stop`, called per table, is still taken
for a feed that shares one connection itself, such as channels on one socket.

The feed is yours to write and yours to scope: with a tenant `scope`, send each person their
tenant's rows only.

### What a feed has to cover

A feed is per table, and some of what a person changes is not in that table:

- **A link to many lives in its junction table.** Adding a tag writes a row to `order_tags`
  and nothing to `orders`, so a feed of `orders` alone never tells teammates. Listen to the
  junction too, on the table that stores the link, and name the record it starts from:

  ```ts
  import { baseSource } from '@svgrid/enterprise/base'
  import type { ServerDataSource } from '@svgrid/grid'

  declare const ordersSource: ServerDataSource<Record<string, unknown>>
  declare const orderTags: ServerDataSource<Record<string, unknown>>
  // Your feed: calls back with what changed in that table, and returns how to stop.
  declare function listen(table: string, on: (change: any) => void): () => void

  const source = baseSource(ordersSource, {
    links: { tags: { through: orderTags, from: 'order_id', to: 'tag_id' } },
    realtime: (apply) => {
      const orders = listen('orders', (change) => apply(change))
      const pairs = listen('order_tags', (row) => apply(row?.order_id == null ? undefined : { type: 'update', id: row.order_id }))
      return () => { orders(); pairs() }
    },
  })
  ```

  A feed that only says "something changed" calls `apply()` for both. `baseFromSupabase`
  and `baseFromEndpoint` listen to the junction tables by themselves, and needs them in the `supabase_realtime`
  publication. A delete's event there has only the key unless the junction table has
  `REPLICA IDENTITY FULL`, so a removed link reads the table again.
- **A soft delete reaches a feed as an update.** The base reads an update that sets the mark
  as a delete, so send the column. Through `createKitDataSource` the page learns the column
  from the server's first answer. A restore reads as an update of a record the page does not
  have. A page-held table takes it in, and reads the table if it has links through a junction.
  A table read a part at a time reads the rows on screen, at most once a second, because a
  feed cannot tell a restore from an edit of a record scrolled out of view.
- **A feed that goes down says nothing.** Nothing here can tell silence from no changes.

### What people see

A change made elsewhere does not just appear. Until someone opens the record:

- in a grid view, the cells that changed are tinted, and a record added
  elsewhere is tinted across the row (Kanban and gallery cards are not);
- the row number has a dot; hover it for "Ana Ruiz changed this record 2
  minutes ago";
- the view bar counts them, "3 changed by Ana Ruiz", and a click on the count
  marks them all seen.

Opening the record clears its marks. Its activity lists each change as
"Ana Ruiz changed Priority", with the value before crossed out and the value
now: Low → Urgent.

The name comes from the record itself: its `lastModifiedBy` field (for a
record added elsewhere, `createdBy` first). Whoever writes to the database
writes their user id to that column, and the base looks it up in
`setFieldUsers`. Without such a field the change is credited to "Someone
else". Your own writes are never reported back to you: the base compares what
it reads with what it last wrote.

### An AI agent writing to the base

The same path serves an agent: a script, a worker calling a model, or Claude
Code with your database's MCP server. Give the agent a user id, add it to
`setFieldUsers` with a name and an avatar, and have it set `modified_by` (or
whichever column your `lastModifiedBy` field reads) on every row it writes.
People then see exactly what it changed, review it in a view filtered on a
"Needs review" field, correct what it got wrong, and approve the rest with a
button field and an automation.

[Let an AI agent work in your base](./ai-agents.md) walks through it with
Claude Code and Supabase, and [Review what an agent changed](./review-queue.md)
covers the review side on any database. Here the agent is a stand-in made of
keyword rules, so the demo runs without a model or a key. It writes to the database with SQL; press "Run the triage
agent", then open a ticket.

<div data-docs-demo="700-base-ai-triage" data-height="900"></div>

To act on changes made elsewhere in code (a notice, a log, a count of your
own), pass `onRemoteChange` to `<SvBase>`. It gets each change once it is in
the page:

```ts
import type { BaseRemoteChange } from '@svgrid/enterprise/base'

function onRemoteChange(changes: BaseRemoteChange[]) {
  for (const c of changes) {
    // c.type: 'insert' | 'update' | 'delete'; c.table, c.id, c.record
    // c.fields (updates): [{ field: 'priority', from: 'Low', to: 'Urgent' }]
    if (c.type === 'update') console.log(c.id, c.fields)
  }
}
```

## Status and errors

The end of the tab bar says what the base is doing:

| It reads | When |
|---|---|
| Loading records... | The tables are loading |
| Saving... | Writes are on their way |
| Still saving: the server has not answered yet | A write has been waiting a while |
| All changes saved | Every write went through |
| Not saved: *reason* | A write was refused; the cell went back |

![A refused write: the database rejects a status, the cell goes back, and the tab bar says the database does not accept this value.](/docs-media/base-refused-write.png)

A table that cannot be read says so where its records would be, for as long as it lasts,
with why and a **Try again**. No empty table is shown for it, and nothing can be added to
it. The other tables of the base open as usual.

A table read a part at a time (`serverRows`) whose next part cannot be read says so in the
tab bar, "Could not load *table*: *reason*", with **Try again**, for as long as a part of the
view is unread, wherever it is scrolled to. The rows that did not come are a tinted band with
"Could not load these rows." and **Retry** on its first row on screen. A read again of rows
already on screen, after a teammate's change, that fails leaves those rows as they were: the
tab bar says so with **Try again**, which reads them again.

When the server sent a reason with its error (`{ "error": "..." }` and no `code`), that reason
is what the notice says. `createRestDataSource` passes on an API's `{ "error" }` or
`{ "message" }` the same way.

A failed write is told in a notice that names the record and the field, says why in
plain words and shows what was entered, with **Try again** where that can work. The record
is named as it is stored, never by the value that was refused. A foreign key of more than one
field that refuses a write names all of its fields. The notice stays until it is dismissed,
and "Not saved" stays until that record is written: a later write of another record does not
clear it. A click, a tap or Enter on the status line opens it in full: the reason, and the
server's own words when it sent some and the reason does not already say them. The text of
the request itself (a status code, a JSON body) is never shown; it is in the browser's
network log and the server's log.

A new record the database refused takes no edit while it is still listed (while another cell or
record is being edited, or a draft on a table read a part at a time whose refusal no retry can
change, such as an id column too narrow): a click, a key or a paste on
it shows its notice again instead of an editor. An editor open on it when the refusal comes closes
with what it holds, and the notice names it. A draft refused for a reason a retry may get past keeps
taking edits, and its next edit sends it again.

**Try again** reads the record first, as an undo does. A value that changed since the
write failed, whether a teammate wrote it or you typed it again, keeps that value and the
page says so. A record deleted since is reported with what you entered. If the record
cannot be read, nothing is written and the notice offers Try again once more.

A change of many records at once (a paste, a clear or an Undo of 20 or more) that fails
is one notice with the number of records, and the same **Try again**: it reads them all
first, sends what is still as it was in blocks, and says how many cells changed since and
how many records were deleted since. Part of a block may have landed; the page reads the
table again to show which. An Undo of some of those cells takes them out of what Try
again would send. A refusal of your permission offers no Try again and leaves no step to
undo, and so does a refusal of the values, an answer of `400`, `409` or `422`: the same
values would be refused again.

A write that gets no answer is not given up on: it may still land, or be refused. After
`writeTimeout` (60 seconds by default, on `<SvBase>`) writes to other records go on, and
later writes to the same record wait behind it, so none can overtake it or be overwritten
by it landing late. The status says "Still saving" for as long as it has no answer, and
starts warning at a sixth of `writeTimeout`. The page keeps what was entered, and goes back
only if the write is refused. A delete with no answer keeps its copy in the trash until the
outcome is known, and leaving the page asks first.

While someone is typing in a cell or in a field of a record, changes from others wait
until the editor closes, so no row moves under it and no text changes under the cursor.
That holds for a live feed and for a read of the table, on any table. If the record was
deleted meanwhile, saving it says so and shows the text.

## Options

`baseSource(dataSource, options)`:

| Option | Default | What it does |
|---|---|---|
| `links` | none | How link fields are stored: `{ column }` or `{ through, from, to }` |
| `columns` | none | Column names that differ from field names: `{ dueDate: 'due_date' }` |
| `idField` | `'id'` | The key column |
| `serverIds` | `false` | The database makes the key of a new record |
| `realtime` | none | Hear of changes made elsewhere: `(apply) => stop`; `apply(changes)` updates those records in place |
| `skip` | none | Fields kept in the page only |
| `holdInPage` | `10000` | How many records a table may hold in the page. It is where a table changes how it is read, not a cap: a bigger one is read from the database a part at a time, and no record is left out. (`limit` is the old name.) |
| `convertField` | none | A field of a big table changed type: rewrite its values in the database and resolve with `true`. Without it the base rewrites them a block at a time. |
| `duplicate` | none | Copy a big table in the database and resolve with the new table's source. |
| `serverRows` | automatic | `true` always reads from the database, and the first screen comes sooner on a table you know is big; `{ blockSize }` sets the rows per request (200). `false` always holds every record in the page, however many. Left out, the base decides by `holdInPage`. |

## Build a base from your database

`baseTablesFromSchemas` makes the tables from your database's own
description of them: a number column becomes a number field, an enum a
single select with its values, a foreign key a link with a field in the
other table that links back. Read the descriptions with
`introspectSupabaseTable`, `introspectDatabase` or `introspectOpenApi`, or
write them out:

```ts
import { baseTablesFromSchemas } from '@svgrid/enterprise/base'
import { createRestDataSource, type EntitySchema } from '@svgrid/enterprise'

const schemas: EntitySchema[] = [
  {
    name: 'deals',
    fields: [
      { field: 'id', type: 'text', primaryKey: true },
      { field: 'title', type: 'text' },
      { field: 'stage', type: 'enum', options: [{ value: 'Open', label: 'Open' }, { value: 'Won', label: 'Won' }] },
      { field: 'company_id', type: 'relation', relation: { entity: 'companies', labelField: 'name' } },
    ],
  },
  { name: 'companies', fields: [{ field: 'id', type: 'text', primaryKey: true }, { field: 'name', type: 'text' }] },
]

const tables = baseTablesFromSchemas(schemas, (schema) => createRestDataSource({ url: `/api/${schema.name}`, schema }))
```

The result is ordinary `BaseTable` objects: change a field's type, add views,
rename a table. [Build a base on your API](./rest-api.md) does this end to end.

The other way round, `baseToSql(tables)` writes a base as Postgres SQL:
tables, foreign keys, the tables behind links to many, and the records, with
`svgrid:` comments for the field settings, views and automations that SQL
has no type for. The tables it makes have text keys with a
`gen_random_uuid()` default, so a record added later gets its key from the
database. See [Take a base to a database](./quick-start.md#take-a-base-to-a-database).

## A table of millions

A table has no size limit, and nothing here is a setting you have to get right.
A table of the thousands of records a team keeps in a tracker, a CRM or an
inventory is held in the page. One that grows past `holdInPage` is read from the
database a part at a time, the next time it is read, and looks and works the
same: every view, link, lookup, rollup, automation and search reads all of it.
The page then holds none of its records, only what is on screen.

```ts
import { baseSource } from '@svgrid/enterprise/base'
import type { ServerDataSource } from '@svgrid/grid'

declare const orders: ServerDataSource<Record<string, unknown>>

// Nothing to set: it reads from the database once the table outgrows the page.
const source = baseSource(orders)

// A table you know is big: skip the first look, and size the requests.
const big = baseSource(orders, { serverRows: { blockSize: 200 } })
```

<div data-docs-demo="723-base-million-orders" data-height="620"></div>

How each part of a base reads such a table:

| | Read a part at a time |
|---|---|
| Grid views | Read through the server row model. Each request carries the view's filter (`filterModel.expression`), its sort, its groups (one row per key with its count, the records under an opened key) and the search. The count in the view bar is the server's. A grouped view shows select groups in option order and each group as the field draws it, with the records it holds at every level, and the totals of the fields with a sum, average, lowest or highest picked in the footer. Whenever the view is read again (your delete, Restore, Undo or Redo, a new record, an edit once you leave the record, an option renamed, a field converted, a teammate's change), the group rows and the loaded records of every open group are read, with or without a feed: a deleted record leaves its group, a restored or new one shows in its group, and the counts follow. A group closed at the time reads again when it is opened. A teammate's change that a feed sends with its row patches that row where it is; when it changes a field the view groups or sorts by (any field, when the view groups or sorts by a formula or lookup), the view is read again at once, so the record takes its place in the order and in its group. A filtered view reads again within a second after any change, so a record that left the filter goes. |
| Kanban | Each lane shows its true size, from one grouped request, and reads its cards as they scroll into sight. A card moved to another lane is written by id and sits at the top of that lane until the lane is read again. Sorted by a number field, dropping a card elsewhere in its lane writes that number, so the order is the table's. |
| Calendar | Reads the dates on screen and no others. A range of up to 400 records is read whole. A busier one is read a day at a time: each day's first records and its size, from one grouped request where the backend groups and the view has no end date, so an empty day costs nothing and a write reads only the days whose size moved. "+N more" lists every record of that day. The days are the viewer's: on a column of moments (Postgres `timestamptz`, SQL Server `datetimeoffset`) the sizes, each day's records and that list follow the page's zone, also across a change of the clocks. A date and a wall clock (`timestamp`, `datetime`, a MySQL `TIMESTAMP`, which reads as the server's clock) show the same everywhere, and their days follow what the cell shows. |
| Gantt | Rows by start date, read as they scroll into sight. The axis runs from the table's first start to its last end. Dependency arrows and rescheduling reach the rows read so far. |
| Gallery, list, inbox | Only the records in sight are drawn and read. A grouped list shows each group's size and reads its records when opened. |
| Chart, dashboard | The server groups and adds up, over every record. A date axis is read a month at a time, in the viewer's months on a column of moments: one grouped request for each part of the records' span with one UTC offset, two a year in a zone with summer time. The records behind a tile show the first 200 and how many there are. |
| Form | Stores its record through the source, and reads nothing. |
| Links | A link cell reads the records it names by id, for the cells on screen, in one request. The picker searches the whole table, and a name pasted into the cell is found there. A link edits from either side: on the side that holds no list (a customer's orders), each tick changes that order. |
| Lookups, rollups and counts | Read the linked records by id. Over a link stored on the big table (a customer's orders), the server counts and adds up: one grouped request a screen, whatever the size. |
| Search across tables | Each big table searches on the server, and says how many match. |
| Find in a grid | The search box filters on the server: a find bar could only mark the rows loaded. |
| Automations | Run on any record, read by id. A scheduled one runs on every matching record, block by block. |
| Share links | Show the whole table, without the fields the share leaves out. |
| Autonumber | The next number is the table's largest plus one. Two people can reach it together, so each record is checked once stored: of any two holding a number the later one takes the next, and a column with a UNIQUE constraint refuses the second and the write tries again. Numbers can skip. A number a person deleted in this page is not given out again while it stays open, so an undo finds its number free. After a reload, or on a teammate's page, the number of a deleted record can be given out again, since the next one follows the largest left. A restored record whose number was given out meanwhile takes the next one. |
| Changing a field's type | Asks first, with the number of records. Then `convertField` does it in one statement (`createSqlDataSource` with `schemaChanges: true` has one on Postgres), or the base reads a block at a time and writes the records whose value changes, sixteen at a time. The other choice changes the field only. |
| Download as SQL | Writes every record, a block at a time, so the file can be larger than the page could hold. |
| Duplicate table | Copies in the database with the `duplicate` option (`schemaChanges: true` gives a Postgres source one). Without it the records are read into the page a block at a time, with the count in the tab bar, and the copy lives in the page, so a very large table needs the option. |
| Edits | Written by id: a change to the 900,000th record is one `update`. |
| Edit fields | On a selection, in a dialog with progress and Stop. The selection is read first, and only records whose value changes are written, a block of 1,000 at a time. Past 10,000 records it asks first, with the exact number, because Undo cannot take that many back. Stop ends it after the block under way. A block that fails ends it too: the page reads that block back, says how many records changed, and Undo takes those back. Records that landed past 10,000 stay changed. |
| A range of cells | Paste, one value pasted over a range, Delete, the fill handle and Ctrl+Enter reach every record the selection covers, loaded or not. Up to 200 cells of rows the grid holds are written at once, cell by cell. Anything larger, or reaching rows not loaded, runs in the Edit fields dialog: the records are read in view order, then written a block of 1,000 at a time (200 on a source that writes a request a record, such as Supabase, so the count moves and Stop answers within a block), with the same progress, Stop, count at the end, question past 10,000 and one Undo step. A block the database refuses part way ends the job: the count says how many records changed, and Undo takes those back. If records moved while the range was read (a teammate's edit changed the order or the set of a sorted view), nothing is written or copied: the page says, for a paste, "Records moved while this was read. Nothing was changed. Try again pastes from "Acme" down over the rows as they are now.", naming the first record selected. Try again finds that record by its id where the list has it at the click, goes from it over as many rows below it as before, and selects those rows first, so the screen shows what it writes; its dialog lies over them, so it names them too ("From "Acme" down over 2,500 rows, selected in the view."). If the record is gone or no longer among the rows shown, it writes nothing and says so, and so it does when fewer rows stand below the record now than the first try covered (the record fell to the end of a sorted view): it never turns lines into new records the first try wrote over records that were there. To tell that records moved, the whole id sequence is checked, in requests that ask for ids alone: a range longer than a block reads its ids first and each block must bring the same ids in the same places, each block also reads the last record of the one before again, a record read twice counts as moved, and once the last block is in, the ids of the whole range are read again and must be the very ids read, in the same order. Each of those reads asks for the whole range at once (up to 20,000 ids); a server that caps an answer (PostgREST's `db-max-rows`, 1,000 on Supabase) is read on from where its answer ended, a page of its own size at a time, and only a different id sequence, or a list that ends before the range does, counts as moved. On Supabase and PostgREST these reads select the key alone. Any difference counts, a move inside the part already read too. Try again acts only in the view the cells were chosen in, as it was then: after a switch to another view, or a change of its sort, filter, groups, open groups or shown fields, it writes nothing and says "That view is no longer open, so nothing was changed." or "The view has changed since, so nothing was changed." An answer to a question the job asked (past 10,000 records, new records past the last row, a delete) does the same. A new record that is not stored yet sits on top of the list and in no block of the table: a range over it leaves it out and says how many it left, a paste keeps its line for it, and a copy has its line. A drag of a range over rows not loaded is refused, with the number. A paste while the view is still loading is refused too, and never makes a record. |
| Copy | Rows not loaded are read first, in a dialog with progress and Cancel, each line a real record with its worked out fields. A copy holds up to 2,000,000 cells: that many, 20 MB of text, took 4.6 s with a longest frame of 450 ms in Chrome on a production build, reading from the page. Past that nothing is copied, the page says how many cells were asked for, and Download gets all of it. If a browser will not take the text so long after the key press, the dialog asks for one more click. |
| A paste past the last row | A line where no value fits its field makes no record. Up to 10 new records are added at once; past 10 the page asks first, with the number. They go in blocks of 1,000 (`createRows` makes a block one statement), and one Undo takes them out the same way, with the cells the paste wrote. A record someone has worked on since stays, and the page says so. |
| "+" | In every view of records. It opens a new record, filled in from the view's filter (Region is EU in a view of EU orders). Nothing is stored until it holds a value, and one closed empty is gone. If the database refuses it, it stays in the grid with its values and the next edit tries again. What the database fills in, such as an order number, comes back into the record. Ctrl+Z takes a stored record out again. |
| Insert record, Duplicate | Insert opens a draft, as "+" does. Duplicate stores the copy and shows it at the top of the grid. |
| A new field | The "+" at the right of the header row, for whoever may change the schema (`columnAdder={false}` hides it). `createSqlDataSource` with `schemaChanges: true` adds the column on Postgres, MySQL and SQLite. A new field starts empty: when a column by that name is already in the table it takes the next free name, and says so. A column that cannot be added takes the field back. A source that cannot add one, such as Supabase, shows the `ALTER TABLE` to run, and `addField` on `baseSource` is your own way to make it. There, Duplicate field copies nothing: it shows the statement for the copy's column, to run before duplicating. An Autonumber or Created time field stays blank on the records already there. |
| Delete | By id, to the trash, as the database holds the record at that moment; Ctrl+Z puts it back whole, columns the base shows no field for included, under the key it had, on a table the page holds and on a big one alike. A column off the source's schema never reaches the page, so it takes its default, unless the source reads whole records (`wholeRecords` on `createSqlDataSource`). The record stays in the trash until the database has it. What only the database may write stays the database's: a generated column works itself out again, and a `GENERATED ALWAYS` key gets a new value. Time columns go back as the database wrote them, past the millisecond and at a local time the clocks skipped, on Postgres and MySQL with any driver. A record the database refuses to delete stays in the table and out of the trash, and so does one a row-level policy skipped without an error: after a delete the base looks. |
| Soft delete | `softDelete: 'deleted_at'` marks a record instead of removing it, and a restore clears the mark, so nothing is rewritten. See [Undo, trash and import](./undo-trash-import.md#soft-delete). |
| Select all | Selects every record of the view, read or not, and the count says so; a group's tick selects all of the group. A new filter clears the selection. With `selectionBar={{ actions: ['deleteRows'] }}` (and `enableSelectionBar()`), Delete first reads what the selection covers, then asks with the exact number. The records go a block at a time, with a Stop button: what went before you stopped stays gone and stays restorable. `deleteRows` and `createRows` on your data source make a block one statement. Up to 10,000 go to the trash and can be undone; above that the question says they cannot be restored. A group that reads back a different size from its group row stops the job with nothing deleted, since what was left out of the selection could not be told apart. A record that leaves the view after you confirm is still deleted, since you confirmed that set. |
| Changes made elsewhere | `apply(changes)` updates those rows in the grid, highlighted and credited, whether the page holds them or not. |
| Formulas | Worked out in the page for the rows on screen. |

All of this is `getRows` with what a grid view already sends: a range, the
view's filter, a sort, `groupBy` and `groupKeys`, an `in` list on the key
(`filterModel.columns.id.selectedValues`), and for a chart or a total
`aggregations` and `needsGrandTotal`. Grouping a link for a count from its other
side sets `groupRawKeys`: group by the linked id, which a foreign key does. A calendar's
`groupDays` and a chart's `groupMonths` ask for a date level by day (`2026-03-14`) or month
(`2026-03`), on a column of moments in the zone `dayOffset` minutes ahead of UTC. A source that passes over them answers by value and the page adds the groups
up, which on a time field is a group a record. The data source applies the view's filter
and acknowledges it with `appliedExpression: true`. The
Supabase, REST and SQL sources already answer all of these, and
`createSqlDataSource` also runs a view's filter, sort, groups and totals on a
formula, lookup or rollup in the database
([computed fields in SQL](./server-compute.md#computed-fields-in-sql)). On your own
source, index the fields views group and place records by: a busy calendar
month is a request per day.

### Index what views sort on

A sort on a column with no index sorts the table again for every block a person
scrolls to, and that is what limits how many people a big table serves. Give each
field a view sorts on an index with the table's key after it:

```sql
CREATE INDEX orders_amount ON orders (amount, id);
```

The key is there because a read breaks ties on it, in the sort's direction
(`ORDER BY amount DESC, id DESC`). Leave both columns ascending, as above: one index
then serves a sort either way. `(amount DESC, id)` matches neither direction, and on
MySQL it goes unused.

Through `createBaseEndpoint` on a table of 1,000,000 records, sorted on a numeric
column, blocks of 100, default database settings, on a shared development machine:

| Median time for a block | No index | With the index |
|---|---|---|
| Postgres, one person | 2,263 ms | 567 ms |
| MySQL, one person | 2,476 ms | 42 ms |
| Postgres, 30 people at once | 23,576 ms | 2,118 ms |
| MySQL, 30 people at once | 22,968 ms | 713 ms |

A formula or a lookup has no column to index: a sort on one costs a sort of the
table for every block, so a view with many people on it is better sorted on a stored
field. A filter narrows what is sorted, and an index that starts with the filtered
field and ends with the sorted one serves both.

### What the database cannot run

A view never goes unanswered. When a filter, sort, group or total needs a field
the data source cannot compute, or the source does not acknowledge a filter, or
it fails on a computed field, the page reads the table a block at a time, works
the field out with the same code the cells use, and keeps the ids and the values
the request needs. The view then reads its records by id. The tab bar shows how
far it has got.

It gives what the cells say, on any backend, and it is slower than the database:
about a minute for a lookup over the 1,000,000 records of the demo on a dev
server. It is read once. Scrolling, sorting again and the lanes of a board cost
nothing more, a record you or someone else changes is updated where it stands,
and changing a field reads again. Taking the sort or filter away stops the read.
Records changing while it reads are read again once, and if the count still moves
the base says so.

Tell the base what your source can work out with `computes`, and that field stays
in the database. Without it, only `createSqlDataSource` is asked: a `queryRecords`
backend needs `computes: () => true` or it is right but slow.

```ts
import { baseSource } from '@svgrid/enterprise/base'
import type { ServerDataSource } from '@svgrid/grid'

declare const orders: ServerDataSource<Record<string, unknown>>

const source = baseSource(orders, { computes: (def) => def.field === 'tax' })
```

`@svgrid/enterprise/base/compute` has both halves:
[`queryRecords`](./server-compute.md#answer-a-paged-table) for records a
server holds, and [`fieldFilterToSql`](./server-compute.md#the-views-filter-in-sql)
for a database.
