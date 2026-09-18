---
"@svgrid/enterprise": minor
---

`sheetCellsFromRows(rows, fields, { totals })` turns an array of records
into the cells the spreadsheet shell takes: a header row of labels, a
row per record as the text the engine reads, and a SUM row under every
numeric column when asked. Studio gains a Spreadsheet block that emits
`<SvSheet>` over the screen's rows through it.
