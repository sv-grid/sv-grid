---
"@svgrid/enterprise": minor
---

Format as Table, and the structured references that go with it. The parser
has always read `Orders[Amount]` and `[@Qty]`; nothing registered a table,
so they never resolved in the shell. Now a `Workbook` holds its own
registry on `workbook.tables`, hands it to every formula it evaluates, and
moves each table with an insert or a delete.

Insert > Table, or Ctrl+T, opens Excel's Create Table dialog on the
selection: the range, the name its columns will be read by, whether the
first row is the header, and a totals row. The table draws Excel's banded
look rather than writing formats into the cells, so a row that joins it is
banded without anything being written, and the filter arrows come with it.
Insert > To Range takes the table away and leaves the cells.

Auto-expand works as Excel's does: a row typed under the last one joins the
table, and every column whose cell above holds a formula is filled down
into it with its references translated. Editing a cell inside a table now
recomputes the formulas that read it, because the dependency graph records
the cells behind a structured reference rather than nothing. A table rides
in `getState()` with the workbook and goes into the .xlsx as a real table
part, both ways.

`extras` is no longer needed for Insert > Table: the shell answers it, and
Insert > Chart, itself. The prop stays and is ignored.
