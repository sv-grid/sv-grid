---
"@svgrid/enterprise": minor
---

Excel's `IMAGE(source, [alt])`: a picture IN a cell rather than floating
over one. The difference is the point. A picture object hangs from a cell
and covers what is under it; an `IMAGE` cell is the picture, so it sorts
with its row, filters with it, copies as a formula and moves when the cells
move, with nothing to keep in step. A catalogue with a thumbnail column
wants this one.

The source is a web address or a `data:` URL; anything else stays text
rather than becoming a broken image. The second argument is the alt text,
worked out like any other argument, so a screen reader is told what the
picture is. The function's own value is the source, so a cell that reads it
gets an address rather than a picture it cannot use. The picture prints
with the sheet, and the file stores the formula as `_xlfn.IMAGE`, which is
where Excel keeps it; `NUMBERVALUE` now goes out under its prefix too.
