# Field types

A column can say what it is - a rating, a URL, a single select with colored
options, a list of files - with `fieldType`, and set that type's properties
with `fieldProps`. The type fills in the editor, the format and the
alignment, and draws the cell when the type needs a cell of its own (stars,
links, file thumbnails). The same module adds a "+" after the last column to
create fields, a "+ Add row" line under the last row, status colors on the
row header, field actions in the column menu, and a view bar with saved grid,
Kanban, calendar, gallery and form views.

<div data-docs-demo="504-project-tracker" data-height="620"></div>

> **SvGrid Base, part of the Suite edition.** The `fieldType` / `fieldProps`
> column properties and the `rowAdder`, `rowColor`, `columnAdder`,
> `fieldMenu`, `expandRows` and `primaryField` props are part of the free
> `@svgrid/grid` types; what draws them is SvGrid Base
> (`@svgrid/enterprise/base`, or `@svgrid/enterprise/fields` for the field
> types alone). Without it a `fieldType` column draws as an ordinary column and
> the props do nothing. Without a Suite key the grid shows the Enterprise
> watermark and everything still runs. New here? [Build a project
> tracker](./base/start.md) first.

## Turn it on

`enableFields()` registers the built-in types for every grid on the page. It is
a separate module: `installEnterprise()` does not load it, so an app that never
calls `enableFields()` does not ship it.

```ts
import { enableFields } from '@svgrid/enterprise/fields'

enableFields()
```

## A table with views

`SvBase` is a grid with a view bar over it. Every prop it does not name
goes to the grid; `views` are the saved views and `activeView` the one shown.

```svelte
<script lang="ts">
  import { SvBase, type FieldView } from '@svgrid/enterprise/fields'

  let views = $state<FieldView[]>([
    { id: 'all', name: 'All tasks', type: 'grid' },
    { id: 'board', name: 'By status', type: 'kanban', stackBy: 'status' },
    { id: 'due', name: 'Due dates', type: 'calendar', dateField: 'due' },
    { id: 'cards', name: 'Gallery', type: 'gallery', coverField: 'files' },
    { id: 'form', name: 'Request a task', type: 'form' },
  ])
</script>

<SvBase {data} {columns} bind:views primaryField="task" editable
  showRowNumbers expandRows containerHeight={600} />
```

A grid, Kanban, calendar, Gantt or gallery view is the grid itself in another
mode (`board`, `scheduler`, `gantt`, `gallery`), so the filter and the sort
carry over; a form view is drawn beside the grid, which stays mounted under
it. In a board, calendar or gallery the bar's search narrows the records; the
text is not saved with the view. The Gantt type is
offered once the app has enabled the Gantt view; its task table holds the
primary field, the two dates and the working days.

`SvBaseViewBar` is the bar on its own, for a page that lays out its own
grid:

```svelte
<SvBaseViewBar {api} bind:views bind:activeView />
<SvGrid {data} {columns} onApiReady={(a) => (api = a)} />
```

## The view bar

