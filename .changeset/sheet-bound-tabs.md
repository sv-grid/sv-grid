---
"@svgrid/enterprise": minor
---

A workbook tab can be a bound table rather than a cell grid. Name it in the
new `gridSheets` prop with its fields and its records and it renders as a
`<SvGrid>`, with its own headers, sorting, filtering and inline editing,
inside the same workbook as the cell sheets beside it.

The records are the truth, and after every change they are projected into
the workbook's cells, header row included. That is what makes this more than
an embedded widget: `=SUM(Orders!D2:D99)` on a cell tab reads a bound tab
with no new machinery at all, because the formula engine, the dependency
graph, the file writers and the printer are never told the tab is different.
`VLOOKUP` across one works for the same reason.

The projection goes through the same `setRaw` an ordinary edit uses, which
ignores a write that changes nothing, so editing one field of one record
rewrites one cell and recalculates only what read it.

A bound tab deliberately holds no formulas of its own: its cells are a
rendering of its records, so anything typed into them would be overwritten by
the next projection. A sheet that needs formulas beside the data is a cell
sheet reading the bound one across.
