# Views for every team

One table of records, many ways to look at it. Product reads the roadmap
grouped by quarter, engineering works off a status board, the leads check a
timeline, and anyone in the company files a request through a form. Each of
those is a saved view: a name, a type, and the filter, sorts, groups, hidden
fields, row height and colors it had when someone last left it.

![The Features table feeds six saved views: Roadmap by quarter (a grid grouped by Quarter, sorted by Impact, Lead hidden, row height 56, colored by Status), Now (a grid filtered to active work), Status board (a Kanban stacked by Status), Timeline (a calendar from Start to Target), Effort by team (a bar chart) and Request a feature (a form). onViewsChange hands the whole list to the app, which stores it and loads it back into bind:views.](/docs-media/base-views.svg)

<div data-docs-demo="513-base-product-roadmap" data-height="680"></div>

> SvGrid Base is part of the **Suite edition** of `@svgrid/enterprise`. Without a key it runs with a watermark.

This page builds the Features table of that roadmap one view at a time. Each
step adds to the `views` list from the step before and works on its own.

## 1. The table

```svelte
<script lang="ts">
  import { SvBase, enableBase, setFieldUsers, type FieldView } from '@svgrid/enterprise/base'

  enableBase()
  setFieldUsers([
    { id: 'u1', name: 'Ana Ruiz' },
    { id: 'u2', name: 'Ben Okafor' },
    { id: 'u3', name: 'Cleo Park' },
  ])

  type Feature = {
    id: number; feature: string; quarter: string; status: string; teams: string[]
    lead: string; impact: number; effort: number; start: string; target: string; votes: number
  }

  const QUARTERS = [
    { value: 'Q4 2026', color: '#2d7ff9' },
    { value: 'Q1 2027', color: '#18bfff' },
    { value: 'Later', color: '#94a3b8' },
  ]
  const STATUS = [
    { value: 'Planned', color: '#94a3b8' },
    { value: 'In progress', color: '#2d7ff9' },
    { value: 'In beta', color: '#8b46ff' },
    { value: 'Shipped', color: '#20c933' },
    { value: 'Blocked', color: '#f82b60' },
  ]
  const TEAMS = [
    { value: 'Web', color: '#2d7ff9' },
    { value: 'Mobile', color: '#ff6f2c' },
    { value: 'Platform', color: '#8b46ff' },
  ]

  let rows = $state.raw<Feature[]>([
    { id: 1, feature: 'Single sign-on with SAML', quarter: 'Q4 2026', status: 'In progress', teams: ['Platform'], lead: 'u2', impact: 5, effort: 12, start: '2026-10-05', target: '2026-11-13', votes: 182 },
    { id: 2, feature: 'Offline mode for the mobile app', quarter: 'Q4 2026', status: 'Blocked', teams: ['Mobile'], lead: 'u3', impact: 4, effort: 13, start: '2026-10-12', target: '2026-12-04', votes: 96 },
    { id: 3, feature: 'Dark mode', quarter: 'Q4 2026', status: 'Shipped', teams: ['Web'], lead: 'u1', impact: 2, effort: 4, start: '2026-10-01', target: '2026-10-16', votes: 154 },
    { id: 4, feature: 'Audit log export', quarter: 'Q1 2027', status: 'Planned', teams: ['Platform', 'Web'], lead: 'u1', impact: 3, effort: 5, start: '2027-01-11', target: '2027-01-29', votes: 41 },
  ])

  const columns = [
    { field: 'feature', header: 'Feature', width: 260, fieldType: 'text' },
    { field: 'quarter', header: 'Quarter', fieldType: 'singleSelect', fieldProps: { options: QUARTERS } },
    { field: 'status', header: 'Status', fieldType: 'singleSelect', fieldProps: { options: STATUS } },
    { field: 'teams', header: 'Teams', fieldType: 'multiSelect', fieldProps: { options: TEAMS } },
    { field: 'lead', header: 'Lead', fieldType: 'user' },
    { field: 'impact', header: 'Impact', fieldType: 'rating', fieldProps: { max: 5 } },
    { field: 'effort', header: 'Effort (days)', fieldType: 'number', fieldProps: { format: 'integer', summary: 'sum' } },
    { field: 'start', header: 'Start', fieldType: 'date', fieldProps: { dateFormat: 'friendly' } },
    { field: 'target', header: 'Target', fieldType: 'date', fieldProps: { dateFormat: 'friendly' } },
    { field: 'votes', header: 'Votes', fieldType: 'number', fieldProps: { format: 'integer', summary: 'sum' } },
  ]

  let views = $state<FieldView[]>([{ id: 'all', name: 'All features', type: 'grid' }])
</script>

<SvBase data={rows} {columns} bind:views primaryField="feature"
  editable sortable showRowNumbers expandRows summary containerHeight={640}
  rowAdder={{ label: 'Add feature', defaults: () => ({ id: Date.now(), status: 'Planned', quarter: 'Later', teams: [] }) }} />
```

