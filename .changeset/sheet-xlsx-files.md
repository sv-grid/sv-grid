---
"@svgrid/enterprise": minor
---

The whole sheet document as an .xlsx, both ways, and a File tab to use it.

`documentToXlsx(doc)` writes every sheet with formulas as formulas and
their cached values, the formats (number format, font, fill, alignment,
wrap, indent, borders, unlocked cells), column widths, row heights, hidden
rows, columns and sheets, frozen panes, merges, the AutoFilter region,
data validation with alert and input message, conditional formatting,
sheet protection, comments, defined names and the active sheet.
`documentFromXlsx(file)` reads the same back, plus what Excel writes that
the writer does not (shared strings and formulas, built-in formats by id,
the `_xlfn.` prefix). Text dates go out as serials under a date format and
come back as text. `documentToXlsxParts` / `documentFromXlsxParts` are the
pure halves; the zip goes through the `jszip` peer.

The ribbon's File tab has New, Open (Ctrl+O), Save As (Ctrl+S) and Export
CSV, each raised for the host first; the shell's `open(file)`, `toXlsx()`,
`toCsv()` and `newWorkbook()` do the work for a host that keeps its
workbooks elsewhere. `csvText` is the CSV serializer.
