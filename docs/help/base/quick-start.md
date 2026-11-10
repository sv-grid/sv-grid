# From a database to an app

You have a database. One call reads its tables and `<SvBase>` turns them
into an app your team can use: a tab per table, fields typed from the
columns, links from the foreign keys, colored selects, a Kanban board and a
calendar. Every edit goes back to the database.

<!-- tutorial:mk-meet-svgrid-base -->
<figure class="docs-tutorial docs-tutorial-player" id="tutorial-mk-meet-svgrid-base" data-docs-tutorial="mk-meet-svgrid-base">
<video class="docs-tutorial-video" src="/tutorials/mk-meet-svgrid-base.mp4" poster="/tutorials/mk-meet-svgrid-base.poster.webp" width="960" height="540" controls playsinline preload="none" aria-label="Meet SvGrid Base: tables inside your Svelte app, on your own database, 108 second tutorial"><track kind="captions" srclang="en" label="English" src="/tutorials/mk-meet-svgrid-base.vtt">Your browser does not play embedded video. <a href="/tutorials/mk-meet-svgrid-base.mp4">Download the MP4</a>.</video>
<figcaption><strong>Meet SvGrid Base: tables inside your Svelte app, on your own database</strong> (1:48, with narration). <a href="https://www.youtube.com/watch?v=rB-K65XMm7M" rel="noopener">Watch on YouTube</a></figcaption>
</figure>
<!-- /tutorial:mk-meet-svgrid-base -->

<small>Airtable is a registered trademark of Formagrid Inc dba Airtable. SvGrid is not affiliated with Airtable.</small>

![From a database to an app: your SQL tables go into one call, baseFromDatabase, which reads the tables, columns, foreign keys and repeated values; out comes the app with tabs, typed fields, colored selects, links and views.](/docs-media/base-quick-start.svg)

Try it: pick a sample database, change its SQL if you like, and press
"Make the app". The tables are created in a real Postgres running in the
page.

<div data-docs-demo="519-base-from-database" data-height="900"></div>

## Start a new app

```bash
npm create @svgrid@latest my-base -- --template base
```

The wizard asks two things:

```text
  Where is your data?
    1. Postgres in the browser - nothing to set up, try it now
    2. Your Postgres - DATABASE_URL, behind a SvelteKit endpoint
    3. Supabase - your project, live through Realtime
  Start with which template?
    1. Project tracker - tasks and milestones
    2. Sales CRM - deals, accounts and contacts
    3. Content calendar - posts and campaigns
    4. Product roadmap - features and feedback
    5. Hiring tracker - candidates and roles
    6. Inventory - items and suppliers
    7. Bug tracker - bugs and releases
    8. Event planning - events, attendees, checklist
    9. OKRs - objectives and key results
    10. Expense approvals - expenses and budgets
    11. Employee onboarding - people, checklist, departments
    12. My own tables - an empty db/schema.sql to fill in
```

The templates are the [ready-to-use bases](./templates.md), as SQL: their
tables, records, views and automations. Or answer on the command line:

```bash
npm create @svgrid@latest my-base -- -t base --data postgres --sample sales-crm
```

The app is a SvelteKit project. The tables it starts with are in
`db/schema.sql`, and the other templates in `db/templates/`. With
**Postgres in the browser** it runs straight away, saved in the browser.
With **your Postgres**, set `DATABASE_URL` in `.env` and run
`npm run db:setup`. With **Supabase**, run `db/schema.sql` and
`db/policies.sql` in the SQL editor and put the project URL and anon key in
`.env`. Skip the schema to show tables you already have.

## Take a base to a database

A base you built in the page goes to a database the same way: "All tables"
in the tab bar, then **Download as SQL**. The file creates the tables, the
foreign keys and the tables behind links to many, and inserts the records.
Run it with `psql`, in the Supabase SQL editor, or on PGlite, and the
base opens from that database as it was. In code:

```ts
import { baseToSql } from '@svgrid/enterprise/base'

const sql = baseToSql(tables)   // tables: the BaseTable[] you pass to <SvBase>
```

