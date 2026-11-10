# Formulas on a server

A base works out its formulas, lookups, rollups and counts in the page and
never stores them. An API, an AI chat or a nightly report that reads the
database sees the stored fields only: a deal with no margin, a project with no
hours. `@svgrid/enterprise/base/compute` works them out where you need them,
with the same engine the grid uses, so the server sees the values people see.

> SvGrid Base is part of the **Suite edition** of `@svgrid/enterprise`. Without a key it runs with a watermark.

It imports no Svelte and touches no DOM. It runs in Node, Deno, Bun and a
Cloudflare Worker.

```ts
import { computeRecords } from '@svgrid/enterprise/base/compute'

// The tables as <SvBase tables> keeps them: columns with field types, and records.
const tables = await loadBase(db)

const projects = computeRecords(tables, 'projects')
// [{ id: 'p1', name: 'Website', tasks: ['t1', 't2'], hours: 40, rate: 25, ... }]
```

Each record comes back as a copy, with every formula, lookup, rollup and count
set. The stored records are not changed.

## What it works out

| Field type | Value |
|---|---|
| `formula` | The formula's result, before its number or date format is applied. A formula that names itself is `'#ERROR'`; one not written yet is `null`. |
| `lookup` | A list: the field of each linked record, in the link's order. A lookup of a computed field in the other table reads its computed value. |
| `rollup` | The aggregation (`SUM`, `AVERAGE`, `MIN`, `MAX`, `COUNT`, `COUNTA`, `COUNTALL`, `ARRAYJOIN`, `ARRAYUNIQUE`, `CONCATENATE`, `AND`, `OR`) over the linked records. |
| `count` | How many records the link points at. |

A formula reads a rich text field as its words (`LEN({Notes})` counts letters,
not tags), as it does in the grid. A rollup of rollups that point back at each
other stops after a few steps instead of looping, as in the grid.

The values match the grid's: the test suite works out a base both ways, record
by record, and compares them.

## Records that are not in the table yet

Pass the records to work out, against the rest of the base. Useful for a
record about to be saved, or one page of a large table:

```ts
import { computeRecord, computedValues } from '@svgrid/enterprise/base/compute'

const draft = { id: 'p9', name: 'Draft', budget: 900, tasks: ['t4'] }
computeRecord(tables, 'projects', draft)                      // draft + every computed field
computeRecord(tables, 'projects', draft, { fields: ['Rate'] }) // just Rate (a key or a name)
computedValues(tables, 'projects', draft)                     // { hours: 8, rate: 112.5, ... }
```

## Saving the results

The base does not store computed values: they change when a linked record
does. When a database view, a search index or a report needs them as columns,
write them yourself from the server, after each change:

```ts
import { computedValues } from '@svgrid/enterprise/base/compute'

for (const row of changedRows) {
  await db.update('projects').set(computedValues(tables, 'projects', row)).where({ id: row.id })
}
```

A change to a task changes the rollups of its project, so work out the
records that link to what changed too, not only the changed records.

## A view's filter on the server

`evaluateFilter` tests one record against a view's filter, the
`advancedFilter` the view bar writes. `filterRecords` keeps the records of a
table that pass it:

```ts
import { filterRecords, evaluateFilter } from '@svgrid/enterprise/base/compute'

const view = tables[0].views.find((v) => v.id === 'mine')
const mine = filterRecords(tables, 'tasks', view.state.advancedFilter, { me: user.id })

evaluateFilter(view.state.advancedFilter, record, { tables, tableId: 'tasks', me: user.id })
```

With `tables` and `tableId`, a condition on a formula, lookup or rollup reads
its value, and one on a link field reads the linked records' names, as the
view bar does. `me` is who "me" is in a person condition ("Assignee is me");
without it, those conditions match no one. `now` sets "today" for date
conditions.

## Answer a paged table

