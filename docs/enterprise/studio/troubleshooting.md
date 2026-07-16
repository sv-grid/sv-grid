# Troubleshooting & FAQ

Common issues and answers when building with SvGrid Studio.

## Troubleshooting

### The unlicensed watermark or "Unlock Pro" nudge shows

Studio is soft-gated. Set your license key once at app startup to remove both:

```ts
import { setLicenseKey } from '@svgrid/enterprise'
setLicenseKey(import.meta.env.VITE_SVPRO_KEY)
```

For the [MCP generator](./ai-generation.md), set `SVGRID_LICENSE_KEY` in the MCP
config env. See [licensing](../licensing.md).

### "Cannot find module 'pg'" (or mysql2 / mssql / better-sqlite3)

No database driver is bundled - install the one for your database:

```bash
npm i pg            # postgres / supabase
npm i mysql2        # mysql / mariadb
npm i mssql         # sql server
npm i better-sqlite3  # sqlite
```

### The database connection fails

- Check `DATABASE_URL` is set on the **server** (not client code).
- On serverless / edge, use a **pooler** URL (Supabase pooler on port `6543`,
  PgBouncer) - direct connections are scarce.
- Add SSL params if your provider requires them (`?sslmode=require`, or the
  driver's SSL option).

### My edits were overwritten after regenerating

Only the `svgrid:managed` regions are regenerated. Put custom code, imports, and
layout **outside** those markers and they survive. See
[Code generation](./code-generation.md).

### Columns don't fill the width, or a summary row appears

Add `fitColumns` to scale columns to the grid width, and
`enableRowSummaries={false}` to remove the aggregate footer (it is on by
default). The generated screens set both.

### Sorting / filtering / paging does nothing

Server mode needs three things wired: the `external*` switch, the matching
`on*Change` handler routed to the controller, and (for paging) `rowCount`. See
[Sorting, filtering & paging](./server-grid.md).

### The page-size dropdown shows the wrong number

The footer offers `10 / 25 / 50 / 100`. Start with a `pageSize` that matches one
of those so the select reflects the current size.

### Validation isn't firing

Validation runs on **submit**. Confirm the field has `required`, a `format` /
`min` / `pattern` constraint, or a `validate` function - see
[Edit forms & validation](./edit-forms.md). Read-only and primary-key fields are
never validated.

### The edit form covers the whole page in the designer preview

The default `presentation` is `drawer` (a full-height overlay). In an inline
preview, pass `presentation="inline"`.

### The MCP generator tools aren't available in my agent

Confirm `@svgrid/mcp` is in your agent's `mcpServers` config and **restart the
agent** so it reloads the server. See [AI generation](./ai-generation.md).

### Generated code doesn't compile

Run your project's check - `npx svelte-check`. The AI path compiles the page
before returning it; the CLI relies on your project's check as the final gate.

### Introspection missed a table or columns

`--from` (Drizzle) is a best-effort source parse. Pick a specific table with
`--table`, or refine the generated `EntitySchema` (types, enums, relations) in
the file or the [visual designer](./designer.md). For a live database, `--db`
reads the catalog directly and is more precise.

## Frequently asked questions

### Do I need a database to try Studio?

No. Scaffolding from a Drizzle schema starts [in-memory](./in-memory.md), so the
screen runs immediately. You can also run a real Postgres **entirely in the
browser** with [PGlite](https://pglite.dev) - point `createSqlDataSource`'s
`execute` at `db.query(text, params)`.

### Which databases are supported?

PostgreSQL, Supabase, MySQL / MariaDB, SQL Server, and SQLite out of the box, and
any other SQL client (or REST / GraphQL API) via a
[custom source](./rest-api.md). See [Databases](./databases.md).

### Is my data or schema sent anywhere?

No. There is no telemetry and no network call for licensing (validated locally).
The AI generator uses **your** model API key; your data never touches our
servers.

### Can I edit the generated code?

Yes - it is plain SvelteKit you own. Edit freely outside the `svgrid:managed`
markers and your changes survive regeneration.

### Does it work with my ORM / query builder?

Yes. `createSqlDataSource` takes a single `execute(text, params)`, so Drizzle,
postgres.js, better-sqlite3, mysql2, Kysely, and others all work.

### Is Studio free?

It is part of the Enterprise license and is soft-gated - it runs unlicensed with
a watermark for evaluation. See [pricing](https://svgrid.com/pricing).

## See also

- [SvGrid Studio overview](../studio.md) · [Databases](./databases.md) · [Deploying a Studio app](./deployment.md)
