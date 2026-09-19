---
"@svgrid/enterprise": patch
---

A table printed plain.

The table style is drawn over the cells rather than written into them,
which is what lets a row typed under the last one arrive already banded.
The printed page is built from the cells, so it carried none of it: a sheet
that shows a blue header and stripes came out of File > Print as bare text,
while Excel prints a table as a table.

`SheetPrintCell` takes the table's look for that cell now, and the shell
hands it in: the header filled and bold with its readable text colour, the
banded rows tinted, a totals row ruled off. It goes UNDER the cell's own
format, the order the screen draws them in, so a fill written on a cell
still wins. A sheet with no table prints exactly as before.
