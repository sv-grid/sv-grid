---
"@svgrid/enterprise": minor
---

SvGrid Base: the field types, views and records of the fields module, as a
product of the Suite edition, next to the Spreadsheet and Studio.

```ts
import { SvBase, enableBase } from '@svgrid/enterprise/base'
enableBase()
```

- `@svgrid/enterprise/base` is the new entry. It exports everything
  `@svgrid/enterprise/fields` does, plus `enableBase` (the same function as
  `enableFields`). The `fields` entry stays.
- The components: `SvBase` (the bar, the grid and the form), `SvBaseViewBar`
  and `SvBaseForm`.
- Licensing: SvGrid Base is a Suite product. With no key, or with a Grid or
  Indie key, it runs and shows the watermark and a notice naming SvGrid Base.
  It never blocks. `licenseCovers('base')` tells the two editions apart.
- A calendar view colored by a single select colors its events by the
  options and shows them as a legend that hides and shows each one.
- The Kanban view no longer draws an empty "Uncategorized" lane. It appears
  when a record has no value in the stacking field.
- A single select sorts and groups in the order of its options, not
  alphabetically. Its sort is labelled "first → last".
- A group header's record count and summaries leave out the records the
  view's filter hides, and so does the record count in the view bar.
- A formula field that computes a number, currency or percent can show a
  footer summary (sum, average, ...), and one that computes a date can show
  the earliest or latest.
- Kanban lanes take `hideWhenEmpty`: the lane is drawn only while a card is in
  it.
- A calendar view of records with one date (a start or a due date) moves
  events but does not resize them; the scheduler config takes `resizable`.
- Several tables, as tabs: `<SvBase tables>` takes a list of tables (`id`,
  `name`, `data`, `columns`, `views`, `primaryField`, `props`) and draws one
  tab each, drawn in the theme's colors (`--sg-muted-bg` for the band, the
  accent on the shown table). A tab renames on double-click; its menu renames, duplicates and
  deletes the table (asking first), "Add table" starts a new one, and the
  list button next to it switches to any table, for when the tabs overflow.
  `onTablesChange` reports the list after every change.
- Relations: every table of a base is a table a link field can point at. A
  link field gets a field in the other table that links back
  (`fieldProps.inverse`), and the two stay in step through edits, deleted
  records, a link pointed at another table, a link turned into another type
  and deleted fields or tables. Deleting a link field with a field back asks
  first and names the lookups and rollups that read it.
- A linked record opened from a chip offers "Open in {table}" when its table
  is a tab of the base (`LinkedTable.open`). `unregisterLinkedTable` forgets a
  table.
- A rollup's sum, average, min or max shows as its source field does
  ($482,000). Lookups and rollups find their linked table when they draw, so
  one filled before the table was registered still shows its values, and a
  linked record shows its computed fields.
- Row colors on the row header are a 3px stripe at the row's start, without
  the tint over the row number.
- A chart view (`type: 'chart'`): the records the view shows, grouped by a
  field and counted, summed or averaged, as a bar, horizontal bar, line, pie
  or donut chart in the option colors. "Customize chart" in the view bar
  changes it; the view keeps it as `chart`.
- A Gantt view showed a table of every field, with raw values, wide enough to
  push the chart out of sight. Its task table now holds the primary field, the
  two dates and the working days, and its bars take the view's colors.
- A Gantt view edits the records: dragging a bar or its edge writes the start
  and end (a date-only field keeps the last day), the links it cascades move
  the records they push, the progress grip writes a percent field in its own
  scale, a link drawn between bars or removed writes a "depends on" link
  field to the same table, a double-click on the chart adds a record on that
  day and opens it, and Delete in a bar's menu removes the record. A click on
  a bar or a task's name opens the record. "Customize timeline" changes the
  start, end, progress and depends-on fields; a Gantt or calendar view has
  Color, and one made from the view switcher starts colored by the first
  single select. The zoom is kept with the view.
- A calendar view was read-only: its events could not be dragged or resized.
  They move and resize now, writing the record's dates (a date-only end keeps
  the event's last day, and a multi-day record spans through it), a click
  opens the record, and the scheduler config takes `onEventOpen(row)` for that.
- A date field with a time was written back as a bare day when a calendar
  event or a bar moved; it keeps its time now.
- Bars, cards and calendar events found their record by row identity, which
  a view handing over a copy of the row broke; they use the record id.
- The Gantt task table shows a cell as its column formats it (a select's
  label, a person's name, a date in the column's format) and a computed
  column's value; it never takes more than 60% of the width. A Gantt config
  takes `colorOf(row)` for a bar's color, `onTaskOpen(row)` to open a task
  where the app keeps it (in place of the drawer), `predecessorField` for
  links listed on the task that waits, `progressValue(row)` for progress
  kept in another scale, and `tableColumnWidths`. The chart fills the pane
  below the last task, the hover card follows a bar after it is dragged, and
  "Add subtask" shows only where `parentField` makes a tree.
