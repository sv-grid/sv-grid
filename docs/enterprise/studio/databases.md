# Databases

Studio connects directly to your relational database, reads a table's columns
from the catalog, and scaffolds a connected CRUD screen. Supported:
**PostgreSQL, Supabase, MySQL / MariaDB, SQL Server, SQLite**.

![The generated CRUD screen over a database table.](/docs-media/studio-crud.png)

## How it works

1. You install the driver for your database (no driver is bundled).
2. `npx @svgrid/studio add <table> --db <dialect> --url <conn>` reads the table's
   columns - types, primary key, `NOT NULL`, and **foreign keys** - into an
   `EntitySchema`. FK columns become `relation` fields ([Relations](./relations.md)).
3. It generates three files; the API route is wired to that driver via
   `process.env.DATABASE_URL`.

| Database | Install | `--db` | Placeholders |
| --- | --- | --- | --- |
| PostgreSQL | `pg` | `postgres` | `$1` + `ILIKE` |
| Supabase | `pg` | `supabase` | `$1` + `ILIKE` |
| MySQL / MariaDB | `mysql2` | `mysql` | `?` |
| SQL Server | `mssql` | `mssql` | `@p1` |
| SQLite | `better-sqlite3` | `sqlite` | `?` |

The generated `+server.ts` uses [`createSqlDataSource`](#the-generated-code),
which turns the grid's sort / filter / page request into safe, **parameterized**
SQL (values are always bound; identifiers come from the schema-whitelisted plan).

---

## PostgreSQL

```bash
npm i pg
export DATABASE_URL="postgres://user:pass@localhost:5432/app"
npx @svgrid/studio add customers --db postgres --url "$DATABASE_URL"
npm run dev
```

Connection string parts: `postgres://USER:PASSWORD@HOST:PORT/DATABASE`.

### The generated code

`src/routes/api/customers/+server.ts`:

```ts
import pg from 'pg'
import { createKitHandlers, createSqlDataSource } from '@svgrid/enterprise'
import { customersSchema, type CustomersRow } from '$lib/customers.schema'

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL })
const source = createSqlDataSource<CustomersRow>({
  schema: customersSchema,
  table: 'customers',
  dialect: { placeholders: '$', ilike: true },
  execute: async (text, params) => (await pool.query(text, params)).rows,
})
export const { POST } = createKitHandlers({ schema: customersSchema, source })
```

---

## Supabase

> **Step-by-step walkthrough:** see the dedicated **[Supabase guide](./supabase.md)** -
> create the table, set up Row-Level Security, and connect from the browser or a
> SvelteKit server route. It matches the
> [live Supabase demo](https://svgrid.com/demos/194-studio-supabase/).

Supabase is Postgres, so use the same `pg` driver with your Supabase connection
string. In the Supabase dashboard: **Project Settings -> Database -> Connection
string**. For serverless / edge, use the **connection pooler** URL (port `6543`).

```bash
npm i pg
export DATABASE_URL="postgres://postgres.[ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres"
npx @svgrid/studio add customers --db supabase --url "$DATABASE_URL"
```

The generated route is identical to PostgreSQL above.

### With the `supabase-js` client (RLS + auth)

Prefer the Supabase client so row-level security and auth are enforced per
user? Use `createSupabaseDataSource` from the browser - no server route at all.
The **[Supabase guide](./supabase.md)** is the canonical walkthrough for that
path (keys, RLS policies, and the ready-made source); this page only covers the
connection-string route above.

---

## MySQL / MariaDB

```bash
npm i mysql2
export DATABASE_URL="mysql://user:pass@localhost:3306/app"
npx @svgrid/studio add customers --db mysql --url "$DATABASE_URL"
```

Generated route:

```ts
import mysql from 'mysql2/promise'
import { createKitHandlers, createSqlDataSource } from '@svgrid/enterprise'
import { customersSchema, type CustomersRow } from '$lib/customers.schema'

const pool = mysql.createPool(process.env.DATABASE_URL ?? '')
const source = createSqlDataSource<CustomersRow>({
  schema: customersSchema,
  table: 'customers',
  execute: async (text, params) => {
    const [rows] = await pool.query(text, params)
    return rows as Record<string, unknown>[]
  },
})
export const { POST } = createKitHandlers({ schema: customersSchema, source })
```

---

## SQL Server

```bash
npm i mssql
npx @svgrid/studio add customers --db mssql \
  --url "Server=localhost;Database=app;User Id=sa;Password=Your_Pass;Encrypt=true;TrustServerCertificate=true"
```

The generated route uses the `mssql` package with `@p1` placeholders (bound as
`p1`, `p2`, ...) and reads its connection from `process.env.DATABASE_URL`.

---

## SQLite

```bash
npm i better-sqlite3
npx @svgrid/studio add todos --db sqlite --url ./data.db
```

`--url` is the database file path. The generated route opens it with
`better-sqlite3` (synchronous, no pool).

## Turso (libSQL)

[Turso](https://turso.tech) is hosted SQLite (libSQL) over HTTP - it runs on
serverless and edge where a socket driver can't. The generated route uses the
`@libsql/client` and reads two env vars:

```bash
DATABASE_URL="libsql://<db>-<org>.turso.io"
DATABASE_AUTH_TOKEN="<your-db-token>"
```

```ts
import { createClient } from '@libsql/client'
const client = createClient({ url: env.DATABASE_URL ?? '', authToken: env.DATABASE_AUTH_TOKEN })
// createSqlDataSource execute:
execute: async (text, params) => (await client.execute({ sql: text, args: params })).rows,
```

## Connect a database in the designer

Prefer clicking to typing CLI flags? The **local** designer (`npx @svgrid/studio
designer`) has a **Connect database** wizard that does the same job visually:

1. **Pick a dialect** (PostgreSQL / MySQL / SQL Server / SQLite / Supabase /
   Turso) and enter the connection. A guided form collects host, port, database,
   user, password, and SSL and assembles the string for you - or paste a full
   connection string on the string tab. For MySQL that string is
   `mysql://user:pass@host:3306/db`; passwords and every credential stay
   server-side and go only to `.env`.
2. **Test connection** proves it works and shows the real row count per table.
3. **Pick tables**, and hit **Preview** on any of them to see actual rows before
   you import - a quick way to confirm you're pointed at the right database.
4. **Add entities** reads the chosen tables' columns (types, primary key, foreign
   keys) into schemas and binds each to its SQL table.

Missing the driver? When a connect or preview fails because `pg` / `mysql2` /
`mssql` / `better-sqlite3` isn't installed, the wizard offers a **one-click
install** (it runs your project's package manager) and retries.

Already have entities? Open a SQL entity's **Configure** builder, paste a
connection string (the dialect is auto-detected), set the **Schema** (Postgres
search path, default `public`), and **Preview data** to load real rows onto the
canvas.

> **Online vs. local.** Live connect / test / preview need the local designer,
> because a browser can't reach a raw SQL database and the driver is a server-side
> package. In the **online** designer you bind the entity (dialect + table +
> schema) and **Generate app** - the app connects for real at runtime via
> `DATABASE_URL`. Want a live database inside the online designer? Use
> **[Supabase](./supabase.md)** or the **[Local database](./local-database.md)**.

## One-click hosted database (from the designer)

Don't have a database yet? The designer's **Get a database** button provisions one
without leaving the flow: pick **Neon** (serverless Postgres), **Supabase**
(Postgres + auth), or **Turso** (edge SQLite). It opens the provider's one-click
"create a free database" page and **binds every entity to the right dialect**, so
**Generate app** emits a connected `/api` route per entity. Paste the connection
string into `.env` - the bundle ships a **`.env.example`** listing exactly which
vars each dialect needs (`DATABASE_URL`, plus `DATABASE_AUTH_TOKEN` for Turso).

Prefer zero setup? Bind to the **[Local database](./local-database.md)** (PGlite) -
a real, persistent Postgres in the browser with no account and no connection
string, and switch to a hosted one later without touching the schema.

---

## Postgres in the browser (PGlite)

You can even run **real Postgres entirely in the browser** with
[PGlite](https://pglite.dev) - a WASM build of Postgres, under 3 MB. No server,
no connection string. Point `createSqlDataSource`'s `execute` at PGlite's
`query`:

```ts
import { PGlite } from '@electric-sql/pglite'
import { createSqlDataSource } from '@svgrid/enterprise'

const db = new PGlite() // in-memory; use `new PGlite('idb://app')` to persist
await db.exec('CREATE TABLE customers (id serial primary key, name text, email text)')

const source = createSqlDataSource<Customer>({
  schema: customersSchema,
  table: 'customers',
  dialect: { placeholders: '$', ilike: true },
  execute: async (text, params) => (await db.query(text, params)).rows,
})
```

Every sort, filter, page, and edit runs actual parameterized SQL against the
in-browser Postgres. Great for demos, offline / local-first apps, and tests.

![The live-SQL demo: a real Postgres in the browser, showing the executed query.](/docs-media/studio-live-sql.png)

> **Live demo:** [Data-app Studio · live SQL](https://svgrid.com/demos/193-studio-live-sql/) -
> a full CRUD screen over PGlite; watch the SQL update as you sort and filter.

---

## Scaffold every table at once

```bash
npx @svgrid/studio add --all --db postgres --url "$DATABASE_URL"
```

This lists the base tables and generates a screen (and route) for each.

## Notes

- **Schema drift**: re-run `add` after a migration - only the `svgrid:managed`
  regions regenerate, so your customizations survive.
- **Types**: catalog types map to grid types automatically (int/numeric ->
  number, bool/bit -> boolean, timestamp -> datetime, date -> dateString, json ->
  json, else text). Refine anything in the schema file or the
  [visual designer](../studio.md#three-ways-to-build).
- **Non-default schema**: to read a table outside the default namespace (Postgres
  `public`, SQL Server `dbo`), pass **`dbSchema`** to `createSqlDataSource` - the
  table is then addressed as `"schema"."table"`, each part quoted separately:
  ```ts
  createSqlDataSource({ schema: ordersSchema, table: 'orders', dbSchema: 'analytics', /* ... */ })
  ```
  In the designer, set the SQL builder's **Schema** field and it emits this for you.
- **Security**: reads and writes are fully parameterized; the table name and
  columns come from the schema, never from request input.

## Common gotchas

| Symptom | Cause and fix |
| --- | --- |
| **`Cannot find module 'pg'`** (or `mysql2` / `mssql` / `better-sqlite3` / `@libsql/client`) | No driver is bundled - install the one for your dialect (see the table above). |
| **Turso: `The authenticated user is not authorized`** | `DATABASE_AUTH_TOKEN` is missing or expired - mint a fresh DB token and set both it and the `libsql://` `DATABASE_URL` in the server env. |
| **Grid empty, server logs a connection error** | `DATABASE_URL` is not set in the **server** environment (not client code, not `PUBLIC_`). Set it in your host's env. |
| **Numbers arrive as strings** | Postgres `numeric` comes back as text over some drivers. Use `integer` / `bigint` for numeric columns, or cast in a view. |
| **Works locally, times out on Vercel / Netlify** | Serverless functions exhaust direct connections. Use a **pooler** URL (Supabase port `6543`, PgBouncer) and keep the pool small - see [Deployment](./deployment.md#connection-pooling). |
| **`SSL required` / self-signed cert** | Add SSL to the pool (`ssl: { rejectUnauthorized: false }` for managed hosts) or the connection string's `sslmode`. |
| **A column is missing from the grid** | Re-run `add` after a migration - only the `svgrid:managed` regions regenerate, so new columns come in and your edits survive. |

## See also

- [Data binding](./data-binding.md) - the underlying contract
- [Drizzle schema](./drizzle.md) · [REST & custom APIs](./rest-api.md) · [In-memory](./in-memory.md)
