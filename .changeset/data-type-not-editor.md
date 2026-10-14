---
"@svgrid/grid": minor
"@svgrid/enterprise": patch
---

A column's data type and its editor are separate settings. `cellDataType`
decides sorting, filter operators, default alignment, histogram buckets and
the date filter picker; `editorType` only picks what edits the cell. A
number column can be typed in a text box, a number input or any editor
registered with `registerCellEditor`, and still sort, filter and align as
numbers:

```ts
{ field: 'amount', cellDataType: 'number', editorType: 'text' }
{ field: 'rating', cellDataType: 'number', editorType: 'stars' }
```

Columns that set only a built-in `editorType` (`number`, `date`,
`datetime`, `checkbox`) keep the type it implied before. `inferColumnTypes`
now also infers the type of a column edited in a text box or a custom
editor, and records it as `cellDataType`. `columnDataType(columnDef)` is
exported, and `api.getColumns()` reports each column's `cellDataType`; the
Enterprise advanced filter builder uses it for its operators.

Registered cell editors get more of what the built-in ones have:

- `typeToEdit` on a registration says which keys typed on a selected cell
  start the editor (`false`, or a function of the key); the context's
  `typed` says the value is that text, not the cell's value.
- `onCommitAndMoveDown(value, up)` commits the way Enter does in the
  built-in editors: then a row down (up with Shift).

`editorFormatString` sets the text format of the date / datetime editor
(date-format tokens such as `'MMMM d, yyyy'`), so an edit shows the date as
the cell does. A grid extension can draw an icon before a column's header
label (`headerIcon`), draw the row-number cell's content (`rowHeader`) and
a footer summary cell's content (`summaryCell`), a group header's content
(`groupRow`), a note after a header label (`headerNote`), the column menu's
sort labels (`sortLabels`) and a column it may not pin or unpin
(`lockColumn`), and something over the table that does not scroll with it
(`overlay`); the `expandRows` and `primaryField` props are typed here and
drawn by the Enterprise fields module. The scheduler config
gains `allDay` (a date field without a time: each record is an all-day
event on its own day; an end given as a day is the event's last day).

Find (Ctrl+F) marks every match while the bar is open, the current one
more strongly (`--sg-find-hit-bg`, `--sg-find-current-bg`), and a cell
matches on what it shows (its `formatter`) as well as on its value, so a
user's name or "$1,800" is found.

The selection bar has a `'deleteRows'` built-in: Delete asks "Delete N
rows?" on the bar, then removes the selected rows and fires the new
`onRowsDelete` with the rows, their ids and the data left. The new
`onRowColorChange` event reports a row-color choice made from a column menu.

A paste goes through the column's `valueParser` with the pasted text as
`rawInput`, as an edit commit does, so a column that formats amounts reads
`$1,200.50` back instead of storing null.
