---
"@svgrid/grid": patch
---

Pinned columns and the row-number gutter stick with logical insets
(`inset-inline-start` / `inset-inline-end`) rather than `left` and
`right`, so a grid under `dir="rtl"` keeps them at the right edge instead
of scrolling them off. Three accessibility fixes found by an axe audit of
the spreadsheet shell: the row-number corner carries visually hidden text
rather than only an `aria-label`, so it is no longer an empty table
header; the keyboard row-resize separator carries `aria-valuenow` with
the row's height, as a focusable splitter must; and the unlicensed
watermark hangs from the grid's root rather than the `role="grid"` table,
which took a link as a child of a table.
