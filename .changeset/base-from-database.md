---
"@svgrid/enterprise": minor
---

SvGrid Base from a database you already have, in one call.

- `baseFromDatabase({ execute })` reads every table of a SQL database
  (Postgres, MySQL, SQLite, SQL Server, PGlite) and returns the tables
  `<SvBase>` takes, each on a source that writes edits back.
- `createBaseEndpoint({ execute })` serves them from a SvelteKit route
  (`GET` describes, `POST ?table=` reads and writes, only the tables it
  described are reachable; `authorize` and `audit` per table), and
  `baseFromEndpoint('/api/base')` reads them in the page.
- `baseFromSupabase({ client, url, key })` does the same for a Supabase
  project, with Realtime.
- What it infers: field types from column types and names (email, url,
  phone, long text, currency, rating), single selects with colors from the
  values a text column repeats, links from foreign keys with a field that
  links back, a link to many from a junction table, which keys the database
  makes, the primary field, the table order, and a grid, Kanban and calendar
  view per table.
- `describeDatabase`, `baseSpecFromSchemas` and `baseTablesFromSpec`: the
  same as JSON-safe specs, for apps that send them or adjust them first.
