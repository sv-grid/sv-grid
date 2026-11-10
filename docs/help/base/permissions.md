# Permissions: what each person may do

Your app already knows its roles: who is an editor, who only comments, who
sees the margin column. `permissions` hands that to the base, and the screen
offers only what the signed-in person may do. A commenter gets no "+" row and
no Delete in the record menu; a sales rep never sees the Cost field, or the
formula that reads it.

> SvGrid Base is part of the **Suite edition** of `@svgrid/enterprise`. Without a key it runs with a watermark.

```svelte
<script lang="ts">
  import { SvBase, enableBase, setCurrentUser, type BaseTable, type BasePermissions } from '@svgrid/enterprise/base'

  enableBase()
  let { data } = $props()
  setCurrentUser(data.user)

  let tables = $state<BaseTable[]>(data.tables)
  // From your server: the role of the person signed in.
  const permissions: BasePermissions =
    data.user.role === 'editor'
      ? { canEditSchema: false }
      : { canCreate: false, canDelete: false, canEditSchema: false, canEditViews: false, fields: { 'deals.cost': 'hidden' } }
</script>

<SvBase bind:tables {permissions} editable fieldMenu columnAdder expandRows />
```

Everything is allowed by default. Each key turns one thing off:

| Permission | Off means |
|---|---|
| `canEdit` | No cell, record view, card drag or date drag changes a value. Adding and deleting records are off too. |
| `canCreate` | No "+" row, no group "+", no Insert record above or below, no Duplicate record, no "+" on board lanes or calendar days, no form views, no "Import records from a file". |
| `canDelete` | No Delete record in the row and card menus, no Delete in the selection bar, no trash button. |
| `canEditSchema` | No field editor or "+" field column, no Add, Rename, Duplicate or Delete table, no "Import a file as a table", no Automations button, no SQL export. The field menu keeps Filter, Group, Hide and Color by. |
| `canEditViews` | No Create, Rename, Duplicate, Delete, Lock or Unlock on shared views. Filters, sorts and groups the person changes stay in their page; they may still make personal views, which are saved. |
| `canComment` | Comments are read, not written: no comment box, no Comment in the menus. |
| `fields` | Per field: `'hidden'` or `'readOnly'`. A key is a column id (in every table) or `tableId.columnId`. |
| `viewsOnly` | Only these views (a view id, or `tableId.viewId`). Tables with none of them are not shown, the field editor is off, and view changes stay in the page. |

## A table's own permissions

`BaseTable.permissions` wins over the base's, key by key, and its `fields`
are merged over the base's `fields`:

```ts
const tables: BaseTable[] = [
  // Everyone may add deals; only the base's permissions decide the rest.
  { id: 'deals', name: 'Deals', columns, data, permissions: { canCreate: true } },
  // The price list is read-only for the person signed in.
  { id: 'prices', name: 'Prices', columns: priceColumns, data: prices, permissions: { canEdit: false } },
]
```

## Hidden fields

A hidden field leaves the grid, the record view, cards, search and lookups
from other tables. So does every field that would show what it holds:

- a formula that reads it (`{Amount} - {Cost}` goes with Cost),
- a lookup or rollup of it in another table,
- a link to a table the person cannot see, and the lookups that read that link.

The records keep the values. When the person edits a field, the stored record
is the same object with Cost still in it, so the database never sees Cost
cleared. A field change in the field editor comes back with the hidden fields
in their places, and the columns your app stores never take the
`editable: false` the screen uses for read-only fields.

Hiding is for display. A page that loads the whole table has the values in
memory, and a person with the browser's developer tools can read them. For a
field that is secret, leave it out of what your server sends, as
`sharedTables` does for a [read-only share](./collaboration.md#share-a-base-read-only).

## Views a person may change

Without `canEditViews` the views menu shows "Create a personal view" and
Rename, Duplicate and Delete only on the person's own personal views (those
need `setCurrentUser`). A filter or sort they set on a shared view shows in
their page and is not saved; `onTablesChange` hands your app the views as
stored, with their personal views added.

A locked view keeps its settings for everyone. With `canEditViews`, a person
may unlock it; without it, they may not.

## A narrow window: `viewsOnly`

A support agent who needs the "Open tickets" view and nothing else:

```svelte
<SvBase bind:tables permissions={{ viewsOnly: ['tickets.open'], canDelete: false }} editable expandRows />
```

They see the Tickets tab with one view, edit records in it, and nothing else
of the base. Their filter and sort changes stay in their page.

## One table

With `data` and `columns` instead of `tables`, `permissions` works the same.
`onColumnAdd`, `onColumnChange` and `onColumnRemove` hand your app the
columns as you declared them, hidden fields included.

## In code

```ts
import { permittedRecords, tablePermissions, gridPermissions } from '@svgrid/enterprise/base'

// The tables as one person sees them, the hidden fields' values gone from the
// records: on your server, to send only those.
const shown = permittedRecords(tables, permissions)

// Every permission decided for a table (defaults filled in).
tablePermissions({ canEdit: false })   // { canEdit: false, canCreate: false, canDelete: false, ... }

// What the person may do in a grid of the base: for your own buttons and cells.
if (gridPermissions(ctrl).canDelete) showDeleteButton()
```

`permittedTables` gives the same tables with the records as they were, hidden
values included, for code in the page that writes them back. Do not send its
result to anyone.

`<sv-base>` takes the same object as its `permissions` property or as JSON in
the `permissions` attribute; see [`<sv-base>`](../web-components/sv-base.md).

## Pitfalls

- **The browser follows these; your server decides.** A base on a database
  still needs the API or row-level security to refuse a delete from a role
  that may not delete. The screen not offering it is not the same as the
  server refusing it.
- **`canCreate` and `canDelete` need `canEdit`.** A person who may not change
  values cannot add or delete records either.
- **`readOnly` wins.** A base shown with `readOnly` (a share link) is read-only
  whatever `permissions` says.
- **`fields` keys are column ids.** A field's header can change; its id
  does not. Use `tableId.columnId` when two tables have a field with the same id.

## Next

- [People, comments and files](./collaboration.md): who is signed in, protected
  fields, a read-only share.
- [Views](./views.md): personal and locked views.
- [Formulas on a server](./server-compute.md): the values people see, worked
  out in Node for an API or an AI tool.
