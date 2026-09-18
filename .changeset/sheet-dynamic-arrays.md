---
"@svgrid/enterprise": minor
---

Dynamic arrays in the spreadsheet engine. A formula whose answer is a
grid spills it over the cells below and to the right, as Excel's does:
`FILTER`, `UNIQUE`, `SORT`, `SORTBY`, `SEQUENCE`, `TRANSPOSE`,
`TEXTSPLIT`, a bare range, and arithmetic over a range with Excel's
broadcasting (`FILTER(A2:C9, B2:B9>3)`). The workbook keeps the spill
ranges (`spillOf`, `spills`), reads a covered cell from its anchor, shows
`#SPILL!` while something is in the way and `#CALC!` for an empty
answer, and moves spills with an insert or delete. The shell outlines
the spill the active cell is in; the xlsx carries spills as array
formulas with the dynamic-array metadata, both ways. `evaluateSpill`
sits beside `evaluate`, which keeps returning one value.