SQL has no column type for a select's colors, a formula, a view or an
automation. Those go into comments on the tables and columns
(`comment on column ... is 'svgrid:{...}'`), and `baseFromDatabase`,
`createBaseEndpoint` and `baseFromSupabase` read them back. Remove them and
the base still opens, read from the columns alone. Dates near today are
written as `current_date + 3`, so sample data stays current whenever it
runs; `baseToSql(tables, { relativeDays: 0 })` writes every date as it is,
and `{ data: false }` leaves the records out.

## Add it to an app you have

**Postgres (or MySQL, SQL Server, SQLite) behind your server.** The endpoint
reads the database and serves its tables; the page shows them. This is for an app
from `npx sv create`, on SvelteKit 3; the [tutorial](./postgres.md#on-sveltekit-2)
lists what differs on SvelteKit 2.

```bash
npm i @svgrid/grid @svgrid/enterprise pg
npm i -D @types/pg
```

```bash
# .env
DATABASE_URL=postgres://user:password@localhost:5432/tracker
```

```ts
// src/env.ts
import { defineEnvVars } from '@sveltejs/kit/env'

export const variables = defineEnvVars({ DATABASE_URL: {} })
```

```ts
// src/routes/api/base/+server.ts
import pg from 'pg'
import { createBaseEndpoint } from '@svgrid/enterprise/base'
import { DATABASE_URL } from '$app/env/private'

const pool = new pg.Pool({ connectionString: DATABASE_URL })

export const { GET, POST } = createBaseEndpoint({
  execute: async (sql, params) => (await pool.query(sql, params)).rows,
  // The tables this route serves.
  tables: ['tasks', 'projects'],
  // Who may use it: `event.locals` as your hooks fill it in.
  authorize: () => ({ event }) => !!event.locals?.user,
})
```

`event.locals.user` is yours to fill in, from your sign-in. Until it is, every
call is a `403`. This stands in for one on your machine, and signs nobody in on a
production build:

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

```ts
// src/routes/base/+page.ts
export const ssr = false
```

```svelte
<!-- src/routes/base/+page.svelte -->
<script lang="ts">
  import { SvToaster } from '@svgrid/grid'
  import { SvBase, baseFromEndpoint, enableBase } from '@svgrid/enterprise/base'

  enableBase()
  const tables = baseFromEndpoint('/api/base')
</script>

{#await tables}
  <p>Reading the database...</p>
{:then tables}
  <SvBase {tables} editable sortable />
{:catch error}
  <p>Could not open the base: {error.message}</p>
{/await}
<SvToaster />
```

The page never sees the connection string. Every read and write is
parameterized SQL, and only the tables in `tables` can be reached.

The endpoint will not start open. Without `authorize` it needs `public: true`,
which lets every visitor read and write, and without `tables` it needs
`allTables: true`, which serves your users and sessions tables too. `authorize`
gets the table and then `{ action, event }`: return `false` to refuse. `GET`
asks it as well, with `action: 'read'`, and describes only the tables it allows.

`allTables` serves the tables a bare name reaches. On Postgres those are the tables of
the schemas on the search path (`current_schemas(false)`), in its order: a name in an
earlier schema hides one in a later, as it does for every query, and so do a view or a
sequence of that name. On MySQL it is the connection's database, on SQL Server its
default schema. A database with no tables yet is described as none, a `200` with an
empty list, and read again on the next request, so tables made after the server started
show on a reload.

A column named like a credential (`password_hash`, `api_key`, `remember_token`,
`iban`) stays out of the base: it is not described, not read and not written.
That is a check of the column's name and nothing more. It is a default, not a
guarantee: a column called `notes2` that holds keys goes straight through, so read
your tables before you open them. Change what stays out with
`hide: (table, column) => boolean`, and call `isSecretColumn(column)` in it to keep
that check. A foreign key that holds such a column's value stays out with it.

A record's key goes to every page that reads the table, so a key cannot be hidden. A
table whose key is named like a credential, `sessions` keyed by `token`, does not start:
it is not read, not described and not served, and the server log says why. The other
tables start as usual. Give that table another key, or name it in
`exposeSecretKeys: ['sessions']` if the key is safe for whoever reads it.

`scope: (table) => ...` shows each person their own rows, as `createKitHandlers`
does; with it, select options are no longer sampled from the table, unless you set
`choices: true`. Return `null` for a table every tenant shares. A resolver that
names no tenant, `locals.user.tenant ?? ''` for a person with no organisation, is
a `403` on every read and write and leaves the table out of `GET`: it never means
"every row". A filter the client sends on the tenant column is combined with the scope,
never put in its place: `tenant_id = 2` from tenant 1 finds no rows, and an `updateWhere`
with it changes none.

#### Links under a tenant

A junction table needs a scope too, and it has two ways to get one. If it holds the
tenant, as `order_tags (id, tenant, order_id, tag_id)` does, name the column so it stays
a link to many instead of a tab, and its resolver is the same as any other table's:

```ts
const tenant = ({ event }) => ({ field: 'tenant', value: event.locals.user.tenant })

export const { GET, POST } = createBaseEndpoint({
  execute,
  tables: ['orders', 'tags', 'order_tags'],
  authorize: () => ({ event }) => !!event.locals?.user,
  tenantColumn: 'tenant',
  scope: () => tenant,
})
```

If it holds no tenant, `order_tags (id, order_id, tag_id)`, say which foreign key names
its owner. A pair then belongs to the tenant of that record, on reads, writes, the trash
and everything else:

```ts
scope: (table) => (table === 'order_tags' ? { through: 'order_id' } : tenant),
```

`through` needs a foreign key in the database, to a table this route serves. Without
one the junction is a `403`. It goes one level: the parent must hold the tenant itself,
so a table whose parent is scoped by `through` too is a `403` and drops out of `GET`. A
`null` for a junction between tables that have a scope is a `403` as well, because every
tenant would read and change the others' links.

A pair keyed by both ends, `order_tags (order_id, tag_id)`, takes either shape: see
[Keys the base can use](./data.md#keys-the-base-can-use). Either way a pair is read and
deleted only inside the scope: an id that names another tenant's pair reads nothing and is
a `403` to delete, a tenant column in that id included. A read of a junction, of either
shape, leaves out a pair whose other end is another tenant's record in a table that holds
its own tenant column (a pair written straight into the database; the API refuses one with
a `409`), so that key never reaches the page.

The column a scope names shows in the page and takes no edit, for whoever that scope
applies to, and `tenantColumn` says the same with no scope at all. To keep it off the page,
name it in `hide`: the scope still filters and stamps it, and no answer holds it.

A write is held to the scope at both ends. A foreign key whose table has a scope must
name a record of that scope, a record in its trash included. Anything else is a `409`
with `code: 'link-refused'`, the same answer for another tenant's record and for no
record at all, so a tenant cannot point at another's record, block its delete, or
learn which keys exist. A table this route does not serve is not checked, so list every
tenant table in `tables`, or check the link in a `before*` hook. `createKitHandlers` used
alone has no other tables to ask: use its `checkWrite` option. All of this reads the
database's foreign keys: a column with no constraint behind it, as on a MySQL table that
declares none, is plain text to the base, and nothing checks where it points.

One thing a key cannot hide: a key is unique across tenants, so a create that names
another tenant's key gets the `409` of a duplicate. That says the key exists and nothing
about the record. Use keys nobody can guess (`gen_random_uuid()`) where that matters.

Nothing checks a write on the server unless you say how. A field's "Required in
forms" is a rule of the form in the page, and a client that skips the form skips
it. `validate: true` holds each table to its columns: a `NOT NULL` column with no
default is required, and a write that breaks that is a `422`. Pass a function for
your own check, `validate: (table) => ({ values }) => errors`, and
`hooks: (table) => ({ beforeCreate, beforeUpdate, ... })` to change or refuse a
write. Leave `validate: true` off a table people add blank records to: the base
adds a record first and fills it in after.

`audit` runs [server automations](./automations.md#on-the-server), and
`maxPageSize` caps the rows one read returns (20,000 by default), and the records one
block may write. The page follows it: a read of more goes in as many requests as that
takes, and a block goes in the server's size.

A bulk write comes in blocks: Edit fields, Delete and an undo of either send up to 1,000
records in a request, or `maxPageSize` if that is less, the `updateMany` and `deleteMany` messages. Records given the same
values are one statement; the rest go a few hundred to a statement. Every rule of a
one-record write holds for each record of a block. `authorize` is called once per record
with the message of that one write, so a guard that reads `message.id` needs no change.
`scope`, `validate`, `before*` and `checkWrite` run on every record before the first
statement, and one refusal refuses the block: nothing of it is written. `after*` hooks
and `audit` run per record once it is written, and on a failure part way, for the records
the earlier statements wrote. Long values split a block into more requests, each under
256 KB, because SvelteKit's adapters refuse a body over 512 KB unless `BODY_SIZE_LIMIT`
says otherwise.

The route takes `application/json` only, a `415` otherwise, and refuses a `POST` from
another site with a `403`. A page on another host that should reach it goes in
`origins: ['https://app.example.com']`.

### Formulas, lookups and rollups on a big table

The endpoint works computed fields out in the database, so a view that sorts or
filters on one is a statement, not a read of the whole table into the page. It works
from the fields it holds: the `svgrid:` comments on Postgres tables (`baseToSql`
writes them), and `computed`, which is how MySQL and SQLite get them:

```ts
export const { GET, POST } = createBaseEndpoint({
  execute,
  tables: ['orders', 'customers'],
  computed: {
    orders: [
      { field: 'tax', header: 'Tax', fieldType: 'formula', fieldProps: { formula: '{amount} * 0.2' } },
      { field: 'tier', header: 'Tier', fieldType: 'lookup', fieldProps: { linkField: 'customer', field: 'tier' } },
    ],
  },
  authorize: () => ({ event }) => !!event.locals?.user,
})
```

A request names a field and never brings a definition: nothing a client sends
becomes SQL or a formula. A field added or changed in the page stays the page's. It
is worked out there, with a read of the table, and once one of the fields the server
described changes, so are the table's others, because one may read another. Four more
cases go to the page:

- a formula SQL cannot say exactly (`TODAY()`, `UPPER()`, `LEFT()`), as on any source;
- a formula on a column `hide` keeps back;
- a lookup into a table this person may not read: the field is not described to them;
- a lookup into a table `scope` covers. A subquery has no tenant, so the page reads
  those records through the scope.

`GET` lists what the server works out in `serverComputes`, per table and per person.

### Reads nobody waits for

`execute` gets a third argument, `{ signal }`, on reads. When the person scrolls on or
closes the page, no further statement of that read is sent. The statement already
running stops only if your `execute` stops it, and only if your framework aborts
`request.signal` when the client leaves. With node-postgres:

```ts
execute: async (sql, params, o) => {
  const client = await pool.connect()
  const cancel = () => void pool.query('select pg_cancel_backend($1)', [client.processID])
  o?.signal?.addEventListener('abort', cancel, { once: true })
  try {
    return (await client.query(sql, params)).rows
  } finally {
    o?.signal?.removeEventListener('abort', cancel)
    client.release()
  }
}
```

### Indexes that help

A read at a place in a list costs what walking to that place costs, so a sort people
use on a big table wants an index on that column. A date condition compares the column
to a range on Postgres and MySQL, and an index on the date column serves it. On MySQL a
descending sort reads such an index backwards.

`dialect` takes `'mysql'`, `'sqlite'` or `'mssql'`. On SQL Server, `execute` binds
`@p1`, `@p2` and so on:

```ts
import sql from 'mssql'

const pool = await sql.connect(DATABASE_URL) // Server=host,1433;Database=app;User Id=sa;Password=...

export const { GET, POST } = createBaseEndpoint({
  dialect: 'mssql',
  execute: async (text, params) => {
    const request = pool.request()
    params.forEach((value, i) => request.input(`p${i + 1}`, value))
    return (await request.query(text)).recordset ?? []
  },
  tables: ['tasks', 'projects'],
  authorize: () => ({ event }) => !!event.locals?.user,
})
```

Formulas, lookups and rollups run in the database on SQL Server, as on the other
engines. A few do not: a formula that ends in a yes or no, and `TRIM`, `MOD`, `FLOOR`,
`CEILING`, `UPPER`, `LOWER`, `LEFT`, `RIGHT`, `MID` and `TODAY`. A table small enough to
hold in the page works them out there. On a larger one the base does not read the table
through: a sort or a total on such a field is left out and says so, and a filter or a
group on it fails at once and names the field. SQL Server takes no subquery in a group or
a total, so a group on a rollup or a count fails that way too, and a total over one is left out.

**Supabase.** One call in the page; other people's changes arrive through
Realtime:

```ts
import { createClient } from '@supabase/supabase-js'
import { baseFromSupabase } from '@svgrid/enterprise/base'

const supabase = createClient('https://your-project.supabase.co', 'your-anon-key')
const tables = await baseFromSupabase({ client: supabase, url: 'https://your-project.supabase.co', key: 'your-anon-key' })
```

**Postgres in the browser** (PGlite), for prototypes and offline tools:

```ts
import { PGlite } from '@electric-sql/pglite'
import { baseFromDatabase } from '@svgrid/enterprise/base'

const db = new PGlite('idb://my-base')
const tables = await baseFromDatabase({ execute: async (sql, params) => (await db.query(sql, params)).rows as Record<string, unknown>[] })
```

## What it reads from your database

| In the database | In the base |
|---|---|
| A table | A tab; the table that links to the most others comes first |
| A text column | A text field; `email`, `url`, `phone` in the name give those fields, `notes` or `description` a long text |
| A text column that repeats a few values (`status`, `priority`) | A single select, one color per value |
| A number column | A number at the column's scale, so `numeric(12,2)` shows two places and an integer none; `price`, `amount`, `budget` show as currency, `rating` as stars. A column that declares no scale (`double precision`, a bare `numeric`) takes the places its values show, up to 8, read from the first 1,000. With a tenant `scope` no values are read, so it shows two. |
| A `date` or `timestamp` column | A date field, with the time for a timestamp |
| A `time` column | A time of day, with seconds. A time with a zone stays text, and neither is a select |
| A `boolean` column, or MySQL's `tinyint(1)` | A checkbox |
| A Postgres `text[]` column | A multiple select, with the values it holds as options |
| A foreign key (`project_id`) | A link to that table, and a field there that links back. Two keys to one table give two fields back, each named for its key: "Orders (Customer)" and "Orders (Rev customer)". When the link's name is a column of the table already (`customer` beside `customer_id`), the link keeps its column's name as its id and is called "Customer (link)"; both fields show |
| A table that only pairs two others (`task_tags`) | A link to many records, stored in that table |
| A key the database makes (`serial`, a default `uuid`) | New records get theirs from the database |
| A column named `name` or `title`, or else the first text column | The primary field, first and pinned. The tenant column, a key column and a foreign key column are never it: with no other text column the record's key names it, shown first and read-only. That field holds the key the database gave each record, a new one's too once it is stored; Edit field changes only its name and description, and nothing the page does writes it. A key column named `id` is the field `id_key` in the description, which `rename` maps back to `id` |
| A text column named `created_by`, `updated_by` or `modified_by` | Created by / Last modified by: the user id is shown as the person, and a change made elsewhere is credited to them |

Each table also gets views: a grid colored by its first select, a Kanban
board by that select, and a calendar by its first date.

![The Kanban view the base made from the events table: a lane per status value, a card per event with its date, price and notes.](/docs-media/base-from-database-board.png)

## Notices

A base shows its own notices: a save that failed, a write or an undo that was
refused, a Restore after a delete. With no `<SvToaster />` on the page it draws
one, and two bases on a page share it. A page that mounts `<SvToaster />` keeps its
own, with the position it chose, and no notice shows twice.

## Make it yours

The base is ordinary `BaseTable` objects: change a field, add a view, set
[automations](./automations.md). What you change in the app (field types,
views, colors) lives in the page; to keep it, store the tables
`onTablesChange` hands you and start from them next time. The records
always stay in your database.

## Next

- [Keep a base in a database](./data.md): how the writes work, links,
  record ids, realtime.
- [Ready-to-use bases](./templates.md): templates to start from.
- [Automations](./automations.md).
