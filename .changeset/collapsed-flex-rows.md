---
"@svgrid/grid": patch
---

A collapsed row (a spreadsheet row hidden with Ctrl+9 or folded by a filter)
leaves the layout again with flex rows. The flex row rule outranked
`.sv-grid-row-collapsed { display: none }`, so the row stayed at 0px and its
cells' bottom border still drew 1px into the row below.
