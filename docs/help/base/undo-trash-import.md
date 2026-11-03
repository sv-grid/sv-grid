# Undo, the trash and importing files

Three things people reach for in their first week with a base: Ctrl+Z after
a slip, getting back a record someone deleted yesterday, and pulling in the
spreadsheet they kept until now. All three work on `<SvBase tables>` with no
setup; this page says what each one does and how an app keeps it.

> SvGrid Base is part of the **Suite edition** of `@svgrid/enterprise`. Without a key it runs with a watermark.

## Undo and redo

Ctrl+Z (Cmd+Z on a Mac) undoes what was done to the shown table, in the
order it was done. Ctrl+Shift+Z or Ctrl+Y redoes it. The keys work anywhere
in the base, and also with nothing focused on the page (after a dialog
closes, or a click beside the base): then the base used last takes them. A
key typed in a field of your own page stays yours. One history holds:

- cell edits, pastes and fills (the grid's own history);
- records added, deleted or imported from a file;
- fields added, changed (a new type, new options) or deleted.

Undoing a deleted record puts it back at the place it had, and the links the
delete cleared come back too: delete a task and its project stops listing
it; undo, and the project lists it again. The step restores the records of
every table the change touched.

The Undo and Redo buttons at the end of the tab bar say what the next press
does ("Undo delete 2 records"). `undoRedo={false}` hides them; the keys still
work. Each table keeps its history while another table is shown, so going
back to a table carries on where you left it. View settings (a filter, a
sort) are not part of the history: a view keeps them as you leave it.

<div data-docs-demo="705-base-undo-redo" data-height="620"></div>

## The trash

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

Items older than `trashDays` (30 by default, 0 for no limit) are dropped when
the base opens. `restoreItems(tables, items)` puts items back in code, for an
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
is read in the page; nothing is uploaded.

- **As a new table** (the list of tables, "Import a file as a table"): each
  column becomes a field, the first one naming the records. The type comes
  from the column's values and the dialog shows each guess to change before
  the import.
- **Into the shown table** (the table's menu, "Import records from a file"):
  each column goes to the field it names, matched by name or id in any case.
  A column that matches nothing is skipped unless you point it at a field. A
  value a select does not have becomes a new option.

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