A table on `baseSource(ds, { serverRows: true })` sends its grid's requests to
`ds.getRows`: a block of rows, the view's filter in `filterModel.expression`,
the sort, the groups. The other views send the same requests: a lane of a board
is the records under one group key, a day of a calendar is a date condition in
the filter, and a chart or a dashboard asks for totals (`aggregations`, per
group, and `needsGrandTotal` for the whole result). `queryRecords` answers them
over records a server holds, with the base's rules: a filter or sort on a
formula reads its value, a select sorts in its option order, a link is searched
by its records' names. Pass the linked tables with their records: a key to a
record the linked table does not hold reads as empty in a filter, a group and a
sort, as a record in the trash does in the page. Left out, a link has no names
to group, sort or search by, and "is empty" means no key stored. A count from
the other side of a link (`groupRawKeys`) groups by the stored id either way.

```ts
import { queryRecords } from '@svgrid/enterprise/base/compute'

// A SvelteKit endpoint the data source posts its requests to.
export const POST = async ({ request, locals }) => {
  const tables = await loadBase(db)
  return Response.json(queryRecords(tables, 'orders', await request.json(), { me: locals.user.id }))
}
```

It returns `{ rows, rowCount, appliedExpression }`. A grouped request gets one
row per key with `childCount`, then the records under an opened key.

## The view's filter in SQL

For records in a database, `fieldFilterToSql` turns the view's filter into a
`WHERE` clause with its parameters:

```ts
import { fieldFilterToSql, viewFilterOf } from '@svgrid/enterprise/base/compute'

const where = fieldFilterToSql(viewFilterOf(req.filterModel?.expression), { columns, columnNames: { dueDate: 'due_date' } })
if (where) {
  const rows = await sql.unsafe(`select * from tasks where ${where.sql} limit ${req.endRow - req.startRow} offset ${req.startRow}`, where.params)
  return { rows, rowCount, appliedExpression: true }
}
```

| Condition | Postgres |
|---|---|
| text contains, is, is not, is empty | `ILIKE`, `LOWER(col) = $1`, with `NULL` counted as empty |
| number =, ≠, <, >, ≤, ≥ | the operator; ≠ keeps empty cells, as the page does |
| checkbox | `col = true`, unchecked counting `NULL` |
| single select is, is any of, is none of | `=`, `IN (...)`, `NOT IN (...)` |
| multiple select has any, all, none, is exactly | `&&`, `@>`, `NOT &&`, `@> AND <@` on a `text[]` |
| date is, before, after, within | day comparisons on `col::date`, "today" from `now` |

`createSqlDataSource` applies a view's filter by itself. By hand, pass
`computed` to `fieldFilterToSql` so a condition on a computed field runs too.

## Computed fields in SQL

`computedSql` turns a formula, lookup, rollup or count into a SQL expression, so
a database can filter, sort, group and add up on it. A formula becomes
arithmetic and a lookup or rollup a subquery on the linked table. On a base,
`createSqlDataSource` does this for you; `baseSource` tells it the table's fields
and where its links lead.

