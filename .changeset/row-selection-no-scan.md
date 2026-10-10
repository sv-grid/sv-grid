---
"@svgrid/grid": patch
---

A grid with a `rowSelectionModel` no longer scans every row to draw each
row's selected state. The body passes the row it is drawing; the lookup by
id is kept for API callers. Over a server row model's windowed million rows
the scan ran once per drawn row and several times per row, and sorting a
column on the 1M-row server demo held the page for about 17 s; it now takes
under 100 ms.
