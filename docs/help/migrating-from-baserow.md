# Migrating from Baserow

Baserow is an app your team signs into; outside it, a view shows up only as
a read-only iframe. [SvGrid Base](./base/start.md) is the same kind of table
database shipped as a Svelte 5 component. The records go into tables in your
own database, `<SvBase>` renders editable views inside your app, and every
change is written back to those tables.

> Estimated effort: **1-3 hours** per database, plus the time to rebuild
> its automations.

<!-- facts:start baserow -->
> **Facts, checked 14 Oct 2026.** `@svgrid/grid` 3.0.3, MIT, last published 11 Sep 2026, 16,900 npm downloads in the 30 days to 10 Sep 2026. Baserow pricing, as its site states it: Baserow's self-hosted open-source edition is free with unlimited rows. baserow.io/pricing lists Premium at $10 per user per month billed yearly ($12 monthly), Advanced at $18 per user per month billed yearly ($22 monthly) and Enterprise on request, at the same prices on cloud and self-hosted; cloud Free is $0 with 3,000 rows per workspace (https://baserow.io/pricing, read 14 Oct 2026). SvGrid: SvGrid Base ships in Enterprise Suite of @svgrid/enterprise, $999 per developer per year, unlimited apps and end users; the grid it runs on is MIT. Side by side, with sources: [SvGrid vs Baserow](https://svgrid.com/compare/baserow/).
<!-- facts:end -->

## Two starting points

- **Your data was synced in from your own PostgreSQL.** Baserow's
  PostgreSQL data sync copies a table you own into Baserow. Skip the export:
  point the base at the source tables (step 3) and they open with their
  foreign keys as links.
- **Your data lives in Baserow.** Baserow's own tables belong to Baserow.
  Export each one and load it into tables of yours, as below.

## What maps to what

| Baserow | SvGrid Base |
| --- | --- |
| A database | A `<SvBase tables>` with one tab per table |
| A table | A table in your database, opened as a `BaseTable` |
| A view | A `FieldView`: `grid`, `kanban`, `calendar`, `gallery`, `chart` or `form` |
| An automation | An automation in the view bar, or `createAutomationServer` on your server |
| Workspace roles | Your app's login, and `authorize` on the endpoint |
| Row comments | `setRecordComments`, stored where your app stores them |
| An application builder page | Your own Svelte page around the base |

| Baserow field | `fieldType` |
| --- | --- |
| Single line text, long text | `text`, `longText` |
| Link to table | `link` |
| Lookup, rollup, count | `lookup`, `rollup`, `count` |
| Formula | `formula` |
| Number, rating, duration | `number`, `rating`, `duration` |
| Boolean | `checkbox` |
| Date | `date` |
| Created on, last modified | `createdTime`, `lastModifiedTime` |
| Created by, last modified by | `createdBy`, `lastModifiedBy` |
| Collaborator | `user` |
| File | `attachment` |
| Single select, multiple select | `singleSelect`, `multiSelect` |
| Autonumber | `autoNumber` |
| URL, email, phone number | `url`, `email`, `phone` |
| Button | `button` |
| UUID | `text`, or the table's key |
| Password | none: passwords belong to your app's login |
| AI prompt | none: an automation action you register with `registerAutomationAction` |

Baserow formulas name fields in square brackets (`[Quantity] * [Unit Price]`);
SvGrid Base names them in braces (`{Quantity} * {Unit Price}`). Change the
brackets and paste the formula into the field editor. A function the base
does not have shows `#ERROR` and is named in the editor, so you rewrite
that part.

## 1. Export each table

In each table, export the grid view as CSV with every field shown and no
filter. Open one file and look at how the link columns came out: the next
step matches the linked rows they name back to keys.

## 2. Load the tables into your database

Create a table per Baserow table, with a key the database makes, load the
CSV, and turn the link text into foreign keys and pairing tables. The SQL is
the same as for any other CSV export:
[Load the tables into your database](./migrating-from-airtable.md#2-load-the-tables-into-your-database)
walks through it, a link to one record and a link to many.

## 3. Open the database as a base

```ts
// src/routes/api/base/+server.ts
import { createBaseEndpoint } from '@svgrid/enterprise/base'

// Your database driver: run parameterized SQL, return the rows.
declare function query(sql: string, params: unknown[]): Promise<Record<string, unknown>[]>

export const { GET, POST } = createBaseEndpoint({ execute: query })
```

```svelte
<!-- src/routes/base/+page.svelte (with `export const ssr = false` in +page.ts) -->
<script lang="ts">
  import { SvToaster } from '@svgrid/grid'
  import { SvBase, baseFromEndpoint, enableBase } from '@svgrid/enterprise/base'

  enableBase()
  const tables = baseFromEndpoint('/api/base')
</script>

{#await tables then tables}
  <SvBase {tables} editable sortable columnAdder fieldMenu />
{/await}
<SvToaster />
```

Foreign keys become links with a field on the other side that links back,
pairing tables become links to many records, and a text column that repeats
a few values becomes a single select with a color per value. See
[what it reads from your database](./base/quick-start.md#what-it-reads-from-your-database).

## 4. Views, automations and access

Recreate the views you used, including the Kanban and calendar views that
were paid on Baserow:

```ts
import type { FieldView } from '@svgrid/enterprise/base'

const views: FieldView[] = [
  { id: 'all', name: 'All rows', type: 'grid', color: { mode: 'field', field: 'status' } },
  { id: 'board', name: 'Board', type: 'kanban', stackBy: 'status' },
  { id: 'due', name: 'Due dates', type: 'calendar', dateField: 'due' },
]
```

Automations take the triggers you know (a record created or changed, a
condition, a form, a button, a schedule) and update records, create
records, call webhooks or send email; see [Automations](./base/automations.md).
Roles move into the endpoint's `authorize`, or into row level security on
Supabase.

## What you give up

- Workspaces, roles and the sharing screen. Access rules live in your
  server or database.
- The application builder. The screens around the base are your own
  Svelte pages.
- Long row change history and audit logs kept for you. The record shows the
  changes made in the session, and the endpoint's `audit` hook can log every
  write.
- File import, AI fields and the AI assistant inside the tool.

SvGrid Base is part of the Suite edition of `@svgrid/enterprise` ($999 per
developer). It runs without a key during an evaluation, with a watermark.

## See also

- [SvGrid vs Baserow](https://svgrid.com/compare/baserow/): the side-by-side comparison with sources.
- [Keep a base in a database](./base/data.md): how the writes, links and realtime work.
- [Ready-to-use bases](./base/templates.md): templates to start from.
- [Field types](./fields.md): every type and its properties.
