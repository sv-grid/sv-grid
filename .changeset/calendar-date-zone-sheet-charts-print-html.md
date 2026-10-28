---
"@svgrid/grid": patch
"@svgrid/enterprise": patch
---

Expanding or collapsing one group no longer re-groups every row: the grouping
stage keeps its groups while its input rows, grouping and columns are the
same. On a 100,000-row grid grouped by five columns one expand went from 521
to 98 ms.

A calendar date string ('2026-10-07') in a date column whose `format`
options carry `timeZone: 'UTC'` showed the day before east of UTC: the
string is read as local midnight and was then formatted in UTC. `timeZone`
is now ignored for a bare calendar date, on screen and in exports.

Enterprise: a grouped Excel export found string indexes and written group
rows by scanning arrays, so it grew with the square of its rows (10,000 rows
grouped by five columns: 4.8 s, now 0.45 s; the file is unchanged). A sheet
chart hung from a row the grid had not rendered yet when the sheet measured
its objects was not drawn until the sheet scrolled; rows the grid adds now
re-measure an object that has no box. `print()` and `printGrid()` resolve to
the printable HTML, and `open: false` returns it without the print window
and dialog.
