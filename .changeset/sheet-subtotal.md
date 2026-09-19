---
'@sv-grid/enterprise': patch
---

SUBTOTAL, the function an AutoFilter is built on

The shell shipped AutoFilter and tables with a totals row, and `SUBTOTAL` -
what a totals row is written with, and what every .xlsx exported from Excel
with one contains - answered `#NAME?`. It now works: codes 1-11 and 101-111
over `AVERAGE`, `COUNT`, `COUNTA`, `MAX`, `MIN`, `PRODUCT`, `STDEV`, `STDEVP`,
`SUM`, `VAR` and `VARP`, a filtered-out row left out of both and a row hidden
by hand left out of the hundreds, and a nested `SUBTOTAL` skipped so a grand
total counts each row once. `Workbook.setHiddenRows` is the seam that tells
the engine what is folded away; `SvSheet` wires it to its own filter and to
Hide Rows, so a total follows the filter as it does in Excel.
