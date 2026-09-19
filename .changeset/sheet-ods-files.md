---
'@sv-grid/enterprise': patch
---

OpenDocument: the sheet reads and writes .ods

LibreOffice Calc saves .ods by default and Google Sheets hands one back when
you ask, and the shell could open neither. It can now, both ways. File > Open
takes an .ods beside the .xlsx and the .csv, deciding by the bytes rather than
the file name, and File > Save As ODS writes one; `documentToOds`,
`documentFromOds` and `documentFromFile` are the API behind them, and
`sheet.toOds()` the component's method.

What travels is the document this package keeps: cells with their formulas,
translated both ways between A1 and ODF's own grammar (`=SUM(A1:A3)` here,
`of:=SUM([.A1:.A3])` there), values with their type, so a date stays a date
and money stays money, the number formats, the cell looks, column widths and
row heights, merges, hidden rows and columns, hyperlinks, notes, defined names
and sheet protection. Checked against a real LibreOffice in both directions:
files it wrote, read here, and files written here, opened there.