The view bar over the grid has "All features" on the left, then Hide
fields, Filter, Group, Sort, Color and a row height button, and "4 records"
with a search button on the right. The footer row shows "Sum 34" under Effort
and "Sum 473" under Votes, because those fields set `fieldProps.summary`.

Every view key that names a field (`stackBy`, `dateField`, a filter
condition's `column`, a chart's `x`) takes the column id. A column without an
`id` uses its `field`, so in this table the two are the same.

## 2. A roadmap grouped by quarter

A view can start with settings. `state` is the grid's own state, the same
object `api.getState()` returns; `color` says how rows are colored.

```ts
const roadmap: FieldView = {
  id: 'roadmap',
  name: 'Roadmap by quarter',
  type: 'grid',
  color: { mode: 'field', field: 'status' },
  rowHeight: 56,
  state: {
    grouping: ['quarter'],
    sorting: [{ id: 'quarter', desc: false }, { id: 'impact', desc: true }],
    hiddenColumns: ['lead'],
  },
}
```

Groups and sorts share the grid's `sorting` list: a grouped field's
direction is an entry ahead of the sorts. The view bar writes them that way,
so write them that way too. Here the bar reads "1 hidden field", "Grouped by
1 field" and "Sorted by 1 field": the `quarter` entry belongs to the group,
not to Sort.

Each group header shows "Quarter" over the option's pill, the number of
records, the summaries the fields picked for that group ("Effort (days) 29",
"Votes 432"), and "+" to add a feature that already has that quarter. Groups
come in the select's option order, not alphabetically. Group rows are at
least 52px tall so the field's name fits over the value; with
`rowHeight: 56` they match the records. Each row has a status color stripe
on its row header. 56 is the row height menu's "Medium": from 48px, text and
select pills wrap.

## 3. A view that starts filtered

The filter is the grid's advanced filter with its own kind, `fieldFilter`.
Put it in `state.advancedFilter`:

```ts
import { describeFieldFilter, type FieldFilter } from '@svgrid/enterprise/base'

const activeWork: FieldFilter = {
  kind: 'fieldFilter',
  conjunction: 'and',
  conditions: [
    { column: 'status', kind: 'select', op: 'isAnyOf', value: ['In progress', 'In beta', 'Blocked'] },
    {
      conjunction: 'or',
      conditions: [
        { column: 'target', kind: 'date', op: 'isWithin', value: { span: 'nextDays', days: 30 } },
        { column: 'impact', kind: 'number', op: 'gte', value: 4 },
      ],
    },
  ],
}

const now: FieldView = {
  id: 'now',
  name: 'Now',
  type: 'grid',
  state: { sorting: [{ id: 'target', desc: false }], advancedFilter: activeWork },
}

const header = (id: string) => columns.find((c) => c.field === id)?.header ?? id
describeFieldFilter(activeWork, header)
// "Status is any of In progress, In beta, Blocked and (Target is within the next 30 days or Impact ≥ 4)"
```

