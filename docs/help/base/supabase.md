# Build a base on Supabase

This tutorial puts a project tracker in a Svelte app with its records in
Supabase: two tables, Projects and Tasks, a link between them stored as a
foreign key, and edits from other people arriving through Supabase Realtime.
It takes about fifteen minutes and a free Supabase project.

![Two people on one Supabase project. Ana sets a task to Blocked; a moment later Ben's base shows it. Each window lists the requests it made.](/docs-media/base-supabase-live.png)

Try it first in the page, with a stand-in for the Supabase project. Change a
task on one side and watch the other:

<div data-docs-demo="517-base-supabase" data-height="640"></div>

> SvGrid Base and the Supabase source are part of the **Suite edition** of
> `@svgrid/enterprise`. Without a key they run with a watermark, so you can
> follow this tutorial before you buy.

## 1. Create the tables

In the Supabase dashboard, open the SQL editor and run:

```sql
create table projects (
  id uuid primary key default gen_random_uuid(),
  name text not null default '',
  owner text
);

create table tasks (
  id uuid primary key default gen_random_uuid(),
  name text not null default '',
  status text default 'Todo',
  due date,
  project_id uuid references projects(id) on delete set null
);

insert into projects (name) values ('Website relaunch'), ('Customer portal');
insert into tasks (name, status, project_id)
  select 'Wireframes', 'Done', id from projects where name = 'Website relaunch';
```

The keys are uuids the database makes. A task's project is the
`project_id` foreign key; the Projects table has no column for its tasks.
The base works that list out from `project_id`.

## 2. Let signed-in people read and write

Row level security decides what each person can do. For a team tracker where
everyone who is signed in can edit everything:

```sql
alter table projects enable row level security;
alter table tasks enable row level security;

create policy "team reads and writes projects" on projects
  for all to authenticated using (true) with check (true);
create policy "team reads and writes tasks" on tasks
  for all to authenticated using (true) with check (true);
```

Narrow the policies as your app needs; the base talks to Supabase as the
signed-in person, so a write a policy refuses comes back to them as an error
and the cell goes back.

A policy is the only lock here: the anon key can ask PostgREST for anything a policy
allows, whatever the base shows. `hide` keeps a column out of the base and out of what
the page asks for, and a table whose key is named like a credential stays out unless
you name it in `exposeSecretKeys`. To keep a column from a person, revoke it from the role
as well. A column the base hides is not read, so a record brought back by undo gets
that column's default.

For one tenant's rows, a junction table needs a policy too, or every tenant reads and
changes the others' links. Give it a tenant column, and pass `tenantColumn: 'tenant'` to
`baseFromSupabase` so it stays a link to many, or check through the parent record:

```sql
create policy "pairs of my orders" on order_tags for all to authenticated
  using (exists (select 1 from orders o where o.id = order_id and o.tenant = auth.jwt() ->> 'tenant'))
  with check (exists (select 1 from orders o where o.id = order_id and o.tenant = auth.jwt() ->> 'tenant'));
```

A link is a foreign key, so a `with check` is also what stops a person pointing at
another tenant's record: check the far side in the same way.

A join table keyed by both ends, `order_tags (order_id, tag_id, primary key (order_id,
tag_id))`, is a link to many. Any other composite key, a table with no primary key and a
view are left out, and the browser console says why: see
[Keys the base can use](./data.md#keys-the-base-can-use).

## 3. Turn on Realtime for the tables

```sql
alter publication supabase_realtime add table projects, tasks;
```

Without this the base still works; it just does not see other people's
changes until it is opened again. Undo and delete read the record first, so a
teammate's edit is not lost to a copy the page held.

## 4. Install

```bash
npm i @svgrid/grid @svgrid/enterprise @supabase/supabase-js
```

Put the project URL and the anon key in `.env`:

```bash
PUBLIC_SUPABASE_URL=https://your-project.supabase.co
PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

## 5. Describe the tables to the base

A base table names its fields by type; the Supabase source needs the
columns it reads. Both go in one file:

The code on this page is for SvelteKit 2. On SvelteKit 3,
[these names differ](../../getting-started/sveltekit.md#on-sveltekit-3).

```ts
// src/lib/tracker.ts
import { createClient } from '@supabase/supabase-js'
import { baseSource, type BaseTable } from '@svgrid/enterprise/base'
import { createSupabaseDataSource, createSupabaseRealtime, type EntitySchema } from '@svgrid/enterprise'
import { PUBLIC_SUPABASE_ANON_KEY, PUBLIC_SUPABASE_URL } from '$env/static/public'

export const supabase = createClient(PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY)

// The columns of each table, as the Supabase source reads them.
const schemas: Record<string, EntitySchema> = {
  projects: {
    name: 'projects',
    fields: [
      { field: 'id', type: 'text', primaryKey: true },
      { field: 'name', type: 'text' },
      { field: 'owner', type: 'text' },
    ],
  },
  tasks: {
    name: 'tasks',
    fields: [
      { field: 'id', type: 'text', primaryKey: true },
      { field: 'name', type: 'text' },
      { field: 'status', type: 'text' },
      { field: 'due', type: 'date' },
      { field: 'project_id', type: 'text' },
    ],
  },
}

/** A table on Supabase: loads it, writes back, and listens for other people's changes. */
const onSupabase = (table: string, links = {}) =>
  baseSource(createSupabaseDataSource({ client: supabase, table, schema: schemas[table]! }), {
    links,
    // The database makes the uuid of a new record.
    serverIds: true,
    realtime: (onChange) => createSupabaseRealtime({ client: supabase, table, onChange }),
  })

export function trackerTables(): BaseTable[] {
  return [
    {
      id: 'tasks',
      name: 'Tasks',
      primaryField: 'name',
      data: [],
      columns: [
        { field: 'name', header: 'Task', width: 220, fieldType: 'text' },
        {
          field: 'status', header: 'Status', width: 130, fieldType: 'singleSelect',
          fieldProps: { options: [{ value: 'Todo', color: '#64748b' }, { value: 'In progress', color: '#2563eb' }, { value: 'Blocked', color: '#dc2626' }, { value: 'Done', color: '#16a34a' }] },
        },
        { field: 'project', header: 'Project', width: 170, fieldType: 'link', fieldProps: { table: 'projects', multiple: false, inverse: 'tasks' } },
        { field: 'due', header: 'Due', width: 140, fieldType: 'date', fieldProps: { dateFormat: 'friendly' } },
      ],
      views: [
        { id: 'all', name: 'All tasks', type: 'grid', color: { mode: 'field', field: 'status' } },
        { id: 'board', name: 'Board', type: 'kanban', stackBy: 'status' },
      ],
      // The Project field is the project_id column.
      source: onSupabase('tasks', { project: { column: 'project_id' } }),
    },
    {
      id: 'projects',
      name: 'Projects',
      primaryField: 'name',
      data: [],
      columns: [
        { field: 'name', header: 'Project', width: 200, fieldType: 'text' },
        { field: 'owner', header: 'Owner', width: 160, fieldType: 'text' },
        // Worked out from tasks.project_id: never stored.
        { field: 'tasks', header: 'Tasks', width: 300, fieldType: 'link', fieldProps: { table: 'tasks', multiple: true, inverse: 'project' } },
      ],
      source: onSupabase('projects'),
    },
  ]
}
```

The Project field and the Tasks field name each other (`inverse`), so they
stay in step: link a task to a project from either table and the task's
`project_id` is written.

## 6. Put the base on a page

```svelte
<!-- src/routes/tracker/+page.svelte -->
<script lang="ts">
  import { SvToaster } from '@svgrid/grid'
  import { SvBase, enableBase } from '@svgrid/enterprise/base'
  import { trackerTables } from '$lib/tracker'

  enableBase()
  let tables = $state.raw(trackerTables())
</script>

<div style="height: 640px">
  <SvBase bind:tables editable sortable containerHeight="100%" />
</div>
<SvToaster />
```

Run `npm run dev` and open `/tracker`. The tab bar says "Loading records..."
and then shows the tasks. Change a status, and in the Supabase table editor
the row has the new value. Open the page in a second browser, change
something there, and the first one shows it.

The base runs in the browser, so turn off server rendering for the route
(`export const ssr = false` in `+page.ts`) or sign the person in before it
loads, so the requests carry their session.

## 7. Let Supabase describe the tables

Step 5 writes the fields out, which gives you control over each one. To
start from the database instead, read each table's columns with
`introspectSupabaseTable` and let `baseTablesFromSchemas` make the fields and
the links:

```ts
import { baseTablesFromSchemas, type BaseTable } from '@svgrid/enterprise/base'
import { createSupabaseDataSource, introspectSupabaseTable, type SupabaseClientLike } from '@svgrid/enterprise'

export async function tablesFromSupabase(client: SupabaseClientLike, url: string, key: string): Promise<BaseTable[]> {
  const schemas = await Promise.all(['projects', 'tasks'].map((table) => introspectSupabaseTable({ url, key, table })))
  return baseTablesFromSchemas(
    schemas,
    (schema) => createSupabaseDataSource({ client, table: schema.name, schema }),
    () => ({ serverIds: true }),
  )
}
```

`project_id` becomes a Project link with a Tasks field in Projects that links
back. Adjust the result like any other tables: give Status its colors, add a
Kanban view.

## A table of millions

A table too large to hold in the page reads a part at a time, by itself: its
views ask PostgREST for what they show, with the view's filter, sort and groups.
Name it to skip the first look:
`baseFromSupabase` takes the tables by name:

```ts
import { baseFromSupabase } from '@svgrid/enterprise/base'
import type { SupabaseClientLike, SupabaseRealtimeClientLike } from '@svgrid/enterprise'

declare const supabase: SupabaseClientLike & SupabaseRealtimeClientLike

const tables = await baseFromSupabase({ client: supabase, url: 'https://xyz.supabase.co', key: 'anon-key', serverRows: ['orders'] })
```

With your own sources, pass `serverRows: true` to `baseSource` and the view
filter hook to the Supabase source, which turns a view's filter into a
PostgREST filter (`fieldFilterToPostgrest`):

```ts
import { baseSource, supabaseFieldFilter } from '@svgrid/enterprise/base'
import { createSupabaseDataSource, type EntitySchema, type SupabaseClientLike } from '@svgrid/enterprise'

declare const client: SupabaseClientLike
declare const schema: EntitySchema
declare const columns: Array<Record<string, unknown>>

const source = baseSource(createSupabaseDataSource({ client, table: 'orders', schema, expression: supabaseFieldFilter(columns) }), { serverRows: true })
```

What changes for such a table, and what does not, is in
[A table of millions](./data.md#a-table-of-millions).

Edit fields gives many records one value, and that goes 200 records to a request:
20,000 took 2.8 seconds against a local PostgREST. PostgREST has no write of different
values to different rows short of an upsert, which would bring back a record someone
deleted, so a block of different values, a paste of a column for one, is a request a
record, 16 at a time: 2,000 took 6 seconds there. A row level policy that skips a record
stops the block and says so.

A Supabase project starts with PostgREST's aggregate functions off. A big table
works without them: a Kanban lane, a calendar day and a link's count each read
their size with a plain count. A total in a grid view is added up in the page
from a read of the table, which takes longer on a big table. Turning them on
makes it one query, and a chart or a tile that adds up a field needs them. Run
this once in the SQL editor:

```sql
alter role authenticator set pgrst.db_aggregates_enabled = 'true';
notify pgrst, 'reload config';
```

A block of records is written in one request of up to 1,000 (deletes 200, since the
ids travel in the URL), and a request that fails applied nothing. Row level security
skips rows without an error, so `deleteRows` asks which rows went, and treats any
missing as refused: the base then reads back what is still there.

PostgREST filters on stored columns, so a view filter on a formula is answered in
the page, which reads the table a block at a time
([what the database cannot run](./data.md#what-the-database-cannot-run)). To make
it fast, turn the formula into a column. `generatedColumnSql` writes the
statement, and `generated` tells the filter to read it:

```ts
import { generatedColumnSql, supabaseFieldFilter } from '@svgrid/enterprise/base/compute'

declare const columns: Array<Record<string, any>>

const total = columns.find((c) => c.field === 'total')!
// alter table "orders" add column "total" double precision generated always as (...) stored;
const statement = generatedColumnSql(total, { table: 'orders', key: 'id', columns })

const expression = supabaseFieldFilter(columns, { generated: ['total'] })
```

## When something goes wrong

| What you see | Why |
|---|---|
| Not saved: You do not have permission to do this. | A policy refused the write. Check the policies in step 2 and that the person is signed in. The database's text is in the tooltip. |
| Could not delete *record*. The database kept it, so you may not have permission. | A policy skipped the delete, which PostgREST does not report as an error. The record stays, and stays out of the trash. |
| Other people's changes do not show | The table is not in the `supabase_realtime` publication (step 3). |
| Not saved: The server could not be reached. | The network dropped. The cell went back, and the notice shows what you entered: **Try again** when the connection returns. |
| "Reading N of N records..." in the tab bar | A view filters, sorts or adds up on a formula, lookup or rollup, which PostgREST cannot see, so the page is reading the table. It is kept until a record changes. For a big table, make the field a generated column. |
| An undone delete comes back with a new id | The key column is `GENERATED ALWAYS`, which only the database may write. Anywhere else a record goes back under the key it had. Use `GENERATED BY DEFAULT` to keep keys through an undo. |
| "Reading N of N records..." on a filter of a link field by "is empty" | A key to a record in the trash shows empty, and PostgREST cannot look through a key, so the page reads the table to answer. |
| A sort on a link field keeps a trashed link among the keys | On a table read a part at a time PostgREST sorts by the stored key. The cell is empty and sits where its key sorts. Grouping reads one Empty group, and opening it lists the records of up to 300 trashed keys. |
| Delete forever stopped half way, and Restore says it cannot | PostgREST has no transaction across requests, so the page runs the steps, and a failure or a closed page can leave them unfinished. See [Delete forever is one step](./undo-trash-import.md#delete-forever-is-one-step). Press Delete forever to finish. |
| A new field does not save | PostgREST cannot add a column. The base shows the `ALTER TABLE` statement when you add the field: run it in the SQL editor. |

## Next

- [Keep a base in a database](./data.md): how the writer works, links,
  record ids and every option.
- [Build a base on Postgres](./postgres.md): the same base with your own
  server and database.
