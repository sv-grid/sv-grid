---
"@svgrid/enterprise": minor
---

Row and column outlining, Excel's Data > Group: group and ungroup the
selection, collapse a section behind the button on its summary line, and the
numbered level buttons at the corner of the bar that show the whole sheet at
one depth. Auto Outline groups the runs between the totals a sheet already
has, and Clear Outline takes the lot away.

Modelled the way the file models it, a level per line rather than a list of
ranges, so `outlineLevel` and `collapsed` round-trip through the .xlsx both
ways and a group follows its rows through an insert or a delete. A row
inserted inside a group joins it, as Excel's does.

A line a collapsed group folds is kept apart from a line the user hid by
hand. Reading one back as the other is the bug this arrangement exists to
prevent: it would leave a row invisible after its group reopened, with no
button left to bring it back.
