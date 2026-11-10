# Undo, the trash and importing files

Three things people reach for in their first week with a base: Ctrl+Z after
a slip, getting back a record someone deleted yesterday, and pulling in the
spreadsheet they kept until now. All three work on `<SvBase tables>` with no
setup; this page says what each one does and how an app keeps it.

> SvGrid Base is part of the **Suite edition** of `@svgrid/enterprise`. Without a key it runs with a watermark.

## Undo and redo

A step undoes what it did and nothing else: what teammates changed since stays, whether
the change came through a live feed or a read of the table. A cell someone changed after
you keeps their value, on undo and on redo, cell by cell in a paste, and a record you added
that someone has worked on since stays, and the page says so. Delete it if it should go.
For a range the page says how many: "Someone has changed 1 of these records since, so it
keeps their value." once all its blocks are written, or "1 of these cells" for a small range
undone cell by cell.
A cell undo on a table in a database reads the record first, with a live feed or without
one, so this holds for a change the page never saw; a date with a time is compared as the
page last heard of it. When the record cannot be read, or a write of it has not answered
yet, the undo is refused with a message and the step stays the next one to try. A number
the column rounded (1.234 in a column of two decimals) counts as what you typed. Moving a
record by drag is a step too.

On a table in a database one Undo or Redo runs at a time. While one is still checking or
writing, another press changes nothing and says "Undo is still running." (or "Redo is still
running."); the buttons show it busy, and leaving the page asks first. One that writes more
than one block (1,000 records, or 1,000 cells of a table the page holds) runs in the dialog a
big paste has, with its count and Stop: a range, Edit fields, a delete, the records a paste
added, and cells. Stopped, an Undo, or a Redo of cells or of added records, stays the next
step, and pressing it again writes only what is left; a Redo of a delete that is stopped
keeps the records it deleted, and Undo brings those back. A turn that writes a record the
view no longer shows is done when that write has answered. What an Undo or Redo did is said
once it is done, with the number it changed: cells someone else changed, records a teammate
restored first or that were deleted forever, records out of reach and writes the database
refused are not counted. A paste of cells the grid holds says its count the same way, once
the database has answered.

A record you add to a table read a part at a time has its "add record" step from the
moment its row is there. What you type into it is part of that step. An Undo before the
database has stored it waits for the insert, then takes the record out; a new record that
was never stored (left empty, or refused) just goes, with no Redo. Its activity starts
once it is stored: a refused record has none.

An undo or a redo puts values back. It runs no automation, and the row returns to its
place in the view at once.

An undo of a delete that fails (the network dropped, the database refused) leaves the
record in the trash and the step in place: press Ctrl+Z again, or restore it from the
trash.

Ctrl+Z (Cmd+Z on a Mac) undoes what was done to the shown table, in the
order it was done. Ctrl+Shift+Z or Ctrl+Y redoes it. The keys work anywhere
in the base, and also with nothing focused on the page (after a dialog
closes, or a click beside the base): then the base used last takes them. A
key typed in a field of your own page stays yours. One history holds:

- cell edits, pastes, fills and Edit fields on a selection, each one step however many
  cells it wrote (the grid's own history). Edit fields on more than 10,000 records of a
  table read a part at a time has no step: it says so and asks first. If it is stopped or
  fails with 10,000 or fewer changed, those have a step. A paste, Delete or fill over a large
  range goes the same way, and its undo reads and writes in blocks too;
- records added, deleted or imported from a file;
- fields added, changed (a new type, new options) or deleted;
- tables added, renamed, duplicated, deleted or imported from a file.

Undoing a deleted record puts it back at the place it had, and the links the
delete cleared come back too: delete a task and its project stops listing
it; undo, and the project lists it again. The step restores the records of
every table the change touched.

Undoing a deleted table brings it back as a tab, with its records and the
fields of other tables that linked to it, and takes it out of the trash.
Undoing a table you added takes it away again; the step lives on the new
table's history, so there is no redo once it is gone.

The Undo and Redo buttons at the end of the tab bar say what the next press
does ("Undo delete 2 records"). `undoRedo={false}` hides them; the keys still
work. Each table keeps its history while another table is shown, so going
back to a table carries on where you left it. View settings (a filter, a
sort) are not part of the history: a view keeps them as you leave it.

<div data-docs-demo="705-base-undo-redo" data-height="620"></div>

## Soft delete

Undo of a delete writes the record back. Point `softDelete` at a timestamp column and it
does not have to: a delete sets the column and leaves the row, and a restore clears it.
Nothing about the record is rewritten, so columns off the schema, exact times and big
numbers come back as they were, and what a teammate wrote before the delete stays.

```sql
ALTER TABLE orders ADD COLUMN deleted_at timestamptz;
```

```ts
const source = createSqlDataSource({ schema, table: 'orders', softDelete: 'deleted_at', dialect, execute })
```

`createSupabaseDataSource` takes the same option, and so do `createBaseEndpoint`,
`baseFromDatabase` and `baseFromSupabase`:

```ts
const endpoint = createBaseEndpoint({ execute, tables: ['orders', 'tags'], authorize, softDelete: 'deleted_at' })
```

Per table it is a function: `softDelete: (table) => (table === 'orders' ? 'removed_at' : null)`.

The string form skips a table without the column. The function form names a column that
must be there. Those three keep the column out of the fields. By hand, leave it off the
schema: no write sets it either way, so a client cannot create a record already deleted or
mark one through an update, and `createKitHandlers` answers `422` to an update of it alone.
Reads, counts, groups, totals, lookups and rollups skip marked records, and a write to one
is told the record is gone.

- The trash of a table with `softDelete` reads the table: every marked row is there, after
  a reload, for whoever may delete, whoever marked it. It lists the latest 1,000 per table
  and says how many there are. No trash store is needed for those records.
- A record's links through a junction table stay. A delete leaves the junction rows, at
  either end of the link, a marked record shows in no link, and a restore finds them.
- A foreign key in another table stays too. A delete writes nothing to that table, the
  record shows in no link while it is marked, and a restore finds its links where they were,
  whoever restores it and after any reload. A link a teammate changed in the meantime stays
  as they left it. While the record is marked the link reads as empty everywhere: "is empty"
  and "is not empty", one Empty group, sort, count and the link picker. The key stays in the
  column, so a query of your own still sees it. A link written to a marked record, from a
  picker opened before the delete, is stored, shows empty, and the person is told why.
- Delete forever and Empty trash are final. Each asks first, the item stays in the trash
  until the database has confirmed, and if it refuses (another table still needs the record)
  the person is told and the record can still be restored. In one Empty trash the others go.
  Junction rows go with the record, and the foreign keys that point at it are emptied with it,
  in the tables of this base: see [Delete forever is one step](#delete-forever-is-one-step). A
  `NOT NULL` key cannot be emptied, so the record stays and the person is told other records
  depend on it. A row itself marked deleted keeps its key: a foreign key constraint refuses
  the purge until that row has gone. Undo cannot bring a deleted record back, in that window
  or another. An undo to a link whose record was deleted forever says so, and offers no Try again.
- A trash item reaching `trashDays` is deleted for real only when the page's trash holds
  it, that is, when a trash store or `bind:trash` kept it. A row found marked in the table
  stays until someone deletes it, so opening a page never purges what another tool marked.
  For a limit on those, run it on a schedule:
  `DELETE FROM orders WHERE deleted_at < now() - interval '30 days'`.
- A delete too big for the trash marks and purges a block of 1,000 at a time. A page closed
  half way leaves at most the block under way marked, and it shows in the trash.
- A marked row still holds its value in a UNIQUE column, and still counts for a foreign key.
- On Supabase a delete is an UPDATE to row-level security, so write the policy as one.
- Autonumber reads the highest number over every row, marked ones too, on every source, so
  a marked record keeps its number and a new record takes the next.
- A trash store item from before `softDelete` was turned on has no mark to clear: Restore
  says it was deleted forever.

### Delete forever is one step

Emptying the keys that hold a record and deleting it are several writes. Which of them can
stop half way depends on how the base reaches the database:

| The base is on | Delete forever is |
|---|---|
| `createBaseEndpoint` with `transaction` | One request and one transaction: all of it or none of it |
| `createBaseEndpoint` without | One request: the server runs the steps, and a closed page changes nothing |
| `createKitHandlers` with `linkedFrom` | The same two, by whether the sources share a `transaction` |
| `baseFromDatabase` with `transaction` | One transaction, for the tables that share it |
| `createKitHandlers` without `linkedFrom`, `baseFromDatabase` without `transaction` | Steps the page runs, over several requests |
| Supabase and PostgREST | Steps the page runs. PostgREST has no transaction across requests |

Where it is steps, they are safe in this order. First the record's mark changes to
`1970-01-03`, which is a claim: from then on no Restore or undo reaches it, by any path.
Then the keys go, each only where it still holds this record, then the record. A failure
puts the keys back, only where a key is still empty, so a link a teammate made meanwhile
stays, and gives the claim up, with the mark set to that moment. If that fails too, or the
page closes, the claim stays: the record stays in the trash marked as not finished, Restore
says why it cannot, and Delete forever finishes the job. Its links may be gone by then, so
it does not come back with fewer than it had. A purge never reports a record it did not delete.

Give the `transaction` next to `execute`, the same function for every table of a database. It
runs `run` in a transaction, hands it an `execute` on that connection, and resolves to what
`run` resolved to. A throw must roll back.

```ts
// node-postgres
transaction: async (run) => {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const out = await run((sql, params) => client.query(sql, params).then((r) => r.rows))
    await client.query('COMMIT')
    return out
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {})
    throw e
  } finally {
    client.release()
  }
}

// postgres.js
transaction: (run) => sql.begin((tx) => run((text, params) => tx.unsafe(text, params)))

// mysql2
transaction: async (run) => {
  const c = await pool.getConnection()
  try {
    await c.beginTransaction()
    const out = await run((sql, params) => c.query(sql, params).then(([rows]) => rows))
    await c.commit()
    return out
  } catch (e) {
    await c.rollback().catch(() => {})
    throw e
  } finally {
    c.release()
  }
}

// mssql
transaction: async (run) => {
  const tx = new mssql.Transaction(pool)
  await tx.begin()
  try {
    const out = await run(async (text, params) => {
      const request = new mssql.Request(tx)
      params.forEach((value, i) => request.input(`p${i + 1}`, value))
      return (await request.query(text)).recordset ?? []
    })
    await tx.commit()
    return out
  } catch (e) {
    await tx.rollback().catch(() => {})
    throw e
  }
}
```

On SQLite run `BEGIN IMMEDIATE`, `run` and `COMMIT` or `ROLLBACK` on the one connection, and
take no other write on it meanwhile. A teammate's write to a row the transaction holds waits
for it, then lands. Under a transaction a Restore of the record waits too, and finds it gone.

In the server's step each table's own `authorize`, `scope`, `validate`, hooks and `audit` apply
to the keys it empties, as the page's requests met them, with `afterUpdate` and the audit only
for what stayed emptied. A `beforeUpdate` hook can refuse. What it changes in the patch is not
written here.

With routes wired by hand, tell each table who holds its keys, and which of its fields lead to a
table that marks. Without `liveLinks` a group on such a field has an Empty group for each
trashed key.

```ts
const orders = createKitHandlers({
  schema: orderSchema,
  source: createSqlDataSource({ ...orderConfig, transaction, liveLinks: { customer_id: { table: 'customers', key: 'id', softDelete: 'deleted_at' } } }),
})
const customers = createKitHandlers({
  schema: customerSchema,
  source: createSqlDataSource({ ...customerConfig, transaction }),
  linkedFrom: [{ handlers: orders, column: 'customer_id' }],
})
```

### Index for soft delete

`deleted_at IS NULL` is in every read, so a count or a group can no longer be answered from
an index that does not hold the column. Scrolling, sorting and filtering a page barely
notice; counts and groups do, and MySQL more than Postgres. Measured on a million orders,
Postgres 16 and MySQL 8.4 on default memory settings:

| Statement, ms | Postgres, plain to soft | MySQL, plain to soft |
|---|---|---|
| Count all | 19 to 32 | 55 to 229 |
| Group by status | 44 to 73 | 112 to 888 |
| Count through a lookup filter | 14 to 61 | 33 to 465 |

With a third of 633,000 rows marked, the lookup count on MySQL took about 0.9 s warm and
13.3 s cold; an index on `(account, deleted_at)` brought it to 18 ms. So add the mark to the
indexes your views filter and group on, last:

```sql
CREATE INDEX orders_account_live ON orders (account, deleted_at);
```

On Postgres a partial index does the same for less space:
`CREATE INDEX orders_account_live ON orders (account) WHERE deleted_at IS NULL`. The trash
reads the latest marks, so index the column by itself on a table with many of them.

## The trash

A deleted view goes there too, with its filter, sorts and settings, and "Restore"
puts it back at its place in the views menu. Undo does the same.

A deleted record, field or table goes to the trash. The trash button at the
end of the tab bar shows how many items it holds and opens a list, newest
first, with who deleted each one (`setCurrentUser`) and when. Restore puts an
item back:

- a record in its table, at the place it had, with its links;
- a field with its values (the values stay in the records while the field is
  in the trash);
- a table as a tab, with the fields of other tables that linked to it made
  again from its side.

The notice that appears after a delete has a Restore button too. A record
whose table is in the trash waits until the table is restored; the dialog
says so.

The trash is plain data. Bind it and store it next to the tables:

```svelte
<script lang="ts">
  import { SvBase, enableBase, type BaseTable, type BaseTrashItem } from '@svgrid/enterprise/base'

  enableBase()
  let tables = $state.raw<BaseTable[]>(loadTables())
  let trash = $state<BaseTrashItem[]>(loadTrash())
</script>

<SvBase bind:tables bind:trash trashDays={30} editable onTablesChange={saveTables} onTrashChange={saveTrash} />
```

With neither `onTrashChange` nor a store the trash lives in the page: it goes when the
page is closed or reloaded, and the panel says so in place of a number of days. If the
app keeps a `bind:trash` some other way, pass `trashKept` to show the days.

To keep the trash where the records are, so it survives a reload and every
person of the base gets the same one, give it a store. `list` is read when the
base opens (a promise is fine), so someone else's deletes appear in the panel when
the page is next opened; `add` and `remove` hear each item deleted, restored, undone
or emptied, by id:

```ts
import type { BaseTrashItem, BaseTrashStore } from '@svgrid/enterprise/base'

const trashStore: BaseTrashStore = {
  list: async () => (await (await fetch('/api/trash')).json()) as BaseTrashItem[],
  add: (items) => fetch('/api/trash', { method: 'POST', body: JSON.stringify(items) }),
  remove: (ids) => fetch('/api/trash', { method: 'DELETE', body: JSON.stringify(ids) }),
}
```

Pass it as `<SvBase {trashStore}>`. A store that fails says so in a notice;
the page's trash stands either way.

Items older than `trashDays` (30 by default, 0 for no limit) are dropped when
the base opens, the same as Delete forever: on a table with `softDelete` the row goes
with them, and one the database refuses stays in the trash. `restoreItems(tables, items)` puts items back in code, for an
admin screen that restores from a stored trash.

| `BaseTrashItem.kind` | Also holds |
|---|---|
| `'record'` | `table` (id), `row`, `index` |
| `'field'` | `table` (id), `column`, `index` |
| `'table'` | `table` (the whole `BaseTable`), `index` |

Every item has `id`, `deletedAt` (ISO time) and, when someone is signed in,
`deletedBy` (a user id).

<div data-docs-demo="706-base-trash" data-height="620"></div>

## Import a CSV or Excel file

The tab bar's menus import a CSV, TSV, Excel (.xlsx) or JSON file. The file
is read in the page; nothing is uploaded. An Excel cell is read as it shows: a
number in a percent cell as a percent, a number in a date cell as that date.

- **As a new table** (the list of tables, "Import a file as a table"): each
  column becomes a field, the first one naming the records. The type comes
  from the column's values and the dialog shows each guess to change before
  the import.
- **Into the shown table** (the table's menu, "Import records from a file"):
  each column goes to the field it names, matched by name or id in any case.
  A column that matches nothing is skipped unless you point it at a field. A
  value a select does not have becomes a new option. A link field reads the
  linked records' names, comma-separated, with a name that holds a comma in
  quotes. A person field reads names or emails.

A CSV is read for what it is. The separator (comma, semicolon, tab, pipe) and
the encoding are found from the file, and the dialog shows both to change. A
decimal comma stays a decimal: `1,50` is 1.5, and `1,500` alone is one thousand
five hundred.

Each value is read the way the field reads a paste. A date keeps the calendar day
it is written with, in every time zone, in any form a person writes one
(`October 9, 2026`, `12/02/2026`, `3 December 2026`, `2026-10-09`). `12/02/2026`
reads by the field's date format, then the viewer's language, unless a number past
12 in the same column settles it: with `13/02/2026` in the column, all of it is day
first. A percent reads as the grid reads it: `25%` is 25%, and a bare `25` in a
percent field is 25% too. A person matches by name or email. A name that matches
nobody is not stored, and neither is a linked record's name that no record has: the
dialog says how many cells that is before the import, and again after it.

The dialog says what it found before anything is imported: a file that is not
UTF-8, a quote that is never closed (the quote stays as text and the rows after
it are read as usual), rows longer or shorter than the header (extra cells get
columns of their own), values a field type cannot hold, names that match no
person or record, and records that repeat a name already in the table. A file
that is not text is refused.

## Download a view

The list of tables has "Download this view as CSV" and "Download this view as
Excel". The file holds the view's fields in its order and its records, filtered
and sorted, each cell as it reads on screen: a formula's result, the names of
linked records and people, a checklist's items, attachments' file names. Numbers
stay numbers, at every digit they hold, whether the page or a database driver gave
them. A percent is written `12.5%` and a duration `1:30:15`, so the file imports back to
the same values. A person sees only what they may see, in the file too. Text that would
start a formula in a spreadsheet is guarded in a CSV.

In Excel a number, a percent, a date and a time of day are real cells with the field's
number format: they sum and sort, and read as on screen, in the date format and at
the places the field shows. That goes for a formula with a result of that kind, a count, a
rollup, and a lookup with one value. A moment reads at the time its cell shows, in the
viewer's zone or in GMT for a GMT field. These stay text: a number of more digits than a spreadsheet
keeps (16 and up), so every digit stays; a date before March 1900, which Excel has no day for;
a lookup of several values; a duration; and a yes or no field, as the word `true` or `false`
on every driver.

`recordsAsShown(columns, rows)` gives the same values in code. `api.exportCsv`
writes what is stored: nothing for a formula, ids for links and people.

| Values in the column | Field type |
|---|---|
| `$1,200`, `€80.50` | Number as currency, with the symbol |
| `25%` | Number as percent (0 to 100) |
| `yes` / `no`, `true` / `false`, `x` | Checkbox |
| `42`, `3.75` | Number (integer or decimal) |
| `ana@example.com` | Email |
| `https://...` | URL |
| `2026-11-02`, `02/11/2026` | Date (with the time when there is one) |
| `+1 415 555 0100` | Phone |
| A few short values, repeated | Single select, a color per value |
| `Design, Copy`, items repeated | Multiple select |
| Long text or line breaks | Long text |
| Anything else | Single line text |

An import into a table is one undo step. An app that already has a file (a
drop zone of its own, a download) opens the same dialog with it:

```svelte
<script lang="ts">
  let base = $state<ReturnType<typeof SvBase> | null>(null)
</script>

<SvBase bind:this={base} bind:tables editable />
<button onclick={() => base?.openImport('append', file)}>Import</button>
```

`openImport('new', file)` makes a new table from it. In code, without the
dialog, `tableFromMatrix(rows, tables, name)` builds a table from a header row
and rows of text, and `recordsFromMatrix(rows, table, matchColumns(header,
table))` turns them into records of an existing table. `fileImport={false}`
removes the menu items.

<div data-docs-demo="709-base-import-csv-excel" data-height="620"></div>

## Next

- [Views for every team](./views.md): personal and locked views, and the
  layout on a phone.
- [Collaboration](./collaboration.md): who is signed in, comments and
  @mentions.
- [Keep a base in a database](./data.md): a restored or imported record is
  written back like any other change.