It says what the page says or nothing at all. Blanks count as in a cell (0 in
arithmetic, '' in text), a division by zero is empty, half rounds up, and text
compares by code rather than by the database's collation. A formula it cannot
match gives `null`, and the page answers instead: it reads the table a block at a
time and works the field out with the code the cells use
([what the database cannot run](./data.md#what-the-database-cannot-run)). The table
below says which functions run in the database; the others give the same answer,
more slowly.

| | Postgres | MySQL | SQLite |
|---|---|---|---|
| Arithmetic, `&`, comparisons, `IF`, `SWITCH`, `AND`, `OR`, `NOT` | yes | yes | yes |
| `SUBSTITUTE`, `CONCATENATE`, `ROUND`, `INT`, `ABS`, `MAX`, `MIN` | yes | yes | yes |
| `YEAR`, `MONTH`, `DAY`, `WEEKDAY`, `DATEADD`, `DATETIME_DIFF` (days, weeks), `IS_BEFORE`, `IS_AFTER` | yes | yes | yes |
| `TRIM` | yes | no | yes |
| `LEN`, `FIND`, `SEARCH`, `POWER`, `SQRT` | yes | yes | no |
| `MOD` | no | yes | no |
| `UPPER`, `LOWER`, `LEFT`, `RIGHT`, `MID`, `FLOOR`, `CEILING`, `TODAY` | no | no | no |

The last row is deliberate. A database's text and float rules differ from a cell's
(`UPPER("straße")`, `FLOOR(4.35 * 100)`), and its `TODAY` is the server's day and
not the person's. `POWER` with a field as the exponent and `DATEADD` with a field
or a fraction as the amount stay in the page too. A text comparison between two
fields stays there on Postgres and SQLite.

```ts
import { computedSql } from '@svgrid/enterprise/base/compute'

const columns = [
  { field: 'amount', fieldType: 'number' },
  { field: 'qty', fieldType: 'number' },
  { field: 'total', fieldType: 'formula', fieldProps: { formula: '{amount} * {qty}' } },
]
const sql = computedSql(columns[2]!, { dialect: 'postgres', table: 'orders', key: 'id', columns })
```

On Supabase, `fieldFilterToPostgrest` writes the same filter as a PostgREST
logic tree for `query.or(...)`, and `supabaseFieldFilter(columns)` is the
`expression` hook of `createSupabaseDataSource` that applies it
([Supabase: a table of millions](./supabase.md#a-table-of-millions)).

`dialect: 'mysql'` or `'sqlite'` writes `?` placeholders and `LOWER(col)
LIKE`; a multiple select is not translated there. A condition on a formula,
lookup, rollup or count, a link matched by name, rich text, files, a checklist
or a time of day returns `null`: answer without `appliedExpression` (the grid
says so), or filter with `queryRecords`. "Me" in a person condition is
`me`.

## An AI tool that sees what people see

An MCP tool that answers "which projects are over budget" from the database
would see no `hours` and no `cost` without this. With it:

```ts
import { computeRecords, filterRecords } from '@svgrid/enterprise/base/compute'

server.tool('list_records', { table: z.string(), view: z.string().optional() }, async ({ table, view }) => {
  const tables = await loadBase(db)
  const filter = view ? tables.find((t) => t.id === table)?.views?.find((v) => v.id === view)?.state?.advancedFilter : null
  const rows = computeRecords(tables, table, filterRecords(tables, table, filter))
  return { content: [{ type: 'text', text: JSON.stringify(rows) }] }
})
```

## Reference

| Function | Returns |
|---|---|
| `computeRecords(tables, tableId, rows?, { fields? })` | The records (default: the table's `data`), each a copy with its computed fields set. |
| `computeRecord(tables, tableId, row, { fields? })` | One record, with its computed fields set. |
| `computedValues(tables, tableId, row, { fields? })` | Only the computed values, by field key. |
| `computedFields(table)` | The keys of the table's formula, lookup, rollup and count fields. |
| `evaluateFilter(filter, row, { tables?, tableId?, me?, now? })` | Whether the record passes the filter. An empty filter passes everything. |
| `filterRecords(tables, tableId, filter, { rows?, me?, now? })` | The records that pass, as stored. |
| `queryRecords(tables, tableId, request, { rows?, me?, now? })` | A grid request answered: `{ rows, rowCount, appliedExpression }`. |
| `fieldFilterToSql(filter, { columns, dialect?, columnNames?, me?, now?, firstParam? })` | `{ sql, params }`, or `null` when a condition cannot be SQL. |
| `viewFilterOf(expression)` | The view's filter in a request's `filterModel.expression`, or `null`. |
| `fieldFilterToPostgrest(filter, { columns, columnNames?, me?, now? })` | A PostgREST logic tree for `query.or()`, or `null`. |
| `supabaseFieldFilter(columns)` | The `expression` hook of `createSupabaseDataSource` for a base table. |

The module also exports the formula engine (`compileFormula`,
`FORMULA_FUNCTIONS`) and the rollup aggregations (`ROLLUPS`).

## Pitfalls

- **The tables are read on each call.** A server that adds records to `data`
  in place sees them on the next call. Load the linked tables too: a rollup
  over tasks needs the tasks.
- **Values are raw.** A currency formula returns `482000`, not `$482,000`; a
  lookup returns a list. Format them where you show them.
- **Created time and last modified time** are stored fields the page stamps,
  not computed ones. Your database keeps them.

## Next

- [Automations](./automations.md): the server runner, which acts on the same
  records.
- [Permissions](./permissions.md): what each person may do in the base.
- [Formulas](./formulas.md): every function a formula can use.
