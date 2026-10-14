---
"@svgrid/enterprise": minor
---

SvGrid Base: keep a base in a database. A `BaseTable` with a `source` loads
its records from it and writes every change back.

```ts
import { baseSource } from '@svgrid/enterprise/base'

source: baseSource(createSupabaseDataSource({ client, table: 'tasks', schema }), {
  links: { project: { column: 'project_id' } },
  realtime: (onChange) => createSupabaseRealtime({ client, table: 'tasks', onChange }),
})
```

- `baseSource(dataSource, options)` wraps any data source with the grid's
  contract: Supabase, SQL (`createSqlDataSource`), a SvelteKit endpoint
  (`createKitDataSource`), REST, in memory, or your own.
- After each change the base sends an `INSERT` for a new record, an
  `UPDATE` with only the fields that changed, or a `DELETE`, one at a time
  and in order. Formula, lookup, rollup and count fields and the field that
  links back are never written.
- A link to one record is a foreign key column (`{ column }`), a link to
  many records a junction table (`{ through, from, to }`). The field that
  links back is worked out in the page.
- A refused write puts the cell back; the end of the tab bar and a notice
  say why. The tab bar also says when the base is loading or saving, and
  when a table has more records than `limit` (10,000 by default).
- `serverIds: true` for keys the database makes: the page keeps its own id
  for a new record and writes to the database id from then on.
- `realtime`: the base reads a table again when it changed elsewhere and
  takes what moved, without writing it back.
- `baseTablesFromSchemas(schemas, sourceFor)` makes base tables from
  `EntitySchema`s (`introspectSupabaseTable`, `introspectDatabase`,
  `introspectOpenApi`): enums become single selects, foreign keys links with
  a field that links back. `baseFieldsFromSchema` does one table.
- `createRestDataSource`: a refused write's error now carries the endpoint's
  own `{ error }` or `{ message }` text.
- A duplicated table no longer shares the source of the table it copies.
- A record added from a Kanban lane, a calendar day, a Gantt day or "+ Add
  row" gets an id when the table's records carry one. Two such records
  used to share no id at all, and a grid keyed on `id` saw them as one.