The Filter button reads "Filtered by 3 fields" (one field reads "Filtered by
Status") and the record count drops to what the filter keeps.
`describeFieldFilter` writes a filter in the words the panel uses, for a page
subtitle or an audit line. It returns `"every record"` for a filter with no
complete conditions.

A condition is a field, an operator and a value; a group is one level deep.
[Filters in code](#filters-in-code) below lists the operators per kind.

One view can serve every lead. `ME` (the string `'@me'`) in a person
condition stands for whoever `setCurrentUser` names when the filter runs; the
Filter panel lists it as "Me", first among the people.

```ts
import { ME, setCurrentUser } from '@svgrid/enterprise/base'

setCurrentUser({ id: 'u2', name: 'Ben Okafor' })

const mine: FieldView = {
  id: 'mine',
  name: 'My features',
  type: 'grid',
  state: {
    advancedFilter: {
      kind: 'fieldFilter',
      conjunction: 'and',
      conditions: [{ column: 'lead', kind: 'select', op: 'is', value: ME }],
    },
  },
}
```

Ben sees "Single sign-on with SAML"; Ana, signed in, sees her two. With
nobody signed in the condition matches no one. `describeFieldFilter` writes
it as "Lead is me".

## 4. A status board

```ts
const board: FieldView = { id: 'board', name: 'Status board', type: 'kanban', stackBy: 'status' }
```

![The roadmap's Status board: Planned, In progress, In beta and Shipped lanes of feature cards showing Quarter, Teams and Lead, with the right-click menu open on "Single sign-on with SAML": Expand record, Comment, Move to, Duplicate record, Delete record.](/docs-media/base-views.png)

`stackBy` takes a single select or a user field that holds one person. You
get one lane per option, in option order and color, plus "Uncategorized",
which shows only while a record has no status. Stack by `lead` instead and
the lanes are the people from `setFieldUsers`.

Drop a card in another lane and the status changes through the grid's edit
path, so undo, validation and `onCellValueChange` all see it. "+ Add a card"
adds a record already in that lane, named by the primary field.

A card shows the record's name, then the next three fields the view shows,
in column order (the stacked field left out), each drawn as its cell draws
it. Hide a field in Hide fields and it leaves the cards; drag it up there to
put it on them. Cards are read, not edited: a rating shows its stars
but does not take a click. Double-click a card or press F2 to open the
record. Right-click it for its menu: Expand record, Comment, and, when the
base is `editable`, Move to (a submenu of the lanes), Duplicate record and
Delete record, which asks "Delete record?" first. A card with comments shows
their count; click it to open the record at its comment box.

## 5. A timeline

```ts
const timeline: FieldView = {
  id: 'timeline',
  name: 'Timeline',
  type: 'calendar',
  dateField: 'start',
  endField: 'target',
  color: { mode: 'field', field: 'status' },
}
```

Each feature spans its start to its target date. A date field without a time
shows as all-day events. Drag an event to move both dates; drag its edge to
change the target. The calendar's end is exclusive, so the record keeps the
last day: a feature dragged to cover the 19th to the 21st gets
`target: '2026-10-21'`.

With only `dateField`, events move but cannot be resized. Pick a day (or a
range) on the calendar and a new record lands on it, opened with its name
ready to type. Colored by a single select, the events take the option colors
and the options appear above the calendar as a legend that hides and shows
them.

Moving and resizing need `editable` on the base. Without it the calendar is
read-only.

## 6. Effort by team

```ts
const effort: FieldView = { id: 'effort', name: 'Effort by team', type: 'chart', chart: { kind: 'barH', x: 'teams', y: 'effort' } }
const mix: FieldView = { id: 'mix', name: 'Features per quarter', type: 'chart', chart: { kind: 'donut', x: 'quarter' } }
```

A chart groups the records the view shows by `x` and adds up `y` (or counts
records when there is no `y`). `aggregation: 'avg'` averages instead of
summing. Kinds are `'bar'`, `'barH'`, `'line'`, `'pie'` and `'donut'`.

How `x` groups:

- A single or multiple select keeps its options' order and colors. A
  multiple select counts a record in each of its options, so "Audit log
  export" adds 5 days to both Platform and Web.
- A person or a linked record shows by name.
- A date groups by month ("Oct 2026").
- Records with no value go in an "Empty" bar, last.

Values read as the summed field writes them, and a count as a whole number.
The series is labeled "Sum of Effort (days)", "Average of ..." or "Records".
The bar shows Filter, which narrows what is charted, and "Customize chart",
whose Type, Group by, Value and Combine (sum or average) are kept in `chart`.
A chart view declared without `chart` draws "Choose a field to chart in
Customize chart." until a field is picked there.

## 7. A gallery of mockups

Add an attachment field, then a gallery view with it as the cover:

```ts
const mockupField = { field: 'mockups', header: 'Mockups', fieldType: 'attachment' }
const gallery: FieldView = { id: 'mockups', name: 'Mockups', type: 'gallery', coverField: 'mockups' }
```

Each card shows the first image of `mockups`, the primary field as its title,
then the fields the grid shows, each drawn as its cell draws it. Hide a field
in this view and it leaves the cards; drag fields in Hide fields to reorder
them. A click on a card opens the record. Without `coverField` the cards have
no cover.

## 8. A request form

```ts
const request: FieldView = {
  id: 'request',
  name: 'Request a feature',
  type: 'form',
  formFields: ['feature', 'teams', 'impact'],
  formRequired: ['feature'],
  formTitle: 'Request a feature',
  formDescription: 'What should we build, and who is it for? Product reviews requests every Friday.',
  formSubmitLabel: 'Send request',
}
```

The form asks for the fields in `formFields` (column ids, in order), each with
the editor its cell uses. Without it, the form asks for every field a person
can fill in, the primary field first; computed fields are left out. A field
in `formRequired` must be filled before the form sends. `formTitle` defaults
to the view's name, `formSubmitLabel` to "Submit". A sent form adds a record
the way "+ Add row" does: `rowAdder.defaults` first, so a request starts as
Planned in Later, then what was typed, then `onRowAdd`. The bar shows only
the view switcher on a form.

All the views so far, in one list:

```ts
let views = $state<FieldView[]>([roadmap, board, timeline, effort, now, mine, gallery, request])
```

## 9. A dashboard

```ts
const OPEN: FieldFilter = { kind: 'fieldFilter', conjunction: 'and', conditions: [{ column: 'status', kind: 'select', op: 'isNot', value: 'Shipped' }] }
const SHIPPED: FieldFilter = { kind: 'fieldFilter', conjunction: 'and', conditions: [{ column: 'status', kind: 'select', op: 'is', value: 'Shipped' }] }

const overview: FieldView = {
  id: 'overview',
  name: 'Overview',
  type: 'dashboard',
  dashboard: [
    { id: 'open', kind: 'number', title: 'Open features', filter: OPEN },
    { id: 'days', kind: 'number', title: 'Days of work left', aggregation: 'sum', field: 'effort', filter: OPEN, caption: 'Team capacity 40 days' },
    { id: 'shipped', kind: 'progress', title: 'Shipped', filter: SHIPPED },
    { id: 'status', kind: 'chart', chart: { kind: 'bar', x: 'status' } },
    { id: 'wanted', kind: 'list', title: 'Most wanted', sortBy: 'votes', sortDesc: true, limit: 3 },
  ],
}
```

A dashboard is a grid of tiles. Each tile reads the records of one table,
keeps the ones its `filter` matches (the same `FieldFilter` as a view's
filter), and shows one of four things:

- **`'number'`** counts the records, or with `aggregation: 'sum' | 'avg' |
  'min' | 'max'` and a number `field`, adds them up. The number is written the
  way the field writes it, so a currency field shows "$42,000". Here "Open
  features" reads 3 and "Days of work left" reads 30. `caption` is a line
  under the number.
- **`'chart'`** takes a chart view's `chart` setting (`kind`, `x`, `y`,
  `aggregation`) and groups the tile's records the same way.
- **`'list'`** shows the first `limit` records (5 by default) sorted by
  `sortBy`, with that field's value beside each name ("Single sign-on with
  SAML 182"); `detail` shows another field instead. A click opens the record.
- **`'progress'`** shows how many of all the table's records match the filter:
  "25%, 1 of 4 records" for Shipped.

`size` is `'1x1'`, `'2x1'` or `'2x2'` (columns by rows). A number or progress
tile is `'1x1'` by default, a chart or list `'2x2'`. Below about 450px the
tiles stack in one column. A tile without `title` is named after what it
shows ("Total Effort (days)", "Status is Shipped").

With several tables (`<SvBase bind:tables>`), a tile's `table` names any
table of the base, so a dashboard on Deals can count Accounts and list the
Activities due this week. A tile without `table` reads the table the view is
on. Its filter and fields are that table's.

A number or progress tile is a button: a click, or Enter, lists the records
it counts ("Open the 3 records") in a dialog, each with its name and a few
of its fields. On a chart, a click on a bar or a slice lists the records in
it: the records the tile's filter keeps that fall in that bucket. A click on a record in the dialog opens it, in its
own table's tab when the tile reads another table. While the dashboard is
being edited, the tiles open nothing.

"Edit dashboard" at the top of the view adds a tile, and on each tile sets its
size, moves it (drag it, or the arrows), edits it in a dialog (kind, table,
value, filter, title, size) or removes it. Every change is saved in the view's
`dashboard` at once and reaches `onViewsChange` and `onTablesChange`. A locked
view has no "Edit dashboard". The view bar shows only the view switcher on a
dashboard.

<div data-docs-demo="721-base-dashboard" data-height="680"></div>

## 10. A list for the phone

```ts
const list: FieldView = {
  id: 'list',
  name: 'Feature list',
  type: 'list',
  listFields: ['status', 'teams', 'votes'],
  state: { sorting: [{ id: 'quarter', desc: false }, { id: 'votes', desc: true }], grouping: ['quarter'], hiddenColumns: [], advancedFilter: null },
}
```

A list shows one record per entry: the primary field in bold, and under it
the fields in `listFields` (column ids, in order), each drawn as its cell
draws it, so Status is a colored pill and Teams are tags. An empty value is
left out. Without `listFields` the list shows the next three fields the grid
shows. Long names stay readable at phone width, where a grid would cut them.

The list keeps the view's filter, sorts and groups. Here it is grouped by
Quarter: a header per quarter with the field's name, its value and the
number of records, "Quarter Q4 2026 3", and a click on the header folds the
group. Within each quarter the most voted feature comes first. Grouped by
more fields (`grouping: ['quarter', 'status']`), each quarter holds a header
per status, indented under it, with its own count and its own fold.

A click on a record, or Enter, opens it. The list is one tab stop: Up and
Down move between records and group headers at every level, Home and End
jump, Left and Right fold and unfold a group, and Left on a record or a
folded group moves to the group it is in. A record someone else changed and nobody here
opened yet has a dot before its name.

The view bar has Hide fields, Filter, Group, Sort and "Customize list", which
turns the fields under the name on and off and saves them in `listFields`.

<div data-docs-demo="719-base-list-view" data-height="620"></div>

## 11. An inbox of changes

```ts
const inbox: FieldView = {
  id: 'inbox',
  name: 'Inbox',
  type: 'inbox',
  inboxDateField: 'start',
  listFields: ['status', 'lead'],
}
```

An inbox shows the records on the left and the picked one on the right: its
fields, each one editable in place with the editor its cell uses, and its
latest changes, "Cleo Park changed Status: Planned → In progress". "Expand"
opens the full record with its comments.

The list is newest first by `inboxDateField` (a date field's column id), so
"Audit log export", which starts on January 11, is on top.
Records without a date go last. Without `inboxDateField` the inbox keeps the
view's sort. The view's filter applies either way.

A record someone else changed and nobody here has opened is unread: its name
is bold and it has a dot. The changes come from a table with a `source` that
hears of writes made elsewhere ([Changes made
elsewhere](./data.md#changes-made-elsewhere)). Picking a record marks it read,
as opening it in any view does, and "Mark all read" marks the rest. The count
at the top says "2 unread" or "All read".

Down or j picks the next record and Up or k the previous one; Enter opens the
full record. Narrower than 640px the inbox shows the list, and a picked record
fills it with a Back button (Escape goes back too).

The view bar has Hide fields, Filter, Sort and "Customize inbox": the date
field it lists by and the fields under each name. A field hidden in the view
leaves the record on the right too.

<div data-docs-demo="720-base-inbox-view" data-height="620"></div>

## 12. Keep the views

`onViewsChange` fires with the whole list when a view is created, renamed,
duplicated or deleted, and about 400ms after the shown view's settings stop
changing. Switching views stores the one being left first. Store the list
wherever the app stores things.

In the browser:

```svelte
<script lang="ts">
  import { SvBase, enableBase, type FieldView } from '@svgrid/enterprise/base'

  enableBase()
  const KEY = 'roadmap:views'
  const DEFAULT_VIEWS: FieldView[] = [{ id: 'all', name: 'All features', type: 'grid' }]

  function read<T>(key: string, fallback: T): T {
    try {
      const raw = localStorage.getItem(key)
      return raw ? (JSON.parse(raw) as T) : fallback
    } catch {
      return fallback
    }
  }
  function write(key: string, value: unknown) {
    try {
      localStorage.setItem(key, JSON.stringify(value))
    } catch {
      // Private mode or a full quota: the views still work, unsaved.
    }
  }

  let views = $state<FieldView[]>(read(KEY, DEFAULT_VIEWS))
  let activeView = $state<string>(read(`${KEY}:active`, ''))

  $effect(() => write(`${KEY}:active`, activeView))
</script>

<SvBase data={rows} {columns} primaryField="feature" editable
  bind:views bind:activeView onViewsChange={(v: FieldView[]) => write(KEY, v)} />
```

On a server, decide who owns a list.

- **Per user.** Each person keeps their own list, so one lead's filter does
  not change another's. Seed it from the team's defaults the first time.
- **Shared.** One list per table that everyone reads. Write it only for the
  people you allow; for everyone else, keep their changes in memory or in
  their own list. A shared "My features" view built on `ME` still shows each
  person their own records.

```ts
type Scope = 'me' | 'team'

async function loadViews(scope: Scope): Promise<FieldView[]> {
  const res = await fetch(`/api/tables/features/views?scope=${scope}`)
  return res.ok ? ((await res.json()) as FieldView[]) : DEFAULT_VIEWS
}

function saveViews(scope: Scope, next: FieldView[]) {
  void fetch(`/api/tables/features/views?scope=${scope}`, {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(next),
  })
}
```

```svelte
{#await loadViews('me') then loaded}
  <SvBase data={rows} {columns} primaryField="feature" editable
    views={loaded} onViewsChange={(v: FieldView[]) => saveViews('me', v)} />
{/await}
```

Or mount at once and swap the list in when it arrives. When `views` or
`activeView` changes from outside and the shown view is not the one the grid
has, the bar applies it. It never stores the grid's settings into a view it
has not applied yet.

```svelte
<script lang="ts">
  let views = $state<FieldView[]>(DEFAULT_VIEWS)
  let loaded = false
  loadViews('me').then((v) => {
    views = v
    loaded = true
  })
</script>

<SvBase data={rows} {columns} primaryField="feature" editable
  bind:views onViewsChange={(v: FieldView[]) => loaded && saveViews('me', v)} />
```

The `loaded` check matters: about 400ms after mount the bar stores the
default view's settings, and that save must not replace the list on the
server before the real one is in.

With several tables (`<SvBase bind:tables>`), each table keeps its own
`views`, and `onTablesChange` hands back the whole list of tables, views
included.

## Personal and locked views

Once several people share a table, two more keys on a view matter:

```ts
const views: FieldView[] = [
  // Only Ana sees it, under "My views" in the views menu.
  { id: 'ana-open', name: 'My open tasks', type: 'grid', personal: 'u1', state: { /* ... */ } },
  // Everyone sees it; nobody changes its settings until someone unlocks it.
  { id: 'report', name: 'Leadership report', type: 'grid', locked: true, lockedBy: 'u2', state: { /* ... */ } },
]
```

- **`personal: userId`** lists the view only for that person, read from
  `setCurrentUser`. With nobody signed in every view is listed. "Create" in
  the views menu has a "Personal view: only I see it" box once someone is
  signed in.
- **`locked: true`** keeps the view's filter, sorts, groups, hidden fields,
  colors and row height as saved. Its settings buttons are off, nothing is
  saved into it, and the bar shows "Locked" with who locked it. A sort from a
  column header still works for the moment; the bar then says "Locked, not
  saved" with a Reset. Records stay editable. A locked view cannot be
  deleted, and a copy of it starts unlocked.

The lock button in the views menu locks the view as the grid shows it now,
or unlocks it. `lockViews={false}` on `SvBase` removes it for people who may
not lock views. Both keys come back through `onViewsChange` and
`onTablesChange`, so the app stores a personal view with its owner the same
way as the others.

<div data-docs-demo="710-base-personal-locked-views" data-height="620"></div>

## On a phone

When a table is narrower than 600px (its own width, not the window's), a
grid view shows each record as a card: the primary field, then the next four
fields the view shows, in the view's filter and sort. A tap opens the
record, "+" adds one, and on a phone screen the opened record fills it. The
view bar keeps its icons and the tab bar its tabs. Kanban, calendar, gallery
and form views stay as they are.

`phoneLayout` on `SvBase` moves the breakpoint (`phoneLayout={480}`), turns
the cards on at every width (`true`) or keeps the grid (`false`).

<div data-docs-demo="713-base-phone-layout" data-height="720"></div>

## Search across tables

The view bar's search finds records in the view on screen. The box at the
end of the tab bar searches every table of the base. With the focus in the
base, Ctrl+K puts the cursor in it, and so does "/" outside the grid and any
text box. Neither is taken from the rest of the page.

It reads a field the way its cell shows it: a single select by its option's
label, a person by name, a date as the field writes it, a link by the names
of the records it links to, a formula or lookup by its result. Numbers,
currency, percents, durations, ratings, checkboxes, buttons, rollups and
counts are not searched. Case and accents do not count: "tomas" finds
"Tomás".

Every word of the query has to be in the record, in one field or another.
The results are grouped by table, five records each with "N more in Deals"
under them, each with its name, the field the words were found in and the
words marked. Records rank by:

1. the whole query in one field, before words spread over several;
2. the primary field, before the others;
3. a field that is the query, then one that starts with it, then one with a
   word that starts with it, then one that holds it anywhere.

Tables are listed by their best record. Up and Down move through the list,
Enter or a click shows the record's table and opens the record, and Escape
closes the list, then clears the box. `search={false}` on `SvBase` leaves the
box out. A shared base (`readOnly`) keeps it, over the tables and fields the
share shows.

The same search runs without the box, for a command palette of your own or
on a server:

```ts
import { searchBase } from '@svgrid/enterprise/base'

const groups = searchBase(tables, 'northwind proposal', { limit: 10 })
for (const g of groups) {
  console.log(g.name, g.total)
  for (const hit of g.hits) console.log(hit.rowId, hit.title, `${hit.fieldName}: ${hit.text}`, hit.marks)
}
```

Each hit has the table and record ids, the record's name (`title`), the
field that matched (`field`, `fieldName`, `primary`), its text cut around
the match when it is long, and `marks`, the `[start, end)` spans of the
words in that text. `field: (table, column) => boolean` in the options picks
the fields to search. To open a hit in `SvBase`, show its table
(`bind:activeTable`) and call `openRecord({ api, rowId })` once that table's
grid has called `onApiReady`; the box does this for you.

<div data-docs-demo="718-base-search-all-tables" data-height="620"></div>

## View types and the keys they read

| Type | Keys | View bar buttons |
|---|---|---|
| `'grid'` | `state`, `rowHeight`, `color` | Hide fields, Filter, Group, Sort, Color, Row height |
| `'kanban'` | `stackBy`: a single select, or a user field with one person | Hide fields, Filter, Sort |
| `'calendar'` | `dateField`, `endField` (optional), `color` | Hide fields, Filter, Sort, Color |
| `'gantt'` | `dateField`, `endField`, `progressField`, `dependencyField`, `zoom`, `color` | Hide fields, Filter, Sort, Color, Customize timeline |
| `'gallery'` | `coverField`: an attachment field | Hide fields, Filter, Sort |
| `'chart'` | `chart`: `kind`, `x`, `y`, `aggregation` | Filter, Customize chart |
| `'list'` | `listFields`: the fields under each name | Hide fields, Filter, Group, Sort, Customize list |
| `'inbox'` | `inboxDateField`: a date field, newest first; `listFields` | Hide fields, Filter, Sort, Customize inbox |
| `'form'` | `formFields`, `formRequired`, `formTitle`, `formDescription`, `formSubmitLabel`, `formConditions`, `formPrefill` | none |
| `'dashboard'` | `dashboard`: the tiles, in order | none |
| any type | `personal`, `locked`, `lockedBy` | off while `locked` |

Every type also keeps `state` (filter, sorts, groups, hidden fields, column
order, widths, pinning) and switches with the grid's own state, so a filter
set on the board is still there when you come back to it. The search text is
not part of it. The views menu's "Create" offers each type `SvBase` can show
and greys out one the table cannot: a Kanban needs a single select, a
calendar a date field, a chart a field to group by. A new view starts with no
filter, sorts or groups and every field shown.
`viewTypes={['grid', 'kanban', 'calendar']}` on `SvBase` limits what
"Create" offers.

A Gantt is a calendar with a task table beside the bars. It is offered once
the app has called `enableGanttView()` from `@svgrid/enterprise`. Its bars
take the view's colors, `progressField` is a percent field drawn as each
bar's fill, and `dependencyField` is a link field to the same table naming
what each record waits for, drawn as arrows.

## The view bar, panel by panel

- **Views menu** (the view's name): switch, rename, duplicate ("Roadmap by
  quarter copy") and delete. The last view cannot be deleted.
- **Hide fields**: a switch per field, a search, hide all and show all, and
  drag to reorder. The primary field is always shown.
- **Filter**: "Where [field] [operator] [value]" rows joined by "and" or
  "or", and condition groups. Each change filters at once. A condition still
  missing its value filters nothing.
- **Group**: up to three fields, each with a direction.
- **Sort**: fields in order, each with a direction labeled for its type ("1
  → 9", "A → Z", "first → last" for a single select). Attachment and button
  fields are not offered.
- **Color**: None, Select field (a single select's option colors) or
  Conditions in order.
- **Row height**: Short 34, Medium 56, Tall 88, Extra tall 128.
  `rowHeights` on `SvBase` or `SvBaseViewBar` sets the list.
- **Search**: in a grid view, the grid's find bar (Ctrl+F) that marks every
  match. In a board, calendar, gallery, list or inbox, a "Find a record" box
  that narrows the records. Switching views clears it.
- **Search all tables**: the box in the tab bar (below).

A button with something set says so and is tinted. With `fieldMenu` on, each
column's menu adds "Filter by this field" and "Group by this field", which
open the bar's panel with the new condition or group in it.

## Filters in code

`filterKindOf(columnDef)` gives the kind a field filters as, and
`operatorsFor(kind)` the operators the panel offers for it, in menu order.
[Filter conditions](../fields.md#filter-conditions) maps each field type to
its kind.

| `kind` | `op` values | `value` |
|---|---|---|
| `'text'`, `'link'` | `contains`, `notContains`, `is`, `isNot` | a string; a link compares the linked records' names |
| `'number'` | `eq`, `neq`, `lt`, `gt`, `lte`, `gte` | a number |
| `'select'` | `is`, `isNot` | one option value, or a person's id (or `ME`) for a user field |
| `'select'` | `isAnyOf`, `isNoneOf` | an array of them |
| `'multi'` | `hasAnyOf`, `hasAllOf`, `isExactly`, `hasNoneOf` | an array of option values or ids |
| `'checkbox'` | `is` | `true` or `false` |
| `'date'` | `is`, `isBefore`, `isAfter`, `isOnOrBefore`, `isOnOrAfter` | `{ mode: 'today' }`, with `mode` also `'tomorrow'`, `'yesterday'`, `'oneWeekAgo'`, `'oneWeekFromNow'`, `'oneMonthAgo'`, `'oneMonthFromNow'`; or `{ mode: 'exactDate', date: '2026-11-01' }` |
| `'date'` | `isWithin` | `{ span: 'pastWeek' }`, with `span` also `'pastMonth'`, `'pastYear'`, `'nextWeek'`, `'nextMonth'`, `'nextYear'`; or `{ span: 'pastDays', days: 14 }`, `{ span: 'nextDays', days: 14 }` |
| `'files'` | `contains` (file name contains) | a string |

Every kind except checkbox also takes `isEmpty` and `isNotEmpty`, with no
value. A few rules from the code:

- An empty number cell is no number: it matches only `neq`.
- Dates compare whole days. A bare `'2026-11-01'` is that day where the user
  is, and "within the past week" runs from 7 days ago to today.
- A user condition holds the person's id (`'u2'`), not the name, or `ME`
  for whoever is signed in.
- A link condition sets `table` to the linked table's id, so it can match
  records by name.

Set a filter on the shown view with `api.setAdvancedFilter(filter)`; the
view keeps it like one set in the panel.

## Row colors: by field or by conditions

```ts
import type { ColorSetting } from '@svgrid/enterprise/base'

const byStatus: ColorSetting = { mode: 'field', field: 'status' }
const byRisk: ColorSetting = {
  mode: 'conditions',
  rules: [
    { color: '#f82b60', condition: { column: 'status', kind: 'select', op: 'is', value: 'Blocked' } },
    { color: '#fcb400', condition: { column: 'target', kind: 'date', op: 'isBefore', value: { mode: 'today' } } },
  ],
}
```

By field, each row takes its option's color, and the row header's title says
the option, so the color is never the only signal. A multiple select colors
by its first value. By conditions, the first rule that matches wins: a
blocked feature is red even when it is also late. A condition is tested as
the filter tests it: on the value the cell shows, so a formula, lookup,
rollup or count field works, and a condition still missing its value colors
nothing. A calendar colors its events by a single select only; a Gantt's bars
take either kind.

The color is a 3px stripe on the row header, unless the `rowColor` prop on
`SvBase` sets a `target` (`'bar'` or `'row'`): a view's colors use it too. A
view without `color` shows the `rowColor` prop's colors until someone picks
colors for it in Color. `{ mode: 'none' }` turns the colors off in that view.

## Summaries in the footer and in group headers

With `summary` on, a click on a field's footer cell picks its summary: sum,
average, median, min, max or range for numbers; checked, unchecked or percent
checked for a checkbox; earliest, latest or the date range in days for dates;
empty, filled, unique, percent empty or percent filled for any field. The
result is written as the field writes values. The choice is stored in the
field's `fieldProps.summary` and reported through `onColumnChange`; see
[Summaries at the bottom](../fields.md#summaries-at-the-bottom).

Group headers show the same summaries over that group's records. Both leave
out records the filter hides, even in a collapsed group.

## The view bar over your own grid

`SvBaseViewBar` is the bar alone, for a page that lays out its own
`<SvGrid>`:

```svelte
<script lang="ts">
  import { SvGrid } from '@svgrid/grid'
  import { SvBaseViewBar, enableBase, type FieldView } from '@svgrid/enterprise/base'

  enableBase()
  // Raw: the bar finds its grid by the api object itself, and a proxy is another object.
  let api = $state.raw<any>(null)
  let views = $state<FieldView[]>([
    { id: 'all', name: 'All features', type: 'grid' },
    { id: 'board', name: 'Status board', type: 'kanban', stackBy: 'status' },
  ])
  let activeView = $state('all')
</script>

{#if api}
  <SvBaseViewBar {api} bind:views bind:activeView
    rowHeights={[{ label: 'Compact', height: 32 }, { label: 'Roomy', height: 64 }]} />
{/if}
<SvGrid data={rows} {columns} primaryField="feature" editable containerHeight={600}
  onApiReady={(a) => (api = a)} />
```

Its "Create" offers grid, Kanban and calendar (and Gantt once enabled). It
loads the board, calendar and gallery renderers the first time a view of
that type is shown, and opens the record and the "Delete record?" question
for a card's menu. Chart and form views are drawn by `SvBase`, not by the
bar, so leave them out of `viewTypes` here, or draw `SvBaseForm` yourself
when a form view is active.

## Pitfalls

- **A new view from "Create" starts with `color: { mode: 'none' }`**, so it
  hides the `rowColor` prop's colors. A new calendar or Gantt is the
  exception: it starts colored by the first single select. Pick colors in
  Color, or declare the view in code without `color`.
- **`color.field` is the data field; the other keys are column ids.** They
  differ only when a column sets an `id`.
- **Summaries belong to the field, not the view.** Picking "Average" in one
  view changes every view's footer and group headers.
- **Save views only after they load.** See the `loaded` check in step 12.

## Next

- [Linked records](./linked-records.md): link Features to Feedback and chart
  or filter by the linked names.
- [Formulas](./formulas.md): computed fields a view can sort, group and chart
  by.
- [Forms](./forms.md): required fields, the thank-you screen and forms
  outside the base.
- [Collaboration](./collaboration.md): comments, people and who changed what.
- [Automations](./automations.md): conditions written with this same filter.
- [Keep a base in a database](./data.md): load the tables from Postgres,
  Supabase or your API and write every change back.
