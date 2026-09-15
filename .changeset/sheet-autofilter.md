---
"@svgrid/enterprise": minor
---

AutoFilter in the spreadsheet shell, in place of the grid's filter row.

Ctrl+Shift+L (Home > Editing > Filter, Data > Filter) puts an arrow on
every header cell of the current region; an arrow drops Excel's menu: Sort
A to Z and Z to A, Clear Filter From the column, Text or Number Filters
(two conditions joined with And or Or), a search box, (Select All) and the
column's values with their counts. The rows that fail fold away as
collapsed rows kept apart from the rows the user hid by hand, so Unhide,
Filter off and the saved document see only those; the arrow turns into a
funnel, the region's row numbers turn blue, the status bar reads "N of M
records found". The rows are worked out again after every change, so a
formula that drops out of a Number Filter folds away and one that comes
back returns. The filter is per sheet, moves with an insert or delete,
rides in `getState()` as `autoFilter` and reports `filter` on `onChange`.
The grid's filter row (`filterMode`) is no longer used by the shell.
`hiddenRowsFor`, `distinctValues`, `withColumnFilter`, `valuesFilter`,
`shiftAutoFilter`, `describeFilter` and the types are exported from
`@svgrid/enterprise/sheet`.

Also: Enter in the formula bar hands the sheet back with the cursor one
row down, as in Excel, so the next keystroke (Ctrl+Z included) goes to the
sheet; `SvFormulaBar`'s `onCommit` gets a third argument, `'enter'` or
`'blur'`.
