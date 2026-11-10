# Build a base on Postgres

This tutorial keeps a base in your own Postgres database, behind your own
SvelteKit server. The browser never sees a database password: it calls one
endpoint per table, and the endpoint runs parameterized SQL. Three tables,
Tasks, Projects and Tags, with a foreign key and a junction table between
them.

The demo below is the finished base on a real Postgres running in the page
(PGlite), with the SQL each change runs listed under it:

<div data-docs-demo="516-base-postgres" data-height="760"></div>

![SvGrid Base on Postgres: tasks with a status, a project and tags; under the base, the SQL log shows the UPDATE that a status change ran, with its parameters.](/docs-media/base-postgres.png)

> SvGrid Base and the SQL source are part of the **Suite edition** of
> `@svgrid/enterprise`. Without a key they run with a watermark.

## 1. Create the tables

```sql
create table projects (
  id text primary key,
  name text not null default '',
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
```

The record keys are text: a new record gets its id in the page, and that id
is its key here. (With `serial` or `uuid` keys the database makes, set
`serverIds: true` on the source; see [record ids](./data.md#record-ids).)

## 2. Install

Start from a SvelteKit app. `npx sv create tracker` makes one on SvelteKit 3, and
the code on this page is written for that. An app on SvelteKit 2, such as one
from `npm create @svgrid`, takes [a few small changes](#on-sveltekit-2).

```bash
npm i @svgrid/grid @svgrid/enterprise pg
npm i -D @types/pg
```

```bash
# .env
DATABASE_URL=postgres://user:password@localhost:5432/tracker
```

SvelteKit 3 hands an app only the variables it declares:

```ts
// src/env.ts
import { defineEnvVars } from '@sveltejs/kit/env'

export const variables = defineEnvVars({ DATABASE_URL: {} })
```

## 3. One endpoint per table

`createSqlDataSource` turns the base's reads and writes into SQL for one
table; `createKitHandlers` serves it as a SvelteKit endpoint. A helper makes
both from a table name and its columns:

```ts
// src/lib/server/tables.ts
import pg from 'pg'
import { createKitHandlers, createSqlDataSource, type EntitySchema } from '@svgrid/enterprise'
import { DATABASE_URL } from '$app/env/private'

const pool = new pg.Pool({ connectionString: DATABASE_URL })

const text = (field: string) => ({ field, type: 'text' as const })
const SCHEMAS: Record<string, EntitySchema> = {
  projects: { name: 'projects', fields: [{ ...text('id'), primaryKey: true }, text('name'), { field: 'due', type: 'date' }] },
  tags: { name: 'tags', fields: [{ ...text('id'), primaryKey: true }, text('name')] },
  tasks: {
    name: 'tasks',
    fields: [
      { ...text('id'), primaryKey: true },
      text('name'),
      text('status'),
      { field: 'priority', type: 'number' },
      { field: 'due', type: 'date' },
      { field: 'done', type: 'boolean' },
      text('project_id'),
    ],
  },
  task_tags: { name: 'task_tags', fields: [{ field: 'id', type: 'number', primaryKey: true }, text('task_id'), text('tag_id')] },
}

/** The POST handler for one table: reads, inserts, updates and deletes as SQL. */
export function tableEndpoint(table: string) {
  const schema = SCHEMAS[table]!
  const source = createSqlDataSource({
    schema,
    table,
    dialect: { placeholders: '$', ilike: true },
    execute: async (sql, params) => (await pool.query(sql, params)).rows,
  })
  return createKitHandlers({ schema, source, authorize: ({ event }) => !!event.locals?.user })
}
```

On a table with `softDelete`, a `transaction` and `linkedFrom` make Delete forever one server
step. [Delete forever is one step](./undo-trash-import.md#delete-forever-is-one-step) has one
for each driver.

Then a route that serves any of the four tables:

```ts
// src/routes/api/[table]/+server.ts
import { error } from '@sveltejs/kit'
import { tableEndpoint } from '#lib/server/tables.ts'

const TABLES = new Set(['projects', 'tags', 'tasks', 'task_tags'])

export async function POST(event: { params: { table: string }; request: Request; locals: Record<string, unknown> }) {
  if (!TABLES.has(event.params.table)) error(404, 'No such table')
  return tableEndpoint(event.params.table).POST(event)
}
```

`authorize` above reads `event.locals.user`, and that is yours to fill in: without
it every call is a `403` and the page says you have no permission. Your sign-in
sets it in `src/hooks.server.ts`. Until you have one, this signs everyone in on
your machine and nobody in a production build:

```ts
// src/hooks.server.ts
import type { Handle } from '@sveltejs/kit/hooks'
import { dev } from '$app/env'

export const handle: Handle = ({ event, resolve }) => {
  if (dev) event.locals.user = { id: 'me' }
  return resolve(event)
}
```

```ts
// src/app.d.ts
declare global {
  namespace App {
    interface Locals {
      user?: { id: string }
    }
  }
}

export {}
```

The base asks this endpoint for dates, bigints and decimals as Postgres writes
them, so a date shows the same day whatever zone the server or the browser is in
([what a cell holds](./data.md#what-a-cell-holds)).

Every statement uses parameters (`$1`, `$2`), so no value the base sends is
ever part of the SQL text. Using Drizzle? Pass `execute` the same `pg.Pool`
you gave `drizzle()`.

Who may do what belongs here too: `createKitHandlers` takes `authorize`
(return `false` to refuse an operation), `scope` (each person sees only
their rows) and `audit` (log every write). See
[access control](../../enterprise/studio/access-control.md).

The schema is the whitelist. A column that is not on it is not read, not
returned from a write and cannot be set, whatever a client sends. So leave
`password_hash` off `SCHEMAS` and it stays on the server. A field marked
`readonly: true` is read but only your server sets it: the handlers drop it from
what a client sends, and a `before*` hook can still write it.

What the database says stays in the server log, because a driver's words name
tables, columns and values. A refusal reaches the page as a `409` with a code it
turns into plain words:

| The database refused | The person reads | `code` |
|---|---|---|
| A unique constraint | Another record already has this value. | `duplicate` |
| `NOT NULL` | This field needs a value. | `required` |
| A foreign key, on a write: the record it names is not there | The record Site id points to is not there. (names the field when the database says which) | `link-missing` |
| A foreign key, on a delete: other records name this one | Other records depend on it. | `linked` |
| A `CHECK`, a value too long or of the wrong type | The database does not accept this value. | `not-accepted` |
| Its permissions | You do not have permission to do this. | `no-permission` |

Anything else is a `500` with `code: 'request-failed'`, and the page says "Not saved: The
server answered with an error. Whoever runs it can see why in its log." A trigger's
`RAISE EXCEPTION` is one of these: its text stays in the log too. "It may not have been
stored" is said only of a write that got no answer at all. A source in the page's own
process (`baseFromDatabase`, your own `execute`) reads what it throws the same way: the
notice says what its code means and never the driver's message, which is in the status
line's tooltip. To say something of your own, throw an `Error` with `expose: true` from `execute` or a hook: its message
goes to the client with a `400`. Only do that with text you wrote.

```ts
execute: async (sql, params) => {
  try {
    return (await pool.query(sql, params)).rows
  } catch (e) {
    if ((e as { constraint?: string }).constraint === 'not_blocked') {
      throw Object.assign(new Error('Blocked is set by the planning team.'), { expose: true })
    }
    throw e
  }
},
```

## 4. The tables in the browser

On the client each table's source is `createKitDataSource`, which talks to
the endpoint:

```ts
// src/lib/tracker.ts
import { baseSource, type BaseTable } from '@svgrid/enterprise/base'
import { createKitDataSource } from '@svgrid/enterprise'

const api = (table: string) => createKitDataSource({ endpoint: `/api/${table}` })

const STATUS = [
  { value: 'Todo', color: '#64748b' },
  { value: 'In progress', color: '#2563eb' },
  { value: 'Blocked', color: '#dc2626' },
  { value: 'Done', color: '#16a34a' },
]

export function trackerTables(): BaseTable[] {
  return [
    {
      id: 'tasks',
      name: 'Tasks',
      primaryField: 'name',
      data: [],
      columns: [
        { field: 'name', header: 'Task', width: 220, fieldType: 'text' },
        { field: 'status', header: 'Status', width: 130, fieldType: 'singleSelect', fieldProps: { options: STATUS } },
        { field: 'project', header: 'Project', width: 160, fieldType: 'link', fieldProps: { table: 'projects', multiple: false, inverse: 'tasks' } },
        { field: 'tags', header: 'Tags', width: 190, fieldType: 'link', fieldProps: { table: 'tags', multiple: true, inverse: 'tasks' } },
        { field: 'due', header: 'Due', width: 150, fieldType: 'date', fieldProps: { dateFormat: 'friendly' } },
        { field: 'priority', header: 'Priority', width: 110, fieldType: 'rating', fieldProps: { max: 5 } },
        { field: 'done', header: 'Done', width: 70, fieldType: 'checkbox' },
      ],
      source: baseSource(api('tasks'), {
        links: {
          project: { column: 'project_id' },
          tags: { through: api('task_tags'), from: 'task_id', to: 'tag_id' },
        },
      }),
    },
    {
      id: 'projects',
      name: 'Projects',
      primaryField: 'name',
      data: [],
      columns: [
        { field: 'name', header: 'Project', width: 200, fieldType: 'text' },
        { field: 'due', header: 'Due', width: 150, fieldType: 'date' },
        { field: 'tasks', header: 'Tasks', width: 300, fieldType: 'link', fieldProps: { table: 'tasks', multiple: true, inverse: 'project' } },
        { field: 'count', header: 'Open', width: 90, fieldType: 'count', fieldProps: { linkField: 'tasks' } },
      ],
      source: baseSource(api('projects')),
    },
    {
      id: 'tags',
      name: 'Tags',
      primaryField: 'name',
      data: [],
      columns: [
        { field: 'name', header: 'Tag', width: 180, fieldType: 'text' },
        { field: 'tasks', header: 'Tasks', width: 300, fieldType: 'link', fieldProps: { table: 'tasks', multiple: true, inverse: 'tags' } },
      ],
      source: baseSource(api('tags')),
    },
  ]
}
```

What each change runs:

| In the base | In the database |
|---|---|
| Set a task's Status | `UPDATE "tasks" SET "status" = $1 WHERE "id" = $2 RETURNING "id", "name", ...` |
| Pick a Project for a task | `UPDATE "tasks" SET "project_id" = $1 WHERE "id" = $2 RETURNING "id", "name", ...` |
| Add a task to a project from the Projects tab | the same `UPDATE` on the task |
| Add a tag to a task | `INSERT INTO "task_tags" ("task_id", "tag_id") VALUES ($1, $2) RETURNING "id", "task_id", "tag_id"` |
| Remove a tag | `DELETE FROM "task_tags" WHERE "id" = $1` |
| "+ Add task" | `INSERT INTO "tasks" (...) VALUES (...) RETURNING "id", "name", ...` |
| Delete a task | `DELETE FROM "tasks" WHERE "id" = $1` |

`RETURNING` lists the schema's columns and no others.

The Count field and the Tasks fields of Projects and Tags are worked out in
the page and never written.

## 5. The page

```svelte
<!-- src/routes/tracker/+page.svelte -->
<script lang="ts">
  import { SvToaster } from '@svgrid/grid'
  import { SvBase, enableBase } from '@svgrid/enterprise/base'
  import { trackerTables } from '#lib/tracker.ts'

  enableBase()
  let tables = $state.raw(trackerTables())
</script>

<div style="height: 680px">
  <SvBase bind:tables editable sortable showRowNumbers expandRows containerHeight="100%" />
</div>
<SvToaster />
```

## 6. When the database says no

Constraints keep working: the database has the last word. Add one:

```sql
alter table tasks add constraint not_blocked check (status <> 'Blocked') not valid;
```

and set a task to Blocked. The `UPDATE` fails, the cell goes back to what
the database holds, and the base says why in plain words. The table in
[step 3](#3-one-endpoint-per-table) lists them, and shows how to send your own:

![A refused write: the database rejects the status, the cell goes back to Todo, and the tab bar says the database does not accept this value.](/docs-media/base-refused-write.png)

## On SvelteKit 2

The scaffolds from `npm create @svgrid` pin SvelteKit 2, where a few names differ:

| On this page | On SvelteKit 2 |
|---|---|
| `#lib/server/tables.ts` | `$lib/server/tables` |
| `src/env.ts` and `$app/env/private` | no `src/env.ts`, and `$env/static/private` |
| `$app/env` | `$app/environment` |
| `import type { Handle } from '@sveltejs/kit/hooks'` | `import type { Handle } from '@sveltejs/kit'` |

## 7. Changes made by others

The base reads a table again when its source's `realtime` says it changed.
Postgres can tell you with `LISTEN`/`NOTIFY`: a trigger notifies on every
change, your server forwards it to the browser over server-sent events or a
WebSocket, and the client calls `onChange`:

```ts
import { baseSource, createBaseFeed } from '@svgrid/enterprise/base'
import { createKitDataSource } from '@svgrid/enterprise'

// One stream for every table: your endpoint sends { "table": "tasks" } when a table changes.
const feed = createBaseFeed((apply) => {
  const events = new EventSource('/api/changes')
  events.onmessage = (e) => apply(JSON.parse(e.data).table)
  return () => events.close()
})

const tasksSource = baseSource(createKitDataSource({ endpoint: '/api/tasks' }), {
  links: { project: { column: 'project_id' } },
  realtime: feed('tasks'),
})
const projectsSource = baseSource(createKitDataSource({ endpoint: '/api/projects' }), {
  realtime: feed('projects'),
})
```

Keep it to one stream for the base, not one per table. A browser opens at most six
connections to one host over HTTP/1.1, and each open stream holds one: with a stream per
table on six tables, no write reaches the server.

Without `realtime`, people see each other's changes when they open the base
again.

The feed has to cover what `tasks` does not hold. A link to many through a junction table
changes that table, not this one: when the junction changes, call `apply('tasks')`. See
[What a feed has to cover](./data.md#what-a-feed-has-to-cover).

## Next

- [Keep a base in a database](./data.md): how the writer works and every
  option.
- [Build a base on Supabase](./supabase.md): the same, with Supabase doing
  the server part.
