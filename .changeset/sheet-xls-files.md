---
'@sv-grid/enterprise': patch
---

Excel 97-2003: the sheet reads and writes .xls

The shell opened the three modern formats and none of the old one, which is
still what a bank statement, an ERP export or a ten-year-old model arrives
as. It reads and writes it now. File > Open takes an .xls beside the .xlsx,
the .ods and the .csv, deciding by the bytes rather than the file name, and
File > Save As XLS writes one; `documentToXls`, `documentFromXls` and
`documentFromFile` are the API behind them, and `sheet.toXls()` the
component's method. Neither half needs `jszip`: an .xls is not a zip but a
compound file, a small FAT filesystem holding a stream of BIFF records, and
both the container and the records are read and written here.

Formulas travel as formulas, which in this format means RPN tokens rather
than text: `=ROUND(AVERAGE(D2:D3),2)` is four tokens in the file and is walked
back into the formula on the way in, shared formulas and all. A function Excel
97 never had has no token, so such a cell goes out as the value it worked out,
and Excel's own trick for the other direction is read: a workbook saved as an
.xls calls `_xlfn.XLOOKUP` through a defined name, and that name turns back
into the function here. Values, number formats, fonts, colours, fills,
borders, alignment, column widths, row heights, hidden rows, columns and
sheets, merges, frozen panes, sheet protection and defined names travel too.
Charts, pictures, pivots, validation, conditional formatting and comments do
not: save as .xlsx or .ods for those. Excel's function numbering is checked
against a real spreadsheet rather than trusted, both ways, for every function
in the table.
