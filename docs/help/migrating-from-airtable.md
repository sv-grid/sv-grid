# Migrating from Airtable

Airtable is a cloud service: the base, its views and its records live on
Airtable, and the most you can put in your own app is a read-only iframe.
[SvGrid Base](./base/start.md) is the same kind of table database shipped
as a Svelte 5 component. The records move into your own database, `<SvBase>`
renders the views inside your app, and every edit goes back to your tables.

> Estimated effort: **half a day** for a typical base, plus the time to
> rebuild its automations.

<!-- facts:start airtable -->
> **Facts, checked 14 Oct 2026.** `@svgrid/grid` 3.0.3, MIT, last published 11 Sep 2026, 16,900 npm downloads in the 30 days to 10 Sep 2026. Airtable pricing, as its site states it: Airtable Free has no cost. airtable.com/pricing lists Team at $20 per seat per month billed annually ($24 monthly) and Business at $45 per seat per month billed annually ($54 monthly); Enterprise Scale pricing is custom. Read-only collaborators are not charged on Team or Business (https://airtable.com/pricing, read 14 Oct 2026). SvGrid: SvGrid Base ships in Enterprise Suite of @svgrid/enterprise, $999 per developer per year, unlimited apps and end users; the grid it runs on is MIT. Side by side, with sources: [SvGrid vs Airtable](https://svgrid.com/compare/airtable/).
<!-- facts:end -->

## What maps to what

| Airtable | SvGrid Base |
| --- | --- |
| A base | A `<SvBase tables>` with one tab per table |
| A table | A table in your database, opened as a `BaseTable` |
| A linked record field | A foreign key (link to one) or a junction table (link to many) |
| A view | A `FieldView`: `grid`, `kanban`, `calendar`, `gallery`, `gantt`, `chart` or `form` |
| An automation | An automation in the view bar, or `createAutomationServer` on your server |
| Collaborators and permissions | Your app's login, and `authorize` on the endpoint |
| Comments | `setRecordComments`, stored where your app stores them |
| An interface | Your own Svelte page around the base |

Field types carry over almost one to one:

| Airtable field | `fieldType` |
| --- | --- |
| Single line text | `text` |
| Long text | `longText` (with `richText` for bold, italic, links and lists) |
| Attachment | `attachment` |
| Checkbox | `checkbox` |
| Single select, multiple select | `singleSelect`, `multiSelect` |
| User | `user` |
| Date | `date` |
| Phone number, email, URL | `phone`, `email`, `url` |
| Number, currency, percent | `number` with `format: 'integer'`, `'currency'` or `'percent'` |
| Duration | `duration` |
| Rating | `rating` |
| Formula | `formula` |
| Lookup, rollup, count | `lookup`, `rollup`, `count` |
| Created time, last modified time | `createdTime`, `lastModifiedTime` |
| Created by, last modified by | `createdBy`, `lastModifiedBy` |
| Autonumber | `autoNumber` |
| Barcode, button | `barcode`, `button` |
| Linked record | `link` |

Formulas use the same shape: fields by name in braces, `&` to join text,
and functions such as `IF`, `SWITCH`, `ROUND`, `DATEADD` and
`DATETIME_DIFF`. Paste each formula into the field editor; one that uses a
function the base does not have shows `#ERROR` and names it, and you
rewrite that part.

## 1. Export each table

In Airtable, open a grid view that shows every field and every record (no
filter, no hidden fields) and choose **Download CSV**. Do this for each
table. A linked record column comes out as text naming the linked records
rather than as record ids; open one file to see the exact form before the
next step turns those names back into links.

Attachment columns come out as URLs that Airtable expires after a few
hours. Download the files straight away and put them in your own storage,
or skip the column and move the files later.

## 2. Load the tables into your database

Create a table per Airtable table, with a key the database makes, and load
the CSV with a text column for each link. Postgres:

```sql
create table projects (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  status text,
  due date
);

create table tasks (
  id uuid primary key default gen_random_uuid(),
  task text not null,
  status text,
  budget numeric,
  project_name text,                    -- the CSV's "Project" column
  project_id uuid references projects(id)
);

\copy projects (name, status, due) from 'Projects-Grid view.csv' csv header
\copy tasks (task, status, budget, project_name) from 'Tasks-Grid view.csv' csv header
```

Then match the names to keys and drop the text column:

```sql
update tasks t set project_id = p.id
from projects p where p.name = t.project_name;

alter table tasks drop column project_name;
```

A link to many records becomes a table that pairs the two. Load the CSV's
list of names into a text column first (`tag_names` below; adjust the
separator to what the file holds), then:

```sql
create table task_tags (
  task_id uuid references tasks(id) on delete cascade,
  tag_id uuid references tags(id) on delete cascade,
  primary key (task_id, tag_id)
);

insert into task_tags (task_id, tag_id)
select t.id, g.id
from tasks t
cross join lateral unnest(string_to_array(t.tag_names, ', ')) as n(name)
join tags g on g.name = n.name;
```

Names must be unique for the match to be right. If two Airtable records
shared a primary value, give them distinct names before you export, or
match on another column.

## 3. Open the database as a base

One endpoint on your server reads the tables and serves them; the page
opens them. A foreign key becomes a link with a field in the other table
that links back, a pairing table a link to many records, and a text column
that repeats a few values a single select with a color per value
([what it reads](./base/quick-start.md#what-it-reads-from-your-database)).

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

[Build a base on Postgres](./base/postgres.md) is the same thing end to
end, and [From a database to an app](./base/quick-start.md) covers MySQL,
SQLite and Supabase.

## 4. Set the field types and views

The base guesses the types from the columns. Fix the ones it cannot know
(a percent, a rating, a user, a formula) and recreate the views you used:

```ts
import type { FieldView } from '@svgrid/enterprise/base'

const views: FieldView[] = [
  { id: 'all', name: 'All tasks', type: 'grid', color: { mode: 'field', field: 'status' } },
  { id: 'board', name: 'Board', type: 'kanban', stackBy: 'status' },
  { id: 'due', name: 'Due dates', type: 'calendar', dateField: 'due' },
  { id: 'request', name: 'Request a task', type: 'form' },
]
```

What you change in the app (field types, views, colors) comes back through
`onTablesChange`; store it and start from it next time. The records stay in
your database either way.

## 5. Rebuild the automations

Open **Automations** in the view bar. The triggers you know are there: a
record is created, a record changes, a record matches a condition, a form
is sent, a button is pressed, a scheduled time. The actions update the
record, create a record in any table, show a notice, color the record,
call a webhook or send an email. An Airtable script that calls an API
becomes a webhook action, or an action you register in code with
`registerAutomationAction`.

Automations that must run whoever made the change, or that hold secrets,
run on your server with `createAutomationServer`; see
[Automations on the server](./base/automations.md#on-the-server).

## 6. Users, permissions and comments

Your app's login replaces Airtable collaborators. List the people for user
fields with `setFieldUsers`, say who is signed in with `setCurrentUser`
(created by and last modified by read it), and decide who may read or write
what in the endpoint's `authorize`, or with row level security on Supabase.
Comments go through `setRecordComments` to wherever you keep them.

## What you give up

- The hosted service: someone adds `<SvBase>` to a Svelte app and runs the
  database it reads.
- Interfaces, Omni and the AI credits. The pages around the base are your
  own Svelte pages.
- Native mobile apps, and the list and inbox views.
- The permissions screen, sharing links and the long revision history.
  Access rules live in your server or database; the record shows the
  changes made in the session, and the endpoint's `audit` hook can log
  every write.

SvGrid Base is part of the Suite edition of `@svgrid/enterprise` ($999 per
developer). It runs without a key during an evaluation, with a watermark.

## See also

- [SvGrid vs Airtable](https://svgrid.com/compare/airtable/): the side-by-side comparison with sources.
- [Build a project tracker](./base/start.md): SvGrid Base step by step.
- [Ready-to-use bases](./base/templates.md): a CRM, a content calendar, a roadmap and more.
- [Field types](./fields.md): every type and its properties.
