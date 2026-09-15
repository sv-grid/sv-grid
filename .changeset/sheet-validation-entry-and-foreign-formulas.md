---
"@svgrid/enterprise": minor
---

Spreadsheet shell: what the new spreadsheet demos needed.

- A custom validation rule reads the cell it guards as the text being
  entered (`=A1>B1` on A1 judges the new A1), as Excel does; it read the
  old value. `Workbook.evaluateText` takes an optional cell override for it.
- A bound written as a relative formula moves with the cell: `=A2` as the
  minimum of G2:G17 reads A5 on G5. Absolute references stay put.
- `ISNUMBER`, `ISTEXT`, `ISLOGICAL`, `ISBLANK`, `DAYS` and `DATEDIF` join
  the function library, the Insert Function dialog (a new Information
  group) and the formula bar's hints.
- A block pasted from Excel keeps a formula when every reference falls
  inside the block read as if copied from A1 (a totals column keeps
  totalling) and moves it with the paste; a formula that reaches outside
  the block lands as its value. Excel's HTML says nothing about where a
  block came from, so unshifted formulas pointed at the wrong cells
  anywhere but A1. `anchorForeignFormulas` is exported.
- A document handed to `<SvSheet document>` shows its widths, hidden
  lines, frozen panes and AutoFilter from the first paint; they were
  applied only after a sheet switch or a `setState`.
