---
"@svgrid/enterprise": minor
---

Hyperlinks on the spreadsheet, both of Excel's kinds. Insert > Link, or
Ctrl+K, puts a link ON the cell, with the address, the text to display and
a ScreenTip: the cell keeps what it says and the link is kept beside it, so
editing the text keeps the link and clearing the cell takes it away.
Insert > Remove takes the links off the selection. The `HYPERLINK` function
puts one in a formula, and a cell holding it is clickable too, its target
whatever the first argument works out to. A target that reads like an
address moves the selection instead of leaving the page, switching sheets
when it has to; anything with a scheme opens in a new tab. A single click
follows and a drag selects, as in Excel. Links are per sheet, ride in
`getState()` as `links`, report `{ kind: 'links' }`, move with an insert or
a delete, and go into the .xlsx as real hyperlinks both ways, an external
one as a relationship and an internal one as a location.
