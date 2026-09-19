---
'@sv-grid/enterprise': patch
---

File > Open reads a CSV, not only an .xlsx

The shell could write a CSV and not read one, though a CSV is what every
spreadsheet offers when you ask it for a file anything can open. Open now
takes one: the kind is decided by the bytes rather than the name, the
separator is guessed (a comma, a semicolon from a European Excel, a tab), a
quoted field keeps its commas, quotes and line breaks, the BOM Excel writes is
not part of the first field, and a field that reads as a percentage, a
currency amount or a grouped number lands as that number with the format it
implies. A field is never read as a formula, as it is not in Excel.
`csvRows`, `guessCsvSeparator` and `sheetStateFromCsv` are exported for a host
that imports its own way.
