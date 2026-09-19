---
'@sv-grid/enterprise': patch
---

A table's formulas now survive the file, in both formats

`=[@Qty]*[@Price]` is the shorthand Excel accepts in the formula bar; what it
stores in the file is the long form, `Orders[[#This Row],[Qty]]`. The writer
was storing the shorthand, and a reader that follows the format refuses it:
every calculated column in a saved workbook came back as an error. The long
form goes out now, and reads back as the formula the sheet works with.

OpenDocument has no structured references at all, so the same formulas were
written into an .ods as bracketed text a reader takes for a broken reference.
They are resolved to the rectangle they name (`SUM(Orders[Amount])` becomes
`SUM([.D2:.D25])`), with the sheet named only when it differs, and a formula
that cannot be resolved leaves its cell holding the value rather than a
formula no reader will take.
