# @svgrid/studio

Scaffold a full CRUD screen for SvelteKit from a **live database** or a
**Drizzle / Prisma schema** in **one command**.

```bash
# from a live database (PostgreSQL / Supabase / MySQL / SQL Server / SQLite)
npx @svgrid/studio add customers --db postgres --url "$DATABASE_URL"

# or from a schema file - a Drizzle schema.ts or a Prisma schema.prisma
npx @svgrid/studio add customers --from src/lib/db/schema.ts
npx @svgrid/studio add User      --from prisma/schema.prisma
```

That generates, into your SvelteKit app:

- `src/lib/customers.schema.ts` — the entity schema + row type
- `src/routes/api/customers/+server.ts` — the API route
- `src/routes/customers/+page.svelte` — a working screen: grid + edit panel, with
  search, server sort, pagination, and multi-select (optimistic) delete

Then:

```bash
npm run dev   # open /customers
```

## Connect to a database

Install the driver for your database, then point `--db` / `--url` at it. The CLI
reads the table's columns from the catalog and wires the generated route to that
driver. No driver is bundled.

| Database | Install | Flag |
| --- | --- | --- |
| PostgreSQL | `pg` | `--db postgres` |
| Supabase | `pg` | `--db supabase` |
| MySQL / MariaDB | `mysql2` | `--db mysql` |
| SQL Server | `mssql` | `--db mssql` |
| SQLite | `better-sqlite3` | `--db sqlite` |

```bash
npm i pg
npx @svgrid/studio add --all --db postgres --url "$DATABASE_URL"   # every table
npx @svgrid/studio add todos --db sqlite --url ./data.db           # one table
```

## Scaffold the whole app from your schema

`--all --from` reads **every** table/model in a schema file and generates a
screen for each, plus a nav layout and home page. Foreign keys are followed
across the file - a Drizzle `.references()` or a Prisma `@relation` becomes a
searchable lookup, and enums become select fields:

```bash
npx @svgrid/studio add --all --from src/lib/db/schema.ts   # every Drizzle table
npx @svgrid/studio add --all --from prisma/schema.prisma   # every Prisma model
```

## Options

```
svgrid-studio add <name> [--from <schema> | --db <dialect> --url <conn>] [options]

  --from <path>    Drizzle (.ts) or Prisma (.prisma) schema file to introspect
  --db <dialect>   Connect to a live database (postgres|supabase|mysql|mssql|sqlite)
  --url <conn>     Connection string / file path for --db
  --all            Scaffold a screen for every table/model (with --from or --db)
  --table <name>   Which table/model to use (defaults to <name>)
  --sql            Use createSqlDataSource with an execute() stub (instead of a driver)
  --route <seg>    Route segment (default: <name> / table name)
  --api <path>     API route path (default: /api/<route>)
```

With `--db`, the generated route is fully connected to that driver via
`process.env.DATABASE_URL`. With `--from` (no `--db`) it starts in-memory so the
screen runs immediately; add `--sql` for a `createSqlDataSource` stub you fill
in with any client (Drizzle `db.execute`, postgres.js, better-sqlite3, mysql2).

## Regeneration is safe

Re-running `add` replaces only the `svgrid:managed` regions of each file — your
edits outside those markers are preserved.

## Requires

`@svgrid/grid` and `@svgrid/enterprise` in your project. The Studio is part of the
**Enterprise** license (soft-gate: it works unlicensed, with a nudge). See
[licensing](https://svgrid.com/pricing).
