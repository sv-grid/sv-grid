# Build a project tracker

SvGrid Base is a table database you put inside your own Svelte app: typed
fields, saved views (a grid, a Kanban board, a calendar, a gallery, a form),
filters, groups, row colors, linked records, and an expanded record with
comments. Your users get a tool they already know how to use; you keep the
data, the backend and the rest of the app.

<div data-docs-demo="504-project-tracker" data-height="660"></div>

> **SvGrid Base is part of the Suite edition** of `@svgrid/enterprise`. It runs
> without a key during an evaluation (with a watermark), and with a Grid
> edition key it runs too, showing the watermark and an upgrade notice.

This page builds a small tracker step by step. Each step works on its own.

## 1. Turn it on

```ts
import { SvBase, enableBase } from '@svgrid/enterprise/base'

enableBase()
```

`enableBase()` registers the field types and the renderers they draw with.
Call it once, at app start or in the component that uses it.

## 2. Declare the fields

A field is a column with a `fieldType`. The type brings its editor, its format,
its alignment and, for the types that need one, its own cell.

```ts
const STATUS = [
  { value: 'Todo', color: '#94a3b8' },
  { value: 'In progress', color: '#2d7ff9' },
  { value: 'Done', color: '#20c933' },
]

let columns = $state.raw([
  { field: 'task', header: 'Task', fieldType: 'text' },
  { field: 'status', header: 'Status', fieldType: 'singleSelect', fieldProps: { options: STATUS } },
  { field: 'owner', header: 'Owner', fieldType: 'user' },
  { field: 'due', header: 'Due', fieldType: 'date', fieldProps: { dateFormat: 'friendly' } },
  { field: 'budget', header: 'Budget', fieldType: 'number', fieldProps: { format: 'currency', symbol: '$', summary: 'sum' } },
  { field: 'files', header: 'Files', fieldType: 'attachment' },
])
```

The [field types page](../fields.md) lists every type and its properties.

## 3. Render the base

```svelte
<SvBase data={rows} {columns} primaryField="task"
  editable sortable showRowNumbers expandRows summary containerHeight={600} />
```

`primaryField` is the record's name: always the first column, pinned, and the
title of a record, a card or a calendar event. `expandRows` turns the row
number into a checkbox and an expand button that opens the record.
`summary` adds the row of the fields' summaries under the records, with
"+ Add row" below it, both on the column headers' ground. The primary
field's cell counts the records the view shows until you pick a summary for
it.

Right-click a record for its menu: expand it, comment on it, insert a
record above or below it (in its group, when the view is grouped),
duplicate it, copy and paste cells, or delete it, which asks first. A card
on a board has the same menu, with "Move to" a lane. A record made there
gets its own id and the next autonumber and is saved like any other. Pass
your own `contextMenu` to the grid to replace the menu, or
`contextMenu={false}` to turn it off.

A record with comments shows how many next to its row number and on its
card; a click opens the record at its discussion. See
[Collaboration](./collaboration.md) for where comments are kept.

## 4. Give it views

```ts
import type { FieldView } from '@svgrid/enterprise/base'

let views = $state<FieldView[]>([
  { id: 'all', name: 'All tasks', type: 'grid', color: { mode: 'field', field: 'status' } },
  { id: 'board', name: 'Board', type: 'kanban', stackBy: 'status' },
  { id: 'due', name: 'Due dates', type: 'calendar', dateField: 'due' },
  { id: 'files', name: 'Files', type: 'gallery', coverField: 'files' },
  { id: 'chart', name: 'By status', type: 'chart', chart: { kind: 'bar', x: 'status', y: 'budget' } },
  { id: 'request', name: 'Request a task', type: 'form' },
])
```

```svelte
<SvBase data={rows} {columns} bind:views primaryField="task" editable />
```

Each view keeps its own filter, sorts, groups, hidden fields, row height and
colors. A view can start with them set, as `state` (the grid's view state) and
`color`.

## 5. Let people change the fields

`columnAdder` puts a "+" after the last column, `fieldMenu` adds Edit, Insert,
Duplicate, Hide and Delete to each column's menu. The grid keeps no schema of
its own: every change hands back the whole column list.

```svelte
<SvBase data={rows} {columns} columnAdder fieldMenu
  onColumnAdd={store} onColumnChange={store} onColumnRemove={store} />
```

```ts
function store(e: { columns: any[]; data?: Row[] }) {
  columns = e.columns
  if (e.data) rows = e.data
}
```

## 6. Keep it

`onViewsChange` fires whenever a view is created, renamed, deleted or changed.
`onCellValueChange`, `onRowAdd` and `onRowsDelete` report the data. Store them
wherever your app stores things; the base reads them back as props.

## 7. Add tables

A base can hold several tables, as tabs. Give `SvBase` a list of tables
instead of `data` and `columns`, and link them with a link field: the other
table gets a field that links back, kept in step from then on.

```svelte
<SvBase bind:tables editable columnAdder fieldMenu onTablesChange={save} />
```

[Tables and links](../fields.md#tables-and-links) has the shape of a table and
what the tabs do.

## Next

- [Ready-to-use bases](./templates.md): a content calendar, a CRM, a roadmap,
  a hiring tracker and an inventory, each a working starting point.
- [Link tables](./linked-records.md): a CRM with accounts, contacts and
  deals, and the lookups, rollups and counts across them.
- [Formulas](./formulas.md): fields computed from the other fields of a
  record.
- [Views](./views.md): a board, a calendar, a chart and filtered grids over
  the same records, saved per team.
- [Forms](./forms.md): new records from a form, inside the base or on a
  public page.
- [People, comments and files](./collaboration.md): real users, comments in
  your backend and uploads to your storage.
- [Your own field type](./custom-field-type.md): a type with its own cell,
  editor, filter and summary.
- [Automations](./automations.md): records that update themselves, new
  records made for you, notices and buttons that start work.
- [Keep a base in a database](./data.md): load the tables from Postgres,
  Supabase or your API and write every change back.
- [Field types](../fields.md): every type, the view bar, filters, records and
  linked tables.
