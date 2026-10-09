---
"@svgrid/grid": patch
---

Horizontal scrolling in a grid with row numbers is smoother. The rule that
fuses the row-number gutter with a detail-toggle column used a sibling
`:has()` (`.sv-grid-row-number-cell:has(+ .sv-grid-detail-toggle-cell)`),
and a sibling `:has()` makes Chrome restyle every cell of a row whenever a
cell is added to or taken out of it. Each move of the column window during
a horizontal scroll restyled about 1,500 elements in 8 ms; it now restyles
the ~400 that moved, in about 3.5 ms, and the longest frame of a horizontal
wheel scroll on the 100k-row x 100-column demo dropped from 25 ms to 17 ms.
The table carries `sv-grid-numbers-beside-toggle` instead when the toggle
column sits directly after the row numbers; the look is unchanged.
