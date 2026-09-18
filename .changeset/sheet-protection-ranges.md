---
"@svgrid/enterprise": minor
---

Sheet protection gains Excel's two refinements. Review > Protect Sheet
now opens the dialog with its "allow all users of this worksheet to"
list (format cells, format columns and rows, insert and delete columns
and rows, sort, use AutoFilter), and what is ticked stays open while the
sheet is protected. Review > Allow Edit Ranges names blocks, each with a
title, that take an edit on a protected sheet whether their cells are
locked or not. Both ride in `getState()` as `protection` beside the
`protected` flag, move with an insert or delete, and go to and from the
xlsx as `sheetProtection`'s attributes and `protectedRanges`.
