---
"@svgrid/enterprise": minor
---

A report filter on the sheet's PivotTable, Excel's Filters area. A field
placed in Filter narrows the whole pivot to one of its values, and the
filter is written above the block, a line per filter with the field and the
value, so a reader sees what the numbers are of before reading one.

The dialog offers the values that field carries, and typing another value
straight into the cell, or `(All)` to clear it, narrows the pivot at once:
the cell is the control, so a number that did not follow it would be a lie
on the page. The filter applies before anything is grouped, so the totals,
the subtotals and Show Details all see the same rows. `filteredRecords` and
`pivotFieldValues` are exported for a caller that wants the same narrowing
without a sheet.
