# Migrating from NocoDB

NocoDB is an app your team signs into, and outside it a shared view shows up
only as an iframe. [SvGrid Base](./base/start.md) is the same kind of table
database shipped as a Svelte 5 component: `<SvBase>` renders the views
inside your own app, on your own database, and writes every change back.

> Estimated effort: **1-2 hours** per base on PostgreSQL or MySQL; more to
> rebuild workflows.

<!-- facts:start nocodb -->
> **Facts, checked 14 Oct 2026.** `@svgrid/grid` 3.0.3, MIT, last published 11 Sep 2026, 16,900 npm downloads in the 30 days to 10 Sep 2026. NocoDB pricing, as its site states it: NocoDB self-hosted Community is $0 under the Sustainable Use License. nocodb.com/pricing lists cloud Plus at $12 per seat per month billed annually ($15 monthly), Business at $24 per seat per month billed annually ($30 monthly), Scale at $45 per seat per month billed annually with 3 minimum seats, and Enterprise on request; self-hosted Business and Scale are priced the same per seat (https://nocodb.com/pricing, read 14 Oct 2026). SvGrid: SvGrid Base ships in Enterprise Suite of @svgrid/enterprise, $999 per developer per year, unlimited apps and end users; the grid it runs on is MIT. Side by side, with sources: [SvGrid vs NocoDB](https://svgrid.com/compare/nocodb/).
<!-- facts:end -->

## Two starting points

- **NocoDB was connected to your own PostgreSQL or MySQL.** The tables are
  already yours. Point the base at the same database (step 2) and you are
  most of the way there.
- **The tables live in NocoDB's own database.** Download each table as CSV
  (NocoDB also offers JSON and Excel), load it into tables of yours, and
  continue from step 2.
  [Load the tables into your database](./migrating-from-airtable.md#2-load-the-tables-into-your-database)
  has the SQL for the keys, a link to one record and a link to many.

## What maps to what

| NocoDB | SvGrid Base |
| --- | --- |
| A base | A `<SvBase tables>` with one tab per table |
| A table | A table in your database, opened as a `BaseTable` |
| A view | A `FieldView`: `grid`, `kanban`, `calendar`, `gallery`, `chart` or `form` |
| A workflow or webhook | An automation in the view bar, or `createAutomationServer` on your server |
| Roles | Your app's login, and `authorize` on the endpoint |
| Record comments | `setRecordComments`, stored where your app stores them |

| NocoDB field | `fieldType` |
| --- | --- |
| Single line text, long text | `text`, `longText` |
| Link to another record | `link` |
| Lookup, rollup | `lookup`, `rollup`; a rollup with the count function can be `count` |
| Formula | `formula` |
| Number, currency, percent | `number` with the matching `format` |
| Rating, duration | `rating`, `duration` |
| Checkbox | `checkbox` |
| Date | `date` (with `time: true` for a date and time) |
| Created time, last modified time | `createdTime`, `lastModifiedTime` |
| Created by, last modified by | `createdBy`, `lastModifiedBy` |
| User | `user` |
| Attachment | `attachment` |
| Single select, multi select | `singleSelect`, `multiSelect` |
| Barcode, button | `barcode`, `button` |
| Auto number | `autoNumber` |
| Email, URL, phone number | `email`, `url`, `phone` |

Paste each formula into the field editor. Fields go by name in braces
(`{Qty} * {Unit price}`); a function the base does not have shows `#ERROR`
and is named in the editor, so you rewrite that part.

## 1. Check the links

The base turns a foreign key into a link with a field on the other side
that links back, and a table that only pairs two others into a link to many
records. Look at the links you made in NocoDB: if one has no foreign key or
pairing table behind it in your database, add one before you open the base,
or that link will not appear.

## 2. Open the database as a base

```ts
// src/routes/api/base/+server.ts
import { createBaseEndpoint } from '@svgrid/enterprise/base'

// Your database driver: run parameterized SQL, return the rows.
declare function query(sql: string, params: unknown[]): Promise<Record<string, unknown>[]>

export const { GET, POST } = createBaseEndpoint({ execute: query })
```

For MySQL, pass `dialect: 'mysql'`; `tables` limits the base to the tables
you name.

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

## 3. Views, automations and access

Recreate the views you used:

```ts
import type { FieldView } from '@svgrid/enterprise/base'

const views: FieldView[] = [
  { id: 'all', name: 'All tasks', type: 'grid', color: { mode: 'field', field: 'status' } },
  { id: 'board', name: 'Board', type: 'kanban', stackBy: 'status' },
  { id: 'due', name: 'Due dates', type: 'calendar', dateField: 'due' },
]
```

Workflows become automations: a record created or changed, a condition, a
form, a button or a schedule sets them off, and they update or create
records, call webhooks and send email. Integration nodes (Slack, Gmail and
so on) become webhook calls or actions you register with
`registerAutomationAction`. See [Automations](./base/automations.md).

NocoDB's roles move into the endpoint's `authorize`, or into row level
security on Supabase.

## What you give up

- The roles screen and sharing links. Access rules live in your server or
  database.
- The long record revision history. The record shows the changes made in
  the session, and the endpoint's `audit` hook can log every write.
- Workflow integration nodes; they become webhooks and actions you write.
- A no-code setup path: someone adds `<SvBase>` to a Svelte app.

SvGrid Base is part of the Suite edition of `@svgrid/enterprise` ($999 per
developer). It runs without a key during an evaluation, with a watermark.

## See also

- [SvGrid vs NocoDB](https://svgrid.com/compare/nocodb/): the side-by-side comparison with sources.
- [From a database to an app](./base/quick-start.md): what the base reads from your database.
- [Keep a base in a database](./base/data.md): how the writes, links and realtime work.
- [Field types](./fields.md): every type and its properties.
