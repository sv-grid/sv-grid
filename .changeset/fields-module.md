---
"@svgrid/grid": minor
"@svgrid/enterprise": minor
---

Field types, as a new opt-in Enterprise module: `@svgrid/enterprise/fields`.

```ts
import { enableFields } from '@svgrid/enterprise/fields'
enableFields()
```

- Columns name what they are with `fieldType` and set its options with
  `fieldProps`. 26 types: text, long text (optional rich text), attachment,
  checkbox (icon, color), single and multiple select (options in 40 colors),
  user, date (five formats, 12 / 24 hour, one time zone for everyone),
  phone, email, URL, barcode, button, number, duration, rating (1 to 10,
  icon, color), formula, created time, last modified time (all or chosen
  fields), created by, last modified by, autonumber, link to records,
  lookup, rollup and count.
- Number is one type in four formats: integer, decimal, currency (symbol
  before or after the number) and percent (as a bar, values as fractions or
  0 to 100); with precision, separators, thousands, K / M / B abbreviation,
  negative numbers and a default. `currency` and `percent` field types still
  work and edit as a number in that format.
- One number editor for every format: the plain number with the field's
  decimal character and the symbol or percent sign beside it, and a spinner
  (arrows, or Up / Down) that steps by the field's `step`, ten with Shift.
  It reads the field's own separators, a pasted symbol, `2.5k`, `3M` and
  `(120)`; rounds to the precision; refuses text and, where the field says
  so, negatives, with the reason under the cell. Enter commits and moves
  down. A pasted `$1,200.50` is read the same way.
  Default values fill new rows. `registerFieldType()` adds or replaces a
  type, with the options the field editor shows for it.
- Select cells draw each choice as a pill in its option's color. Editing
  opens a panel over the cell: the chosen pills with remove buttons, a
  search box and the options; a typed value that is not an option is
  offered as "Add option", added to the field and picked. A multiple select
  stays open to pick more, and Backspace removes the last choice.
- Rating cells and the rating editor show what a click would set as the
  pointer moves over the icons.
- Duration edits as `2:00` (typed `1:30` or `1h 30m`, a minute a step);
  a date edits in the field's own format, and a date without time is
  stored as the calendar date. A lookup shows each value as its source
  field would when the linked table gives the field's `fieldType`.
- Field headers show the type's icon; a field left unnamed is named after
  its type.
- Long text edits in a panel over the cell: Enter for a new line,
  Ctrl+Enter to save, Escape to cancel, the markup named when rich text is
  on.
- A field added from the "+" header, Insert or Duplicate is scrolled into
  view.
- `setFieldUsers()` and `setCurrentUser()` give user, created-by and
  modified-by fields their people; `registerLinkedTable()` gives link,
  lookup, rollup and count fields the rows of another table.
- Formulas use `{Field name}` references and functions such as IF, ROUND,
  CONCATENATE and DATETIME_DIFF; they are parsed into functions, never
  evaluated as code.
- Attachment fields hold several files: thumbnails and file chips in the
  cell, a dialog to add (picker, drop, paste, URL), remove, reorder and
  preview, uploads through `setAttachmentUploader()` or `fieldProps.upload`
  with progress, abort and retry.
- `rowAdder`: "+ Add row" under the last row; appends a row with the field
  defaults, starts editing it, fires `onRowAdd`.
- `expandRows`: on hover the row number turns into a checkbox (select
  the row) and an expand button that opens the row as a record, every field
  with its name and type icon, each edited with the cell's own editor and
  written through the grid's edit path; arrows step through the rows.
- The grid's `pinSplitter` stops at the primary field, which stays pinned.
- Taller rows (`rowHeight` 48 and up) use the height: text wraps to the
  lines that fit, pills wrap, thumbnails grow.
- With `summary` on, each field picks its footer summary (sum, average,
  median, min, max, range; checked; earliest, latest; empty, filled,
  unique and percentages), written in the field's format and kept in
  `fieldProps.summary`.
- A single select's column menu (`fieldMenu`) can color the rows by it
  ("Color rows by this field" / "Stop coloring rows"), reported through
  `onRowColorChange`.
- The selection bar's Edit fields uses each field's control (pickers,
  multiple select, stars, date picker, typed numbers read by the field's
  parser) and leaves out files, links and computed fields.
- `rowColor`: a status color on each row's header (or a bar, or the row), by
  a select field's option colors or by rules; computed for rendered rows only.
- `columnAdder`: a "+" after the last column that opens the field editor
  (name, type, every option of the type). `fieldMenu`: Edit field, Insert
  left / right, Duplicate, Hide and Delete in the column menu. A type change
  converts the values and says first how many cells would be cleared. Every
  change fires `onColumnAdd` / `onColumnChange` / `onColumnRemove` with the
  whole column list, so the app owns the schema.
- Views: `SvBase` is a grid with a view bar over it and saved views
  (grid, Kanban, calendar, Gantt once enabled, gallery, form); each view
  keeps its sorts, groups, filter, hidden fields, row height and colors,
  and `onViewsChange` reports the list. Kanban cards draw fields as their cells
  do, and "+ Add a card" adds a record in that lane. A card opens its record
  (double-click, F2); a day picked on the calendar adds a record on it. A
  gallery view is the grid's `gallery` mode set up from the view.
  `SvBaseViewBar` and `SvBaseForm` work on their own with the grid's api.
- The view bar keeps its labels to screen readers on a narrow bar (icons
  only) and moves focus into a panel when it opens, and back after.
- The view bar: Hide fields (switches, search, drag to reorder), Filter
  (conditions per field type: has any of, is within the past week, file
  name contains...; and / or; condition groups), Group, Sort (labels by
  type, "1 → 9", "A → Z"), Color (a select's colors or conditions), Row
  height, the record count and search.
- `primaryField`: the record's name, always first and pinned, never hidden
  or deleted.
- Group headers show the value as its cell draws it, the count, the
  group's summaries and "+" for a record already in the group.
- The expanded record lists hidden fields (read-only) and the record's
  activity: its changes and comments (`setRecordComments` to keep them).
  Space on a cell opens it.
- A link chip opens its record, and previews it on hover; a linked table
  with `create` lets the picker add a record. Files dropped on an
  attachment cell are added. Rows drag (`rowDragManaged`) only while
  nothing sorts or groups them. The column menu filters or groups by a
  field and shows a field's description as an info mark.
- `installEnterprise()` does not load the module; an app that never calls
  `enableFields()` does not ship it.

`@svgrid/grid` gains the types of those props and of `fieldType` /
`fieldProps`, and one seam the module plugs into, `registerGridExtension`:
field cells and the column fill (which sees every column, for fields that
name other fields), header and body end components, row marks, a root
class, column-menu items, and `cellEdited` after an edit, paste, fill,
clear or checkbox toggle. Without a registered extension nothing changes.
Custom cell editors also receive the edited column's definition and row
(`columnDef`, `row` on the editor context).
