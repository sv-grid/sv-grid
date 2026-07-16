# Supabase

[Supabase](https://supabase.com) gives you a hosted PostgreSQL database with a
generous free tier and a browser-safe client. This guide takes you from an empty
Supabase project to a live CRUD screen, step by step. No backend to run.

> **Try it first:** the [Supabase demo](https://svgrid.com/#/demos/194-studio-supabase)
> is exactly this - paste your project URL + anon key and it runs against your
> real database in the browser.

> **Want it all in one page?** The
> **[Supabase CRUD grid tutorial](./supabase-grid.md)** is the complete,
> copy-paste walkthrough - the table, the schema, the data source, and the full
> grid page with create / edit / delete, start to finish. This page is the deeper
> reference behind it.

There are two ways to connect, and you can use either:

| Path | When | Runs in |
| --- | --- | --- |
| **A. `supabase-js` client** | SPAs, and when you want Row-Level Security + auth enforced per user | The browser |
| **B. SvelteKit server route** | You already use SvelteKit `+server.ts` and want SQL on the server | Node / edge server |

Path A is what the demo uses and what most people want. Start there.

---

## Step 1 - Create a project

1. Sign in at [supabase.com](https://supabase.com) and click **New project**.
2. Give it a name and a database password, pick a region, and wait ~2 minutes
   for it to provision.

## Step 2 - Create and seed the table

Open **SQL Editor** in the Supabase dashboard, paste this, and click **Run**. It
creates a `customers` table and adds a few rows.

```sql
create table if not exists customers (
  id     bigint generated always as identity primary key,
  name   text not null,
  email  text not null,
  tier   text,
  mrr    integer,
  active boolean default true
);

insert into customers (name, email, tier, mrr, active) values
  ('Ada Lovelace',    'ada@analytic.io',      'enterprise', 1200, true),
  ('Alan Turing',     'alan@bletchley.uk',    'pro',         240, true),
  ('Grace Hopper',    'grace@navy.mil',       'enterprise',  980, true),
  ('Edsger Dijkstra', 'edsger@shortest.path', 'free',          0, false);
```

## Step 3 - Open access with Row-Level Security

Supabase blocks all access by default until you add a **policy**. Because the
anon key is public (it ships in the browser), RLS is what actually protects your
data - so you always keep it on and grant exactly what you intend.

For a public demo, allow the anon role to read and write:

```sql
alter table customers enable row level security;

create policy "svgrid demo access" on customers
  for all to anon using (true) with check (true);
```

> **For a real app**, do not grant blanket access to `anon`. Grant to
> `authenticated` and scope rows to the signed-in user, e.g.
> `using (auth.uid() = user_id)`. See the
> [Supabase RLS docs](https://supabase.com/docs/guides/database/postgres/row-level-security).

## Step 4 - Get your keys

In the dashboard: **Project Settings -> API**. Copy two values:

- **Project URL** - `https://xxxxxxxxxxxx.supabase.co`
- **anon public** key - a long token starting with `eyJ...`

The anon key is designed to be shipped in the browser. Never ship the
**service_role** key to a client - it bypasses RLS.

---

## Path A - Connect from the browser (`supabase-js`)

This is a SvelteKit page (or any Svelte SPA). Install the client:

```bash
npm i @supabase/supabase-js
```

Put your keys in `.env` (Vite exposes `PUBLIC_`-prefixed vars to the browser):

```bash
PUBLIC_SUPABASE_URL="https://xxxxxxxxxxxx.supabase.co"
PUBLIC_SUPABASE_ANON_KEY="eyJhbGciOiJI..."
```

Build the data source with **`createSupabaseDataSource`** - it maps the grid's
sort, filter, paging, and CRUD onto the Supabase query builder for you. You bring
the client (so RLS + auth apply per request); it's the whole data layer:

```ts
// src/lib/customers.source.ts
import { createClient } from '@supabase/supabase-js'
import { PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY } from '$env/static/public'
import { createSupabaseDataSource } from '@svgrid/enterprise'
import { customersSchema, type Customer } from '$lib/customers'

const client = createClient(PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY)

export const customersSource = createSupabaseDataSource<Customer>({
  client,
  table: 'customers',
  schema: customersSchema,
  // searchColumns: ['name', 'email'],  // optional; defaults to text + enum fields
})
```

Then wire it exactly like the in-memory source from
[Getting started](./getting-started.md) - the page code is identical:

```ts
const controller = createServerDataSource(customersSource, {
  pageSize: 10, optimistic: true, getRowId: (r) => String(r.id),
  onChange: (s) => (view = s),
})
controller.refresh()
```

That is the entire integration. Sorting, filtering, paging, and CRUD now run
against hosted Postgres, with RLS enforced on every request.

> **Don't know the columns ahead of time?** `introspectSupabaseTable({ url, key,
> table })` reads them from PostgREST and returns an `EntitySchema` you can feed
> to `schemaToColumns` and `createSupabaseDataSource` - that's how the
> [live demo](https://svgrid.com/#/demos/194-studio-supabase) adapts to any table.
> It also reads **foreign keys**, so a FK column comes back as a `relation` field
> and the form gets a searchable picker automatically - see [Relations](./relations.md).

> **Want it live?** Add [`createSupabaseRealtime`](./realtime.md) to refetch and
> flash rows whenever the database changes - no polling.

---

## Path B - SvelteKit server route (connection string)

Prefer to keep SQL on the server? Supabase is plain Postgres, so use the `pg`
driver with the **connection pooler** string (Dashboard -> Project Settings ->
Database -> Connection string, port `6543`). The Studio CLI writes the whole
route for you:

```bash
npm i pg
export DATABASE_URL="postgres://postgres.[ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres"
npx @svgrid/studio add customers --db supabase --url "$DATABASE_URL"
npm run dev            # open /customers
```

This generates the schema, a `+server.ts` API route backed by
[`createSqlDataSource`](./databases.md), and the page. Keys stay on the server;
the browser only talks to your own route. See [The Studio CLI](./cli.md) and
[Databases](./databases.md) for the full picture.

---

## Troubleshooting

| Symptom | Cause and fix |
| --- | --- |
| **On connect it shows no data and only offers to "add columns"** - even though the table has columns and rows | The demo infers your columns *from the rows it fetches*, so an RLS-blocked read means it sees neither rows nor columns and falls back to manual entry. Add the `select` policy from Step 3, then reconnect. Confirm it's RLS by running `select * from your_table;` in the SQL Editor (that bypasses RLS): if it returns rows but the demo shows none, RLS is the cause. |
| **Grid is empty, no error** | RLS is on but no policy grants `select`. Add the policy in Step 3, or scope one to your users. |
| **`new row violates row-level security`** on create | Your policy allows `select` but not `insert`. Use `for all` (as above) or add a `with check` policy for writes. |
| **"Could not reach Supabase"** | Wrong Project URL, or a network / CORS issue. Confirm the URL is the `https://xxxx.supabase.co` form, not the database host. |
| **401 / invalid key** | You pasted the wrong key. Use the **anon public** key from Settings -> API, not the service_role or the JWT secret. |
| **Numbers arrive as strings** | Postgres `numeric` comes back as text over PostgREST. Use `integer` / `bigint` for numeric columns, or cast in a view. |

More answers in [Troubleshooting & FAQ](./troubleshooting.md).

---

## See also

- [Supabase demo](https://svgrid.com/#/demos/194-studio-supabase) - this guide, live
- [Databases](./databases.md) - the SQL sources and dialects
- [Data binding](./data-binding.md) - the `ServerDataSource` contract
- [Getting started](./getting-started.md) - the page code, end to end
