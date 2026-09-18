---
"@svgrid/enterprise": minor
---

ROW, COLUMN, ADDRESS, OFFSET and INDIRECT in the sheet engine.

OFFSET and INDIRECT produce a reference: on their own they read as the
top-left cell, inside a function they hand over the whole rectangle, so
`=SUM(OFFSET(A1,0,0,A2,1))` adds as many cells as A2 says. Both are
volatile, as RAND, RANDBETWEEN, NOW and TODAY now are: a workbook
recomputes a cell holding one on every write, since the dependency graph
cannot see what text it will point at next. `ROW()` and `COLUMN()` with
no argument read the formula's own cell.