From the left: the view switcher, then Hide fields, Filter, Group, Sort,
Color and Row height, and at the right the record count and search (the
grid's find bar, Ctrl+F). A button with something set says so ("2 hidden
fields", "Filtered by Status", "Sorted by 1 field") and is tinted. Each
setting goes through the grid's own state, so `api.getState()` holds it.

- **Hide fields**: a switch per field, a search, hide all / show all, and
  drag to reorder. The primary field is always shown.
- **Filter**: conditions on fields (below), joined by "and" or "or", with
  condition groups one level deep. Each change filters at once.
- **Group**: up to three fields, each with a direction. Group headers show
  the value as its cell draws it (see [Grouped records](#grouped-records)).
- **Sort**: fields in order, each with a direction labeled for its type:
  "1 → 9" for a number or a date, "A → Z" for text, "☐ → ☑" for a checkbox.
- **Color**: none, a single select's option colors, or conditions in order
  with a color each (the first match colors the row, where the `rowColor`
  prop's `target` says; a condition still missing its value colors nothing).
  A view with no color setting shows the `rowColor` prop's colors.
- **Row height**: short, medium, tall and extra tall (`rowHeights` on
  `SvBase` or `SvBaseViewBar` sets the list).

## Filter conditions

A condition is a field, an operator that fits the field's type and a value in
the control the field calls for. A condition without a value yet filters
nothing. The filter is the grid's advanced filter with its own expression
kind, `fieldFilter`, so `api.setAdvancedFilter` sets it and a saved view
keeps it.

| Field type | Operators |
|---|---|
| Text, long text, URL, email, phone, barcode, formula, lookup | contains, does not contain, is, is not, is empty, is not empty |
| Number, currency, percent, rating, duration, autonumber, count, rollup | =, ≠, <, >, ≤, ≥, is empty, is not empty |
| Single select, user | is, is not, is any of, is none of, is empty, is not empty |
| Multiple select, multiple users | has any of, has all of, is exactly, has none of, is empty, is not empty |
| Date, created time, last modified time | is, is before, is after, is on or before, is on or after, is within, is empty, is not empty |
| Checkbox | is checked / unchecked |
| Attachment | file name contains, is empty, is not empty |
| Link to another table | contains, does not contain, is, is not (by the records' names), is empty, is not empty |

A date compares days: "today", "tomorrow", "one week ago", "one month from
now" or an exact date, and "is within" takes the past or next week, month or
year, or a number of days. A bare `'2026-10-14'` is that day where the user
is.

```ts
api.setAdvancedFilter({
  kind: 'fieldFilter',
  conjunction: 'and',
  conditions: [
    { column: 'status', kind: 'select', op: 'isAnyOf', value: ['Todo', 'Blocked'] },
    { column: 'due', kind: 'date', op: 'isWithin', value: { span: 'nextWeek' } },
  ],
})
```

## Saved views

A view is a name, a type and the settings it had when it was last left:

| Key | What it holds |
|---|---|
| `id`, `name`, `type` | `'grid'`, `'kanban'`, `'calendar'`, `'gantt'`, `'gallery'`, `'chart'` or `'form'` |
| `state` | the grid's state: sorts, groups, the filter, hidden fields, order, widths, pinned columns |
| `rowHeight`, `color` | the row height and how rows are colored |
| `stackBy` | Kanban: the single select or user field the cards stack by |
| `dateField`, `endField` | calendar and Gantt: the dates a record starts and ends on |
| `progressField`, `dependencyField`, `zoom` | Gantt: a percent field the bars fill with, a link field to the same table naming what each record depends on, and the zoom it was left at |
| `coverField` | gallery: the attachment field whose first image is the cover |
| `chart` | chart: `kind` (`'bar'`, `'barH'`, `'line'`, `'pie'`, `'donut'`), `x` the field to group by, `y` a number field (else a count), `aggregation` (`'sum'` or `'avg'`) |
| `formFields`, `formTitle`, `formDescription` | form: the fields it asks for and its heading |

The view switcher creates a view of any type (a Kanban asks what to stack by,
a calendar which date field), renames, duplicates and deletes. A new view
starts plain: no filter, sorts or groups, every field shown. Changes to the
shown view are kept a moment after they are made, and `onViewsChange` reports
the list whenever it changes, so the app can store it. A Kanban card moved to
another lane, or a calendar record moved to another day, writes the field
through the grid's edit path (undo, validation, `onCellValueChange`); a date
field without a time shows as all-day events. A Kanban card draws its fields as their cells do (pills,
avatars, file thumbnails), and "+ Add a card" in a lane adds a record already
in that lane, named by the primary field. Double-click a card (or F2) to open its record. On
the calendar, picking a day adds a record on it and opens it with its name
ready to type.

A Kanban stacked by a field draws an "Uncategorized" lane only while a record
has no value in that field. A calendar view whose `color` is a single select
(`{ mode: 'field', field: 'stage' }`) colors each event as the record's
option, with the options above the calendar as a legend that hides and shows
their events.

## Gallery, chart and form views

A gallery draws each record as a card: the cover image, the primary field as
the title, and the fields the grid shows, each drawn as its cell draws it. The
cards follow the filter, the sort and the hidden fields; a click opens the
record. It is the grid's [gallery view](./rows/gallery.md) (`gallery`), set up
from the view: the cover field, the primary field as the title, the shown
fields as the card's fields.

A chart groups the records the view shows (its filter applies) by one field
and counts them, or adds up or averages a number field, as a bar, horizontal
bar, line, pie or donut chart. A single select keeps its options' order and
colors, a person and a linked record show by name, a date groups by month, and
the values read as the summed field writes them ("$480,000"). "Customize
chart" in the view bar changes the kind, the field and the value; the view
keeps them as `chart`:

```ts
{ id: 'pipeline', name: 'Pipeline value by stage', type: 'chart', chart: { kind: 'bar', x: 'stage', y: 'value' } }
{ id: 'funnel', name: 'Candidates by stage', type: 'chart', chart: { kind: 'donut', x: 'stage' } }
```

A form asks for the fields a person can fill in (computed fields are left
out), each with the editor its cell uses, and adds a row the way "+ Add row"
does: field defaults, the next autonumber, then what was typed, and
`onRowAdd`. `SvBaseForm` takes `fields`, `required`, `title`,
`description` and `onSubmit`; a field's `description` shows under it.

## The primary field

`primaryField` names the field that is the record's name. It is always the
first column and pinned, it cannot be hidden or deleted (the column menu does
not offer it, the pin splitter stops at it), and it titles the expanded
record, a gallery card and a calendar event.

```svelte
<SvGrid {data} {columns} primaryField="task" />
```

## Declare columns by type

```ts
import type { GridColumns } from '@svgrid/grid'

type Task = { task: string; status: string; tags: string[]; due: string; score: number; budget: number; spec: string }

const columns: GridColumns<Task> = [
  { field: 'task', header: 'Task', fieldType: 'text' },
  {
    field: 'status',
    header: 'Status',
    fieldType: 'singleSelect',
    fieldProps: { options: [{ value: 'Todo', color: '#64748b' }, { value: 'Done', color: '#16a34a' }] },
  },
  { field: 'tags', header: 'Tags', fieldType: 'multiSelect', fieldProps: { options: [{ value: 'Design' }, { value: 'Docs' }] } },
  { field: 'due', header: 'Due', fieldType: 'date', fieldProps: { dateFormat: 'friendly' } },
  { field: 'score', header: 'Score', fieldType: 'rating' },
  { field: 'budget', header: 'Budget', fieldType: 'number', fieldProps: { format: 'currency', symbol: '€', symbolPosition: 'after', precision: 0 } },
  { field: 'spec', header: 'Spec', fieldType: 'url' },
]
```

A property the column sets itself wins over its type:
`{ fieldType: 'number', align: 'left' }` stays left-aligned.

| Type | `fieldProps` |
| --- | --- |
| `text` | `default` |
| `longText` | `richText` (**bold**, *italic*, `code`, [links](https://svgrid.com), "- " lists; drawn as elements, never as HTML) |
| `attachment` | `accept`, `maxFiles`, `maxSize`, `upload` |
| `checkbox` | `icon` (`check`, `x`, `star`, `heart`, `thumbsUp`, `flag`, `dot`), `color`, `default` |
| `singleSelect`, `multiSelect` | `options` (`{ value, label?, color? }[]`, 40 colors in the editor, sort A to Z), `default` |
| `user` | `multiple`, `default`; the people come from `setFieldUsers` |
| `date` | `dateFormat` (`local`, `friendly`, `us`, `european`, `iso`), `time`, `timeFormat` (`12hour`, `24hour`), `gmt` (one time zone for everyone), `showTimeZone`, `defaultToday` |
| `phone`, `email`, `url` | none |
| `barcode` | none |
| `button` | `label`, `color`, `url` (`{Field name}` filled from the row), or `onClick` set in code |
| `number` | `format` (`integer`, `decimal`, `currency`, `percent`), `precision` 0 to 8, `step` (the editor's spinner, default 1), `separators` (`local`, `comma-period`, `period-comma`, `space-comma`, `space-period`), `showThousands`, `abbreviation` (`none`, `thousand`, `million`, `billion`; not for percent), `allowNegative`, `default`; currency: `symbol`, `symbolPosition` (`before`, `after`); percent: `showBar`, `points` (values 0 to 100 instead of fractions) |
| `duration` | `durationFormat` (`h:mm`, `h:mm:ss`, `h:mm:ss.S`, `h:mm:ss.SS`, `h:mm:ss.SSS`); values are seconds, typed as `1:30` or `1h 30m` |
| `rating` | `max` 1 to 10, `icon` (`star`, `heart`, `thumbsUp`, `flag`, `dot`), `color` |
| `formula` | `formula`, `result` (`auto`, `number`, `currency`, `percent`, `date`) and that format's options |
| `createdTime`, `lastModifiedTime` | the date options; last modified also `watch` (`all`, `specific`) and `watchFields` |
| `createdBy`, `lastModifiedBy` | last modified by: `watch`, `watchFields`; the user comes from `setCurrentUser` |
| `autoNumber` | none |
| `link` | `table` (from `registerLinkedTable`), `multiple` |
| `lookup` | `linkField`, `field` |
| `rollup` | `linkField`, `field`, `aggregation` (`SUM`, `AVERAGE`, `MIN`, `MAX`, `COUNT`, `COUNTA`, `COUNTALL`, `ARRAYJOIN`, `ARRAYUNIQUE`, `CONCATENATE`, `AND`, `OR`), `precision` |
| `count` | `linkField` |

A number field has one editor for every format. The box shows the plain
number with the field's decimal character, the currency symbol (before or
after) or the percent sign right beside it, and a spinner at the cell's
edge: its arrows, or Up and Down, add or take away `step` (Shift: ten
times). It reads what people type the way the field writes it: its own
separators, a pasted symbol or percent sign, `2.5k`, `3M`, `(120)` for -120.
Enter commits and moves a row down, Tab a column across. On commit the
value is rounded to the field's precision; text that is not a number, or a
negative where the field allows none, keeps the box open and says why under
the cell. Pasting `$1,200.50` into the cell is read the same way. Columns
with the older `currency` and `percent` field types keep working and open in
the field editor as a number in that format.

Long text opens a panel over the cell with room for paragraphs: Enter
starts a new line, Ctrl+Enter (Cmd+Enter), Tab or a click outside saves,
Escape leaves the cell as it was. With rich text on, the panel names the
markup the cell draws.

A duration uses the same editor in its own format: `2:00` in the box,
`1:30` or `1h 30m` typed, a minute a step (a second when the format shows
seconds). A date opens with the date written as its cells write it
(`October 24, 2026` for friendly), and a date without time is stored as the
calendar date (`'2026-10-24'`), never moved across a day by a time zone.

A select cell opens a panel over itself: the chosen options as pills (each
with a remove button), a search box and the options. Typing filters them; a
value that is not an option yet is offered as "Add option", which adds it to
the field (with a color, through `onColumnChange`) and picks it. A multiple
select stays open to pick more; Backspace in the empty search box removes the
last choice. A user field opens the same panel with the people from
`setFieldUsers`, each with the avatar and name its cells show.

A `default` (or a type's own new-row value: today, the next autonumber, the
created time, the current user) fills the rows the row adder adds. Computed
and automatic fields are read-only; autonumber and created time give every
existing row a value when the field is created.

URL, email and phone cells become links only for the schemes they mean
(`http(s):`, `mailto:`, `tel:`). A value such as `javascript:alert(1)` stays
text.

## Attachments

An attachment cell holds an array of files:

```ts
import type { Attachment } from '@svgrid/enterprise/fields'

const files: Attachment[] = [
  { id: 'a1', url: 'https://cdn.example.com/plan.png', name: 'plan.png', type: 'image/png', size: 48213 },
  { id: 'a2', url: 'https://cdn.example.com/spec.pdf', name: 'spec.pdf', type: 'application/pdf' },
]
```

Images show as thumbnails, other files as chips, as many as the column width
holds and then "+N". Enter or a double click opens the dialog: add files with
the picker, by dropping them, by pasting them or by URL; remove, reorder (drag,
or Alt+Left / Alt+Right) and preview (images and PDFs inline). Files dropped on
the cell itself are added without the dialog. Export writes the file names. A
copy in `<SvBase>` writes their URLs, and pasting text adds one attachment per
http(s) URL in it, so a copied cell pastes as the same files. In a base, people
and links copy as names too, and a pasted name finds its person or record.

Uploading is yours to decide. Set one uploader for the app, or one per column
in `fieldProps.upload`; it gets the file, the row and an abort signal, reports
progress, and returns the attachment. A failed upload stays in the dialog with
Retry.

```ts
import { setAttachmentUploader } from '@svgrid/enterprise/fields'

setAttachmentUploader(async (file, { signal, onProgress }) => {
  const res = await fetch(`/api/upload?name=${encodeURIComponent(file.name)}`, { method: 'PUT', body: file, signal })
  if (!res.ok) throw new Error(`Upload failed (${res.status})`)
  onProgress(1)
  const { url } = (await res.json()) as { url: string }
  return { id: url, url, name: file.name, type: file.type, size: file.size }
})
```

With no uploader, added files stay in the page as `blob:` URLs and are gone
on reload. Thumbnails use `http(s):`, `blob:` and raster `data:image` URLs
only.

## People, linked tables and formulas

User fields choose from the people you list; created by and last modified by
write whoever you say is signed in. Link fields point at rows of a table you
register; lookup, rollup and count read through a link field.

```ts
import { registerLinkedTable, setCurrentUser, setFieldUsers } from '@svgrid/enterprise/fields'

setFieldUsers([
  { id: 'u1', name: 'Ana Ruiz' },
  { id: 'u2', name: 'Ben Okafor', avatarUrl: 'https://cdn.example.com/ben.png' },
])
setCurrentUser({ id: 'u1', name: 'Ana Ruiz' })

registerLinkedTable({
  id: 'milestones',
  name: 'Milestones',
  primaryField: 'name',
  rows: () => [{ id: 'm1', name: 'Beta', date: '2026-10-31' }],
  // A field's type, when it has one, is how a lookup shows it.
  fields: [{ field: 'name', header: 'Name' }, { field: 'date', header: 'Date', fieldType: 'date', fieldProps: { dateFormat: 'friendly' } }],
})

const columns = [
  { field: 'milestone', header: 'Milestone', fieldType: 'link', fieldProps: { table: 'milestones', multiple: false } },
  { field: 'milestoneDate', header: 'Milestone date', fieldType: 'lookup', fieldProps: { linkField: 'milestone', field: 'date' } },
  { field: 'total', header: 'Total', fieldType: 'formula', fieldProps: { formula: '{Qty} * {Unit price}', result: 'currency', precision: 2 } },
]
```

A link cell shows one chip per linked record. A click on a chip opens that
record (its fields, read-only: the table is the app's), and resting the
pointer on one previews it. A table with a `create` function lets the link
picker add a record: a search that names no record offers "+ Create" for it,
picked at once.

```ts
let milestones = [{ id: 'm1', name: 'Beta', date: '2026-10-31' }]
registerLinkedTable({
  id: 'milestones',
  name: 'Milestones',
  primaryField: 'name',
  rows: () => milestones,
  create: (name) => {
    const row = { id: `m${milestones.length + 1}`, name, date: '' }
    milestones = [...milestones, row]
    return row
  },
})
```

A formula refers to fields by name in braces and supports `+ - * /`, `&` to
join text, comparisons, and functions such as `IF`, `SWITCH`, `AND`, `OR`,
`CONCATENATE`, `LEFT`, `ROUND`, `SUM`, `DATEADD` and `DATETIME_DIFF`
(the editor lists them all). It is parsed into functions once, never
evaluated as code; a formula that does not compile shows `#ERROR` in its
cells and its message in the field editor.

## Tables and links

`<SvBase tables>` holds several tables, one tab each. A table is its records,
its fields and its views; `id` is what link fields name.

```ts
import { SvBase, type BaseTable } from '@svgrid/enterprise/base'

let tables: BaseTable[] = [
  {
    id: 'deals', name: 'Deals', primaryField: 'deal', data: deals,
    columns: [
      { field: 'deal', header: 'Deal', fieldType: 'text' },
      { field: 'account', header: 'Account', fieldType: 'link', fieldProps: { table: 'accounts', multiple: false, inverse: 'deals' } },
    ],
    views: [{ id: 'all', name: 'All deals', type: 'grid' }],
  },
  {
    id: 'accounts', name: 'Accounts', primaryField: 'name', data: accounts,
    columns: [
      { field: 'name', header: 'Name', fieldType: 'text' },
      { field: 'deals', header: 'Deals', fieldType: 'link', fieldProps: { table: 'deals', inverse: 'account' } },
      { field: 'pipeline', header: 'Pipeline', fieldType: 'rollup', fieldProps: { linkField: 'deals', field: 'value', aggregation: 'SUM' } },
    ],
  },
]
```

```svelte
<SvBase bind:tables editable columnAdder fieldMenu onTablesChange={save} />
```

The tabs take the theme's colors: the tables sit on its muted surface and the
shown one is marked with its accent. They switch tables; double-click one, or use its menu, to rename it. The
menu also duplicates and deletes the table (deleting asks first and lists the
link fields that go with it), and "Add table" starts a new one with a Name,
Notes and Status field. A record of a base has an `id`, and the row adder
gives a new one its own.

Every table of the base is a table a link field can point at. A link field
from one table to another gets a field in the other table that links back
(`fieldProps.inverse` on each names the other), and the two stay in step:

- Linking a deal to an account lists the deal on the account, and the other
  way round. Deleting records takes them out of the links on the other side.
- Pointing the field at another table moves the field back to that table and
  clears the old links. Turning the field into another type, or deleting it,
  takes the field back with it; the delete asks first and names the lookups,
  rollups and counts that read it, which go with it.
- Deleting a table deletes the link fields that point at it, and the
  lookups, rollups and counts that read those links.

A rollup of amounts shows as the amounts do ("$482,000"). A linked record
opened from a chip has "Open in {table}", which switches to that tab with
the record expanded. `onTablesChange` hands over every table after each
change to records, fields, views or tables, ready to store.

To keep the records in a database instead, give each table a `source`: the
base loads from it and writes every change back, a link to one record as a
foreign key and a link to many through a junction table. See
[Keep a base in a database](./base/data.md).

## Automations

A table's `automations` do things on their own when a record is created,
changes, starts matching a condition, is sent with a form or has its button
pressed, or at a scheduled time: update the record, create a record in any
table and link it back, show a notice, color the record while it matches, or
run an action your app adds. "Automations" in the view bar edits them and
lists every run. See [Automations](./base/automations.md).

## Add a row

`rowAdder` draws "+ Add row" under the last row. A click appends a row, scrolls
to it and starts editing its first editable cell, then fires `onRowAdd` with
the row so you can store it.

```ts
import type { RowAdderConfig } from '@svgrid/grid'

const rowAdder: RowAdderConfig<{ status: string }> = {
  label: 'Add task',
  defaults: () => ({ status: 'Todo' }),
}
```

With the grid's `rowDragManaged`, rows drag into a new order by their row
number, but only while nothing sorts or groups them: in a sorted table the
order is the sort's, so the fields module turns dragging off until the sort is
cleared.

## Expand a row

`expandRows` (with `showRowNumbers`) makes the row number the row's handle:
on hover it turns into a checkbox that selects the row and an expand button.
Expand opens the row as a record: every field with its name and type icon,
its value drawn as the cell draws it, and the same editor the cell uses one
click away. A value changed there is written the way a cell edit is, so undo,
validation, `onCellValueChange` and last-modified fields behave the same.
The arrows step through the rows in the grid's order. Space on a selected
cell (not a checkbox) opens its row too.

Fields the grid hides are listed under the others, folded, and read-only. Beside
the fields is the record's activity: the changes made to it in this session
(who changed which field to what) and its comments. Comments live in memory
unless the app keeps them:

```svelte
<SvGrid {data} {columns} showRowNumbers expandRows editable />
```

```ts
import { setRecordComments } from '@svgrid/enterprise/fields'

setRecordComments({
  list: (rowId) => comments.filter((c) => c.rowId === rowId),
  add: (rowId, comment) => saveComment(comment),
})
```

## Drag to pin columns

The grid's [`pinSplitter`](./columns/column-pinning.md#drag-to-pin) works over
field columns too: drag the divider at the edge of the pinned columns to pin
more or fewer. With a `primaryField` it stops at the primary field, which
stays pinned.

```svelte
<SvGrid {data} {columns} showRowNumbers pinSplitter primaryField="task" />
```

## Taller rows

Row height is the grid's `rowHeight`; a view can offer it as short, medium,
tall and extra tall (34, 56, 88, 128 in the demo above). From 48px the field
cells use the height: content starts at the top, text wraps to as many lines
as fit (2 to 6), select pills wrap, long text keeps its line breaks and
attachment thumbnails grow with the row.

## Summaries at the bottom

With the grid's `summary` prop on, each field's cell in the footer row picks
its own summary: a click offers what fits the field (sum, average, median,
min, max, range for numbers; checked for a checkbox; earliest, latest and the
span for dates; empty, filled, unique and their percentages for every field).
The result is written as the field writes its values (`Sum $17,700`,
`Average 42%`). The choice is kept in `fieldProps.summary` and reported
through `onColumnChange`, so it can be set in the column too:

```ts
{ field: 'budget', header: 'Budget', fieldType: 'number', fieldProps: { format: 'currency', summary: 'sum' } }
```

## Grouped records

Grouped by a field (the view bar's Group, the column menu, or `groupBy`), each
group's header shows the field's name over its value, drawn as the cell draws
it (a select's pill, a person's avatar), the number of records, the summaries
the fields picked for that group ("Budget $4,300"), and "+" to add a record
that is already in the group: it gets the group's value, and its parent
groups' values, before editing starts.

A single select sorts and groups in the order of its options ("Q4 2026"
before "Q1 2027" before "Later"), not alphabetically. With a filter on, the
group's count and summaries, the record count in the view bar and the footer
totals leave out the records the filter hides, whether the group is open or
closed.

## Act on selected rows

Tick rows with the row header's checkbox (`expandRows`) or the selection
column, and the grid's [selection bar](./rows/selection-bar.md) acts on all of
them: `'editFields'` sets fields on every selected row with each field's own
control, `'deleteRows'` deletes them after an inline confirm.

```svelte
<SvGrid {data} {columns} showRowNumbers expandRows
  selectionBar={['selectAll', 'editFields', 'deleteRows']}
  onRowsDelete={(e) => (data = e.data)} />
```

## Color rows by status

With `fieldMenu`, a single select's column menu has "Color rows by this
field" (and "Stop coloring rows" on the one in use): the rows take that
field's option colors at once, and `onRowColorChange` reports the choice so
the app can keep it as `rowColor`.

`rowColor` gives each row a color on its row header: a 3px stripe on the
leading edge, with the row number left as it is. Color by a select field and
each row takes its option's color; or give rules, first match wins.
`target: 'bar'` puts the stripe on the first cell (for grids without row
numbers), `target: 'row'` tints the whole row. The row header also gets the status as its title, so the color is
never the only signal. Only rendered rows are colored, so it costs nothing at
a million rows.

```ts
import type { RowColorConfig } from '@svgrid/grid'

type Task = { status: string; budget: number }

const byStatus: RowColorConfig<Task> = { field: 'status' }
const byRule: RowColorConfig<Task> = {
  target: 'row',
  rules: [{ when: (row) => row.budget > 2500, color: '#f59e0b', label: 'Over budget' }],
}
```

## Create and edit fields

`columnAdder` draws a "+" after the last column. It opens the field editor: a
name, a type (`{ types: [...] }` limits the list) and that type's properties.
A field left unnamed is named after its type (`Number`, then `Number 2`).
Every field column shows its type's icon before the header label.
`fieldMenu` adds Edit field, Insert left, Insert right, Duplicate field, Hide
field and Delete field to every column menu; with a view bar over the grid,
also "Filter by this field" and "Group by this field", which add the condition
or group and open the bar's panel. The menu's sort items are labeled for the
field ("Sort 1 → 9", "Sort A → Z"). A field's description shows as an info
mark after its name, read on hover.

Changing a field's type converts its values where they can be (a number typed
as text stays a number, a comma list becomes multiple-select values, URLs in
text become attachments); before applying, the editor says how many cells
would be cleared. A select made from other values starts with those values as
its options.

The grid keeps no schema. Every change fires an event with the whole column
list after the change, as you declared it, and the converted rows when values
changed. Store them and the grid stays in step:

```ts
type Row = Record<string, unknown>
let columns: Record<string, unknown>[] = []
let rows: Row[] = []

function onFieldChange(e: { columns: Record<string, unknown>[]; data?: Row[] }) {
  columns = e.columns
  if (e.data) rows = e.data
}
// <SvGrid {columns} data={rows} columnAdder fieldMenu
//   onColumnAdd={onFieldChange} onColumnChange={onFieldChange} onColumnRemove={onFieldChange} />
```

## Your own field type

`registerFieldType` adds a type, or replaces a built-in one with the same id.
`fill` sets up the column; `properties` is what the field editor shows for it;
`cell` (optional) is a Svelte component that draws the cell and receives
`{ value, props, row, column }`.

```ts
import { registerFieldType } from '@svgrid/enterprise/fields'

registerFieldType({
  id: 'sku',
  label: 'SKU',
  defaults: { prefix: 'SKU-' },
  properties: [{ key: 'prefix', label: 'Prefix', kind: 'text' }],
  fill: (def, props) => ({
    ...def,
    editorType: def.editorType ?? 'text',
    formatter: def.formatter ?? ((ctx: { value: unknown }) => `${String(props.prefix)}${String(ctx.value ?? '')}`),
  }),
})
```

## See also

- [Cell data types](./cells/cell-data-types.md)
- [Cell components](./cells/cell-components.md)
- [Conditional formatting](./cells/conditional-formatting.md)
- [Column menu](./columns/column-menu.md)
